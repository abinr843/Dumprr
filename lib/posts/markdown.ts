/** Minimal Markdown → sanitized HTML renderer (zero deps). Feature 4. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMd(s: string): string {
  // s is already escaped; apply inline tokens
  let out = s;
  // images ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*?)&quot;)?\)/g,
    (_m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" />`
  );
  // links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
  );
  // inline code `x`
  out = out.replace(/`([^`\n]+)`/g, (_m, code) => `<code>${code}</code>`);
  // bold **x** / __x__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // strikethrough ~~x~~
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // italic *x* / _x_
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|\W)_([^_\n]+)_/g, "$1<em>$2</em>");
  return out;
}

/** Render markdown source to HTML. Supports headings, quotes, lists, tasks, tables, code, hr. */
export function renderMarkdown(src: string): string {
  const lines = (src || "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listStack: string[] = [];

  const closeLists = () => {
    while (listStack.length) html.push(`</${listStack.pop()}>`);
  };

  const flushCode = () => {
    const body = escapeHtml(codeBuf.join("\n"));
    html.push(
      `<pre class="md-codeblock"${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ""}><code>${body}</code></pre>`
    );
    codeBuf = [];
  };

  while (i < lines.length) {
    const raw = lines[i];
    const fence = raw.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!inCode) {
        inCode = true;
        codeLang = fence[1] || "";
        codeBuf = [];
        closeLists();
      } else {
        inCode = false;
        flushCode();
        codeLang = "";
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      i++;
      continue;
    }
    const line = raw;
    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      i++;
      continue;
    }
    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeLists();
      html.push("<hr />");
      i++;
      continue;
    }
    // headings
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeLists();
      const level = h[1].length;
      html.push(`<h${level}>${inlineMd(escapeHtml(h[2]))}</h${level}>`);
      i++;
      continue;
    }
    // blockquote
    if (/^&gt;/.test(escapeHtml(trimmed)) || trimmed.startsWith(">")) {
      closeLists();
      const quotes: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quotes.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      html.push(`<blockquote>${quotes.map((q) => `<p>${inlineMd(escapeHtml(q))}</p>`).join("")}</blockquote>`);
      continue;
    }
    // table (header + delimiter row)
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      /^\|?[\s:|-]+\|?[\s:|.-]*$/.test(lines[i + 1].trim()) &&
      lines[i + 1].includes("-")
    ) {
      closeLists();
      const headerCells = trimmed.split("|").map((c) => c.trim()).filter((c) => c !== "");
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter((c) => c !== ""));
        i++;
      }
      html.push(
        `<table><thead><tr>${headerCells.map((c) => `<th>${inlineMd(escapeHtml(c))}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(escapeHtml(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      );
      continue;
    }
    // task list / unordered / ordered
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      if (listStack[listStack.length - 1] !== "ul") {
        closeLists();
        html.push("<ul>");
        listStack.push("ul");
      }
      const checked = task[1].toLowerCase() === "x";
      html.push(
        `<li class="task"><input type="checkbox" disabled${checked ? " checked" : ""} /> ${inlineMd(escapeHtml(task[2]))}</li>`
      );
      i++;
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listStack[listStack.length - 1] !== "ul") {
        closeLists();
        html.push("<ul>");
        listStack.push("ul");
      }
      html.push(`<li>${inlineMd(escapeHtml(ul[1]))}</li>`);
      i++;
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (listStack[listStack.length - 1] !== "ol") {
        closeLists();
        html.push("<ol>");
        listStack.push("ol");
      }
      html.push(`<li>${inlineMd(escapeHtml(ol[1]))}</li>`);
      i++;
      continue;
    }
    closeLists();
    html.push(`<p>${inlineMd(escapeHtml(trimmed))}</p>`);
    i++;
  }
  if (inCode) flushCode();
  closeLists();
  return html.join("\n");
}

/** Word/character/read-time stats for the telemetry bar. */
export function getReadingStats(text: string): {
  characters: number;
  words: number;
  readMinutes: number;
} {
  const characters = (text || "").length;
  const words = (text || "").trim() ? (text || "").trim().split(/\s+/).length : 0;
  const readMinutes = Math.max(1, Math.ceil(words / 200));
  return { characters, words, readMinutes };
}
