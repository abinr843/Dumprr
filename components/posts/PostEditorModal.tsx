"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2, Save, FileText, Image, Tag, Code, Paperclip, Pin } from "lucide-react";
import { MarkdownEditor } from "./MarkdownEditor";
import { apiFetch, ApiError } from "@/lib/client/api";
import { toast } from "@/components/ui/Toast";
import type { PostRecord } from "@/types/posts";

interface PostEditorModalProps {
  post: PostRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

interface AttachRow {
  id: string;
  file_id: string;
  display_order: number;
  file?: {
    id: string;
    display_name: string | null;
    original_name: string;
    name: string;
    extension: string | null;
    size_bytes: number;
  } | null;
}

interface VaultFile {
  id: string;
  display_name: string | null;
  original_name: string;
  name: string;
  extension: string | null;
  size_bytes: number;
}

const CODE_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "sql",
  "bash",
  "json",
  "yaml",
  "html",
  "css",
  "markdown",
  "txt",
];

export function PostEditorModal({ post, onClose, onSaved }: PostEditorModalProps) {
  const isEditing = Boolean(post);
  const p = post as unknown as Record<string, unknown> | null;

  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [slugManual, setSlugManual] = useState(Boolean(post?.slug));
  const [content, setContent] = useState(post?.content || "");
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    (post?.status as "draft" | "published" | "archived") || "published"
  );
  const [featuredImageUrl, setFeaturedImageUrl] = useState(
    post?.featured_image_url || ""
  );
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(post?.tags) ? (post.tags as string[]).join(", ") : ""
  );
  const [postType, setPostType] = useState<"article" | "code">(
    ((p?.post_type as string) === "code" ? "code" : "article")
  );
  const [codeLanguage, setCodeLanguage] = useState<string>(
    (p?.code_language as string) || "typescript"
  );
  const [codeFilename, setCodeFilename] = useState<string>(
    (p?.code_filename as string) || ""
  );
  const [isPinned, setIsPinned] = useState(Boolean(p?.is_pinned));
  const [changeSummary, setChangeSummary] = useState("");

  const [attachments, setAttachments] = useState<AttachRow[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"attach" | "insert">("attach");
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Field-level validation messages from the server (Zod details)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Load existing attachments when editing
  useEffect(() => {
    if (!post) return;
    fetch(`/api/posts/${post.id}/attachments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.attachments) setAttachments(d.attachments);
      })
      .catch(() => {});
  }, [post]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showFilePicker) {
          setShowFilePicker(false);
          return;
        }
        e.stopImmediatePropagation();
        onClose();
      }
    },
    [onClose, showFilePicker]
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

  const openPicker = (mode: "attach" | "insert") => {
    setPickerMode(mode);
    setShowFilePicker(true);
    setPickerLoading(true);
    fetch("/api/files?folder_id=null&status=active")
      .then((r) => r.json())
      .then((d) => {
        setVaultFiles(d.files || []);
        setPickerLoading(false);
      })
      .catch(() => setPickerLoading(false));
  };

  const handlePickFile = async (f: VaultFile) => {
    if (pickerMode === "insert") {
      const label = f.display_name || f.original_name || f.name;
      const snippet = (f.extension || "").match(/^(png|jpe?g|gif|webp|svg)$/i)
        ? `![${label}](/api/files/${f.id}/preview)`
        : `[${label}](/api/files/${f.id}/download)`;
      setContent((c) => `${c}${c.endsWith("\n") || c === "" ? "" : "\n"}${snippet}\n`);
      setShowFilePicker(false);
      return;
    }
    // attach mode
    if (!post) {
      // Not yet created: stage locally; real attach happens after save via pending list
      setAttachments((prev) =>
        prev.some((a) => a.file_id === f.id)
          ? prev
          : [...prev, { id: `pending-${f.id}`, file_id: f.id, display_order: prev.length, file: f }]
      );
      setShowFilePicker(false);
      return;
    }
    try {
      await apiFetch(`/api/posts/${post.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: [f.id] }),
      });
      const d = await fetch(`/api/posts/${post.id}/attachments`).then((r) => r.json());
      if (d?.attachments) setAttachments(d.attachments);
      toast.success("File attached");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't attach that file";
      setError(msg);
      toast.error("Couldn't attach file", { description: msg });
    } finally {
      setShowFilePicker(false);
    }
  };

  const handleDetach = async (fileId: string, rowId: string) => {
    if (rowId.startsWith("pending-")) {
      setAttachments((prev) => prev.filter((a) => a.file_id !== fileId));
      return;
    }
    if (!post) return;
    try {
      await apiFetch(`/api/posts/${post.id}/attachments/${fileId}`, { method: "DELETE" });
      setAttachments((prev) => prev.filter((a) => a.file_id !== fileId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't remove that file";
      setError(msg);
      toast.error("Couldn't detach file", { description: msg });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFieldErrors({ title: "Please give your post a title." });
      setError("Please give your post a title before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      content: content.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      status,
      featured_image_url: featuredImageUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      post_type: postType,
      code_language: postType === "code" ? codeLanguage : undefined,
      code_filename: postType === "code" ? codeFilename.trim() || undefined : undefined,
      is_pinned: isPinned,
    };
    if (isEditing && changeSummary.trim()) {
      payload.change_summary = changeSummary.trim();
    }

    try {
      const url = isEditing ? `/api/posts/${post!.id}` : "/api/posts";
      const method = isEditing ? "PATCH" : "POST";

      const saved = await apiFetch<{ post?: { id: string } }>(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const savedId: string | undefined = saved?.post?.id || post?.id;

      // Flush pending attachments for newly created posts
      const pending = attachments.filter((a) => a.id.startsWith("pending-"));
      if (savedId && pending.length > 0) {
        await apiFetch(`/api/posts/${savedId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_ids: pending.map((a) => a.file_id) }),
        }).catch(() => {
          toast.info("Post saved, but some attachments didn't stick", {
            description: "You can re-attach them by editing the post.",
          });
        });
      }

      toast.success(
        isEditing ? "Post updated" : status === "published" ? "Post published!" : "Draft saved"
      );
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't save your post";
      // Map server Zod details to per-field messages
      if (err instanceof ApiError) {
        const zod = err.details as
          | { fieldErrors?: Record<string, string[]> }
          | undefined;
        if (zod?.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [field, msgs] of Object.entries(zod.fieldErrors)) {
            if (Array.isArray(msgs) && msgs.length > 0) mapped[field] = msgs[0];
          }
          setFieldErrors(mapped);
        }
      }
      setError(msg);
      toast.error("Couldn't save post", { description: msg });
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
              {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
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
              {fieldErrors.slug && <span className="field-error">{fieldErrors.slug}</span>}
            </div>

            {/* Type + Pin row */}
            <div className="form-row">
              <div className="form-group flex-1">
                <span className="form-label">Post Type</span>
                <div className="seg">
                  <button
                    type="button"
                    className={`seg-btn ${postType === "article" ? "active" : ""}`}
                    onClick={() => setPostType("article")}
                  >
                    <FileText size={13} /> Article
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${postType === "code" ? "active" : ""}`}
                    onClick={() => setPostType("code")}
                  >
                    <Code size={13} /> Code
                  </button>
                </div>
              </div>
              <div className="form-group flex-1">
                <span className="form-label">Visibility</span>
                <label className="pin-check">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <Pin size={13} /> Pinned to top
                </label>
              </div>
            </div>

            {postType === "code" && (
              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="post-lang" className="form-label">Language</label>
                  <select
                    id="post-lang"
                    className="form-select"
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                  >
                    {CODE_LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex-2">
                  <label htmlFor="post-filename" className="form-label">Filename</label>
                  <input
                    id="post-filename"
                    type="text"
                    className="form-input mono"
                    placeholder="supabase-auth.ts"
                    value={codeFilename}
                    onChange={(e) => setCodeFilename(e.target.value)}
                  />
                  {fieldErrors.code_filename && (
                    <span className="field-error">{fieldErrors.code_filename}</span>
                  )}
                </div>
              </div>
            )}

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
                  onChange={(e) => setStatus(e.target.value as "draft" | "published" | "archived")}
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
                {fieldErrors.featured_image_url && (
                  <span className="field-error">{fieldErrors.featured_image_url}</span>
                )}
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
              {fieldErrors.excerpt && <span className="field-error">{fieldErrors.excerpt}</span>}
            </div>

            {/* Content — rich markdown workstation */}
            <div className="form-group">
              <label htmlFor="post-content" className="form-label">
                Content (Markdown supported)
              </label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                onInsertFiles={() => openPicker("insert")}
              />
              {fieldErrors.content && <span className="field-error">{fieldErrors.content}</span>}
            </div>

            {isEditing && (
              <div className="form-group">
                <label htmlFor="post-change" className="form-label">
                  Change summary (version note)
                </label>
                <input
                  id="post-change"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Fixed install steps for v2"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                />
              </div>
            )}

            {/* Attachments */}
            <div className="form-group">
              <span className="form-label">
                <Paperclip size={13} style={{ display: "inline", marginRight: 4 }} />
                Attached Files ({attachments.length})
              </span>
              {attachments.length > 0 && (
                <div className="attach-list">
                  {attachments.map((a) => (
                    <span key={a.id} className="attach-pill">
                      {(a.file?.display_name || a.file?.original_name || a.file_id).slice(0, 28)}
                      <button type="button" onClick={() => handleDetach(a.file_id, a.id)} aria-label="Remove">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" className="attach-btn" onClick={() => openPicker("attach")}>
                <Paperclip size={13} /> Attach Files from Vault
              </button>
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
              {fieldErrors.tags && <span className="field-error">{fieldErrors.tags}</span>}
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

        {/* File picker sub-modal */}
        {showFilePicker && (
          <>
            <div className="picker-backdrop" onClick={() => setShowFilePicker(false)} />
            <div className="picker-modal" role="dialog" aria-label="Select file">
              <div className="picker-head">
                <h4>{pickerMode === "attach" ? "Attach Vault Files" : "Insert File Reference"}</h4>
                <button type="button" className="editor-close-btn" onClick={() => setShowFilePicker(false)} aria-label="Close picker">
                  <X size={15} />
                </button>
              </div>
              <div className="picker-body">
                {pickerLoading ? (
                  <div className="picker-state"><Loader2 size={18} className="spin" /> Loading vault…</div>
                ) : vaultFiles.length === 0 ? (
                  <div className="picker-state">No files in vault root. Upload files first.</div>
                ) : (
                  vaultFiles.map((f) => (
                    <button key={f.id} type="button" className="picker-row" onClick={() => handlePickFile(f)}>
                      <FileText size={15} />
                      <span className="picker-name">{f.display_name || f.original_name || f.name}</span>
                      <span className="picker-ext">{(f.extension || "").toUpperCase()}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
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
          width: min(94vw, 860px);
          max-height: 92vh;
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
        .form-input.mono { font-family: monospace; }
        .form-textarea {
          resize: vertical;
          min-height: 140px;
          font-family: inherit;
        }
        .form-textarea.short {
          min-height: 60px;
        }
        .field-error {
          font-size: var(--text-xs);
          color: #f87171;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .field-error::before {
          content: "⚠";
          font-size: 11px;
        }
        .seg { display: inline-flex; gap: 4px; background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: 9px; padding: 3px; width: fit-content; }
        .seg-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; }
        .seg-btn.active { background: var(--bg-elevated); color: var(--text-primary); box-shadow: var(--shadow-sm); }
        .pin-check { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--text-secondary); background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: 9px; padding: 8px 12px; cursor: pointer; width: fit-content; }
        .attach-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .attach-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); color: var(--text-primary); padding: 4px 6px 4px 10px; border-radius: 9999px; }
        .attach-pill button { display: inline-flex; background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; border-radius: 50%; }
        .attach-pill button:hover { color: #f87171; }
        .attach-btn { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 13px; font-weight: 600; color: var(--color-primary); background: transparent; border: 1px dashed rgba(99,102,241,0.4); padding: 7px 12px; border-radius: 8px; cursor: pointer; }
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
        .picker-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1110; }
        .picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: min(90vw, 480px); max-height: 70vh; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; z-index: 1111; display: flex; flex-direction: column; overflow: hidden; }
        .picker-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); }
        .picker-head h4 { margin: 0; font-size: 14px; }
        .picker-body { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        .picker-state { padding: 28px; text-align: center; color: var(--text-muted); font-size: 13px; display: flex; gap: 8px; align-items: center; justify-content: center; }
        .picker-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; color: var(--text-primary); font-size: 13px; text-align: left; }
        .picker-row:hover { background: var(--bg-hover); }
        .picker-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .picker-ext { font-size: 10px; font-weight: 800; color: var(--color-primary); }
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
