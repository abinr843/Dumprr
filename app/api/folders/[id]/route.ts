import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { folderUpdateSchema } from "@/lib/validation/schema";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole, Database } from "@/types/database.types";
import type { BreadcrumbItem } from "@/types/storage";

type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Build breadcrumb trail from a folder up to the root.
 */
async function buildBreadcrumbs(
  adminClient: any,
  folderId: string
): Promise<BreadcrumbItem[]> {
  const crumbs: BreadcrumbItem[] = [];
  let currentId: string | null = folderId;

  // Walk up the tree (max 20 levels to prevent infinite loops)
  for (let depth = 0; depth < 20 && currentId; depth++) {
    const { data } = await adminClient
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .single();

    const folderRow = data as { id: string; name: string; parent_id: string | null } | null;
    if (!folderRow) break;

    crumbs.unshift({ id: folderRow.id, name: folderRow.name });
    currentId = folderRow.parent_id;
  }

  // Prepend root
  crumbs.unshift({ id: null, name: "Home" });
  return crumbs;
}

/**
 * Check if `targetId` is a descendant of `ancestorId` (cycle detection).
 */
async function isDescendantOf(
  adminClient: any,
  targetId: string,
  ancestorId: string
): Promise<boolean> {
  let currentId: string | null = targetId;

  for (let depth = 0; depth < 50 && currentId; depth++) {
    if (currentId === ancestorId) return true;

    const { data } = await adminClient
      .from("folders")
      .select("parent_id")
      .eq("id", currentId)
      .single();

    const row = data as { parent_id: string | null } | null;
    if (!row) break;
    currentId = row.parent_id;
  }

  return false;
}

/**
 * GET /api/folders/:id
 * Returns folder metadata, breadcrumbs, and child counts.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const adminClient = createAdminClient();
  let query = adminClient.from("folders").select("*").eq("id", id);

  if (!userIsAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  }

  const { data: folder, error } = await query.single();

  if (error || !folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Get breadcrumbs and child counts
  const [breadcrumbs, { count: childFolderCount }, { count: childFileCount }] =
    await Promise.all([
      buildBreadcrumbs(adminClient, id),
      adminClient
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", id)
        .eq("status", "active"),
      adminClient
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("folder_id", id)
        .eq("status", "active"),
    ]);

  return NextResponse.json({
    folder: {
      ...folder,
      breadcrumbs,
      childFolderCount: childFolderCount ?? 0,
      childFileCount: childFileCount ?? 0,
    },
  });
}

/**
 * PATCH /api/folders/:id
 * Admin only. Rename, recolour, toggle favourite, or move (with cycle detection).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(req, `PATCH /api/folders/${id}`);
  if (guard.error) return guard.error;

  const body = await req.json();
  const parsed = folderUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const { data: existing, error: fetchErr } = await adminClient
    .from("folders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const updates: FolderUpdate = {
    updated_at: new Date().toISOString(),
  };
  const auditEvents: { action: string; metadata: Record<string, unknown> }[] =
    [];

  const { name, parent_id, color } = parsed.data;
  const is_favorite = (body as any).is_favorite as boolean | undefined;

  if (name !== undefined && name !== existing.name) {
    updates.name = name;
    auditEvents.push({
      action: AUDIT_ACTIONS.FOLDER_RENAMED,
      metadata: { previousName: existing.name, newName: name },
    });
  }

  if (color !== undefined) {
    updates.color = color;
  }

  if (is_favorite !== undefined) {
    updates.is_favorite = is_favorite;
  }

  if (parent_id !== undefined && parent_id !== existing.parent_id) {
    // Cycle detection: can't move folder into itself or its descendants
    if (parent_id !== null) {
      if (parent_id === id) {
        return NextResponse.json(
          { error: "Cannot move a folder into itself" },
          { status: 400 }
        );
      }

      const isCycle = await isDescendantOf(adminClient, parent_id, id);
      if (isCycle) {
        return NextResponse.json(
          { error: "Cannot move a folder into one of its own descendants" },
          { status: 400 }
        );
      }

      // Verify target parent exists and is active
      const { data: targetParent } = await adminClient
        .from("folders")
        .select("id, path")
        .eq("id", parent_id)
        .eq("status", "active")
        .single();

      if (!targetParent) {
        return NextResponse.json(
          { error: "Target parent folder not found" },
          { status: 400 }
        );
      }
    }

    updates.parent_id = parent_id;
    auditEvents.push({
      action: AUDIT_ACTIONS.FOLDER_MOVED,
      metadata: {
        previousParentId: existing.parent_id,
        newParentId: parent_id,
      },
    });
  }

  // Rebuild path if name or parent changed
  if (updates.name || updates.parent_id !== undefined) {
    const folderName = (updates.name as string) || existing.name;
    if (updates.parent_id === null || (updates.parent_id === undefined && !existing.parent_id)) {
      updates.path = `/${folderName}`;
    } else {
      const pid = (updates.parent_id as string) || existing.parent_id;
      if (pid) {
        const { data: parentFolder } = await adminClient
          .from("folders")
          .select("path")
          .eq("id", pid)
          .single();
        updates.path = parentFolder ? `${parentFolder.path}/${folderName}` : `/${folderName}`;
      }
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ folder: existing, message: "No changes" });
  }

  const { data: updated, error: updateErr } = await adminClient
    .from("folders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json(
      { error: `Update failed: ${updateErr.message}` },
      { status: 500 }
    );
  }

  for (const evt of auditEvents) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: evt.action,
      target_type: "folder",
      target_id: id,
      target_name: updated.name,
      result: "SUCCESS",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: evt.metadata,
    });
  }

  return NextResponse.json({ folder: updated });
}

/**
 * DELETE /api/folders/:id
 * Admin only. Soft-deletes folder and cascades to contained items.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(req, `DELETE /api/folders/${id}`);
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const { data: existing, error: fetchErr } = await adminClient
    .from("folders")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (existing.status === "trash") {
    return NextResponse.json(
      { error: "Folder is already in trash" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // Cascade: collect all descendant folder IDs
  async function collectDescendantIds(parentId: string): Promise<string[]> {
    const { data: children } = await adminClient
      .from("folders")
      .select("id")
      .eq("parent_id", parentId)
      .neq("status", "trash");

    if (!children || children.length === 0) return [];

    const ids: string[] = children.map((c: any) => c.id);
    for (const child of children) {
      const grandchildren = await collectDescendantIds(child.id);
      ids.push(...grandchildren);
    }
    return ids;
  }

  const descendantFolderIds = await collectDescendantIds(id);
  const allFolderIds = [id, ...descendantFolderIds];

  // Soft-delete all folders in the tree
  await adminClient
    .from("folders")
    .update({ status: "trash", deleted_at: now, updated_at: now })
    .in("id", allFolderIds);

  // Soft-delete all files in these folders
  await adminClient
    .from("files")
    .update({ status: "trash", deleted_at: now, updated_at: now })
    .in("folder_id", allFolderIds)
    .eq("status", "active");

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FOLDER_DELETED,
    target_type: "folder",
    target_id: id,
    target_name: existing.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      cascadedFolders: descendantFolderIds.length,
      totalFoldersAffected: allFolderIds.length,
    },
  });

  return NextResponse.json({
    message: "Folder and contents moved to trash",
    foldersAffected: allFolderIds.length,
  });
}
