import { NextRequest, NextResponse } from "next/server";
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
 * DELETE /api/folders/:id/permanent
 * Admin only. Recursively purges folder, all descendant folders,
 * and all contained files from both storage and database.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(
    req,
    `DELETE /api/folders/${id}/permanent`
  );
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const { data: existing, error: fetchErr } = await adminClient
    .from("folders")
    .select("id, name")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Collect all descendant folder IDs
  async function collectAllDescendantIds(
    parentId: string
  ): Promise<string[]> {
    const { data: children } = await adminClient
      .from("folders")
      .select("id")
      .eq("parent_id", parentId);

    if (!children || children.length === 0) return [];

    const ids: string[] = children.map((c: any) => c.id);
    for (const child of children) {
      const grandchildren = await collectAllDescendantIds(child.id);
      ids.push(...grandchildren);
    }
    return ids;
  }

  const descendantFolderIds = await collectAllDescendantIds(id);
  const allFolderIds = [id, ...descendantFolderIds];

  // Find all files in these folders
  const { data: filesToDelete } = await adminClient
    .from("files")
    .select("id, storage_path")
    .in("folder_id", allFolderIds);

  // Remove physical storage objects
  if (filesToDelete && filesToDelete.length > 0) {
    const storagePaths = filesToDelete
      .map((f) => f.storage_path)
      .filter(Boolean);

    if (storagePaths.length > 0) {
      await adminClient.storage.from("dump-files").remove(storagePaths);
    }

    // Delete file rows
    const fileIds = filesToDelete.map((f) => f.id);
    await adminClient.from("files").delete().in("id", fileIds);
  }

  // Delete folder rows (children first is handled by collecting all)
  await adminClient.from("folders").delete().in("id", allFolderIds);

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FOLDER_PERMANENTLY_DELETED,
    target_type: "folder",
    target_id: id,
    target_name: existing.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      foldersDeleted: allFolderIds.length,
      filesDeleted: filesToDelete?.length ?? 0,
    },
  });

  return NextResponse.json({
    message: "Folder and all contents permanently deleted",
    foldersDeleted: allFolderIds.length,
    filesDeleted: filesToDelete?.length ?? 0,
  });
}
