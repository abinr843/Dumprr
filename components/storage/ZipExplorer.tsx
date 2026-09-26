"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Folder,
  FolderOpen,
  File as FileIcon,
  Download,
  Eye,
  Loader2,
  ChevronRight,
  Archive,
} from "lucide-react";
import type { ZipEntryMeta, ZipTreeNode } from "@/lib/storage/zip";
import { buildZipTree } from "@/lib/storage/zip";
import {
  getPreviewMimeType,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "@/lib/storage/preview";

interface ZipExplorerProps {
  fileId: string;
  fileName: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function ratio(e: ZipEntryMeta): string {
  if (!e.size) return "—";
  const r = 100 - (e.compressedSize / e.size) * 100;
  return `${r.toFixed(0)}%`;
}

/** In-browser ZIP inspector: tree, sizes, inner preview + single-file extract. */
export function ZipExplorer({ fileId, fileName }: ZipExplorerProps) {
  const [entries, setEntries] = useState<ZipEntryMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ZipEntryMeta | null>(null);
  const [innerText, setInnerText] = useState<string | null>(null);
  const [innerLoading, setInnerLoading] = useState(false);
  const [innerBlobUrl, setInnerBlobUrl] = useState<string | null>(null);
  const [innerBlobMime, setInnerBlobMime] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  const revokeBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  // Revoke blob URLs on unmount / archive change
  useEffect(() => {
    return () => {
      revokeBlob();
    };
  }, [fileId]);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    setSelected(null);
    setInnerText(null);
    setInnerBlobUrl(null);
    setInnerBlobMime(null);
    revokeBlob();
    fetch(`/api/files/${fileId}/zip-tree`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to list archive");
        return d;
      })
      .then((d) => {
        if (!cancelled) {
          setEntries(d.entries || []);
          // auto-expand top-level dirs
          setExpanded(new Set((d.entries || []).filter((e: ZipEntryMeta) => e.isDir).map((e: ZipEntryMeta) => e.path).slice(0, 10)));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "ZIP unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const tree = useMemo(() => (entries ? buildZipTree(entries) : []), [entries]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const previewInner = async (entry: ZipEntryMeta) => {
    const myReq = ++requestRef.current;
    revokeBlob();
    setSelected(entry);
    setInnerBlobUrl(null);
    setInnerBlobMime(null);
    const ext = (entry.name.split(".").pop() || "").toLowerCase();
    const textish = ["txt", "md", "json", "csv", "log", "xml", "html", "css", "js", "ts", "py", "yml", "yaml"].includes(ext);
    const imageish = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext);
    const pdfish = ext === "pdf";
    const audioish = (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
    const videoish = (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
    if (!textish && !imageish && !pdfish && !audioish && !videoish) {
      setInnerText(null);
      return;
    }
    setInnerLoading(true);
    setInnerText(null);
    try {
      const extractUrl = `/api/files/${fileId}/zip-extract?entry=${encodeURIComponent(entry.path)}`;
      if (textish) {
        const r = await fetch(extractUrl, {
          headers: { Accept: "application/json" },
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Extract failed");
        if (requestRef.current !== myReq) return;
        setInnerText(d.text || "");
      } else if (imageish) {
        if (requestRef.current !== myReq) return;
        setInnerText(`__IMAGE__:${extractUrl}`);
      } else {
        // PDF / audio / video: fetch raw bytes and preview via blob URL
        // so "preview" renders inline instead of downloading.
        const r = await fetch(extractUrl);
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Extract failed");
        }
        const blob = await r.blob();
        if (requestRef.current !== myReq) return;
        const mime = getPreviewMimeType(ext) || blob.type || "application/octet-stream";
        const url = URL.createObjectURL(new Blob([blob], { type: mime }));
        blobUrlRef.current = url;
        setInnerBlobUrl(url);
        setInnerBlobMime(mime);
      }
    } catch (e) {
      if (requestRef.current !== myReq) return;
      setInnerText(`Error: ${e instanceof Error ? e.message : "extract failed"}`);
    } finally {
      if (requestRef.current === myReq) setInnerLoading(false);
    }
  };

  const renderNode = (node: ZipTreeNode, depth: number): React.ReactNode => {
    if (node.isDir) {
      const open = expanded.has(node.path.replace(/\/$/, "") + "/") || expanded.has(node.path) || expanded.has(node.path + "/");
      // normalize: our paths for dirs lack trailing slash in tree builder
      const key = node.path;
      const isOpen = expanded.has(key);
      return (
        <div key={key}>
          <div className="zx-row zx-dir" style={{ paddingLeft: 12 + depth * 16 }} onClick={() => toggle(key)}>
            <ChevronRight size={13} className={`chev ${isOpen ? "open" : ""}`} />
            {isOpen ? <FolderOpen size={15} className="zx-folder" /> : <Folder size={15} className="zx-folder" />}
            <span className="zx-name">{node.name}</span>
            <span className="zx-size">{node.children.length} items</span>
          </div>
          {isOpen && node.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }
    const e = node.entry!;
    return (
      <div
        key={node.path}
        className={`zx-row zx-file ${selected?.path === node.path ? "sel" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => previewInner(e)}
      >
        <FileIcon size={14} className="zx-file-ic" />
        <span className="zx-name" title={node.path}>{node.name}</span>
        <span className="zx-size">{formatBytes(e.size)}</span>
        <span className="zx-ratio">{ratio(e)}</span>
      </div>
    );
  };

  if (error) {
    return (
      <div className="zx-state">
        <Archive size={28} />
        <p>{error}</p>
        <a className="zx-dl" href={`/api/files/${fileId}/download`} download={fileName}>Download archive instead</a>
        <style jsx>{`.zx-state{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px;color:var(--text-muted);font-size:var(--text-sm);}.zx-dl{color:var(--color-primary);font-weight:600;}`}</style>
      </div>
    );
  }
  if (!entries) {
    return (
      <div className="zx-state"><Loader2 size={22} className="spin" /> Reading archive…<style jsx>{`.zx-state{display:flex;align-items:center;gap:8px;padding:48px;color:var(--text-muted);font-size:var(--text-sm);justify-content:center;}.spin{animation:spin 1s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}`}</style></div>
    );
  }

  return (
    <div className="zx-wrap">
      <div className="zx-head">
        <Archive size={15} />
        <span className="zx-title">{fileName}</span>
        <span className="zx-count">{entries.filter((e) => !e.isDir).length} files</span>
      </div>
      <div className="zx-cols">
        <div className="zx-list">
          <div className="zx-list-head"><span>Name</span><span>Size</span><span>Saved</span></div>
          {tree.map((n) => renderNode(n, 0))}
        </div>
        <div className="zx-preview">
          {!selected ? (
            <div className="zx-empty">Select a file to preview its contents.<br />Text, images, PDFs, audio and video preview inline; anything else can be extracted individually.</div>
          ) : (
            <>
              <div className="zx-sel-bar">
                <span className="zx-sel-name" title={selected.path}>{selected.path}</span>
                <div className="zx-sel-actions">
                  <a
                    className="zx-btn"
                    href={`/api/files/${fileId}/zip-extract?entry=${encodeURIComponent(selected.path)}`}
                    download={selected.name}
                  >
                    <Download size={13} /> Extract
                  </a>
                </div>
              </div>
              {innerLoading ? (
                <div className="zx-empty"><Loader2 size={18} className="spin" /> Extracting…</div>
              ) : innerBlobUrl ? (
                innerBlobMime?.startsWith("audio/") ? (
                  <div className="zx-media-pad">
                    <audio src={innerBlobUrl} controls preload="metadata" className="zx-audio" />
                  </div>
                ) : innerBlobMime?.startsWith("video/") ? (
                  <video src={innerBlobUrl} controls preload="metadata" playsInline className="zx-video" />
                ) : (
                  <iframe src={innerBlobUrl} title={selected.name} className="zx-pdf" />
                )
              ) : innerText == null ? (
                <div className="zx-empty">
                  <Eye size={18} />
                  <p>No inline preview for this type — use Extract to download just this file.</p>
                </div>
              ) : innerText.startsWith("__IMAGE__:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={innerText.slice(10)} alt={selected.name} className="zx-img" />
              ) : (
                <pre className="zx-text">{innerText.slice(0, 20000)}</pre>
              )}
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        .zx-wrap { display: flex; flex-direction: column; width: 100%; }
        .zx-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); font-size: var(--text-sm); }
        .zx-title { font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .zx-count { margin-left: auto; font-size: 11px; color: var(--text-muted); }
        .zx-cols { display: grid; grid-template-columns: 1fr 1fr; min-height: 300px; max-height: 58vh; }
        .zx-list { overflow: auto; border-right: 1px solid var(--border-subtle); }
        .zx-list-head { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; background: var(--bg-surface); }
        .zx-row { display: flex; align-items: center; gap: 8px; padding: 7px 14px 7px 12px; font-size: 12px; cursor: pointer; border-bottom: 1px solid rgba(148,163,184,0.06); }
        .zx-row:hover { background: var(--bg-hover); }
        .zx-row.sel { background: rgba(99,102,241,0.1); }
        .zx-dir { font-weight: 600; color: var(--text-primary); }
        .zx-folder { color: #f59e0b; }
        .zx-file-ic { color: var(--text-muted); flex-shrink: 0; }
        .zx-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .zx-size { color: var(--text-muted); font-size: 11px; white-space: nowrap; }
        .zx-ratio { color: #10b981; font-size: 11px; min-width: 36px; text-align: right; }
        .chev { transition: transform 0.12s; color: var(--text-muted); }
        .chev.open { transform: rotate(90deg); }
        .zx-preview { display: flex; flex-direction: column; overflow: hidden; }
        .zx-empty { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 12px; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        .zx-sel-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); }
        .zx-sel-name { flex: 1; min-width: 0; font-size: 11px; font-family: monospace; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .zx-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--color-primary); text-decoration: none; border: 1px solid rgba(99,102,241,0.3); padding: 4px 10px; border-radius: 6px; white-space: nowrap; }
        .zx-text { margin: 0; padding: 14px; overflow: auto; font-size: 12px; font-family: monospace; white-space: pre-wrap; word-break: break-word; color: var(--text-primary); }
        .zx-img { max-width: 100%; max-height: 46vh; object-fit: contain; margin: 12px auto; border-radius: 6px; }
        .zx-pdf { width: 100%; min-height: 320px; height: 46vh; border: none; background: #fff; }
        .zx-video { width: 100%; max-height: 46vh; background: #000; }
        .zx-media-pad { padding: 24px 16px; }
        .zx-audio { width: 100%; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) { .zx-cols { grid-template-columns: 1fr; } .zx-preview { border-top: 1px solid var(--border-subtle); } }
      `}</style>
    </div>
  );
}

// re-export for header counts
export type { ZipEntryMeta };
