import type { StorageUsage } from "@/types/storage";

/**
 * Storage quota calculation and verification utilities.
 */

/** Calculate storage usage metrics */
export function calculateUsage(
  usedBytes: number,
  quotaBytes: number
): StorageUsage {
  return {
    usedBytes,
    quotaBytes,
    percentUsed: quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
  };
}

/** Check if a file upload would exceed the user's quota */
export function wouldExceedQuota(
  currentUsedBytes: number,
  quotaBytes: number,
  fileSizeBytes: number
): boolean {
  return currentUsedBytes + fileSizeBytes > quotaBytes;
}

/** Format bytes into a human-readable string */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
