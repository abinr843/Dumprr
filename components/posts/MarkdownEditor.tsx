"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Minus,
  Link as LinkIcon,
  Paperclip,
} from "lucide-react";
import { renderMarkdown, getReadingStats } from "@/lib/posts/markdown";

export type EditorMode = "edit" | "preview" | "split";

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  onInsertFiles?: () => void;
}

/** Rich markdown workstation: toolbar + edit/preview/split + telemetry (Feature 4). */
export function MarkdownEditor({ value, onChange, onInsertFiles }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>("split");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => getReadingStats(value), [value]);
  const html = useMemo(() => renderMarkdown(value), [value]);

  const surround = (before: string, after = "", placeholder = "text") => {
    const ta = taRef.current;
    if (!ta) {
      onChange(`${value}${before}${placeholder}${after}`);
      return;
    }
    const { selectionStart, selectionEnd } = ta;
    const sel = value.slice(selectionStart, selectionEnd) || placeholder;
    const next =
      value.slice(0, selectionStart) + before + sel + after + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = selectionStart + before.length + sel.length + after.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const prefixLines = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    const before = value.slice(0, selectionStart);
    const sel = value.slice(selectionStart, selectionEnd) || "List item";
    const after = value.slice(selectionEnd);
    const lines = sel.split("\n").map((l) => `${prefix}${l}`).join("\n");
    onChange(before + lines + after);
    requestAnimationFrame(() => ta.focus());
  };

  const tools: { icon: React.ReactNode; label: string; act: () => void }[] = [
    { icon: <Bold size={15} />, label: "Bold", act: () => surround("**", "**") },
    { icon: <Italic size={15} />, label: "Italic", act: () => surround("*", "*") },
    { icon: <Strikethrough size={15} />, label: "Strikethrough", act: () => surround("~~", "~~") },
    { icon: <Heading1 size={15} />, label: "Heading 1", act: () => prefixLines("# ") },
    { icon: <Heading2 size={15} />, label: "Heading 2", act: () => prefixLines("## ") },
    { icon: <Heading3 size={15} />, label: "Heading 3", act: () => prefixLines("### ") },
    { icon: <Quote size={15} />, label: "Quote", act: () => prefixLines("> ") },
    { icon: <Code size={15} />, label: "Code block", act: () => surround("\n```\n", "\n```\n", "const a = 42;") },
    { icon: <List size={15} />, label: "Bullet list", act: () => prefixLines("- ") },
    { icon: <ListOrdered size={15} />, label: "Numbered list", act: () => prefixLines("1. ") },
    { icon: <CheckSquare size={15} />, label: "Task list", act: () => prefixLines("- [ ] ") },
    { icon: <TableIcon size={15} />, label: "Table", act: () => surround("\n| Col 1 | Col 2 |\n| --- | --- |\n| ", " |  |\n", "A") },
    { icon: <Minus size={15} />, label: "Divider", act: () => surround("\n\n---\n\n") },
    { icon: <LinkIcon size={15} />, label: "Link", act: () => surround("[", "](https://)") },
  ];

  return (
    <div className="md-wrap">
      <div className="md-toolbar">
        {tools.map((t, i) => (
          <button key={i} type="button" className="md-tool" title={t.label} onClick={t.act}>
            {t.icon}
          </button>
        ))}
        <span className="md-sep" />
        <button type="button" className="md-tool md-attach" title="Insert file reference" onClick={onInsertFiles}>
          <Paperclip size={15} /> <span>File</span>
        </button>
        <span className="md-modes">
          {(["edit", "preview", "split"] as EditorMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`mode-btn ${mode === m ? "active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "edit" ? "Edit" : m === "preview" ? "Preview" : "Split"}
            </button>
          ))}
        </span>
      </div>

      <div className={`md-panes ${mode}`}>
        {(mode === "edit" || mode === "split") && (
          <textarea
            ref={taRef}
            className="md-edit"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your post content here… Markdown supported."
            spellCheck={false}
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div className="md-preview" dangerouslySetInnerHTML={{ __html: html || "<p><em>Nothing to preview yet.</em></p>" }} />
        )}
      </div>

      <div className="md-stats">
        <span>Characters: {stats.characters.toLocaleString()}</span>
        <span>Words: {stats.words.toLocaleString()}</span>
        <span>Read time: ~{stats.readMinutes} min</span>
      </div>

      <style jsx>{`
        .md-wrap { display: flex; flex-direction: column; border: 1px solid var(--border-default); border-radius: 10px; overflow: hidden; background: var(--bg-input); }
        .md-toolbar { display: flex; align-items: center; gap: 2px; padding: 6px 8px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); flex-wrap: wrap; }
        .md-tool { display: inline-flex; align-items: center; gap: 4px; width: 30px; height: 30px; align-items: center; justify-content: center; border: none; background: transparent; color: var(--text-secondary); border-radius: 6px; cursor: pointer; }
        .md-tool:hover { background: var(--bg-hover); color: var(--text-primary); }
        .md-attach { width: auto; padding: 0 8px; font-size: 12px; font-weight: 600; color: var(--color-primary); }
        .md-sep { width: 1px; height: 20px; background: var(--border-subtle); margin: 0 4px; }
        .md-modes { margin-left: auto; display: inline-flex; background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 2px; gap: 2px; }
        .mode-btn { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; }
        .mode-btn.active { background: var(--bg-elevated); color: var(--text-primary); box-shadow: var(--shadow-sm); }
        .md-panes { display: flex; min-height: 220px; max-height: 420px; }
        .md-panes.split .md-edit, .md-panes.split .md-preview { width: 50%; }
        .md-panes.edit .md-edit, .md-panes.preview .md-preview { width: 100%; }
        .md-edit { flex: 1; background: transparent; border: none; outline: none; resize: vertical; padding: 12px 14px; color: var(--text-primary); font-size: 13px; font-family: var(--font-mono, monospace); line-height: 1.65; min-height: 220px; }
        .md-preview { flex: 1; overflow: auto; padding: 14px 16px; border-left: 1px solid var(--border-subtle); font-size: 13.5px; line-height: 1.7; color: var(--text-primary); }
        .md-panes.edit .md-preview, .md-panes.preview .md-edit { border: none; }
        .md-preview :global(h1) { font-size: 20px; margin: 0 0 10px; }
        .md-preview :global(h2) { font-size: 17px; margin: 14px 0 8px; }
        .md-preview :global(h3) { font-size: 15px; margin: 12px 0 6px; }
        .md-preview :global(p) { margin: 0 0 10px; }
        .md-preview :global(blockquote) { border-left: 3px solid var(--color-primary); margin: 0 0 10px; padding: 6px 12px; background: rgba(99,102,241,0.06); border-radius: 0 6px 6px 0; }
        .md-preview :global(code) { background: rgba(148,163,184,0.15); padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 12.5px; }
        .md-preview :global(.md-codeblock) { background: #0b0f1a; color: #dbe2f1; padding: 12px 14px; border-radius: 8px; overflow: auto; font-size: 12.5px; }
        .md-preview :global(ul), .md-preview :global(ol) { margin: 0 0 10px 20px; padding: 0; }
        .md-preview :global(table) { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12.5px; }
        .md-preview :global(th), .md-preview :global(td) { border: 1px solid var(--border-default); padding: 5px 9px; }
        .md-preview :global(th) { background: var(--bg-card); }
        .md-preview :global(img) { max-width: 100%; border-radius: 6px; }
        .md-preview :global(hr) { border: none; border-top: 1px solid var(--border-default); margin: 14px 0; }
        .md-stats { display: flex; gap: 14px; padding: 7px 12px; border-top: 1px solid var(--border-subtle); background: var(--bg-card); font-size: 11px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
