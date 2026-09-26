import { randomUUID } from "node:crypto";

/**
 * Maximum permitted file size: 70 Megabytes
 * 70 * 1024 * 1024 = 73,400,320 bytes
 */
export const MAX_FILE_SIZE_BYTES = 70 * 1024 * 1024; // 73,400,320 bytes

/**
 * Whitelist of allowed file extensions (lowercase, without leading dot)
 */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "txt",
  "csv",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number] | (string & {});

/**
 * Canonical MIME types mapped to allowed extensions
 */
export const EXTENSION_MIME_MAP: Record<string, string[]> = {
  // Documents
  pdf: ["application/pdf"],
  doc: ["application/msword", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/octet-stream",
  ],
  ppt: ["application/vnd.ms-powerpoint", "application/octet-stream"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/octet-stream",
  ],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
  ],
  txt: ["text/plain"],
  csv: [
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
  ],
  // Images
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  svg: ["image/svg+xml"],
  // Web & Code
  html: ["text/html", "application/xhtml+xml"],
  htm: ["text/html"],
  json: ["application/json", "text/plain"],
  xml: ["application/xml", "text/xml"],
  md: ["text/markdown", "text/plain"],
  css: ["text/css"],
  js: ["text/javascript", "application/javascript"],
  ts: ["text/typescript", "text/plain"],
  // Archives
  zip: ["application/zip", "application/x-zip-compressed"],
  // Audio & Video
  mp3: ["audio/mpeg"],
  mp4: ["video/mp4"],
  wav: ["audio/wav"],
};

/**
 * Known binary magic byte signatures for security validation
 */
const MAGIC_SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  gif87a: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
  gif89a: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  zip: [0x50, 0x4b, 0x03, 0x04], // PK.. (used by docx, xlsx, pptx)
  cfbf: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // Compound File Binary Format (doc, xls, ppt)
  // Dangerous binary executable signatures disguised as documents
  peExe: [0x4d, 0x5a], // MZ (Windows PE Executable)
  elf: [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux executable)
  macho32: [0xfe, 0xed, 0xfa, 0xce],
  macho64: [0xfe, 0xed, 0xfa, 0xcf],
  machoFat: [0xca, 0xfe, 0xba, 0xbe],
};

export type SecurityRejectionReason =
  | "SIZE_LIMIT_EXCEEDED"
  | "DISALLOWED_EXTENSION"
  | "DISALLOWED_MIME_TYPE"
  | "DISGUISED_EXECUTABLE"
  | "MAGIC_BYTES_MISMATCH"
  | "INVALID_TEXT_ENCODING"
  | "MALFORMED_FILENAME"
  | "EMPTY_FILE";

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  securityReason?: SecurityRejectionReason;
  originalName: string;
  sanitizedName: string;
  extension: AllowedExtension | null;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
}

/**
 * Options for dynamic validation overrides.
 * When provided, these override the hardcoded defaults.
 */
export interface ValidationOptions {
  /** Max file size in bytes. Defaults to MAX_FILE_SIZE_BYTES (70 MB). */
  maxSizeBytes?: number;
  /** Allowed extensions list, or "*" for all. Defaults to ALLOWED_EXTENSIONS. */
  allowedExtensions?: readonly string[] | "*";
}

/**
 * Extracts and normalizes the extension from a filename.
 */
export function extractExtension(filename: string): string {
  const parts = filename.trim().split(".");
  if (parts.length <= 1) return "";
  const ext = parts.pop()?.toLowerCase() ?? "";
  return ext;
}

/**
 * Normalizes allowed file extensions from settings or input.
 * Strips leading wildcards, dots, and spaces (e.g., '*html', '*.html', '.html' -> 'html').
 * Returns '*' if all types are allowed.
 */
export function normalizeAllowedExtensions(raw: unknown): string[] | "*" {
  if (!raw) return "*";
  let val = raw;
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {}
  }

  if (Array.isArray(val)) {
    const list = val
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);
    if (list.includes("*") || list.includes("*.*") || list.length === 0) return "*";
    const cleaned = list
      .map((s) => s.replace(/^(\*\.?|\.)+/, ""))
      .filter(Boolean);
    return cleaned.length === 0 ? "*" : cleaned;
  }

  const str = String(val).trim();
  if (str === "*" || str === "*.*" || str === ".*" || str.length === 0) {
    return "*";
  }

  const rawTokens = str
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (rawTokens.includes("*") || rawTokens.includes("*.*") || rawTokens.length === 0) {
    return "*";
  }

  const cleaned = rawTokens
    .map((s) => s.replace(/^(\*\.?|\.)+/, ""))
    .filter(Boolean);

  return cleaned.length === 0 ? "*" : cleaned;
}

