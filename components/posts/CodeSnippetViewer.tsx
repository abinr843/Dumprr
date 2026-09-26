"use client";

import React, { useMemo, useState } from "react";
import { Copy, Check, Download, WrapText, Maximize2, X } from "lucide-react";
import { highlightCode, getCodeLanguageLabel } from "@/lib/storage/preview";

interface CodeSnippetViewerProps {
  code: string;
  language?: string | null;
  filename?: string | null;
  compact?: boolean;
}

/** Reusable code block with macOS dots, language badge, copy/download/wrap/fullscreen. */
export function CodeSnippetViewer({ code, language, filename, compact }: CodeSnippetViewerProps) {
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const label = useMemo(
    () => language || getCodeLanguageLabel(filename?.split(".").pop()),
    [language, filename]
  );
  const highlighted = useMemo(() => highlightCode(code || "", language || filename?.split(".").pop()), [code, language, filename]);
  const lines = useMemo(() => highlighted.split("\n"), [highlighted]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code || ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || `snippet.${(language || "txt").toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 100);
  };

  const body = (
    <div className="code-body">
      <pre className={`code-pre ${wrap ? "wrap" : ""}`}>
        {lines.map((ln, i) => (
          <span key={i} className="code-line">
            <span className="code-no">{i + 1}</span>
            <span className="code-tok" dangerouslySetInnerHTML={{ __html: ln || " " }} />
          </span>
        ))}
      </pre>
    </div>
  );

  return (
    <>
      <div className={`snippet ${compact ? "compact" : ""}`}>
        <div className="snippet-head">
          <span className="dots" aria-hidden>
            <i className="dot r" /><i className="dot y" /><i className="dot g" />
          </span>
          <span className="lang-badge">{label}</span>
          {filename && <span className="fname" title={filename}>{filename}</span>}
          <span className="spacer" />
          <button type="button" className="icon-btn" onClick={() => setWrap((w) => !w)} title="Toggle wrap">
            <WrapText size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="btn-label">{copied ? "Copied!" : "Copy"}</span>
          </button>
          <button type="button" className="icon-btn" onClick={handleDownload} title="Download file">
            <Download size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setFullscreen(true)} title="Fullscreen">
            <Maximize2 size={14} />
          </button>
        </div>
        {body}
      </div>

      {fullscreen && (
        <>
          <div className="fs-backdrop" onClick={() => setFullscreen(false)} />
          <div className="fs-modal" role="dialog" aria-label="Code fullscreen">
            <div className="fs-bar">
              <span className="lang-badge">{label}</span>
              {filename && <span className="fname">{filename}</span>}
              <span className="spacer" />
              <button type="button" className="icon-btn" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy"}
              </button>
              <button type="button" className="icon-btn" onClick={handleDownload}><Download size={14} /></button>
              <button type="button" className="icon-btn" onClick={() => setFullscreen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="fs-body">{body}</div>
          </div>
        </>
      )}

      <style jsx>{`
        .snippet { border: 1px solid var(--border-default); border-radius: 12px; overflow: hidden; background: #0b0f1a; }
        .snippet-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(148,163,184,0.06); border-bottom: 1px solid rgba(148,163,184,0.12); }
        .dots { display: inline-flex; gap: 5px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .dot.r { background: #f87171; } .dot.y { background: #fbbf24; } .dot.g { background: #34d399; }
        .lang-badge { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #8ab4ff; background: rgba(99,102,241,0.15); padding: 2px 8px; border-radius: 9999px; }
        .fname { font-size: 12px; color: #94a3b8; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .spacer { flex: 1; }
        .icon-btn { display: inline-flex; align-items: center; gap: 5px; background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 4px 7px; border-radius: 6px; cursor: pointer; font-size: 12px; }
        .icon-btn:hover { background: rgba(148,163,184,0.12); color: #e2e8f0; }
        .btn-label { font-size: 11px; }
        .code-body { overflow: auto; max-height: ${compact ? "320px" : "480px"}; }
        .code-pre { margin: 0; padding: 12px 0; font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; line-height: 1.65; color: #dbe2f1; }
        .code-line { display: flex; min-width: max-content; padding-right: 16px; }
        .code-line:hover { background: rgba(148,163,184,0.06); }
        .code-no { width: 48px; flex-shrink: 0; text-align: right; padding-right: 12px; color: #475569; user-select: none; }
        .code-tok { white-space: ${wrap ? "pre-wrap" : "pre"}; word-break: ${wrap ? "break-word" : "normal"}; flex: 1; }
        .code-pre :global(.tok-kw) { color: #8ab4ff; }
        .code-pre :global(.tok-str) { color: #9ece8a; }
        .code-pre :global(.tok-com) { color: #64748b; font-style: italic; }
        .code-pre :global(.tok-num) { color: #f0abfc; }
        .fs-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1200; }
        .fs-modal { position: fixed; inset: 4vh 4vw; background: #0b0f1a; border: 1px solid var(--border-default); border-radius: 14px; z-index: 1201; display: flex; flex-direction: column; overflow: hidden; }
        .fs-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid rgba(148,163,184,0.12); }
        .fs-body { flex: 1; overflow: auto; }
        .fs-body .code-body { max-height: none; }
      `}</style>
    </>
  );
}
