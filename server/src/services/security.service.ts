/**
 * Security sanitization service for the Express backend.
 *
 * Ported from lib/security/sanitize.ts — provides XSS sanitization,
 * filename cleaning, and HTML escaping.
 */

/**
 * Sanitizes a filename to remove potentially dangerous characters.
 * Preserves extension but strips path traversal and special chars.
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let cleaned = filename.replace(/^.*[\\\/]/, "");

  // Remove null bytes
  cleaned = cleaned.replace(/\0/g, "");

  // Replace dangerous characters with underscores
  cleaned = cleaned.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");

  // Collapse multiple underscores/dots
  cleaned = cleaned.replace(/_{2,}/g, "_");
  cleaned = cleaned.replace(/\.{2,}/g, ".");

  // Trim leading/trailing dots and spaces
  cleaned = cleaned.replace(/^[\s.]+|[\s.]+$/g, "");

  // Fallback if empty
  if (!cleaned || cleaned.length === 0) {
    cleaned = "unnamed_file";
  }

  // Limit length (preserving extension)
  const maxLength = 255;
  if (cleaned.length > maxLength) {
    const ext = cleaned.split(".").pop() || "";
    const nameWithoutExt = cleaned.slice(0, cleaned.length - ext.length - 1);
    cleaned = nameWithoutExt.slice(0, maxLength - ext.length - 1) + "." + ext;
  }

  return cleaned;
}

/**
 * Escapes HTML entities to prevent XSS.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitizes post content by escaping script tags and dangerous patterns.
 * Preserves basic markdown-safe HTML.
 */
export function sanitizePostContent(content: string): string {
  // Remove script tags and event handlers
  let cleaned = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript\s*:/gi, "");

  // Remove data: URIs with script content
  cleaned = cleaned.replace(/data\s*:\s*text\/html/gi, "");

  return cleaned;
}
