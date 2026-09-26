/**
 * Utilities and constants for file preview capabilities.
 * Feature 1 (Universal Preview) + Feature 6 (ZIP) + Feature 7 (Office).
 */

export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "svg",
  "bmp",
  "ico",
] as const;

export const PDF_EXTENSIONS = ["pdf"] as const;

export const CODE_EXTENSIONS = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "html",
  "htm",
  "css",
  "scss",
  "json",
  "xml",
  "py",
  "sql",
  "sh",
  "bash",
  "yml",
  "yaml",
  "md",
  "markdown",
  "rs",
  "go",
  "c",
  "h",
  "cpp",
  "hpp",
  "java",
  "kt",
  "rb",
  "php",
  "swift",
  "toml",
  "ini",
  "env",
  "txt",
  "csv",
  "log",
] as const;

export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "oga",
  "flac",
  "m4a",
  "aac",
  "opus",
  "weba",
] as const;

export const VIDEO_EXTENSIONS = [
  "mp4",
  "webm",
  "mov",
  "mkv",
  "ogv",
  "m4v",
] as const;

export const OFFICE_EXTENSIONS = [
  "docx",
  "doc",
  "xlsx",
  "xls",
  "pptx",
  "ppt",
] as const;

export const ARCHIVE_EXTENSIONS = ["zip"] as const;

export const PREVIEWABLE_EXTENSIONS = new Set<string>([
  ...IMAGE_EXTENSIONS,
  ...PDF_EXTENSIONS,
  ...CODE_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...OFFICE_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS,
]);

export const INLINE_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  log: "text/plain",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  jsx: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  ts: "text/plain",
  tsx: "text/plain",
  py: "text/plain",
  sql: "text/plain",
  sh: "text/plain",
  bash: "text/plain",
  yml: "text/plain",
  yaml: "text/plain",
  rs: "text/plain",
  go: "text/plain",
  c: "text/plain",
  h: "text/plain",
  cpp: "text/plain",
  hpp: "text/plain",
  java: "text/plain",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  opus: "audio/opus",
  weba: "audio/webm",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
  m4v: "video/x-m4v",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
};

export type PreviewKind =
  | "image"
  | "pdf"
  | "code"
  | "audio"
  | "video"
  | "office"
  | "archive"
  | "unsupported";

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

/** Classify an extension into a preview kind for the universal viewer. */
export function getPreviewKind(ext?: string | null): PreviewKind {
  if (!ext) return "unsupported";
  const clean = ext.toLowerCase().replace(/^\./, "");
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(clean)) return "image";
  if ((PDF_EXTENSIONS as readonly string[]).includes(clean)) return "pdf";
  if ((AUDIO_EXTENSIONS as readonly string[]).includes(clean)) return "audio";
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(clean)) return "video";
  if ((ARCHIVE_EXTENSIONS as readonly string[]).includes(clean)) return "archive";
  if ((OFFICE_EXTENSIONS as readonly string[]).includes(clean)) return "office";
  if ((CODE_EXTENSIONS as readonly string[]).includes(clean)) return "code";
  return "unsupported";
}

/** Map a code extension to a display language label. */
export function getCodeLanguageLabel(ext?: string | null): string {
  const map: Record<string, string> = {
    js: "JavaScript",
    jsx: "JavaScript (JSX)",
    mjs: "JavaScript",
    cjs: "JavaScript",
    ts: "TypeScript",
    tsx: "TypeScript (TSX)",
    py: "Python",
    rb: "Ruby",
    php: "PHP",
    java: "Java",
    kt: "Kotlin",
    swift: "Swift",
    go: "Go",
    rs: "Rust",
    c: "C",
    h: "C Header",
    cpp: "C++",
    hpp: "C++ Header",
    html: "HTML",
    htm: "HTML",
    css: "CSS",
    scss: "SCSS",
    json: "JSON",
    xml: "XML",
    yml: "YAML",
    yaml: "YAML",
    toml: "TOML",
    ini: "INI",
    md: "Markdown",
    markdown: "Markdown",
    sql: "SQL",
    sh: "Shell",
    bash: "Bash",
    txt: "Plain Text",
    csv: "CSV",
    log: "Log",
    env: "Env",
  };
  if (!ext) return "Text";
  return map[ext.toLowerCase().replace(/^\./, "")] || ext.toUpperCase();
}

/**
 * Very small tokenizer-based syntax highlighter.
 * Returns HTML with spans; caller must sanitize source first (escape HTML).
 * Keeps zero dependencies — keywords/strings/comments/numbers only.
 */
export function highlightCode(source: string, ext?: string | null): string {
  const e = (ext || "").toLowerCase();
  // Escape HTML first
  let esc = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Comments (//, #, --, /* */) — single pass placeholder approach
  const placeholders: string[] = [];
  const stash = (html: string) => {
    placeholders.push(html);
    return `\u0000${placeholders.length - 1}\u0000`;
  };
  // Block comments
  esc = esc.replace(/\/\*[\s\S]*?\*\//g, (m) => stash(`<span class="tok-com">${m}</span>`));
  // Line comments for most languages
  if (["py", "sh", "bash", "yml", "yaml", "toml", "ini", "sql", "rb"].includes(e)) {
    esc = esc.replace(/(^|\n)\s*(#|--)[^\n]*/g, (m) => {
      // avoid double-stashing placeholders
      if (m.includes("\u0000")) return m;
      return m.replace(/(#|--)[^\n]*/, (c) => stash(`<span class="tok-com">${c}</span>`));
    });
  } else {
    esc = esc.replace(/\/\/[^\n]*/g, (m) =>
      m.includes("\u0000") ? m : stash(`<span class="tok-com">${m}</span>`)
    );
  }
  // Strings
  esc = esc.replace(/(&quot;|"|')(?:[^\\\n]|\\.)*?(\1|$)/g, (m) =>
    m.includes("\u0000") ? m : stash(`<span class="tok-str">${m}</span>`)
  );
  // Numbers
  esc = esc.replace(/\b(\d[\d_]*(?:\.\d+)?)\b/g, (m) =>
    m.includes("\u0000") ? m : stash(`<span class="tok-num">${m}</span>`)
  );
  // Keywords
  const kw =
    /\b(const|let|var|function|return|if|else|for|while|import|from|export|default|class|extends|new|await|async|try|catch|throw|switch|case|break|continue|typeof|interface|type|enum|public|private|protected|static|def|None|True|False|and|or|not|in|is|lambda|with|as|pass|raise|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|ON|AND|OR|NOT|NULL|fn|struct|impl|mut|match|use|mod|pub|cargo|package|func|var|echo|fi|do|done)\b/g;
  esc = esc.replace(kw, (m) =>
    m.includes("\u0000") ? m : stash(`<span class="tok-kw">${m}</span>`)
  );
  // Restore placeholders
  esc = esc.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[Number(i)] ?? "");
  return esc;
}