/**
 * Sanitizes a filename for display, stripping path traversal, null bytes, and control chars.
 */
export function sanitizeFilename(filename: string): string {
  // Strip null bytes and control chars
  let cleaned = filename.replace(/[\x00-\x1F\x7F]/g, "").trim();
  // Strip path traversal prefixes (e.g. ../ or ..\)
  cleaned = cleaned.replace(/^(\.\.[\/\\])+/, "");
  // Replace invalid filesystem characters: / \ ? * : | " < >
  cleaned = cleaned.replace(/[\\/:*?"<>|]/g, "_");
  // Trim spaces and dots
  cleaned = cleaned.replace(/^\.+/, "").trim();
  return cleaned || "unnamed_file";
}

/**
 * Verifies if a buffer matches a specific magic byte prefix.
 */
function matchesPrefix(buffer: Uint8Array, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Detects whether the file header begins with a known executable or binary signature.
 */
export function isExecutableSignature(buffer: Uint8Array): boolean {
  if (matchesPrefix(buffer, MAGIC_SIGNATURES.peExe)) return true; // MZ
  if (matchesPrefix(buffer, MAGIC_SIGNATURES.elf)) return true; // ELF
  if (matchesPrefix(buffer, MAGIC_SIGNATURES.macho32)) return true;
  if (matchesPrefix(buffer, MAGIC_SIGNATURES.macho64)) return true;
  if (matchesPrefix(buffer, MAGIC_SIGNATURES.machoFat)) return true;
  return false;
}

/**
 * Validates the file buffer header against the expected extension.
 */
export function validateMagicBytes(
  buffer: Uint8Array,
  ext: AllowedExtension
): { valid: boolean; reason?: SecurityRejectionReason } {
  // 1. Immediately reject any file containing executable signatures
  if (isExecutableSignature(buffer)) {
    return { valid: false, reason: "DISGUISED_EXECUTABLE" };
  }

  // 2. Extension-specific magic bytes check
  switch (ext) {
    case "pdf": {
      if (!matchesPrefix(buffer, MAGIC_SIGNATURES.pdf)) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      return { valid: true };
    }

    case "png": {
      if (!matchesPrefix(buffer, MAGIC_SIGNATURES.png)) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      return { valid: true };
    }

    case "jpg":
    case "jpeg": {
      if (!matchesPrefix(buffer, MAGIC_SIGNATURES.jpeg)) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      return { valid: true };
    }

    case "gif": {
      const isGif87 = matchesPrefix(buffer, MAGIC_SIGNATURES.gif87a);
      const isGif89 = matchesPrefix(buffer, MAGIC_SIGNATURES.gif89a);
      if (!isGif87 && !isGif89) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      return { valid: true };
    }

    case "webp": {
      // WEBP: 'RIFF' at byte 0, 'WEBP' at byte 8
      if (buffer.length < 12) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      const isRiff =
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46;
      const isWebp =
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50;
      if (!isRiff || !isWebp) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      return { valid: true };
    }

    case "docx":
    case "xlsx":
    case "pptx": {
      // Modern Office XML formats are ZIP archives
      if (!matchesPrefix(buffer, MAGIC_SIGNATURES.zip)) {
        return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
      }
      return { valid: true };
    }

    case "doc":
    case "xls":
    case "ppt": {
      // Legacy Office documents are OLE / CFBF or text/rtf
      if (matchesPrefix(buffer, MAGIC_SIGNATURES.cfbf)) {
        return { valid: true };
      }
      // Some legacy doc/xls files are plain text or RTF
      // Check if it starts with {\rtf
      const isRtf =
        buffer.length >= 5 &&
        buffer[0] === 0x7b &&
        buffer[1] === 0x5c &&
        buffer[2] === 0x72 &&
        buffer[3] === 0x74 &&
        buffer[4] === 0x66;
      if (isRtf) return { valid: true };
      return { valid: false, reason: "MAGIC_BYTES_MISMATCH" };
    }

    case "txt":
    case "csv": {
      // Text and CSV files should not contain binary null bytes (0x00) in first 1024 bytes
      const inspectLength = Math.min(buffer.length, 1024);
      let nullCount = 0;
      for (let i = 0; i < inspectLength; i++) {
        if (buffer[i] === 0x00) nullCount++;
      }
      // If there are null bytes, this is likely binary data disguised as text
      if (nullCount > 0) {
        return { valid: false, reason: "INVALID_TEXT_ENCODING" };
      }
      return { valid: true };
    }

    default:
      // For any dynamically allowed extensions (HTML, JSON, SVG, ZIP, MD, etc.)
      // or wildcard '*', as long as they pass the executable check above, they are permitted.
      return { valid: true };
  }
}

/**
 * Generates an opaque, collision-free UUID-based storage object path.
 * Format: `<uuid>.<extension>` (e.g. `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.pdf`)
 * Never exposes or stores the user's raw filename in the bucket path.
 */
export function generateStoragePath(extension: string): string {
  const uuid = randomUUID();
  const cleanExt = extension.replace(/^\.+/, "").trim().toLowerCase();
  return cleanExt ? `${uuid}.${cleanExt}` : uuid;
}

/**
 * Comprehensive server-side validator for uploaded files.
 */
export function validateUploadedFile(
  filename: string,
  buffer: Uint8Array,
  declaredMimeType?: string,
  options?: ValidationOptions
): FileValidationResult {
  const effectiveMaxSize = options?.maxSizeBytes ?? MAX_FILE_SIZE_BYTES;
  const rawAllowed = options?.allowedExtensions ?? ALLOWED_EXTENSIONS;
  const effectiveAllowed =
    rawAllowed === "*" ? "*" : normalizeAllowedExtensions(rawAllowed);
  const isWildcard = effectiveAllowed === "*";
  const originalName = filename.trim();
  const sanitizedName = sanitizeFilename(originalName);
  const extStr = extractExtension(sanitizedName);
  const sizeBytes = buffer.length;

  // 1. Check for empty file
  if (sizeBytes === 0) {
    return {
      isValid: false,
      error: "The uploaded file is empty (0 bytes).",
      securityReason: "EMPTY_FILE",
      originalName,
      sanitizedName,
      extension: null,
      mimeType: declaredMimeType || "application/octet-stream",
      sizeBytes: 0,
    };
  }

  // 2. Enforce max file size
  if (sizeBytes > effectiveMaxSize) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    const limitMb = (effectiveMaxSize / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File size (${sizeMb} MB) exceeds maximum permitted limit of ${limitMb} MB.`,
      securityReason: "SIZE_LIMIT_EXCEEDED",
      originalName,
      sanitizedName,
      extension: null,
      mimeType: declaredMimeType || "application/octet-stream",
      sizeBytes,
    };
  }

  // 3. Validate Extension against Whitelist (skip if wildcard '*')
  if (!isWildcard) {
    const allowedList = effectiveAllowed as readonly string[];
    const isAllowedExt = allowedList.includes(extStr);
    if (!isAllowedExt) {
      return {
        isValid: false,
        error: `File extension '.${extStr || "unknown"}' is not permitted. Allowed: ${allowedList.join(", ")}.`,
        securityReason: "DISALLOWED_EXTENSION",
        originalName,
        sanitizedName,
        extension: null,
        mimeType: declaredMimeType || "application/octet-stream",
        sizeBytes,
      };
    }
  }

  const extension = extStr as AllowedExtension;

  // 4. Validate Magic Bytes / Binary Signatures
  const magicCheck = validateMagicBytes(buffer, extension);
  if (!magicCheck.valid) {
    let errorMsg = "File failed integrity and format verification.";
    if (magicCheck.reason === "DISGUISED_EXECUTABLE") {
      errorMsg = "Security violation: Executable or script binary signatures detected.";
    } else if (magicCheck.reason === "MAGIC_BYTES_MISMATCH") {
      errorMsg = `File content signature does not match declared .${extension} format.`;
    } else if (magicCheck.reason === "INVALID_TEXT_ENCODING") {
      errorMsg = "Text file contains binary or invalid characters.";
    }

    return {
      isValid: false,
      error: errorMsg,
      securityReason: magicCheck.reason,
      originalName,
      sanitizedName,
      extension,
      mimeType: declaredMimeType || "application/octet-stream",
      sizeBytes,
    };
  }

  // 5. Determine canonical MIME type safely
  const canonicalMimes = EXTENSION_MIME_MAP[extStr];
  const mimeType =
    declaredMimeType && (canonicalMimes ? canonicalMimes.includes(declaredMimeType) : true)
      ? declaredMimeType
      : canonicalMimes?.[0] || declaredMimeType || "application/octet-stream";

  // 6. Generate UUID Storage Path
  const storagePath = generateStoragePath(extension);

  return {
    isValid: true,
    originalName,
    sanitizedName,
    extension,
    mimeType,
    sizeBytes,
    storagePath,
  };
}
