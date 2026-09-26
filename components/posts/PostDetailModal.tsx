"use client";

import React, { useEffect, useCallback, useState } from "react";
import { X, Calendar, User, Pencil, Eye, Download, Paperclip, Pin, History, Link2 } from "lucide-react";
import type { PostWithAuthor, PostRecord, PostAttachmentWithFile } from "@/types/posts";
import { CodeSnippetViewer } from "./CodeSnippetViewer";
import { PostHistoryModal } from "./PostHistoryModal";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { FilePreviewModal } from "@/components/storage/FilePreviewModal";
import { renderMarkdown } from "@/lib/posts/markdown";
import { pushRecentItem } from "@/lib/client/recent";

interface PostDetailModalProps {
  post: PostWithAuthor;
  onClose: () => void;
  isAdmin: boolean;
  onEdit: (p: PostRecord) => void;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Not published";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PostDetailModal({
  post,
  onClose,
  isAdmin,
  onEdit,
}: PostDetailModalProps) {
  const rec = post as unknown as Record<string, unknown>;
  const postType = (rec.post_type as string) === "code" ? "code" : "article";
  const isPinned = Boolean(rec.is_pinned);
  const [attachments, setAttachments] = useState<PostAttachmentWithFile[]>([]);
  const [related, setRelated] = useState<{ id: string; title: string }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  useEffect(() => {
    try {
      pushRecentItem({ id: post.id, type: "post", title: post.title });
    } catch {
      /* noop */
    }
    fetch(`/api/posts/${post.id}/attachments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.attachments) setAttachments(d.attachments);
      })
      .catch(() => {});
    fetch(`/api/posts/${post.id}/related`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.relatedPosts) setRelated(d.relatedPosts);
      })
      .catch(() => {});
  }, [post.id, post.title]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewFileId) {
          setPreviewFileId(null);
          return;
        }
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        e.stopImmediatePropagation();
        onClose();
      }
    },
    [onClose, previewFileId, historyOpen]
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

  const downloadAll = () => {
    attachments.forEach((a, i) => {
      setTimeout(() => {
        window.open(`/api/files/${a.file_id}/download`, "_blank");
      }, i * 400);
    });
  };

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className={`detail-modal ${isPinned ? "pinned" : ""}`} role="dialog" aria-modal="true">
        <div className="detail-header">
          <div className="detail-meta-left">
            {isPinned && (
              <span className="pinned-badge"><Pin size={11} /> Pinned</span>
            )}
            {postType === "code" && <span className="code-badge">{"</>"} Code</span>}
            <span className={`status-pill status-${post.status}`}>
              {post.status}
            </span>
            <span className="detail-date">
              <Calendar size={13} />
              {formatDate(post.published_at || post.created_at)}
            </span>
          </div>

          <div className="detail-actions">
            <BookmarkButton itemType="post" itemId={post.id} />
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setHistoryOpen(true)}
                  title="Version history"
                >
                  <History size={15} />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => onEdit(post)}
                  title="Edit Post"
                >
                  <Pencil size={15} />
                  <span>Edit</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="action-btn close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="detail-content">
          {post.featured_image_url && (
            <div className="featured-image-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="featured-image"
              />
            </div>
          )}

          <h1 className="detail-title">{post.title}</h1>

          {(post as unknown as { author?: { id: string; username: string; full_name: string; avatar_url: string } | null }).author && (
            <div className="author-bar">
              <div className="author-avatar">
                <User size={16} />
              </div>
              <div className="author-details">
                <span className="author-name">
                  {(post as unknown as { author: { full_name: string; username: string } }).author.full_name ||
                    (post as unknown as { author: { username: string } }).author.username ||
                    "Admin"}
                </span>
                <span className="author-role">Author</span>
              </div>
            </div>
          )}

          {post.excerpt && (
            <div className="detail-excerpt">
              <p>{post.excerpt}</p>
            </div>
          )}

          <div className="detail-body">
            {postType === "code" ? (
              <CodeSnippetViewer
                code={post.content || ""}
                language={(rec.code_language as string) || undefined}
                filename={(rec.code_filename as string) || undefined}
              />
            ) : post.content ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
              />
            ) : (
              <p className="no-content">No content provided for this post.</p>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="attach-section">
              <div className="attach-head">
                <span><Paperclip size={13} /> Attached Files ({attachments.length})</span>
                <button type="button" className="attach-dl" onClick={downloadAll}>
                  <Download size={12} /> Download All
                </button>
              </div>
              <div className="attach-grid">
                {attachments.map((a) => (
                  <div key={a.id} className="attach-card">
                    <div className="attach-info">
                      <span className="attach-name" title={a.file?.display_name || a.file?.original_name}>
                        {a.file?.display_name || a.file?.original_name || a.file_id}
                      </span>
                      <span className="attach-meta">
                        {(a.file?.extension || "").toUpperCase()} · {formatBytes(a.file?.size_bytes)}
                      </span>
                    </div>
                    <div className="attach-actions">
                      <button type="button" className="mini-btn" onClick={() => setPreviewFileId(a.file_id)}>
                        <Eye size={13} /> Preview
                      </button>
                      <a className="mini-btn" href={`/api/files/${a.file_id}/download`} download>
                        <Download size={13} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="related-section">
              <span className="related-label"><Link2 size={12} /> Referenced Vault Files — related reading</span>
              <div className="related-list">
                {related.map((r) => (
                  <span key={r.id} className="related-chip">{r.title.slice(0, 60)}</span>
                ))}
              </div>
            </div>
          )}

          {post.tags && (post.tags as string[]).length > 0 && (
            <div className="tags-section">
              <span className="tags-label">Tags:</span>
              <div className="tags-list">
                {(post.tags as string[]).map((tag) => (
                  <span key={tag} className="tag-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {historyOpen && (
        <PostHistoryModal
          postId={post.id}
          onClose={() => setHistoryOpen(false)}
          onRestored={() => {
            setHistoryOpen(false);
            window.location.reload();
          }}
        />
      )}

      {previewFileId && (
        <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
      )}

      <style jsx>{`
        .detail-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1100;
          animation: fade-in 0.2s ease-out;
        }
        .detail-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(94vw, 820px);
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
        .detail-modal.pinned {
          border-color: rgba(16,185,129,0.55);
          box-shadow: 0 0 0 1px rgba(16,185,129,0.4), 0 0 32px rgba(16,185,129,0.18), var(--shadow-xl);
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-enter {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap;
          gap: 8px;
        }
        .detail-meta-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .pinned-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 9px;
          border-radius: 9999px;
          background: rgba(16,185,129,0.15);
          color: #10b981;
          border: 1px solid rgba(16,185,129,0.4);
        }
        .code-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 9999px;
          background: rgba(99,102,241,0.14);
          color: var(--color-primary);
        }
        .status-pill {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 8px;
          border-radius: var(--radius-full, 9999px);
        }
        .status-published {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }
        .status-draft {
          background: rgba(234, 179, 8, 0.15);
          color: #eab308;
        }
        .status-archived {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }
        .detail-date {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .detail-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          padding: 6px 12px;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }
        .close-btn {
          padding: 6px;
          border: none;
        }
        .detail-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }
        .featured-image-wrapper {
          width: 100%;
          max-height: 280px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--bg-input);
        }
        .featured-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .detail-title {
          font-size: var(--text-2xl);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          line-height: 1.25;
          margin: 0;
        }
        .author-bar {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--border-subtle);
        }
        .author-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full, 9999px);
          background: var(--bg-input);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          border: 1px solid var(--border-subtle);
        }
        .author-details {
          display: flex;
          flex-direction: column;
        }
        .author-name {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
        }
        .author-role {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .detail-excerpt {
          padding: var(--space-3) var(--space-4);
          background: var(--bg-input);
          border-left: 3px solid var(--color-primary);
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
          font-style: italic;
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
        .detail-body {
          color: var(--text-primary);
          font-size: var(--text-base);
          line-height: 1.7;
          word-break: break-word;
        }
        .markdown-body :global(h1) { font-size: 22px; margin: 0 0 12px; }
        .markdown-body :global(h2) { font-size: 18px; margin: 16px 0 8px; }
        .markdown-body :global(h3) { font-size: 16px; margin: 12px 0 6px; }
        .markdown-body :global(p) { margin: 0 0 12px; white-space: pre-wrap; }
        .markdown-body :global(blockquote) { border-left: 3px solid var(--color-primary); margin: 0 0 12px; padding: 8px 14px; background: var(--bg-input); border-radius: 0 8px 8px 0; }
        .markdown-body :global(code) { background: rgba(148,163,184,0.15); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
        .markdown-body :global(.md-codeblock) { background: #0b0f1a; color: #dbe2f1; padding: 14px 16px; border-radius: 10px; overflow: auto; }
        .markdown-body :global(ul), .markdown-body :global(ol) { margin: 0 0 12px 22px; }
        .markdown-body :global(table) { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
        .markdown-body :global(th), .markdown-body :global(td) { border: 1px solid var(--border-default); padding: 6px 10px; }
        .markdown-body :global(img) { max-width: 100%; border-radius: 8px; }
        .no-content {
          color: var(--text-muted);
          font-style: italic;
        }
        .attach-section, .related-section {
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 14px;
          background: var(--bg-card);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .attach-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; }
        .attach-head span { display: inline-flex; align-items: center; gap: 6px; }
        .attach-dl { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--color-primary); background: transparent; border: 1px solid rgba(99,102,241,0.3); padding: 5px 10px; border-radius: 7px; cursor: pointer; }
        .attach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
        .attach-card { border: 1px solid var(--border-subtle); border-radius: 9px; padding: 10px 12px; background: var(--bg-surface); display: flex; flex-direction: column; gap: 8px; }
        .attach-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .attach-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .attach-meta { font-size: 11px; color: var(--text-muted); }
        .attach-actions { display: flex; gap: 6px; }
        .mini-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 4px 9px; border-radius: 6px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-decoration: none; }
        .mini-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .related-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; }
        .related-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .related-chip { font-size: 12px; background: var(--bg-input); border: 1px solid var(--border-subtle); padding: 4px 10px; border-radius: 9999px; color: var(--text-secondary); }
        .tags-section {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border-subtle);
        }
        .tags-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-weight: var(--font-medium);
        }
        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tag-pill {
          font-size: 11px;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          padding: 2px 8px;
          border-radius: var(--radius-full, 9999px);
        }

        @media (max-width: 640px) {
          .detail-modal {
            width: calc(100vw - 20px);
            max-height: 92dvh;
          }
          .detail-header {
            padding: var(--space-3) var(--space-4);
          }
          .detail-content {
            padding: var(--space-4);
            gap: var(--space-3);
          }
          .detail-title {
            font-size: var(--text-lg);
          }
        }
      `}</style>
    </>
  );
}
