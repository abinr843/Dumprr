/**
 * Trash Lifecycle Utilities
 *
 * Manages 7-day trash retention window calculations
 * and expired-trash cleanup logic.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logFileEvent } from "@/lib/logging/file-audit";
import { AUDIT_ACTIONS } from "@/types/audit";
import { logger } from "@/lib/logging/logger";

const TRASH_RETENTION_DAYS = 7;

/** Result of calculating trash expiration for an item */
export interface TrashExpiration {
  expiresAt: string;
  daysRemaining: number;
  hoursRemaining: number;
  isExpired: boolean;
}

/**
 * Calculates the expiration countdown for a trashed item.
 */
export function calculateTrashExpiration(
  deletedAt: string
): TrashExpiration {
  const deletedDate = new Date(deletedAt);
  const expiresDate = new Date(
    deletedDate.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const now = new Date();
  const msRemaining = expiresDate.getTime() - now.getTime();

  return {
    expiresAt: expiresDate.toISOString(),
    daysRemaining: Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))),
    hoursRemaining: Math.max(0, Math.ceil(msRemaining / (60 * 60 * 1000))),
    isExpired: msRemaining <= 0,
  };
}

/**
 * Cleans up all trash items that have exceeded the retention threshold.
 *
 * 1. Finds all files with `status = 'trash'` and `deleted_at` older than `daysThreshold`.
 * 2. Removes their physical storage objects from the 'dump-files' bucket.
 * 3. Permanently deletes the database rows.
 * 4. Repeats for folders (after files so contained files are cleaned first).
 *
 * @returns Count of items permanently removed.
 */
export async function cleanupExpiredTrash(
  daysThreshold: number = TRASH_RETENTION_DAYS
): Promise<{ filesRemoved: number; foldersRemoved: number }> {
  const adminClient = createAdminClient();
  const cutoffDate = new Date(
    Date.now() - daysThreshold * 24 * 60 * 60 * 1000
  ).toISOString();

  let filesRemoved = 0;
  let foldersRemoved = 0;

  try {
    // 1. Find expired trashed files
    const { data: expiredFiles, error: filesQueryErr } = await adminClient
      .from("files")
      .select("id, storage_path, original_name, size_bytes")
      .eq("status", "trash")
      .lte("deleted_at", cutoffDate);

    if (filesQueryErr) {
      logger.error("Failed to query expired trash files", {
        error: filesQueryErr.message,
      });
    }

    if (expiredFiles && expiredFiles.length > 0) {
      // Remove storage objects in batches
      const storagePaths = expiredFiles
        .map((f) => f.storage_path)
        .filter(Boolean);

      if (storagePaths.length > 0) {
        const { error: removeErr } = await adminClient.storage
          .from("dump-files")
          .remove(storagePaths);

        if (removeErr) {
          logger.error("Failed to remove expired storage objects", {
            error: removeErr.message,
            count: storagePaths.length,
          });
        }
      }

      // Delete database rows
      const fileIds = expiredFiles.map((f) => f.id);
      const { error: deleteErr } = await adminClient
        .from("files")
        .delete()
        .in("id", fileIds);

      if (deleteErr) {
        logger.error("Failed to delete expired file rows", {
          error: deleteErr.message,
        });
      } else {
        filesRemoved = fileIds.length;
      }
    }

    // 2. Find expired trashed folders
    const { data: expiredFolders, error: foldersQueryErr } = await adminClient
      .from("folders")
      .select("id, name")
      .eq("status", "trash")
      .lte("deleted_at", cutoffDate);

    if (foldersQueryErr) {
      logger.error("Failed to query expired trash folders", {
        error: foldersQueryErr.message,
      });
    }

    if (expiredFolders && expiredFolders.length > 0) {
      const folderIds = expiredFolders.map((f) => f.id);
      const { error: deleteErr } = await adminClient
        .from("folders")
        .delete()
        .in("id", folderIds);

      if (deleteErr) {
        logger.error("Failed to delete expired folder rows", {
          error: deleteErr.message,
        });
      } else {
        foldersRemoved = folderIds.length;
      }
    }

    // Audit log the cleanup
    if (filesRemoved > 0 || foldersRemoved > 0) {
      await logFileEvent({
        action: AUDIT_ACTIONS.FILE_PERMANENTLY_DELETED,
        entityType: "file",
        metadata: {
          event: "trash_cleanup",
          filesRemoved,
          foldersRemoved,
          cutoffDate,
        },
      });
    }

    logger.info("Trash cleanup completed", { filesRemoved, foldersRemoved });
  } catch (err) {
    logger.error("Trash cleanup exception", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  return { filesRemoved, foldersRemoved };
}
