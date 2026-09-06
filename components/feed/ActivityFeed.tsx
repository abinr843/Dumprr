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
}

export function ActivityFeed({
  isAdmin = false,
  defaultFilter = "all",
  title = "Recent Activity",
}: ActivityFeedProps) {
  const [feedData, setFeedData] = useState<RecentFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "posts" | "files">(defaultFilter);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [viewPost, setViewPost] = useState<PostWithAuthor | null>(null);

  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/feed/recent?limit=30");
      if (res.ok) {
        const data: RecentFeedResponse = await res.json();
        setFeedData(data);
      }
    } catch (e) {
      console.error("Failed to load feed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

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
                        <span className="item-title">{item.title}</span>
                        <span className="item-time">
                          {formatItemTime(item.timestamp)}
                        </span>
                      </div>

                      <div className="item-meta-row">
                        {item.type === "file" ? (
                          <>
                            <span className="file-badge">
                              {item.extension?.toUpperCase() || "FILE"}
                            </span>
                            <span className="meta-separator">•</span>
                            <span className="meta-info">
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
                            <span className="post-badge">ANNOUNCEMENT</span>
                            {item.authorName && (
                              <>
                                <span className="meta-separator">•</span>
                                <span className="meta-info author-text">
                                  by {item.authorName}
                                </span>
                              </>
                            )}
                            {item.description && (
                              <>
                                <span className="meta-separator">•</span>
                                <span className="meta-info excerpt">
                                  {item.description}
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </div>
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
                            <Eye size={15} />
                          </button>
                          <a
                            href={`/api/files/${item.id}/download`}
                            download={item.title}
                            className="feed-action-btn primary"
                            title="Download file"
                            aria-label={`Download ${item.title}`}
                          >
                            <Download size={15} />
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
                          <ArrowRight size={15} />
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
          gap: var(--space-4);
        }
        .feed-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: var(--space-2);
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        .feed-title-area {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .feed-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0;
        }
        .live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-primary);
          background: rgba(99, 102, 241, 0.12);
          padding: 2px 8px;
          border-radius: var(--radius-full, 9999px);
        }
        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-primary);
          box-shadow: 0 0 8px var(--color-primary);
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .feed-header-controls {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .feed-filter-tabs {
          display: flex;
          align-items: center;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 3px;
          gap: 2px;
        }
        .feed-filter-tab {
          padding: 5px 12px;
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          -webkit-tap-highlight-color: transparent;
        }
        .feed-filter-tab:hover {
          color: var(--text-primary);
        }
        .feed-filter-tab.active {
          background: var(--bg-surface);
          color: var(--color-primary);
          font-weight: var(--font-semibold);
          box-shadow: var(--shadow-sm);
        }
        .refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: var(--text-xs);
          cursor: pointer;
          transition: all var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
        }
        .refresh-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }
        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .uploader-text,
        .author-text {
          font-weight: var(--font-medium);
          color: var(--text-secondary);
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
          width: 52px;
          height: 52px;
          border-radius: var(--radius-full, 9999px);
          background: var(--bg-input);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          margin-bottom: var(--space-2);
        }
        .feed-empty h3 {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0;
        }
        .feed-empty p {
          font-size: var(--text-xs);
          max-width: 320px;
          margin: 0;
        }
        .feed-groups {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }
        .feed-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .group-label {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .group-line {
          flex: 1;
          height: 1px;
          background: var(--border-subtle);
        }
        .group-items {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .feed-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .feed-item:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-sm);
        }
        .item-icon-wrapper {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          background: var(--bg-input);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-post { color: #8b5cf6; }
        .icon-image { color: #ec4899; }
        .icon-sheet { color: #10b981; }
        .icon-slides { color: #f59e0b; }
        .icon-file { color: #3b82f6; }

        .item-details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .item-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
        }
        .item-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .item-time {
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .item-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .file-badge, .post-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: var(--radius-sm);
        }
        .file-badge {
          background: rgba(99, 102, 241, 0.1);
          color: var(--color-primary);
        }
        .post-badge {
          background: rgba(139, 92, 246, 0.12);
          color: #8b5cf6;
        }
        .meta-separator {
          color: var(--border-subtle);
        }
        .meta-info.excerpt {
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .item-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .feed-action-btn {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-md);
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
        .feed-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }
        .feed-action-btn.primary {
          background: rgba(99, 102, 241, 0.1);
          border-color: transparent;
          color: var(--color-primary);
        }
        .feed-action-btn.primary:hover {
          background: var(--color-primary);
          color: var(--text-on-primary, #ffffff);
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
            justify-content: space-between;
          }
          .feed-filter-tabs {
            flex: 1;
            justify-content: space-around;
          }
          .refresh-label {
            display: none;
          }
          .feed-action-btn {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </div>
  );
}
