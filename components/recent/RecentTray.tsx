"use client";

import React, { useEffect, useState } from "react";
import { History, FileText, File as FileIcon, X } from "lucide-react";
import { getRecentItems, clearRecentItems, type RecentItem } from "@/lib/client/recent";

interface RecentTrayProps {
  onSelectFile?: (id: string) => void;
  onSelectPost?: (id: string) => void;
  title?: string;
}

/** "Jump Back In" quick-access tray from localStorage (Feature 8). */
export function RecentTray({ onSelectFile, onSelectPost, title = "Jump Back In" }: RecentTrayProps) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(getRecentItems());
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="recent-tray">
      <div className="recent-head">
        <History size={14} />
        <span>{title}</span>
        <button
          type="button"
          className="recent-clear"
          onClick={() => {
            clearRecentItems();
            setItems([]);
          }}
        >
          <X size={12} /> Clear
        </button>
      </div>
      <div className="recent-list">
        {items.slice(0, 10).map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            className="recent-chip"
            title={item.title}
            onClick={() => {
              if (item.type === "file") onSelectFile?.(item.id);
              else onSelectPost?.(item.id);
            }}
          >
            {item.type === "file" ? <FileIcon size={13} /> : <FileText size={13} />}
            <span className="recent-title">{item.title}</span>
            {item.extension && <span className="recent-ext">{item.extension.toUpperCase()}</span>}
          </button>
        ))}
      </div>
      <style jsx>{`
        .recent-tray { border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-card); padding: 12px 14px; }
        .recent-head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 10px; }
        .recent-clear { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; font-size: 11px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
        .recent-clear:hover { color: var(--text-primary); }
        .recent-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .recent-chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 9999px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-secondary); font-size: 12px; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .recent-chip:hover { border-color: var(--border-default); color: var(--text-primary); }
        .recent-title { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .recent-ext { font-size: 10px; font-weight: 800; color: var(--color-primary); }
      `}</style>
    </div>
  );
}
