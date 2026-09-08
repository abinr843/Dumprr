"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  FileText,
  Pencil,
  Trash2,
  RotateCcw,
  ExternalLink,
  MoreVertical,
  Loader2,
  Eye,
  Clock,
  Archive,
  Send,
  AlertTriangle,
} from "lucide-react";
import { PostEditorModal } from "./PostEditorModal";
import { PostDetailModal } from "./PostDetailModal";
import { ActionContextMenu } from "@/components/storage/ActionContextMenu";
import type { PostRecord, PostWithAuthor } from "@/types/posts";

interface PostsManagerProps {
  isAdmin: boolean;
  /** Server-hydrated posts for the default tab — skips mount-time fetch */
  initialPosts?: PostWithAuthor[];
}

type PostTab = "published" | "draft" | "archived" | "trash";

const STATUS_COLORS: Record<string, string> = {
  published: "hsl(142, 70%, 45%)",
  draft: "hsl(45, 80%, 48%)",
  archived: "hsl(220, 12%, 55%)",
  trash: "hsl(0, 60%, 55%)",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PostsManager({ isAdmin, initialPosts }: PostsManagerProps) {
  const [posts, setPosts] = useState<PostWithAuthor[]>(initialPosts || []);
  const [loading, setLoading] = useState(!initialPosts);
  const [activeTab, setActiveTab] = useState<PostTab>("published");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [viewPost, setViewPost] = useState<PostWithAuthor | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const hydratedRef = useRef(!!initialPosts);

  const fetchPosts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const status = activeTab === "published" ? "published" : activeTab;
      const res = await fetch(`/api/posts?status=${status}`, { signal });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // On the first mount with "published" tab + initialPosts, skip the fetch
    if (hydratedRef.current && activeTab === "published") {
      hydratedRef.current = false; // Next tab switch will fetch normally
      return;
    }

    const controller = new AbortController();
    fetchPosts(controller.signal);
    return () => controller.abort();
  }, [fetchPosts, activeTab]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Move this post to trash?")) return;
    await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    fetchPosts();
  };

  const handleRestore = async (postId: string) => {
    await fetch(`/api/posts/${postId}/restore`, { method: "POST" });
    fetchPosts();
  };

  const handlePermanentDelete = async (postId: string) => {
    if (!confirm("Permanently delete this post? This cannot be undone.")) return;
    await fetch(`/api/posts/${postId}/permanent`, { method: "DELETE" });
    fetchPosts();
  };

  const handleStatusChange = async (postId: string, status: string) => {
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActionMenuId(null);
    fetchPosts();
  };

  const tabs: { key: PostTab; label: string; icon: React.ReactNode }[] = [
    { key: "published", label: "Published", icon: <Eye size={14} /> },
    { key: "draft", label: "Drafts", icon: <Clock size={14} /> },
    { key: "archived", label: "Archived", icon: <Archive size={14} /> },
    { key: "trash", label: "Trash", icon: <Trash2 size={14} /> },
  ];

  return (
    <>
      <div className="posts-manager">
        {/* Header */}
        <div className="posts-header">
          <div>
            <h1 className="posts-title">Posts</h1>
            <p className="posts-subtitle">
              Create, edit, and publish posts and announcements.
            </p>
          </div>
          {isAdmin && (
            <button className="post-create-btn" onClick={() => { setEditingPost(null); setEditorOpen(true); }}>
              <Plus size={16} />
              <span>New Post</span>
            </button>
          )}
        </div>

        {/* Tabs (admin only) */}
        {isAdmin && (
          <div className="posts-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`posts-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Posts List */}
        <div className="posts-list">
          {loading ? (
            <div className="posts-empty">
              <Loader2 size={24} className="spin" />
              <p>Loading posts…</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="posts-empty">
              <FileText size={48} strokeWidth={1.2} />
              <p>
                {activeTab === "published"
                  ? "No published posts yet."
                  : activeTab === "draft"
                  ? "No drafts."
                  : activeTab === "trash"
                  ? "Trash is empty."
                  : "No archived posts."}
              </p>
              {isAdmin && activeTab !== "trash" && (
                <button
                  className="post-create-btn-sm"
                  onClick={() => { setEditingPost(null); setEditorOpen(true); }}
                >
                  <Plus size={14} /> Create Post
                </button>
              )}
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="post-card"
                onClick={() => setViewPost(post)}
              >
                <div className="post-card-main">
                  <div className="post-card-status-dot" style={{ background: STATUS_COLORS[post.status] || "var(--text-muted)" }} />
                  <div className="post-card-info">
                    <h3 className="post-card-title">{post.title}</h3>
                    {post.excerpt && (
                      <p className="post-card-excerpt">{post.excerpt}</p>
                    )}
                    <div className="post-card-meta">
                      <span>{timeAgo(post.published_at || post.created_at)}</span>
                      {post.tags && post.tags.length > 0 && (
                        <span className="post-card-tags">
                          {post.tags.slice(0, 3).map((t) => (
                            <span key={t} className="post-tag">{t}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="post-card-actions" onClick={(e) => e.stopPropagation()}>
                    {activeTab === "trash" ? (
                      <>
                        <button className="post-action-btn" title="Restore" onClick={() => handleRestore(post.id)}>
                          <RotateCcw size={15} />
                        </button>
                        <button className="post-action-btn danger" title="Delete forever" onClick={() => handlePermanentDelete(post.id)}>
                          <AlertTriangle size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="post-action-btn" title="Edit" onClick={() => { setEditingPost(post); setEditorOpen(true); }}>
                          <Pencil size={15} />
                        </button>
                        {post.status === "draft" && (
                          <button className="post-action-btn publish" title="Publish" onClick={() => handleStatusChange(post.id, "published")}>
                            <Send size={15} />
                          </button>
                        )}
                        <PostActionsTrigger
                          post={post}
                          isOpen={actionMenuId === post.id}
                          onToggle={() => setActionMenuId(actionMenuId === post.id ? null : post.id)}
                          onClose={() => setActionMenuId(null)}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Post Editor Modal */}
      {editorOpen && (
        <PostEditorModal
          post={editingPost}
          onClose={() => { setEditorOpen(false); setEditingPost(null); }}
          onSaved={() => { setEditorOpen(false); setEditingPost(null); fetchPosts(); }}
        />
      )}

      {/* Post Detail Modal */}
      {viewPost && (
        <PostDetailModal
          post={viewPost}
          onClose={() => setViewPost(null)}
          isAdmin={isAdmin}
          onEdit={(p) => { setViewPost(null); setEditingPost(p); setEditorOpen(true); }}
        />
      )}

      <style jsx>{`
        .posts-manager {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }
        .posts-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
        }
        .posts-title {
          font-size: var(--text-2xl);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: var(--space-1);
        }
        .posts-subtitle {
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
        .post-create-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--color-primary);
          color: var(--text-on-primary);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .post-create-btn:hover {
          background: var(--color-primary-hover);
          box-shadow: var(--shadow-glow);
          transform: translateY(-1px);
        }
        .post-create-btn-sm {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          color: var(--color-primary);
          background: transparent;
          border: 1px solid var(--color-primary);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .post-create-btn-sm:hover {
          background: var(--color-primary);
          color: var(--text-on-primary);
        }

        /* Tabs */
        .posts-tabs {
          display: flex;
          gap: var(--space-1);
          padding: var(--space-1);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          width: fit-content;
        }
        .posts-tab {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .posts-tab:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .posts-tab.active {
          color: var(--text-primary);
          background: var(--bg-elevated);
          box-shadow: var(--shadow-sm);
          font-weight: var(--font-medium);
        }

        /* Posts List */
        .posts-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .posts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-16) 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }
        .post-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .post-card:hover {
          border-color: var(--border-default);
          box-shadow: var(--shadow-sm);
          transform: translateY(-1px);
        }
        .post-card-main {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          min-width: 0;
          flex: 1;
        }
        .post-card-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }
        .post-card-info {
          min-width: 0;
        }
        .post-card-title {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0 0 var(--space-1) 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .post-card-excerpt {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0 0 var(--space-2) 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .post-card-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .post-card-tags {
          display: flex;
          gap: var(--space-1);
        }
        .post-tag {
          padding: 1px var(--space-2);
          background: var(--bg-hover);
          border-radius: var(--radius-sm);
          font-size: 11px;
        }

        /* Post Actions */
        .post-card-actions {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          position: relative;
        }
        .post-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .post-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .post-action-btn.danger:hover {
          background: hsla(0, 60%, 50%, 0.1);
          color: hsl(0, 60%, 55%);
        }
        .post-action-btn.publish:hover {
          background: hsla(142, 70%, 45%, 0.1);
          color: hsl(142, 70%, 45%);
        }
        .post-action-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          min-width: 160px;
          z-index: 100;
          padding: var(--space-1);
          animation: dropdown-enter 0.12s ease-out;
        }
        .post-action-menu button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          background: none;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .post-action-menu button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .post-action-menu button.danger:hover {
          background: hsla(0, 60%, 50%, 0.1);
          color: hsl(0, 60%, 55%);
        }
        @keyframes dropdown-enter {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .posts-empty :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @media (max-width: 768px) {
          .posts-header {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}

function PostActionsTrigger({
  post,
  isOpen,
  onToggle,
  onClose,
  onStatusChange,
  onDelete,
}: {
  post: PostRecord;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onStatusChange: (id: string, status: "draft" | "published" | "archived") => void;
  onDelete: (id: string) => void;
}) {
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const items = [];
  if (post.status !== "archived") {
    items.push({
      icon: <Archive size={15} />,
      label: "Archive",
      action: () => onStatusChange(post.id, "archived"),
    });
  }
  if (post.status === "archived") {
    items.push({
      icon: <Clock size={15} />,
      label: "Move to Drafts",
      action: () => onStatusChange(post.id, "draft"),
    });
  }
  items.push({
    icon: <Trash2 size={15} />,
    label: "Move to Trash",
    action: () => onDelete(post.id),
    danger: true,
  });

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="post-action-btn"
        title="More"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <MoreVertical size={15} />
      </button>

      <ActionContextMenu
        isOpen={isOpen}
        onClose={onClose}
        triggerRef={btnRef}
        title={post.title}
        subtitle={`Status: ${post.status}`}
        icon={<FileText size={18} style={{ color: "var(--color-primary)" }} />}
        items={items}
      />
    </>
  );
}

