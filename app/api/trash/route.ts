import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { calculateTrashExpiration } from "@/lib/storage/trash";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { TrashItem } from "@/types/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/trash
 * Admin only. Lists all trashed files and folders with expiration countdowns.
 */
export async function GET(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "GET /api/trash");
  if (guard.error) return guard.error;

  const { ipAddress, userAgent } = getRequestContext(req);
  const adminClient = createAdminClient();

  const [{ data: trashedFiles }, { data: trashedFolders }] = await Promise.all([
    adminClient
      .from("files")
      .select("id, display_name, name, original_name, extension, size_bytes, deleted_at, folder_id")
      .eq("status", "trash")
      .order("deleted_at", { ascending: false }),
    adminClient
      .from("folders")
      .select("id, name, color, deleted_at, path")
      .eq("status", "trash")
      .order("deleted_at", { ascending: false }),
  ]);

  const items: TrashItem[] = [];

  for (const f of trashedFiles || []) {
    const expiration = calculateTrashExpiration(f.deleted_at!);
    items.push({
      id: f.id,
      type: "file",
      name: f.display_name || f.name,
      originalPath: f.original_name,
      sizeBytes: f.size_bytes,
      extension: f.extension,
      deletedAt: f.deleted_at!,
      ...expiration,
    });
  }

  for (const f of trashedFolders || []) {
    const expiration = calculateTrashExpiration(f.deleted_at!);
    items.push({
      id: f.id,
      type: "folder",
      name: f.name,
      originalPath: f.path,
      color: f.color,
      deletedAt: f.deleted_at!,
      ...expiration,
    });
  }

  // Sort by deletion date descending
  items.sort(
    (a, b) =>
      new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );

  return NextResponse.json({ items, total: items.length });
}

/**
 * DELETE /api/trash
 * Admin only. Empty all trash — permanently purge all trashed items.
 */
export async function DELETE(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "DELETE /api/trash (Empty Trash)");
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Get all trashed files to remove storage objects
  const { data: trashedFiles } = await adminClient
    .from("files")
    .select("id, storage_path, display_name, name")
    .eq("status", "trash");

  let filesDeleted = 0;
  let foldersDeleted = 0;

  if (trashedFiles && trashedFiles.length > 0) {
    const storagePaths = trashedFiles
      .map((f) => f.storage_path)
      .filter(Boolean);

    if (storagePaths.length > 0) {
      await adminClient.storage.from("dump-files").remove(storagePaths);
    }

    const fileIds = trashedFiles.map((f) => f.id);
    await adminClient.from("files").delete().in("id", fileIds);
    filesDeleted = fileIds.length;
  }

  // Delete all trashed folders
  const { data: trashedFolders } = await adminClient
    .from("folders")
    .select("id")
    .eq("status", "trash");

  if (trashedFolders && trashedFolders.length > 0) {
    const folderIds = trashedFolders.map((f) => f.id);
    await adminClient.from("folders").delete().in("id", folderIds);
    foldersDeleted = folderIds.length;
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.TRASH_EMPTIED,
    target_type: "trash",
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      filesDeleted,
      foldersDeleted,
    },
  });

  return NextResponse.json({
    message: "Trash emptied",
    filesDeleted,
    foldersDeleted,
  });
}
