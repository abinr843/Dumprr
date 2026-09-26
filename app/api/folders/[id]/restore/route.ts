import { NextRequest } from "next/server";
import { ok, notFound, conflict } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/folders/:id/restore
 * Admin only. Restores folder and its cascaded contents from trash.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(
    req,
    `POST /api/folders/${id}/restore`
  );
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const { data: existing, error: fetchErr } = await adminClient
    .from("folders")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return notFound("This folder no longer exists.");
  }

  if (existing.status !== "trash") {
    return conflict("This folder isn't in trash, so there's nothing to restore.");
  }

  const now = new Date().toISOString();

  // Collect all descendant folder IDs that were trashed
  async function collectTrashedDescendantIds(
    parentId: string
  ): Promise<string[]> {
    const { data: children } = await adminClient
      .from("folders")
      .select("id")
      .eq("parent_id", parentId)
      .eq("status", "trash");

    if (!children || children.length === 0) return [];

    const ids: string[] = children.map((c: any) => c.id);
    for (const child of children) {
      const grandchildren = await collectTrashedDescendantIds(child.id);
      ids.push(...grandchildren);
    }
    return ids;
  }

  const descendantFolderIds = await collectTrashedDescendantIds(id);
  const allFolderIds = [id, ...descendantFolderIds];

  // Restore all folders in the tree
  await adminClient
    .from("folders")
    .update({ status: "active", deleted_at: null, updated_at: now })
    .in("id", allFolderIds);

  // Restore all files in these folders that are trashed
  await adminClient
    .from("files")
    .update({ status: "active", deleted_at: null, updated_at: now })
    .in("folder_id", allFolderIds)
    .eq("status", "trash");

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FOLDER_RESTORED,
    target_type: "folder",
    target_id: id,
    target_name: existing.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { restoredFolders: allFolderIds.length },
  });

  return ok({
    message: "Folder and contents restored",
    foldersRestored: allFolderIds.length,
  });
}
