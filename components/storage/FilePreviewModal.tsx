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
} from "lucide-react";

interface PreviewData {
  previewable: boolean;
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
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
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(e))
    return <ImageIcon size={48} strokeWidth={1.2} />;
  if (["pdf", "txt", "doc", "docx"].includes(e))
    return <FileText size={48} strokeWidth={1.2} />;
  return <FileIcon size={48} strokeWidth={1.2} />;
}

export function FilePreviewModal({ fileId, onClose }: FilePreviewModalProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/files/${fileId}/preview`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load preview");
        }
        const d = await res.json();
        setData(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview unavailable");
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
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
                  {data.extension?.toUpperCase()} · {formatBytes(data.sizeBytes)}
                </span>
              )}
            </div>
          </div>
          <div className="preview-actions">
            {data?.previewable && data.previewUrl && (
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

          {data && !loading && !error && data.previewable && data.previewUrl && (
            <>
              {data.mimeType?.startsWith("image/") ? (
                <div className="preview-image-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.previewUrl}
                    alt={data.fileName}
                    className="preview-image"
                  />
                </div>
              ) : data.mimeType === "application/pdf" ? (
                <iframe
                  src={data.previewUrl}
                  className="preview-iframe"
                  title={data.fileName}
                />
              ) : data.mimeType === "text/plain" ? (
                <TextPreview url={data.previewUrl} />
              ) : (
                <iframe
                  src={data.previewUrl}
                  className="preview-iframe"
                  title={data.fileName}
                />
              )}
            </>
          )}

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
          width: min(90vw, 1000px);
          max-height: 85vh;
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
        .preview-content {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: center;
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
        .preview-image-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          width: 100%;
          height: 100%;
        }
        .preview-image {
          max-width: 100%;
          max-height: 60vh;
          border-radius: var(--radius-md);
          object-fit: contain;
        }
        .preview-iframe {
          width: 100%;
          height: 60vh;
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

/** Fetches and renders text content */
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        setText(t.slice(0, 50000)); // Cap preview at 50KB
        setLoading(false);
      })
      .catch(() => {
        setText("Failed to load text content");
        setLoading(false);
      });
  }, [url]);

  if (loading) return <div className="preview-loading"><Loader2 size={24} className="spin" /></div>;

  return (
    <pre
      style={{
        width: "100%",
        padding: "var(--space-6)",
        margin: 0,
        overflow: "auto",
        fontSize: "var(--text-sm)",
        fontFamily: "var(--font-mono, monospace)",
        color: "var(--text-primary)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: "60vh",
      }}
    >
      {text}
    </pre>
  );
}
