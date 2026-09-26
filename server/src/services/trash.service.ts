/**
 * Trash retention service for the Express backend.
 *
 * Fetches retention_days from system_settings dynamically,
 * falling back to 7 days when the setting is unavailable.
 */

import { createAdminClient } from "../config/supabase.js";

const DEFAULT_RETENTION_DAYS = 7;

// ─── Settings Cache (15s TTL) ───────────────────────────────────────
let retentionCache: { value: number; expiresAt: number } | null = null;

async function getRetentionDays(): Promise<number> {
  const now = Date.now();
  if (retentionCache && retentionCache.expiresAt > now) {
    return retentionCache.value;
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "storage.retention_days")
      .single();
    let val = data?.value;
    if (typeof val === "string") {
      try { val = JSON.parse(val); } catch { /* keep as-is */ }
    }
    const days = typeof val === "number" && val > 0 ? val : DEFAULT_RETENTION_DAYS;
    retentionCache = { value: days, expiresAt: now + 15_000 };
    return days;
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
}

export interface CleanupResult {
  filesRemoved: number;
  foldersRemoved: number;
  postsRemoved: number;
}

/**
 * Calculates the expiration date for a trashed item.
 * Returns the date string when the item should be permanently deleted.
 * @param retentionDays - override; pass undefined to use the default constant (sync-safe).
 */
export function getExpirationDate(deletedAt: string, retentionDays: number = DEFAULT_RETENTION_DAYS): string {
  const date = new Date(deletedAt);
  date.setDate(date.getDate() + retentionDays);
  return date.toISOString();
}

/**
 * Calculates remaining days until permanent deletion.
 * @param retentionDays - override; pass undefined to use the default constant (sync-safe).
 */
export function getRemainingDays(deletedAt: string, retentionDays: number = DEFAULT_RETENTION_DAYS): number {
  const expiresAt = new Date(deletedAt);
  expiresAt.setDate(expiresAt.getDate() + retentionDays);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Purges all items that have been in trash for longer than the configured retention period.
 * Removes physical storage objects and database rows.
 */
export async function cleanupExpiredTrash(): Promise<CleanupResult> {
  const retentionDays = await getRetentionDays();
  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
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

export { DEFAULT_RETENTION_DAYS, getRetentionDays };
