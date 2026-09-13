/**
 * Trash retention service for the Express backend.
 *
 * Ported from lib/storage/trash.ts — handles the 7-day retention
 * lifecycle for soft-deleted files, folders, and posts.
 */

import { createAdminClient } from "../config/supabase.js";

const RETENTION_DAYS = 7;

export interface CleanupResult {
  filesRemoved: number;
  foldersRemoved: number;
  postsRemoved: number;
}

/**
 * Calculates the expiration date for a trashed item.
 * Returns the date string when the item should be permanently deleted.
 */
export function getExpirationDate(deletedAt: string): string {
  const date = new Date(deletedAt);
  date.setDate(date.getDate() + RETENTION_DAYS);
  return date.toISOString();
}

/**
 * Calculates remaining days until permanent deletion.
 */
export function getRemainingDays(deletedAt: string): number {
  const expiresAt = new Date(deletedAt);
  expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Purges all items that have been in trash for longer than 7 days.
 * Removes physical storage objects and database rows.
 */
export async function cleanupExpiredTrash(): Promise<CleanupResult> {
  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoff.toISOString();

  let filesRemoved = 0;
  let foldersRemoved = 0;
  let postsRemoved = 0;

  // ─── Clean up expired files ───────────────────────────────────────
  const { data: expiredFiles } = await admin
    .from("files")
    .select("id, storage_path")
    .eq("status", "trash")
    .lt("deleted_at", cutoffISO);

  if (expiredFiles && expiredFiles.length > 0) {
    // Remove physical objects from storage
    const storagePaths = expiredFiles
      .map((f) => f.storage_path)
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await admin.storage.from("dump-files").remove(storagePaths);
    }

    // Delete database rows
    const fileIds = expiredFiles.map((f) => f.id);
    await admin.from("files").delete().in("id", fileIds);
    filesRemoved = fileIds.length;
  }

  // ─── Clean up expired folders ─────────────────────────────────────
  const { data: expiredFolders } = await admin
    .from("folders")
    .select("id")
    .eq("status", "trash")
    .lt("deleted_at", cutoffISO);

  if (expiredFolders && expiredFolders.length > 0) {
    const folderIds = expiredFolders.map((f) => f.id);
    await admin.from("folders").delete().in("id", folderIds);
    foldersRemoved = folderIds.length;
  }

  // ─── Clean up expired posts ───────────────────────────────────────
  const { data: expiredPosts } = await admin
    .from("posts")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoffISO);

  if (expiredPosts && expiredPosts.length > 0) {
    const postIds = expiredPosts.map((p) => p.id);
    await admin.from("posts").delete().in("id", postIds);
    postsRemoved = postIds.length;
  }

  return { filesRemoved, foldersRemoved, postsRemoved };
}

export { RETENTION_DAYS };
