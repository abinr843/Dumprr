/** Advanced search operator parser (Feature 5). */

export interface ParsedSearch {
  /** Free-text remainder after stripping operators */
  text: string;
  tags: string[];
  typeFilter: "all" | "post" | "file" | "code" | "folder";
  ext: string | null;
  minSizeBytes: number | null;
  author: string | null;
}

export function parseSizeToBytes(raw: string): number | null {
  const m = raw.trim().toLowerCase().match(/^([\d.]+)\s*(b|kb|mb|gb)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] || "b";
  const mult =
    unit === "gb" ? 1024 ** 3 : unit === "mb" ? 1024 ** 2 : unit === "kb" ? 1024 : 1;
  return Math.floor(n * mult);
}

/** Parse `tag:`, `#`, `type:`, `ext:`, `min-size:`, `author:` operators. */
export function parseSearchOperators(query: string): ParsedSearch {
  const tags: string[] = [];
  let typeFilter: ParsedSearch["typeFilter"] = "all";
  let ext: string | null = null;
  let minSizeBytes: number | null = null;
  let author: string | null = null;

  let q = ` ${query || ""} `;

  // #tag shorthand (keep inside words like C# out: require non-word boundary before #)
  q = q.replace(/(^|\s)#([\w][\w.-]*)/g, (_m, pre, tag) => {
    tags.push(String(tag).toLowerCase());
    return `${pre} `;
  });
  // tag:value
  q = q.replace(/(^|\s)tag:([\w][\w.-]*)/gi, (_m, pre, tag) => {
    tags.push(String(tag).toLowerCase());
    return `${pre} `;
  });
  // type:value
  q = q.replace(/(^|\s)type:(code|post|posts|file|files|folder|folders)\b/gi, (_m, pre, t) => {
    const v = String(t).toLowerCase();
    if (v.startsWith("code")) typeFilter = "code";
    else if (v.startsWith("post")) typeFilter = "post";
    else if (v.startsWith("file")) typeFilter = "file";
    else if (v.startsWith("folder")) typeFilter = "folder";
    return `${pre} `;
  });
  // ext:value
  q = q.replace(/(^|\s)ext:([\w]+)/gi, (_m, pre, e) => {
    ext = String(e).toLowerCase().replace(/^\./, "");
    return `${pre} `;
  });
  // min-size:value
  q = q.replace(/(^|\s)min-size:([^\s]+)/gi, (_m, pre, s) => {
    minSizeBytes = parseSizeToBytes(String(s));
    return `${pre} `;
  });
  // author:value (may be quoted)
  q = q.replace(/(^|\s)author:("[^"]+"|[^\s]+)/gi, (_m, pre, a) => {
    author = String(a).replace(/^"|"$/g, "").toLowerCase();
    return `${pre} `;
  });

  const text = q.replace(/\s+/g, " ").trim();
  return { text, tags, typeFilter, ext, minSizeBytes, author };
}

/** Build a short highlighted snippet around the first match. */
export function buildSnippet(
  source: string | null | undefined,
  query: string,
  radius = 80
): string | undefined {
  if (!source || !query.trim()) return undefined;
  const lower = source.toLowerCase();
  const needle = query.toLowerCase().split(/\s+/)[0];
  if (!needle) return undefined;
  const idx = lower.indexOf(needle);
  if (idx < 0) {
    return source.length > radius * 2 ? `${source.slice(0, radius * 2)}…` : source;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(source.length, idx + needle.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}
