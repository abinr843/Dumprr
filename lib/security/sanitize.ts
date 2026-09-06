/**
 * Stored XSS prevention and input sanitization utilities.
 *
 * These functions prevent stored XSS attacks by sanitizing user-provided
 * content (filenames, post titles, post content, etc.) before storage
 * and/or rendering.
 */

/**
 * Escape HTML special characters to prevent XSS when rendering text.
 *
 * Converts: & < > " ' to their HTML entity equivalents.
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
 * Strip null bytes, control characters (except newline, carriage return, tab),
 * and other non-printable characters from text.
 */
export function sanitizeText(text: string): string {
  // Remove null bytes
  let cleaned = text.replace(/\0/g, "");
  // Remove control characters except \n \r \t
  cleaned = cleaned.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.trim();
}

/**
 * Sanitize a filename for safe storage and display.
 *
 * - Strips path traversal sequences (../ ..\\)
 * - Removes null bytes and control characters
 * - Replaces filesystem-unsafe characters (/ \ : * ? " < > |)
 * - Strips HTML tags
 * - Trims leading dots (hidden files)
 * - Returns "unnamed_file" for empty results
 */
export function sanitizeFilename(name: string): string {
  let cleaned = name;
  // Strip null bytes and control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, "");
  // Strip path traversal
  cleaned = cleaned.replace(/(\.\.[\\/])+/g, "");
  // Strip HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  // Replace filesystem-unsafe characters
  cleaned = cleaned.replace(/[\\/:*?"<>|]/g, "_");
  // Remove leading dots
  cleaned = cleaned.replace(/^\.+/, "");
  const trimmed = cleaned.trim();
  if (!trimmed || /^_+$/.test(trimmed)) {
    return "unnamed_file";
  }
  return trimmed;
}

/**
 * Sanitize post content by stripping dangerous HTML constructs
 * while preserving safe plain-text formatting.
 *
 * Strips: <script>, <iframe>, <object>, <embed>, <form>, <input>,
 * javascript: URIs, event handlers (onload, onerror, onclick, etc.),
 * data: URIs with script content, and HTML comments.
 */
export function sanitizePostContent(content: string): string {
  let cleaned = content;

  // Remove null bytes
  cleaned = cleaned.replace(/\0/g, "");

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Remove dangerous tags and their content
  const dangerousTags = [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "select",
    "button",
    "style",
    "link",
    "meta",
    "base",
    "applet",
  ];
  for (const tag of dangerousTags) {
    // Remove opening + content + closing
    const regex = new RegExp(
      `<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`,
      "gi"
    );
    cleaned = cleaned.replace(regex, "");
    // Remove self-closing
    cleaned = cleaned.replace(
      new RegExp(`<${tag}[^>]*/?>`, "gi"),
      ""
    );
  }

  // Remove event handler attributes (onload, onerror, onclick, etc.)
  cleaned = cleaned.replace(
    /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
    ""
  );

  // Remove javascript: and vbscript: URIs
  cleaned = cleaned.replace(
    /(?:href|src|action|formaction|data|poster|background)\s*=\s*(?:"[^"]*(?:javascript|vbscript)\s*:[^"]*"|'[^']*(?:javascript|vbscript)\s*:[^']*')/gi,
    ""
  );

  // Remove data: URIs that could contain scripts
  cleaned = cleaned.replace(
    /(?:href|src)\s*=\s*(?:"data:[^"]*text\/html[^"]*"|'data:[^']*text\/html[^']*')/gi,
    ""
  );

  return cleaned.trim();
}

/**
 * Validate and sanitize a display name (for files or folders).
 * More permissive than sanitizeFilename — allows spaces and unicode
 * but still strips dangerous characters.
 */
export function sanitizeDisplayName(name: string): string {
  let cleaned = name;
  // Strip null bytes and control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, "");
  // Strip HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  // Strip path traversal
  cleaned = cleaned.replace(/(\.\.[\\/])+/g, "");
  return cleaned.trim() || "Untitled";
}
