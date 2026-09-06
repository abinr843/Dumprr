/**
 * Utilities and constants for file preview capabilities.
 */

export const PREVIEWABLE_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "txt",
]);

export const INLINE_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
};

/**
 * Checks if a file extension supports direct browser preview.
 */
export function isExtensionPreviewable(ext?: string | null): boolean {
  if (!ext) return false;
  const clean = ext.toLowerCase().replace(/^\./, "");
  return PREVIEWABLE_EXTENSIONS.has(clean);
}

/**
 * Returns canonical MIME type for previewable files.
 */
export function getPreviewMimeType(ext?: string | null): string | undefined {
  if (!ext) return undefined;
  const clean = ext.toLowerCase().replace(/^\./, "");
  return INLINE_MIME_TYPES[clean];
}
