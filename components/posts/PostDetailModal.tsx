"use client";

import React, { useEffect, useCallback } from "react";
import { X, Calendar, User, Tag, Pencil, Eye, ExternalLink } from "lucide-react";
import type { PostWithAuthor, PostRecord } from "@/types/posts";

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

export function PostDetailModal({
  post,
  onClose,
  isAdmin,
  onEdit,
}: PostDetailModalProps) {
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

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-modal" role="dialog" aria-modal="true">
        <div className="detail-header">
          <div className="detail-meta-left">
            <span className={`status-pill status-${post.status}`}>
              {post.status}
            </span>
            <span className="detail-date">
              <Calendar size={13} />
              {formatDate(post.published_at || post.created_at)}
            </span>
          </div>

          <div className="detail-actions">
            {isAdmin && (
              <button
                type="button"
                className="action-btn"
                onClick={() => onEdit(post)}
                title="Edit Post"
              >
                <Pencil size={15} />
                <span>Edit</span>
              </button>
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

          {post.author && (
            <div className="author-bar">
              <div className="author-avatar">
                <User size={16} />
              </div>
              <div className="author-details">
                <span className="author-name">
                  {post.author.full_name || post.author.username || "Admin"}
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
            {post.content ? (
              <div className="content-text">{post.content}</div>
            ) : (
              <p className="no-content">No content provided for this post.</p>
            )}
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="tags-section">
              <span className="tags-label">Tags:</span>
              <div className="tags-list">
                {post.tags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
          width: min(92vw, 760px);
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
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border-subtle);
        }
        .detail-meta-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
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
          white-space: pre-wrap;
          word-break: break-word;
        }
        .no-content {
          color: var(--text-muted);
          font-style: italic;
        }
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
