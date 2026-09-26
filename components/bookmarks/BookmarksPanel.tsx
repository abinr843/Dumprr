"use client";

import React, { useEffect, useState } from "react";
import { Bookmark, FileText, Eye, Download, Loader2, Trash2 } from "lucide-react";
import { RecentTray } from "@/components/recent/RecentTray";

interface EnrichedBookmark {
  id: string;
  item_type: "file" | "post";
  item_id: string;
  created_at: string;
  file?: {
    id: string;
    display_name: string | null;
    original_name: string;
    name: string;
    extension: string | null;
    size_bytes: number;
  } | null;
  post?: { id: string; title: string; slug: string; status: string } | null;
}

/** Bookmarks tab panel: saved files/posts + recent tray (Feature 8). */
export function BookmarksPanel({ onPreview }: { onPreview: (fileId: string) => void }) {
  const [items, setItems] = useState<EnrichedBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  const load = () => {
    setLoading(true);
    setNeedsAuth(false);
    fetch("/api/bookmarks")
      .then((r) => {
        if (r.status === 401) {
          setNeedsAuth(true);
          return { bookmarks: [] };
        }
        return r.ok ? r.json() : { bookmarks: [] };
      })
      .then((d) => {
        setItems(d.bookmarks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (b: EnrichedBookmark) => {
    await fetch(`/api/bookmarks?item_type=${b.item_type}&item_id=${b.item_id}`, {
      method: "DELETE",
    });
    setItems((prev) => prev.filter((x) => x.id !== b.id));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading bookmarks…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <RecentTray onSelectFile={onPreview} />
      {needsAuth ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "var(--space-12)",
            border: "1px dashed var(--border-default)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <Bookmark size={32} strokeWidth={1.3} />
          <p>Sign in to save and view bookmarks.</p>
          <a
            href="/login"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-primary)",
              padding: "7px 16px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Sign In
          </a>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "var(--space-12)",
            border: "1px dashed var(--border-default)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <Bookmark size={32} strokeWidth={1.3} />
          <p>No bookmarks yet. Tap the bookmark icon on any file or post to pin it here.</p>
        </div>
      ) : (
        items.map((b) => (
          <div
            key={b.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-card)",
            }}
          >
            <span style={{ color: "#f59e0b" }}>
              <Bookmark size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.item_type === "file"
                  ? b.file?.display_name || b.file?.original_name || b.item_id
                  : b.post?.title || b.item_id}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {b.item_type} · saved {new Date(b.created_at).toLocaleDateString()}
                {b.file?.extension ? ` · ${b.file.extension.toUpperCase()}` : ""}
              </div>
            </div>
            {b.item_type === "file" && (
              <>
                <button
                  type="button"
                  onClick={() => onPreview(b.item_id)}
                  title="Preview"
                  style={btnStyle}
                >
                  <Eye size={14} />
                </button>
                <a href={`/api/files/${b.item_id}/download`} style={btnStyle} title="Download">
                  <Download size={14} />
                </a>
              </>
            )}
            {b.item_type === "post" && (
              <a href={`/posts?post=${b.item_id}`} style={btnStyle} title="Open post">
                <FileText size={14} />
              </a>
            )}
            <button type="button" onClick={() => remove(b)} title="Remove bookmark" style={btnStyle}>
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  textDecoration: "none",
};
