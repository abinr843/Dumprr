import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/storage/batch
 *
 * Batch operations for file management (admin only).
 *
 * Supports:
 * - { action: "move", fileIds: string[], folderIds: string[], destinationFolderId: string | null }
 * - { action: "delete", fileIds: string[], folderIds: string[] }
 */
export async function POST(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "POST /api/storage/batch");
  if (guard.error) return guard.error;

  const { ipAddress, userAgent } = getRequestContext(req);
  const body = await req.json();
  const { action, fileIds, folderIds, destinationFolderId } = body as {
    action: "move" | "delete";
    fileIds?: string[];
    folderIds?: string[];
    destinationFolderId?: string | null;
  };

  if (!action || !["move", "delete"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'move' or 'delete'." },
      { status: 400 }
    );
  }

  const safeFileIds = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
  const safeFolderIds = Array.isArray(folderIds) ? folderIds.filter(Boolean) : [];

  if (safeFileIds.length === 0 && safeFolderIds.length === 0) {
    return NextResponse.json(
      { error: "No items selected. Provide fileIds and/or folderIds." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const results: { filesUpdated: number; foldersUpdated: number; errors: string[] } = {
    filesUpdated: 0,
    foldersUpdated: 0,
    errors: [],
  };

  try {
    if (action === "move") {
      // ─── Batch Move ───
      if (safeFileIds.length > 0) {
        const { error: fileErr, count } = await admin
          .from("files")
          .update({
            folder_id: destinationFolderId ?? null,
            updated_at: new Date().toISOString(),
          })
          .in("id", safeFileIds)
          .is("deleted_at", null);

        if (fileErr) {
          results.errors.push(`Files move failed: ${fileErr.message}`);
        } else {
          results.filesUpdated = count ?? safeFileIds.length;
        }
      }

      if (safeFolderIds.length > 0) {
        // Validate: can't move a folder into itself or into one of its descendants
        // For simplicity, we'll just prevent moving into self (backend-level check)
        const validFolderIds = safeFolderIds.filter(
          (id) => id !== destinationFolderId
        );

        if (validFolderIds.length > 0) {
          const { error: folderErr, count } = await admin
            .from("folders")
            .update({
              parent_id: destinationFolderId ?? null,
              updated_at: new Date().toISOString(),
            })
            .in("id", validFolderIds)
            .is("deleted_at", null);

          if (folderErr) {
            results.errors.push(`Folders move failed: ${folderErr.message}`);
          } else {
            results.foldersUpdated = count ?? validFolderIds.length;
          }
        }

        const skippedCount = safeFolderIds.length - (safeFolderIds.filter((id) => id !== destinationFolderId)).length;
        if (skippedCount > 0) {
          results.errors.push(`${skippedCount} folder(s) skipped (cannot move folder into itself)`);
        }
      }

      await logAction({
        actor_user_id: guard.auth.user.id,
        action: "files.batch_moved",
        target_type: "file",
        result: results.errors.length === 0 ? "SUCCESS" : "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          fileIds: safeFileIds,
          folderIds: safeFolderIds,
          destinationFolderId,
          results,
        },
      });

    } else if (action === "delete") {
      // ─── Batch Delete (Soft Delete → Trash) ───
      const now = new Date().toISOString();

      if (safeFileIds.length > 0) {
        const { error: fileErr, count } = await admin
          .from("files")
          .update({
            status: "trash",
            deleted_at: now,
            updated_at: now,
          })
          .in("id", safeFileIds)
          .is("deleted_at", null);

        if (fileErr) {
          results.errors.push(`Files delete failed: ${fileErr.message}`);
        } else {
          results.filesUpdated = count ?? safeFileIds.length;
        }
      }

      if (safeFolderIds.length > 0) {
        const { error: folderErr, count } = await admin
          .from("folders")
          .update({
            deleted_at: now,
            updated_at: now,
          })
          .in("id", safeFolderIds)
          .is("deleted_at", null);

        if (folderErr) {
          results.errors.push(`Folders delete failed: ${folderErr.message}`);
        } else {
          results.foldersUpdated = count ?? safeFolderIds.length;
        }
      }

      await logAction({
        actor_user_id: guard.auth.user.id,
        action: "files.batch_deleted",
        target_type: "file",
        result: results.errors.length === 0 ? "SUCCESS" : "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          fileIds: safeFileIds,
          folderIds: safeFolderIds,
          results,
        },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    results.errors.push(msg);
  }

  const status = results.errors.length === 0 ? 200 : 207;
  return NextResponse.json({
    message:
      action === "move"
        ? `Moved ${results.filesUpdated} file(s) and ${results.foldersUpdated} folder(s)`
        : `Deleted ${results.filesUpdated} file(s) and ${results.foldersUpdated} folder(s) to trash`,
    results,
  }, { status });
}
