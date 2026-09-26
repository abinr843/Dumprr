"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  FileText,
  Table as TableIcon,
  Presentation,
  ExternalLink,
  Search,
} from "lucide-react";
import { parseZipBuffer, extractZipEntry } from "@/lib/storage/zip";

interface OfficePreviewProps {
  url: string;
  extension?: string;
  fileName?: string;
  downloadUrl?: string;
}

type Sheet = { name: string; rows: string[][] };

function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (c === "\r") {
        /* skip */
      } else cell += c;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== "")).slice(0, 2000);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** DOCX → paragraphs HTML via word/document.xml */
async function parseDocx(buf: Uint8Array): Promise<string> {
  const tree = parseZipBuffer(buf);
  const docEntry = tree.entries.find((e) => e.path === "word/document.xml");
  if (!docEntry) throw new Error("Invalid DOCX (document.xml missing)");
  const xml = new TextDecoder().decode(await extractZipEntry(buf, docEntry));
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const paras = Array.from(dom.getElementsByTagName("w:p"));
  const htmlParts: string[] = [];
  for (const p of paras.slice(0, 1000)) {
    const style = p.getElementsByTagName("w:pStyle")[0]?.getAttribute("w:val") || "";
    const texts = Array.from(p.getElementsByTagName("w:t")).map((t) => t.textContent || "");
    // bold detection: any w:b in run
    const bold = p.getElementsByTagName("w:b").length > 0;
    const joined = texts.join("");
    if (!joined.trim()) continue;
    const esc = joined.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = bold ? `<strong>${esc}</strong>` : esc;
    if (/Heading1/i.test(style)) htmlParts.push(`<h1>${body}</h1>`);
    else if (/Heading2/i.test(style)) htmlParts.push(`<h2>${body}</h2>`);
    else if (/Heading3/i.test(style)) htmlParts.push(`<h3>${body}</h3>`);
    else if (/Title/i.test(style)) htmlParts.push(`<h1 class="doc-title">${body}</h1>`);
    else htmlParts.push(`<p>${body}</p>`);
  }
  // tables
  const tables = Array.from(dom.getElementsByTagName("w:tbl")).slice(0, 20);
  for (const t of tables) {
    const rows = Array.from(t.getElementsByTagName("w:tr")).map((tr) =>
      Array.from(tr.getElementsByTagName("w:tc"))
        .map((tc) =>
          Array.from(tc.getElementsByTagName("w:t"))
            .map((x) => x.textContent || "")
            .join("")
        )
        .slice(0, 12)
    );
    htmlParts.push(
      `<table class="doc-table"><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${c.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    );
  }
  return htmlParts.join("\n") || "<p><em>Empty document.</em></p>";
}

/** XLSX → sheets via sharedStrings + sheet XML */
async function parseXlsx(buf: Uint8Array): Promise<Sheet[]> {
  const tree = parseZipBuffer(buf);
  const byPath = new Map(tree.entries.map((e) => [e.path, e]));
  // shared strings
  let shared: string[] = [];
  const ssEntry = byPath.get("xl/sharedStrings.xml");
  if (ssEntry) {
    const xml = new TextDecoder().decode(await extractZipEntry(buf, ssEntry));
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    shared = Array.from(dom.getElementsByTagName("si")).map((si) =>
      Array.from(si.getElementsByTagName("t"))
        .map((t) => t.textContent || "")
        .join("")
    );
  }
  // workbook sheet names
  const wbEntry = byPath.get("xl/workbook.xml");
  let sheetNames: string[] = [];
  if (wbEntry) {
    const xml = new TextDecoder().decode(await extractZipEntry(buf, wbEntry));
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    sheetNames = Array.from(dom.getElementsByTagName("sheet")).map(
      (s, i) => s.getAttribute("name") || `Sheet ${i + 1}`
    );
  }
  const sheetEntries = tree.entries.filter(
    (e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.path) && !e.isDir
  );
  const sheets: Sheet[] = [];
  for (let si = 0; si < sheetEntries.length; si++) {
    const entry = sheetEntries[si];
    const xml = new TextDecoder().decode(await extractZipEntry(buf, entry));
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    const rowEls = Array.from(dom.getElementsByTagName("row")).slice(0, 1000);
    const grid = new Map<number, Map<number, string>>();
    let maxR = 0;
    let maxC = 0;
    for (const r of rowEls) {
      const cells = Array.from(r.getElementsByTagName("c"));
      for (const c of cells) {
        const ref = c.getAttribute("r") || "";
        const m = ref.match(/^([A-Z]+)(\d+)$/);
        if (!m) continue;
        const col = m[1].split("").reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
        const rowN = parseInt(m[2], 10) - 1;
        const t = c.getAttribute("t");
        let val = "";
        if (t === "s") {
          val = shared[parseInt(c.getElementsByTagName("v")[0]?.textContent || "0", 10)] || "";
        } else if (t === "inlineStr") {
          val = c.getElementsByTagName("t")[0]?.textContent || "";
        } else {
          val = c.getElementsByTagName("v")[0]?.textContent || "";
        }
        if (!grid.has(rowN)) grid.set(rowN, new Map());
        grid.get(rowN)!.set(col, val);
        maxR = Math.max(maxR, rowN);
        maxC = Math.max(maxC, col);
      }
    }
    maxC = Math.min(maxC, 25);
    const rows: string[][] = [];
    for (let r = 0; r <= Math.min(maxR, 999); r++) {
      const rowMap = grid.get(r);
      const arr: string[] = [];
      for (let c = 0; c <= maxC; c++) arr.push(rowMap?.get(c) || "");
      if (arr.some((x) => x !== "")) rows.push(arr);
    }
    sheets.push({ name: sheetNames[si] || `Sheet ${si + 1}`, rows });
  }
  return sheets.length ? sheets : [{ name: "Sheet 1", rows: [] }];
}

/** PPTX → slide texts */
async function parsePptx(buf: Uint8Array): Promise<string[][]> {
  const tree = parseZipBuffer(buf);
  const slides = tree.entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.path) && !e.isDir)
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  const out: string[][] = [];
  for (const s of slides.slice(0, 100)) {
    const xml = new TextDecoder().decode(await extractZipEntry(buf, s));
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    const texts = Array.from(dom.getElementsByTagName("a:t")).map((t) => t.textContent || "");
    out.push(texts.filter((t) => t.trim() !== ""));
  }
  return out;
}

/** Office preview: DOCX / XLSX+CSV / PPTX with Office Web Viewer fallback. */
export function OfficePreview({ url, extension, fileName, downloadUrl }: OfficePreviewProps) {
  const ext = (extension || "").toLowerCase();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [docHtml, setDocHtml] = useState<string>("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [slides, setSlides] = useState<string[][]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError(null);
    (async () => {
      try {
        if (ext === "csv") {
          const r = await fetch(url);
          const text = (await r.text()).slice(0, 2000000);
          if (!cancelled) {
            setSheets([{ name: fileName || "CSV", rows: parseCsv(text) }]);
            setState("ready");
          }
          return;
        }
        const buf = await fetchBytes(url);
        if (cancelled) return;
        if (ext === "docx" || ext === "doc") {
          const html = await parseDocx(buf);
          if (!cancelled) {
            setDocHtml(html);
            setState("ready");
          }
        } else if (ext === "xlsx" || ext === "xls") {
          const sh = await parseXlsx(buf);
          if (!cancelled) {
            setSheets(sh);
            setState("ready");
          }
        } else if (ext === "pptx" || ext === "ppt") {
          const sl = await parsePptx(buf);
          if (!cancelled) {
            setSlides(sl);
            setState("ready");
          }
        } else {
          throw new Error("Unsupported office format");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Preview failed");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, ext, fileName]);

  const officeViewerUrl = useMemo(() => {
    try {
      const abs = new URL(downloadUrl || url, window.location.origin).toString();
      if (!/^https:\/\//i.test(abs)) return null;
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(abs)}`;
    } catch {
      return null;
    }
  }, [url, downloadUrl]);

  const filteredRows = useMemo(() => {
    const sheet = sheets[activeSheet];
    if (!sheet) return [];
    if (!filter.trim()) return sheet.rows;
    const needle = filter.toLowerCase();
    return sheet.rows.filter((r) => r.some((c) => c.toLowerCase().includes(needle)));
  }, [sheets, activeSheet, filter]);

  if (state === "loading") {
    return (
      <div className="off-state"><Loader2 size={22} className="spin" /> Rendering document…<style jsx>{`.off-state{display:flex;align-items:center;gap:8px;justify-content:center;padding:48px;color:var(--text-muted);font-size:var(--text-sm);}.spin{animation:spin 1s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}`}</style></div>
    );
  }

  const fallback = (
    <div className="off-fallback">
      {error ? <p className="off-err">{error}</p> : <p>Complex formatting may not render perfectly.</p>}
      <div className="off-fb-actions">
        {officeViewerUrl && (
          <a href={officeViewerUrl} target="_blank" rel="noopener noreferrer" className="off-btn primary">
            <ExternalLink size={14} /> Open in Office Web Viewer
          </a>
        )}
        {downloadUrl && (
          <a href={downloadUrl} className="off-btn" download={fileName}>Download original</a>
        )}
      </div>
      <style jsx>{`
        .off-fallback { padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px; border-top: 1px dashed var(--border-subtle); }
        .off-err { color: #f59e0b; }
        .off-fb-actions { display: flex; gap: 8px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
        .off-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-subtle); color: var(--text-secondary); text-decoration: none; }
        .off-btn.primary { background: var(--color-primary); color: #fff; border-color: transparent; }
      `}</style>
    </div>
  );

  if (ext === "docx" || ext === "doc") {
    return (
      <div className="off-doc">
        <div className="off-bar"><FileText size={14} /> {fileName}</div>
        <div className="doc-page" dangerouslySetInnerHTML={{ __html: docHtml }} />
        {fallback}
        <style jsx>{`
          .off-doc { width: 100%; }
          .off-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); font-size: 13px; font-weight: 600; }
          .doc-page { background: #fff; color: #111827; padding: 36px 42px; margin: 16px auto; max-width: 720px; border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.35); max-height: 52vh; overflow: auto; font-size: 14px; line-height: 1.7; }
          .doc-page :global(h1) { font-size: 22px; margin: 0 0 12px; }
          .doc-page :global(h2) { font-size: 18px; margin: 18px 0 8px; }
          .doc-page :global(h3) { font-size: 15px; margin: 14px 0 6px; }
          .doc-page :global(p) { margin: 0 0 10px; }
          .doc-page :global(.doc-table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
          .doc-page :global(.doc-table td) { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 13px; }
        `}</style>
      </div>
    );
  }

  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    const sheet = sheets[activeSheet];
    const cols = Math.max(0, ...filteredRows.map((r) => r.length));
    return (
      <div className="off-sheet">
        <div className="off-bar">
          <TableIcon size={14} /> {fileName}
          <span className="off-count">{sheet ? `${filteredRows.length} rows × ${cols} cols` : ""}</span>
          <span className="off-search"><Search size={13} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter cells…" /></span>
        </div>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr><th className="corner" />{Array.from({ length: cols }, (_, c) => <th key={c}>{colLetter(c)}</th>)}</tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 500).map((r, ri) => (
                <tr key={ri}><td className="rowno">{ri + 1}</td>{Array.from({ length: cols }, (_, c) => <td key={c}>{r[c] || ""}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && <div className="off-empty">No rows{filter ? ` matching “${filter}”` : ""}.</div>}
        </div>
        {sheets.length > 1 && (
          <div className="sheet-tabs">
            {sheets.map((s, i) => (
              <button key={i} type="button" className={`sheet-tab ${i === activeSheet ? "active" : ""}`} onClick={() => { setActiveSheet(i); setFilter(""); }}>{s.name}</button>
            ))}
          </div>
        )}
        {fallback}
        <style jsx>{`
          .off-sheet { width: 100%; display: flex; flex-direction: column; }
          .off-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); font-size: 13px; font-weight: 600; flex-wrap: wrap; }
          .off-count { font-size: 11px; color: var(--text-muted); font-weight: 400; }
          .off-search { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 4px 8px; }
          .off-search input { background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 12px; width: 140px; }
          .grid-wrap { overflow: auto; max-height: 52vh; }
          .grid { border-collapse: collapse; font-size: 12px; min-width: 100%; }
          .grid th, .grid td { border: 1px solid var(--border-subtle); padding: 5px 9px; text-align: left; white-space: nowrap; }
          .grid thead th { background: var(--bg-card); color: var(--text-muted); font-weight: 700; position: sticky; top: 0; }
          .corner, .rowno { background: var(--bg-card); color: var(--text-muted); font-weight: 600; min-width: 40px; text-align: right; }
          .off-empty { padding: 28px; text-align: center; color: var(--text-muted); font-size: 12px; }
          .sheet-tabs { display: flex; gap: 4px; padding: 8px 12px; border-top: 1px solid var(--border-subtle); background: var(--bg-card); overflow-x: auto; }
          .sheet-tab { font-size: 12px; padding: 5px 12px; border-radius: 6px 6px 0 0; border: 1px solid var(--border-subtle); border-bottom: none; background: transparent; color: var(--text-secondary); cursor: pointer; white-space: nowrap; }
          .sheet-tab.active { background: rgba(16,185,129,0.12); color: #10b981; font-weight: 700; }
        `}</style>
      </div>
    );
  }

  // PPTX carousel
  return (
    <div className="off-ppt">
      <div className="off-bar">
        <Presentation size={14} /> {fileName}
        <span className="off-count">{slides.length} slides</span>
        <span className="ppt-nav">
          <button type="button" className="ppt-btn" disabled={slideIdx === 0} onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}>← Prev</button>
          <span className="ppt-pos">{slides.length ? `${slideIdx + 1} / ${slides.length}` : "0 / 0"}</span>
          <button type="button" className="ppt-btn" disabled={slideIdx >= slides.length - 1} onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}>Next →</button>
        </span>
      </div>
      <div className="slide-stage">
        {slides.length === 0 ? (
          <div className="off-empty">No slide text extracted.</div>
        ) : (
          <div className="slide-card" key={slideIdx}>
            {(slides[slideIdx] || []).map((t, i) => (
              <p key={i} className={i === 0 ? "slide-title" : "slide-bullet"}>{i === 0 ? t : `• ${t}`}</p>
            ))}
          </div>
        )}
      </div>
      <div className="slide-dots">
        {slides.map((_, i) => (
          <button key={i} type="button" aria-label={`Slide ${i + 1}`} className={`dot ${i === slideIdx ? "active" : ""}`} onClick={() => setSlideIdx(i)} />
        ))}
      </div>
      {fallback}
      <style jsx>{`
        .off-ppt { width: 100%; }
        .off-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); font-size: 13px; font-weight: 600; flex-wrap: wrap; }
        .off-count { font-size: 11px; color: var(--text-muted); font-weight: 400; }
        .ppt-nav { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; }
        .ppt-btn { font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; }
        .ppt-btn:disabled { opacity: 0.4; cursor: default; }
        .ppt-pos { font-size: 12px; color: var(--text-muted); }
        .slide-stage { padding: 20px; display: flex; justify-content: center; background: #0b0f1a; min-height: 300px; }
        .slide-card { background: linear-gradient(135deg, #1e1b4b, #0f172a); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 32px; max-width: 640px; width: 100%; min-height: 240px; box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
        .slide-title { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 14px; }
        .slide-bullet { font-size: 14px; color: #cbd5e1; margin: 0 0 8px; }
        .slide-dots { display: flex; gap: 6px; justify-content: center; padding: 10px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; border: none; background: var(--border-strong); cursor: pointer; padding: 0; }
        .dot.active { background: var(--color-primary); }
        .off-empty { color: var(--text-muted); font-size: 13px; }
      `}</style>
    </div>
  );
}
