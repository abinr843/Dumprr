"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Loader2,
  Maximize2,
  Music,
  Video,
  Archive,
  FileSpreadsheet,
} from "lucide-react";
import { CodePreview } from "./CodePreview";
import { MediaPreview } from "./MediaPreview";
import { ImageViewer } from "./ImageViewer";
import { ZipExplorer } from "./ZipExplorer";
import { OfficePreview } from "./OfficePreview";
import { pushRecentItem } from "@/lib/client/recent";
import type { PreviewKind } from "@/lib/storage/preview";

interface PreviewData {
  previewable: boolean;
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  previewKind?: PreviewKind;
  fileName: string;
  originalName?: string;
  sizeBytes?: number;
  extension?: string;
  reason?: string;
}

interface FilePreviewModalProps {
  fileId: string;
  onClose: () => void;
}

interface RelatedPost {
  id: string;
  title: string;
  slug?: string;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(ext?: string) {
  if (!ext) return <FileIcon size={48} strokeWidth={1.2} />;
  const e = ext.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(e))
    return <ImageIcon size={48} strokeWidth={1.2} />;
  if (["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(e))
    return <Music size={48} strokeWidth={1.2} />;
  if (["mp4", "webm", "mov", "mkv"].includes(e))
    return <Video size={48} strokeWidth={1.2} />;
  if (["zip"].includes(e)) return <Archive size={48} strokeWidth={1.2} />;
  if (["xls", "xlsx", "csv", "ppt", "pptx", "doc", "docx"].includes(e))
    return <FileSpreadsheet size={48} strokeWidth={1.2} />;
  if (["pdf", "txt", "md"].includes(e)) return <FileText size={48} strokeWidth={1.2} />;
  return <FileIcon size={48} strokeWidth={1.2} />;
}

function kindFromExt(ext?: string, mime?: string): PreviewKind {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime?.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (!ext) return "unsupported";
  const e = ext.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "ico"].includes(e)) return "image";
  if (["mp3", "wav", "ogg", "oga", "flac", "m4a", "aac", "opus", "weba"].includes(e)) return "audio";
  if (["mp4", "webm", "mov", "mkv", "ogv", "m4v"].includes(e)) return "video";
  if (["zip"].includes(e)) return "archive";
  if (["docx", "doc", "xlsx", "xls", "pptx", "ppt"].includes(e)) return "office";
  if (["pdf"].includes(e)) return "pdf";
  return "code";
}

