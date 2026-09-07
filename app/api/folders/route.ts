import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { folderCreateSchema } from "@/lib/validation/schema";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/folders
 * Role-aware folder listing.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const url = new URL(req.url);
  const parentId = url.searchParams.get("parent_id");
  const status = url.searchParams.get("status") || "active";

  const adminClient = createAdminClient();

  let query = adminClient.from("folders").select("*");

  if (!userIsAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  } else if (status && status !== "all") {
    query = query.eq("status", status as "active" | "trash" | "deleted");
  }

  // Parent filtering
  if (parentId === "null" || parentId === "" || parentId === undefined || parentId === null) {
    // Root level folders
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", parentId);
  }

  query = query.order("name", { ascending: true });

  const { data: folders, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch folders: ${error.message}` },
      { status: 500 }
    );
  }

  // Batch-enrich with child counts in 2 queries instead of N*2
  const folderIds = (folders || []).map((f) => f.id);
  let childFolderCounts: Record<string, number> = {};
  let childFileCounts: Record<string, number> = {};

  if (folderIds.length > 0) {
    const [childFoldersResult, childFilesResult] = await Promise.all([
      // Count child folders grouped by parent_id
      adminClient
        .from("folders")
        .select("parent_id")
        .in("parent_id", folderIds)
        .eq("status", "active"),
      // Count child files grouped by folder_id
      adminClient
        .from("files")
        .select("folder_id")
        .in("folder_id", folderIds)
        .eq("status", "active"),
    ]);

    // Tally child folder counts
    if (childFoldersResult.data) {
      for (const row of childFoldersResult.data) {
        if (row.parent_id) {
          childFolderCounts[row.parent_id] = (childFolderCounts[row.parent_id] || 0) + 1;
        }
      }
    }

    // Tally child file counts
    if (childFilesResult.data) {
      for (const row of childFilesResult.data) {
        if (row.folder_id) {
          childFileCounts[row.folder_id] = (childFileCounts[row.folder_id] || 0) + 1;
        }
      }
    }
  }

  const enriched = (folders || []).map((folder) => ({
    ...folder,
    childFolderCount: childFolderCounts[folder.id] || 0,
    childFileCount: childFileCounts[folder.id] || 0,
  }));

  return NextResponse.json({ folders: enriched });
}

/**
 * POST /api/folders
 * Admin only. Create a new folder.
 */
export async function POST(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "POST /api/folders");
  if (guard.error) return guard.error;

  const body = await req.json();
  const parsed = folderCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, parent_id, color } = parsed.data;
  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Build path
  let path = `/${name}`;
  if (parent_id) {
    const { data: parentFolder } = await adminClient
      .from("folders")
      .select("path")
      .eq("id", parent_id)
      .eq("status", "active")
      .single();

    if (!parentFolder) {
      return NextResponse.json(
        { error: "Parent folder not found or is not active" },
        { status: 400 }
      );
    }

    path = `${parentFolder.path}/${name}`;
  }

  const { data: folder, error: insertErr } = await adminClient
    .from("folders")
    .insert({
      name,
      parent_id: parent_id || null,
      owner_id: guard.auth.user.id,
      path,
      color: color || "#6366f1",
      status: "active",
    })
    .select()
    .single();

  if (insertErr) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "folder",
      target_name: name,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: insertErr.message },
    });
    return NextResponse.json(
      { error: `Folder creation failed: ${insertErr.message}` },
      { status: 500 }
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FOLDER_CREATED,
    target_type: "folder",
    target_id: folder.id,
    target_name: folder.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { path: folder.path, parentId: parent_id },
  });

  return NextResponse.json({ folder }, { status: 201 });
}
