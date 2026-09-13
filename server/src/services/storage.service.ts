/**
 * Storage validation service for the Express backend.
 *
 * Ported from lib/storage/file-validation.ts and lib/storage/quotas.ts.
 * Handles file size checks, extension whitelisting, binary magic-byte
 * detection, and storage quota enforcement.
 */

import { createAdminClient } from "../config/supabase.js";
import type { FileValidationResult } from "../types/index.js";

// ─── Constants ──────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 70 * 1024 * 1024; // 70 MB
const TOTAL_STORAGE_CAP_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB

const ALLOWED_EXTENSIONS = new Set([
  // Documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "odt", "ods", "odp", "rtf", "txt", "csv", "md",
  // Images
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff",
  // Archives
  "zip", "rar", "7z", "tar", "gz",
  // Media
  "mp3", "mp4", "wav", "avi", "mov", "mkv", "webm", "ogg", "flac",
  // Code / Data
  "json", "xml", "yaml", "yml", "html", "css", "js", "ts",
]);

// Dangerous binary signatures to block
const DANGEROUS_SIGNATURES: { name: string; bytes: number[] }[] = [
  { name: "Windows PE/EXE", bytes: [0x4d, 0x5a] }, // MZ
  { name: "Linux ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] }, // .ELF
];

// Known safe magic bytes (first bytes of common file types)
const SAFE_SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46] }, // GIF
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (also docx/xlsx/pptx)
];

/**
 * Validates a file for upload. Checks:
 * 1. File size under 70MB
 * 2. Extension is in the whitelist
 * 3. Binary header is not a disguised executable
 */
export function validateFile(
  buffer: Buffer,
  fileName: string,
  sizeBytes: number
): FileValidationResult {
  // Size check
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
      code: "SIZE_LIMIT_EXCEEDED",
    };
  }

  // Extension check
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension ".${ext}" is not allowed`,
      code: "INVALID_EXTENSION",
    };
  }

  // Binary magic-byte check: block disguised executables
  if (buffer.length >= 4) {
    for (const sig of DANGEROUS_SIGNATURES) {
      let match = true;
      for (let i = 0; i < sig.bytes.length && i < buffer.length; i++) {
        if (buffer[i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return {
          valid: false,
          error: `File appears to be a ${sig.name} binary disguised as .${ext}`,
          code: "DISGUISED_EXECUTABLE",
        };
      }
    }
  }

  // Detect MIME from magic bytes
  let detectedMime = "application/octet-stream";
  if (buffer.length >= 4) {
    for (const sig of SAFE_SIGNATURES) {
      let match = true;
      for (let i = 0; i < sig.bytes.length && i < buffer.length; i++) {
        if (buffer[i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        detectedMime = sig.mime;
        break;
      }
    }
  }

  return { valid: true, detectedMime };
}

// ─── Storage Quota ──────────────────────────────────────────────────

export type StorageStatus =
  | "normal"
  | "warning"
  | "critical"
  | "emergency"
  | "blocked";

export interface StorageQuotaResult {
  usedBytes: number;
  capBytes: number;
  percentUsed: number;
  status: StorageStatus;
  canUpload: boolean;
}

/**
 * Computes current storage usage against the 8GB cap.
 */
export async function getStorageQuota(): Promise<StorageQuotaResult> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("get_total_storage_used");
  const usedBytes = typeof data === "number" ? data : 0;

  const percentUsed = (usedBytes / TOTAL_STORAGE_CAP_BYTES) * 100;

  let status: StorageStatus = "normal";
  if (percentUsed >= 100) status = "blocked";
  else if (percentUsed >= 95) status = "emergency";
  else if (percentUsed >= 85) status = "critical";
  else if (percentUsed >= 70) status = "warning";

  return {
    usedBytes,
    capBytes: TOTAL_STORAGE_CAP_BYTES,
    percentUsed: Math.round(percentUsed * 100) / 100,
    status,
    canUpload: status !== "blocked",
  };
}

/**
 * Check if a new file of given size can be uploaded within quota.
 */
export async function canAcceptFile(
  sizeBytes: number
): Promise<{ allowed: boolean; quota: StorageQuotaResult }> {
  const quota = await getStorageQuota();
  if (!quota.canUpload) {
    return { allowed: false, quota };
  }
  if (quota.usedBytes + sizeBytes > TOTAL_STORAGE_CAP_BYTES) {
    return { allowed: false, quota };
  }
  return { allowed: true, quota };
}

export { MAX_FILE_SIZE_BYTES, TOTAL_STORAGE_CAP_BYTES, ALLOWED_EXTENSIONS };