export function FilePreviewModal({ fileId, onClose }: FilePreviewModalProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [showRelated, setShowRelated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/files/${fileId}/preview`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load preview");
        }
        const d = await res.json();
        if (cancelled) return;
        setData(d);
        try {
          pushRecentItem({
            id: fileId,
            type: "file",
            title: d.fileName || "File",
            extension: d.extension,
          });
        } catch {
          /* private mode */
        }
        // Related posts (Feature 9) — best effort
        fetch(`/api/files/${fileId}/related`)
          .then((r) => (r.ok ? r.json() : null))
          .then((rel) => {
            if (!cancelled && rel) {
              setRelated([
                ...((rel.mentioningPosts || []) as RelatedPost[]),
                ...((rel.tagRelatedPosts || []) as RelatedPost[]),
              ]);
            }
          })
          .catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Preview unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleKeyDown]);

  const handleDownload = () => {
    const url = data?.downloadUrl || `/api/files/${fileId}/download`;
    window.open(url, "_blank");
  };

  const handleOpenFullscreen = () => {
    if (data?.previewUrl) {
      window.open(data.previewUrl, "_blank");
    }
  };

  const kind: PreviewKind =
    data?.previewKind || kindFromExt(data?.extension, data?.mimeType);

  const renderContent = () => {
    if (!data?.previewable || !data.previewUrl) return null;
    const url = data.previewUrl;
    switch (kind) {
      case "image":
        return <ImageViewer url={url} alt={data.fileName} />;
      case "audio":
        return <MediaPreview url={url} kind="audio" fileName={data.fileName} mimeType={data.mimeType} />;
      case "video":
        return <MediaPreview url={url} kind="video" fileName={data.fileName} mimeType={data.mimeType} />;
      case "code":
        return <CodePreview url={url} extension={data.extension} fileName={data.fileName} />;
      case "archive":
        return <ZipExplorer fileId={fileId} fileName={data.fileName} />;
      case "office":
        return (
          <OfficePreview
            url={url}
            extension={data.extension}
            fileName={data.fileName}
            downloadUrl={data.downloadUrl || `/api/files/${fileId}/download`}
          />
        );
      case "pdf":
        return <iframe src={url} className="preview-iframe" title={data.fileName} />;
      default:
        return <iframe src={url} className="preview-iframe" title={data.fileName} />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="preview-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="preview-modal" role="dialog" aria-label="File preview">
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title-row">
            {data && getFileIcon(data.extension)}
            <div className="preview-title-info">
              <h3 className="preview-filename">{data?.fileName || "Loading..."}</h3>
              {data?.sizeBytes != null && (
                <span className="preview-meta">
                  {data.extension?.toUpperCase()} · {formatBytes(data.sizeBytes)} · {kind}
                  {related.length > 0 && ` · 📄 ${related.length} related`}
                </span>
              )}
            </div>
          </div>
          <div className="preview-actions">
            {related.length > 0 && (
              <button
                className="preview-btn"
                onClick={() => setShowRelated((s) => !s)}
                title="Mentioned in posts"
              >
                <FileText size={16} />
                <span>Posts ({related.length})</span>
              </button>
            )}
            {data?.previewable && data.previewUrl && kind !== "archive" && (
              <button
                className="preview-btn"
                onClick={handleOpenFullscreen}
                title="Open in new tab"
              >
                <Maximize2 size={16} />
              </button>
            )}
            <button className="preview-btn preview-download-btn" onClick={handleDownload}>
              <Download size={16} />
              <span>Download</span>
            </button>
            <button className="preview-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {showRelated && related.length > 0 && (
          <div className="preview-related">
            <span className="related-label">Mentioned in Posts:</span>
            {related.slice(0, 6).map((p) => (
              <a key={p.id} className="related-chip" href={`/posts?post=${p.id}`} title={p.title}>
                <ExternalLink size={11} /> {p.title.slice(0, 40)}
              </a>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="preview-content">
          {loading && (
            <div className="preview-loading">
              <Loader2 size={32} className="spin" />
              <p>Loading preview…</p>
            </div>
          )}

          {error && (
            <div className="preview-error">
              <FileIcon size={48} strokeWidth={1.2} />
              <p>{error}</p>
              <button className="preview-btn preview-download-btn" onClick={handleDownload}>
                <Download size={16} />
                Download File
              </button>
            </div>
          )}

          {data && !loading && !error && data.previewable && data.previewUrl && renderContent()}

          {data && !loading && !error && !data.previewable && (
            <div className="preview-fallback">
              {getFileIcon(data.extension)}
              <h4>{data.fileName}</h4>
              <p className="preview-fallback-reason">
                {data.reason || "Preview not available for this file type"}
              </p>
              <button className="preview-btn preview-download-btn" onClick={handleDownload}>
                <Download size={16} />
                Download to View
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .preview-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1100;
          animation: fade-in 0.2s ease-out;
        }
        .preview-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(94vw, 1080px);
          max-height: 88vh;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          z-index: 1101;
          display: flex;
          flex-direction: column;
          animation: modal-enter 0.25s ease-out;
          overflow: hidden;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-enter {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--border-subtle);
          gap: var(--space-4);
          flex-wrap: wrap;
        }
        .preview-title-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          color: var(--text-secondary);
          min-width: 0;
        }
        .preview-title-info {
          min-width: 0;
        }
        .preview-filename {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .preview-meta {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .preview-actions {
          display: flex;
          gap: var(--space-2);
          flex-shrink: 0;
          align-items: center;
          flex-wrap: wrap;
        }
        .preview-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .preview-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }
        .preview-download-btn {
          background: var(--color-primary);
          color: var(--text-on-primary);
          border-color: transparent;
        }
        .preview-download-btn:hover {
          background: var(--color-primary-hover);
          color: var(--text-on-primary);
        }
        .preview-related {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-card);
          overflow-x: auto;
        }
        .related-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .related-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--color-primary);
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.25);
          padding: 3px 9px;
          border-radius: 9999px;
          text-decoration: none;
          white-space: nowrap;
        }
        .preview-content {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: stretch;
          justify-content: center;
          min-height: 300px;
        }
        .preview-loading,
        .preview-error,
        .preview-fallback {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-12);
          text-align: center;
          color: var(--text-muted);
          margin: auto;
        }
        .preview-fallback h4 {
          color: var(--text-primary);
          font-size: var(--text-lg);
          margin: 0;
        }
        .preview-fallback-reason {
          font-size: var(--text-sm);
          max-width: 320px;
        }
        .preview-iframe {
          width: 100%;
          height: 62vh;
          border: none;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .preview-loading :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @media (max-width: 768px) {
          .preview-modal {
            width: 95vw;
            max-height: 90vh;
          }
        }
      `}</style>
    </>
  );
}
