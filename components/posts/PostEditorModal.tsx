"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2, Save, Send, Eye, FileText, Image, Tag } from "lucide-react";
import type { PostRecord } from "@/types/posts";

interface PostEditorModalProps {
  post: PostRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PostEditorModal({ post, onClose, onSaved }: PostEditorModalProps) {
  const isEditing = Boolean(post);

  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [slugManual, setSlugManual] = useState(Boolean(post?.slug));
  const [content, setContent] = useState(post?.content || "");
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    (post?.status as any) || "published"
  );
  const [featuredImageUrl, setFeaturedImageUrl] = useState(
    post?.featured_image_url || ""
  );
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(post?.tags) ? post.tags.join(", ") : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from title if user hasn't typed a custom slug
  useEffect(() => {
    if (!slugManual && !isEditing) {
      const generated = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  }, [title, slugManual, isEditing]);

  // Handle escape key
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      content: content.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      status,
      featured_image_url: featuredImageUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    try {
      const url = isEditing ? `/api/posts/${post!.id}` : "/api/posts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save post");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="editor-backdrop" onClick={onClose} />
      <div className="editor-modal" role="dialog" aria-modal="true">
        <div className="editor-header">
          <div className="editor-header-info">
            <FileText size={20} className="editor-header-icon" />
            <h2 className="editor-header-title">
              {isEditing ? "Edit Post" : "Create New Post"}
            </h2>
          </div>
          <button
            type="button"
            className="editor-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="editor-form">
          {error && <div className="editor-error">{error}</div>}

          <div className="editor-body">
            {/* Title */}
            <div className="form-group">
              <label htmlFor="post-title" className="form-label">
                Title <span className="required">*</span>
              </label>
              <input
                id="post-title"
                type="text"
                className="form-input"
                placeholder="Enter post title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Slug */}
            <div className="form-group">
              <label htmlFor="post-slug" className="form-label">
                Slug (URL Identifier)
              </label>
              <input
                id="post-slug"
                type="text"
                className="form-input"
                placeholder="post-url-slug"
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(e.target.value);
                }}
              />
            </div>

            {/* Status & Featured Image Row */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="post-status" className="form-label">
                  Publish Status
                </label>
                <select
                  id="post-status"
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="draft">Draft (Private)</option>
                  <option value="published">Published (Public)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="form-group flex-2">
                <label htmlFor="post-image" className="form-label">
                  <Image size={14} style={{ display: "inline", marginRight: 4 }} />
                  Featured Image URL
                </label>
                <input
                  id="post-image"
                  type="url"
                  className="form-input"
                  placeholder="https://images.unsplash.com/..."
                  value={featuredImageUrl}
                  onChange={(e) => setFeaturedImageUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Excerpt */}
            <div className="form-group">
              <label htmlFor="post-excerpt" className="form-label">
                Short Excerpt
              </label>
              <textarea
                id="post-excerpt"
                className="form-textarea short"
                placeholder="A brief 1-2 sentence preview of this post..."
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
              />
            </div>

            {/* Content */}
            <div className="form-group">
              <label htmlFor="post-content" className="form-label">
                Content (Markdown supported)
              </label>
              <textarea
                id="post-content"
                className="form-textarea"
                placeholder="Write your post content here..."
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div className="form-group">
              <label htmlFor="post-tags" className="form-label">
                <Tag size={14} style={{ display: "inline", marginRight: 4 }} />
                Tags (comma separated)
              </label>
              <input
                id="post-tags"
                type="text"
                className="form-input"
                placeholder="announcement, release, updates"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          <div className="editor-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !title.trim()}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isEditing ? "Save Changes" : "Publish Post"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .editor-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1100;
          animation: fade-in 0.2s ease-out;
        }
        .editor-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(92vw, 760px);
          max-height: 90vh;
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
        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border-subtle);
        }
        .editor-header-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .editor-header-icon {
          color: var(--color-primary);
        }
        .editor-header-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0;
        }
        .editor-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .editor-close-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .editor-form {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }
        .editor-error {
          background: rgba(239, 68, 68, 0.12);
          border-left: 4px solid var(--color-danger, #ef4444);
          color: var(--color-danger, #ef4444);
          padding: var(--space-3) var(--space-6);
          font-size: var(--text-sm);
        }
        .editor-body {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .form-row {
          display: flex;
          gap: var(--space-4);
        }
        .flex-1 { flex: 1; }
        .flex-2 { flex: 2; }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-label {
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .required {
          color: var(--color-danger, #ef4444);
        }
        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          color: var(--text-primary);
          font-size: var(--text-sm);
          outline: none;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        .form-textarea {
          resize: vertical;
          min-height: 140px;
          font-family: inherit;
        }
        .form-textarea.short {
          min-height: 60px;
        }
        .editor-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--space-3);
          padding: var(--space-4) var(--space-6);
          border-top: 1px solid var(--border-subtle);
          background: var(--bg-card);
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
          border: 1px solid transparent;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: transparent;
          border-color: var(--border-default);
          color: var(--text-secondary);
        }
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .btn-primary {
          background: var(--color-primary);
          color: var(--text-on-primary, #ffffff);
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover, #4f46e5);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 640px) {
          .editor-modal {
            width: calc(100vw - 20px);
            max-height: 94dvh;
          }
          .editor-header {
            padding: var(--space-3) var(--space-4);
          }
          .editor-body {
            padding: var(--space-4);
            gap: var(--space-3);
          }
          .form-row {
            flex-direction: column;
            gap: var(--space-3);
          }
          .editor-footer {
            padding: var(--space-3) var(--space-4);
          }
        }
      `}</style>
    </>
  );
}
