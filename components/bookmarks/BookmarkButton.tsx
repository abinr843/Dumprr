"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

interface BookmarkButtonProps {
  itemType: "file" | "post";
  itemId: string;
  size?: number;
  showLabel?: boolean;
}

// ─── Shared client-side cache: one /api/bookmarks fetch per 30s window ───
// Avoids N parallel requests when many rows each mount a button.
let bookmarkCache: { at: number; ids: Set<string> } | null = null;
let bookmarkInflight: Promise<Set<string> | null> | null = null;
const BOOKMARK_TTL_MS = 30_000;

function cacheKey(itemType: string, itemId: string): string {
  return `${itemType}:${itemId}`;
}

function fetchBookmarkIds(): Promise<Set<string> | null> {
  if (bookmarkCache && Date.now() - bookmarkCache.at < BOOKMARK_TTL_MS) {
    return Promise.resolve(bookmarkCache.ids);
  }
  if (!bookmarkInflight) {
    bookmarkInflight = fetch("/api/bookmarks")
      .then((r) => {
        // 401 (signed out) or error → null; caller treats as "not saved"
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (!d || !Array.isArray(d.bookmarks)) return null;
        const ids = new Set<string>(
          (d.bookmarks as { item_type: string; item_id: string }[]).map((b) =>
            cacheKey(b.item_type, b.item_id)
          )
        );
        bookmarkCache = { at: Date.now(), ids };
        return ids;
      })
      .catch(() => null)
      .finally(() => {
        bookmarkInflight = null;
      });
  }
  return bookmarkInflight;
}

function mutateBookmarkCache(itemType: string, itemId: string, saved: boolean): void {
  if (!bookmarkCache) return;
  const key = cacheKey(itemType, itemId);
  if (saved) bookmarkCache.ids.add(key);
  else bookmarkCache.ids.delete(key);
}

/**
 * Bookmark toggle with visible feedback (Fix: previously failed silently).
 * - Optimistic update with rollback on error
 * - "Sign in to bookmark" when unauthenticated
 * - Transient success/error notice so every click gets a response
 */
export function BookmarkButton({ itemType, itemId, size = 15, showLabel }: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (tone: "ok" | "err", text: string) => {
    setNotice({ tone, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBookmarkIds().then((ids) => {
      if (!cancelled && ids) setSaved(ids.has(cacheKey(itemType, itemId)));
    });
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const prev = saved;
    setSaved(!prev); // optimistic
    try {
      if (prev) {
        const r = await fetch(
          `/api/bookmarks?item_type=${itemType}&item_id=${itemId}`,
          { method: "DELETE" }
        );
        if (!r.ok) {
          if (r.status === 401) throw new Error("__AUTH__");
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Couldn't remove bookmark");
        }
        mutateBookmarkCache(itemType, itemId, false);
        flash("ok", "Removed");
      } else {
        const r = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_type: itemType, item_id: itemId }),
        });
        if (!r.ok) {
          if (r.status === 401) throw new Error("__AUTH__");
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Couldn't save bookmark");
        }
        mutateBookmarkCache(itemType, itemId, true);
        flash("ok", "Saved ✓");
      }
    } catch (err) {
      setSaved(prev); // rollback optimistic update
      const msg = err instanceof Error ? err.message : "Failed";
      flash("err", msg === "__AUTH__" ? "Sign in to bookmark" : msg.slice(0, 90));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="bm-wrap" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`bm-btn ${saved ? "saved" : ""}`}
        onClick={toggle}
        disabled={busy}
        title={saved ? "Remove bookmark" : "Bookmark"}
        aria-label={saved ? "Remove bookmark" : "Bookmark"}
        aria-pressed={saved}
      >
        {busy ? (
          <Loader2 size={size} className="spin" />
        ) : saved ? (
          <BookmarkCheck size={size} />
        ) : (
          <Bookmark size={size} />
        )}
        {showLabel && <span>{saved ? "Saved" : "Save"}</span>}
      </button>
      {notice && (
        <span className={`bm-note ${notice.tone}`} role="status">
          {notice.text}
        </span>
      )}
      <style jsx>{`
        .bm-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .bm-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          padding: 5px 7px;
          border-radius: 6px;
          font-size: 12px;
          transition: all 0.15s;
        }
        .bm-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .bm-btn.saved {
          color: #f59e0b;
        }
        .bm-btn:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        .bm-btn :global(.spin) {
          animation: bm-spin 1s linear infinite;
        }
        @keyframes bm-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .bm-note {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 9px;
          border-radius: 7px;
          z-index: 60;
          pointer-events: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
          animation: bm-pop 0.15s ease-out;
        }
        .bm-note.ok {
          background: rgba(16, 185, 129, 0.95);
          color: #fff;
        }
        .bm-note.err {
          background: rgba(239, 68, 68, 0.95);
          color: #fff;
        }
        @keyframes bm-pop {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </span>
  );
}
