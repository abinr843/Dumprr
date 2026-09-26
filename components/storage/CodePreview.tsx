"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, Check, WrapText, Type, Loader2 } from "lucide-react";
import { highlightCode, getCodeLanguageLabel } from "@/lib/storage/preview";

interface CodePreviewProps {
  url: string;
  extension?: string;
  fileName?: string;
}

/** Code / text viewer with line numbers, wrap toggle, font-size, copy. */
export function CodePreview({ url, extension, fileName }: CodePreviewProps) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setText(t.slice(0, 500000));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const highlighted = useMemo(
    () => (text != null ? highlightCode(text, extension) : ""),
    [text, extension]
  );
  const lineCount = useMemo(() => (text != null ? text.split("\n").length : 0), [text]);

  const handleCopy = async () => {
    if (text == null) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  };

  if (error) {
    return <div className="cp-state">Failed to load code: {error}</div>;
  }
  if (text == null) {
    return (
      <div className="cp-state">
        <Loader2 size={22} className="spin" /> Loading code…
      </div>
    );
  }

  return (
    <div className="cp-wrap">
      <div className="cp-toolbar">
        <span className="cp-lang">{getCodeLanguageLabel(extension)}</span>
        <span className="cp-meta">
          {lineCount} lines{fileName ? ` · ${fileName}` : ""}
        </span>
        <div className="cp-tools">
          <button type="button" className="cp-btn" onClick={() => setWrap((w) => !w)} title="Toggle word wrap">
            <WrapText size={14} /> {wrap ? "Wrap: on" : "Wrap: off"}
          </button>
          <button
            type="button"
            className="cp-btn"
            onClick={() => setFontSize((s) => Math.min(20, s + 1))}
            title="Increase font size"
          >
            <Type size={14} /> A+
          </button>
          <button
            type="button"
            className="cp-btn"
            onClick={() => setFontSize((s) => Math.max(10, s - 1))}
            title="Decrease font size"
          >
            <Type size={12} /> A-
          </button>
          <button type="button" className="cp-btn cp-copy" onClick={handleCopy} title="Copy raw">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <div className="cp-body">
        <pre
          className="cp-pre"
          style={{ fontSize }}
          dangerouslySetInnerHTML={{ __html: withLineNumbers(highlighted, wrap) }}
        />
      </div>
      <style jsx>{`
        .cp-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 200px; }
        .cp-state { display: flex; align-items: center; gap: 8px; padding: 40px; color: var(--text-muted); font-size: var(--text-sm); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cp-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); flex-wrap: wrap; }
        .cp-lang { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary); background: rgba(99,102,241,0.12); padding: 2px 8px; border-radius: 9999px; }
        .cp-meta { font-size: 11px; color: var(--text-muted); }
        .cp-tools { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
        .cp-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 4px 9px; border-radius: 6px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; }
        .cp-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cp-copy { color: var(--color-primary); border-color: rgba(99,102,241,0.3); }
        .cp-body { overflow: auto; max-height: 60vh; background: #0b0f1a; }
        .cp-pre { margin: 0; padding: 14px 0 14px 0; font-family: var(--font-mono, ui-monospace, monospace); line-height: 1.6; color: #dbe2f1; }
        .cp-pre :global(.tok-kw) { color: #8ab4ff; }
        .cp-pre :global(.tok-str) { color: #9ece8a; }
        .cp-pre :global(.tok-com) { color: #64748b; font-style: italic; }
        .cp-pre :global(.tok-num) { color: #f0abfc; }
        .cp-pre :global(.cp-line) { display: flex; min-width: max-content; padding: 0 16px 0 0; }
        .cp-pre :global(.cp-no) { width: 52px; flex-shrink: 0; text-align: right; padding-right: 14px; color: #475569; user-select: none; }
        .cp-pre :global(.cp-code) { white-space: ${wrap ? "pre-wrap" : "pre"}; word-break: ${wrap ? "break-word" : "normal"}; flex: 1; }
        .cp-pre :global(.cp-line:hover) { background: rgba(148,163,184,0.06); }
      `}</style>
    </div>
  );
}

function withLineNumbers(highlightedHtml: string, _wrap: boolean): string {
  const lines = highlightedHtml.split("\n");
  return lines
    .map(
      (ln, i) =>
        `<span class="cp-line"><span class="cp-no">${i + 1}</span><span class="cp-code">${ln || " "}</span></span>`
    )
    .join("");
}
