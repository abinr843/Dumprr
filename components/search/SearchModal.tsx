"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Folder,
  ArrowRight,
  Loader2,
  Clock,
  HardDrive,
  Download,
  Eye,
} from "lucide-react";
import type { SearchCategory, SearchResultItem, SearchApiResponse } from "@/types/search";
import { FilePreviewModal } from "@/components/storage/FilePreviewModal";
import { PostDetailModal } from "@/components/posts/PostDetailModal";
import type { PostWithAuthor } from "@/types/posts";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getItemIcon(item: SearchResultItem) {
  if (item.type === "folder") {
    return <Folder size={18} className="icon-folder" />;
  }
  if (item.type === "post") {
    return <FileText size={18} className="icon-post" />;
  }
  const ext = (item.extension || "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return <ImageIcon size={18} className="icon-image" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet size={18} className="icon-sheet" />;
  }
  if (["ppt", "pptx"].includes(ext)) {
    return <Presentation size={18} className="icon-slides" />;
  }
  return <FileIcon size={18} className="icon-file" />;
}

export function SearchModal({ isOpen, onClose, isAdmin = false }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [results, setResults] = useState<SearchApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [viewPost, setViewPost] = useState<PostWithAuthor | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  // Handle global Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewFileId) {
          setPreviewFileId(null);
          return;
        }
        if (viewPost) {
          setViewPost(null);
          return;
        }
        onClose();
      }
    },
    [onClose, previewFileId, viewPost]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}&category=${category}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, category]);

  const handleSelect = async (item: SearchResultItem) => {
    if (item.type === "folder") {
      router.push(`/files?folder=${item.id}`);
      onClose();
    } else if (item.type === "file") {
      setPreviewFileId(item.id);
    } else if (item.type === "post") {
      try {
        const res = await fetch(`/api/posts/${item.id}`);
        if (res.ok) {
          const data = await res.json();
          setViewPost(data.post);
        }
      } catch (e) {
        router.push("/posts");
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  const allItems: SearchResultItem[] = results
    ? [
        ...(results.results.files || []),
        ...(results.results.posts || []),
        ...(results.results.folders || []),
      ]
    : [];

  return (
    <>
      <div className="search-backdrop" onClick={onClose} />
      <div className="search-modal" role="dialog" aria-modal="true">
        {/* Search Bar */}
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search files, posts, folders…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 size={16} className="spin search-loading-icon" />}
          {query && !loading && (
            <button
              type="button"
              className="clear-query-btn"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
          <button type="button" className="close-btn" onClick={onClose}>
            ESC
          </button>
        </div>

        {/* Categories Bar */}
        <div className="category-bar">
          {(["all", "files", "posts", "folders"] as SearchCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-pill ${category === cat ? "active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat === "all" ? "All Results" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              {results && cat !== "all" && (
                <span className="count-tag">
                  {cat === "files"
                    ? results.results.files.length
                    : cat === "posts"
                    ? results.results.posts.length
                    : results.results.folders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div className="search-results-area">
          {!query.trim() ? (
            <div className="search-placeholder">
              <Search size={32} strokeWidth={1.3} className="placeholder-icon" />
              <p>Type to search across documents, files, and announcements</p>
              <div className="quick-hints">
                <span>Tip: Search by filename, extension, post content, or folder</span>
              </div>
            </div>
          ) : loading && !results ? (
            <div className="search-loading">
              <Loader2 size={24} className="spin" />
              <span>Searching workspace…</span>
            </div>
          ) : allItems.length === 0 ? (
            <div className="search-no-results">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <span>Try checking for typos or searching a different term.</span>
            </div>
          ) : (
            <div className="search-results-list">
              {results?.results.folders && results.results.folders.length > 0 && (
                <div className="result-section">
                  <div className="result-section-title">
                    <Folder size={14} /> Folders ({results.results.folders.length})
                  </div>
                  {results.results.folders.map((item) => (
                    <div
                      key={item.id}
                      className="result-row"
                      onClick={() => handleSelect(item)}
                    >
                      <div className="result-icon-box">{getItemIcon(item)}</div>
                      <div className="result-info">
                        <span className="result-title">{item.title}</span>
                        <span className="result-sub">Folder</span>
                      </div>
                      <ArrowRight size={15} className="result-arrow" />
                    </div>
                  ))}
                </div>
              )}

              {results?.results.files && results.results.files.length > 0 && (
                <div className="result-section">
                  <div className="result-section-title">
                    <FileIcon size={14} /> Files ({results.results.files.length})
                  </div>
                  {results.results.files.map((item) => (
                    <div
                      key={item.id}
                      className="result-row"
                      onClick={() => handleSelect(item)}
                    >
                      <div className="result-icon-box">{getItemIcon(item)}</div>
                      <div className="result-info">
                        <span className="result-title">{item.title}</span>
                        <div className="result-tags">
                          <span className="type-badge">
                            {item.extension?.toUpperCase() || "FILE"}
                          </span>
                          <span className="size-badge">
                            {formatBytes(item.sizeBytes)}
                          </span>
                        </div>
                      </div>
                      <div className="result-quick-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="quick-action-btn"
                          title="Preview"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewFileId(item.id);
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={`/api/files/${item.id}/download`}
                          download={item.title}
                          className="quick-action-btn primary"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results?.results.posts && results.results.posts.length > 0 && (
                <div className="result-section">
                  <div className="result-section-title">
                    <FileText size={14} /> Posts ({results.results.posts.length})
                  </div>
                  {results.results.posts.map((item) => (
                    <div
                      key={item.id}
                      className="result-row"
                      onClick={() => handleSelect(item)}
                    >
                      <div className="result-icon-box">{getItemIcon(item)}</div>
                      <div className="result-info">
                        <span className="result-title">{item.title}</span>
                        {item.description && (
                          <span className="result-sub excerpt">
                            {item.description}
                          </span>
                        )}
                      </div>
                      <span className="post-status-pill">{item.status || "post"}</span>
                      <ArrowRight size={15} className="result-arrow" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="search-footer">
          <div className="search-hints">
            <span>Navigation: Click or Enter</span>
            <span className="dot">•</span>
            <span>Close: ESC</span>
          </div>
          {results && (
            <span className="total-results">
              {results.totalCount} result{results.totalCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Sub-modals for preview / post view */}
      {previewFileId && (
        <FilePreviewModal
          fileId={previewFileId}
          onClose={() => setPreviewFileId(null)}
        />
      )}

      {viewPost && (
        <PostDetailModal
          post={viewPost}
          onClose={() => setViewPost(null)}
          isAdmin={isAdmin}
          onEdit={() => {}}
        />
      )}

      <style jsx>{`
        .search-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(6px);
          z-index: 980;
          animation: fade-in 0.15s ease-out;
        }
        .search-modal {
          position: fixed;
          top: 15%;
          left: 50%;
          transform: translateX(-50%);
          width: min(92vw, 680px);
          max-height: 75vh;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xl);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          z-index: 981;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slide-down 0.2s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translate(-50%, -10px) scale(0.98); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--border-subtle);
        }
        .search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: var(--text-base);
        }
        .search-input::placeholder {
          color: var(--text-muted);
        }
        .clear-query-btn, .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .close-btn {
          font-size: 11px;
          font-weight: 700;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }
        .search-loading-icon {
          color: var(--color-primary);
        }
        .category-bar {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-5);
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-subtle);
          overflow-x: auto;
        }
        .category-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: var(--radius-full, 9999px);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .category-pill:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .category-pill.active {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.25);
          color: var(--color-primary);
        }
        .count-tag {
          font-size: 10px;
          padding: 1px 5px;
          background: var(--bg-input);
          border-radius: var(--radius-full, 9999px);
        }
        .search-results-area {
          flex: 1;
          overflow-y: auto;
          max-height: 52vh;
          min-height: 200px;
        }
        .search-placeholder, .search-loading, .search-no-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-12) var(--space-4);
          text-align: center;
          color: var(--text-muted);
          gap: var(--space-2);
        }
        .placeholder-icon {
          color: var(--border-strong);
        }
        .search-placeholder p {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0;
        }
        .quick-hints {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .search-results-list {
          display: flex;
          flex-direction: column;
          padding: var(--space-3) 0;
        }
        .result-section {
          margin-bottom: var(--space-3);
        }
        .result-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: var(--space-1) var(--space-5);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .result-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-5);
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .result-row:hover {
          background: var(--bg-hover);
        }
        .result-icon-box {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background: var(--bg-input);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-folder { color: #f59e0b; }
        .icon-post { color: #8b5cf6; }
        .icon-image { color: #ec4899; }
        .icon-sheet { color: #10b981; }
        .icon-slides { color: #f59e0b; }
        .icon-file { color: #3b82f6; }

        .result-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .result-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-sub {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .result-sub.excerpt {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-tags {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .type-badge, .size-badge {
          font-size: 10px;
          color: var(--text-muted);
        }
        .type-badge {
          font-weight: 700;
          color: var(--color-primary);
        }
        .post-status-pill {
          font-size: 10px;
          text-transform: uppercase;
          background: var(--bg-input);
          padding: 1px 6px;
          border-radius: var(--radius-full, 9999px);
          color: var(--text-muted);
        }
        .result-quick-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .quick-action-btn {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-decoration: none;
        }
        .quick-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .quick-action-btn.primary {
          color: var(--color-primary);
        }
        .result-arrow {
          color: var(--text-muted);
          opacity: 0.5;
        }
        .result-row:hover .result-arrow {
          opacity: 1;
          color: var(--text-primary);
        }
        .search-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-5);
          background: var(--bg-card);
          border-top: 1px solid var(--border-subtle);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .search-hints {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dot { opacity: 0.5; }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
}
