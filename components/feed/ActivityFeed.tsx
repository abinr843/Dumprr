"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Download,
  Eye,
  Calendar,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import type { FeedGroup, FeedItem, RecentFeedResponse } from "@/types/feed";
import { FilePreviewModal } from "@/components/storage/FilePreviewModal";
import { PostDetailModal } from "@/components/posts/PostDetailModal";
import type { PostWithAuthor } from "@/types/posts";

function formatBytes(bytes?: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatItemTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function getItemIcon(item: FeedItem) {
  if (item.type === "post") {
    return <FileText size={20} className="icon-post" />;
  }
  const ext = (item.extension || "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return <ImageIcon size={20} className="icon-image" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet size={20} className="icon-sheet" />;
  }
  if (["ppt", "pptx"].includes(ext)) {
    return <Presentation size={20} className="icon-slides" />;
  }
  return <FileIcon size={20} className="icon-file" />;
}

interface ActivityFeedProps {
  isAdmin?: boolean;
  defaultFilter?: "all" | "posts" | "files";
  title?: string;
  /** Server-hydrated feed data — when provided, skips client fetch on mount */
  initialFeed?: RecentFeedResponse;
  /** Max items to request on refresh (default 10) */
  limit?: number;
}

export function ActivityFeed({
  isAdmin = false,
  defaultFilter = "all",
  title = "Recent Activity",
  initialFeed,
  limit = 10,
}: ActivityFeedProps) {
  const [feedData, setFeedData] = useState<RecentFeedResponse | null>(
    initialFeed || null
  );
  const [loading, setLoading] = useState(!initialFeed);
  const [refreshing, setRefreshing] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "posts" | "files">(defaultFilter);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [viewPost, setViewPost] = useState<PostWithAuthor | null>(null);

  const fetchFeed = useCallback(async (isRefresh = false, signal?: AbortSignal) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/feed/recent?limit=${limit}`, { signal });
      if (res.ok) {
        const data: RecentFeedResponse = await res.json();
        setFeedData(data);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("Failed to load feed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  useEffect(() => {
    // If server provided initialFeed, skip the mount-time HTTP request entirely
    if (initialFeed) return;

    const controller = new AbortController();
    fetchFeed(false, controller.signal);
    return () => controller.abort();
  }, [fetchFeed, initialFeed]);

  const handlePostClick = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}`);
      if (res.ok) {
        const data = await res.json();
        setViewPost(data.post);
      }
    } catch (e) {
      console.error("Failed to fetch post details", e);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!feedData) return [];
    if (feedFilter === "all") return feedData.groups;
    return feedData.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          feedFilter === "posts" ? item.type === "post" : item.type === "file"
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [feedData, feedFilter]);

  return (
    <div className="activity-feed">
      <div className="feed-header">
        <div className="feed-title-area">
          <h2 className="feed-title">{title}</h2>
          <span className="live-indicator">
            <span className="live-dot" />
            Live
          </span>
        </div>

        <div className="feed-header-controls">
          <div className="feed-filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={feedFilter === "all"}
              className={`feed-filter-tab ${feedFilter === "all" ? "active" : ""}`}
              onClick={() => setFeedFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={feedFilter === "posts"}
              className={`feed-filter-tab ${feedFilter === "posts" ? "active" : ""}`}
              onClick={() => setFeedFilter("posts")}
            >
              Announcements
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={feedFilter === "files"}
              className={`feed-filter-tab ${feedFilter === "files" ? "active" : ""}`}
              onClick={() => setFeedFilter("files")}
            >
              Files
            </button>
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={() => fetchFeed(true)}
            disabled={loading || refreshing}
            title="Refresh activity"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "spin" : ""}
            />
            <span className="refresh-label">Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="feed-loading">
          <Loader2 size={24} className="spin" />
          <span>Loading activity feed…</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="feed-empty">
          <div className="empty-icon-wrap">
            <Sparkles size={28} />
          </div>
          <h3>
            {feedFilter === "posts"
              ? "No announcements yet"
              : feedFilter === "files"
              ? "No files yet"
              : "No recent activity"}
          </h3>
          <p>
            {feedFilter === "posts"
              ? "Admin messages and announcements will appear here."
              : feedFilter === "files"
              ? "Uploaded files will appear here."
              : "Files uploaded or posts created will appear here in real time."}
          </p>
        </div>
      ) : (
        <div className="feed-groups">
          {filteredGroups.map((group) => (
            <div key={group.label} className="feed-group">
              <div className="group-label">
                <span>{group.label}</span>
                <div className="group-line" />
              </div>

              <div className="group-items">
                {group.items.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`feed-item feed-item-${item.type}`}
                    onClick={() => {
                      if (item.type === "file") {
                        setPreviewFileId(item.id);
                      } else {
                        handlePostClick(item.id);
                      }
                    }}
                  >
                    <div className="item-icon-wrapper">
                      {getItemIcon(item)}
                    </div>

                    <div className="item-details">
                      <div className="item-title-row">
                        <h4 className="item-title">{item.title}</h4>
                      </div>

                      <div className="item-meta-row">
                        {item.type === "file" ? (
                          <>
                            <span className="file-badge">
                              {item.extension?.toUpperCase() || "FILE"}
                            </span>
                            <span className="meta-info time-badge">
                              {formatItemTime(item.timestamp)}
                            </span>
                            <span className="meta-separator">•</span>
                            <span className="meta-info size-badge">
                              {formatBytes(item.sizeBytes)}
                            </span>
                            {item.uploaderName && (
                              <>
                                <span className="meta-separator">•</span>
                                <span className="meta-info uploader-text">
                                  by {item.uploaderName}
                                </span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="post-badge">
                              <span className="badge-glow-dot" />
                              ANNOUNCEMENT
                            </span>
                            <span className="meta-info time-badge">
                              {formatItemTime(item.timestamp)}
                            </span>
                            {item.authorName && (
                              <>
                                <span className="meta-separator author-separator">•</span>
                                <span className="meta-info author-text">
                                  by {item.authorName}
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {item.description && (
                        <p className="item-excerpt">{item.description}</p>
                      )}
                    </div>

                    <div
                      className="item-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.type === "file" && (
                        <>
                          <button
                            type="button"
                            className="feed-action-btn"
                            onClick={() => setPreviewFileId(item.id)}
                            title="Preview file"
                            aria-label={`Preview ${item.title}`}
                          >
                            <Eye size={16} />
                          </button>
                          <a
                            href={`/api/files/${item.id}/download`}
                            download={item.title}
                            className="feed-action-btn primary"
                            title="Download file"
                            aria-label={`Download ${item.title}`}
                          >
                            <Download size={16} />
                          </a>
                        </>
                      )}
                      {item.type === "post" && (
                        <button
                          type="button"
                          className="feed-action-btn primary"
                          onClick={() => handlePostClick(item.id)}
                          title="Read announcement"
                          aria-label={`Read ${item.title}`}
                        >
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
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
        .activity-feed {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .feed-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap;
          gap: var(--space-3);
        }

        .feed-title-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .feed-title {
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin: 0;
        }

        .live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 2px 9px;
          border-radius: 9999px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: pulse 2s infinite ease-in-out;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .feed-header-controls {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .feed-filter-tabs {
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 3px;
          gap: 3px;
        }

        :global([data-theme="light"]) .feed-filter-tabs {
          background: #f1f5f9;
        }

        .feed-filter-tab {
          padding: 6px 14px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .feed-filter-tab:hover {
          color: var(--text-primary);
        }

        .feed-filter-tab.active {
          background: var(--bg-surface);
          color: var(--color-primary);
          font-weight: 700;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }

        :global([data-theme="light"]) .feed-filter-tab.active {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .refresh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        :global([data-theme="light"]) .refresh-btn {
          background: #ffffff;
        }

        .refresh-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }

        .refresh-btn:active:not(:disabled) {
          transform: scale(0.96);
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feed-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          padding: var(--space-12) 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .feed-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-12) var(--space-4);
          text-align: center;
          color: var(--text-muted);
          gap: var(--space-2);
        }

        .empty-icon-wrap {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          margin-bottom: var(--space-2);
        }

        .feed-empty h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .feed-empty p {
          font-size: 12.5px;
          max-width: 320px;
          margin: 0;
          line-height: 1.5;
        }

        .feed-groups {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .feed-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .group-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 0;
        }

        .group-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, var(--border-subtle) 0%, transparent 100%);
        }

        .group-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .feed-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          position: relative;
        }

        .feed-item:hover {
          transform: translateY(-2px);
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
        }

        .feed-item:active {
          transform: scale(0.99);
        }

        .item-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
          transition: transform 0.2s ease;
        }

        :global([data-theme="light"]) .item-icon-wrapper {
          background: #f8fafc;
        }

        .feed-item:hover .item-icon-wrapper {
          transform: scale(1.05);
        }

        .icon-post { color: #a855f7; }
        .icon-image { color: #ec4899; }
        .icon-sheet { color: #10b981; }
        .icon-slides { color: #f59e0b; }
        .icon-file { color: #3b82f6; }

        .item-details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .item-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
        }

        .item-title {
          font-size: 14.5px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.35;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .item-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
          color: var(--text-muted);
          flex-wrap: wrap;
          line-height: 1.4;
          margin-top: 2px;
        }

        .file-badge, .post-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          letter-spacing: 0.04em;
          flex-shrink: 0;
          line-height: 1;
        }

        .file-badge {
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.28);
          color: #93c5fd;
        }

        :global([data-theme="light"]) .file-badge {
          background: rgba(59, 130, 246, 0.1);
          color: #2563eb;
        }

        .post-badge {
          background: rgba(168, 85, 247, 0.14);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #d8b4fe;
        }

        :global([data-theme="light"]) .post-badge {
          background: rgba(168, 85, 247, 0.1);
          color: #7e22ce;
        }

        .badge-glow-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #a855f7;
          box-shadow: 0 0 6px #a855f7;
        }

        .time-badge {
          font-weight: 500;
          color: var(--text-secondary);
        }

        .meta-separator {
          color: var(--border-default);
          flex-shrink: 0;
          user-select: none;
        }

        .uploader-text,
        .author-text {
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        .item-excerpt {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 4px 0 0 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .item-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .feed-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          flex-shrink: 0;
        }

        :global([data-theme="light"]) .feed-action-btn {
          background: #ffffff;
        }

        .feed-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
          transform: scale(1.05);
        }

        .feed-action-btn.primary {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.25);
          color: var(--color-primary);
        }

        .feed-action-btn.primary:hover {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #ffffff;
          box-shadow: 0 4px 12px var(--color-primary-glow);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 768px) {
          .feed-header {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
          }

          .feed-header-controls {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .feed-filter-tabs {
            flex: 1;
            justify-content: space-between;
          }

          .feed-filter-tab {
            flex: 1;
            justify-content: center;
            padding: 7px 4px;
            font-size: 11.5px;
          }

          .refresh-label {
            display: none;
          }

          .refresh-btn {
            width: 38px;
            height: 38px;
            padding: 0;
          }
        }

        @media (max-width: 480px) {
          .feed-item {
            padding: 12px 12px;
            gap: 12px;
            border-radius: 14px;
          }

          .item-icon-wrapper {
            width: 36px;
            height: 36px;
          }

          .item-title {
            font-size: 13.5px;
          }

          .item-actions {
            margin-top: 0;
          }

          .feed-action-btn {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>
    </div>
  );
}
