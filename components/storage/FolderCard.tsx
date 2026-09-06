"use client";

import React, { useRef, useState } from "react";
import {
  Folder,
  MoreVertical,
  Pencil,
  ArrowRightLeft,
  Trash2,
} from "lucide-react";
import { ActionContextMenu } from "./ActionContextMenu";
import type { FolderWithStats } from "@/types/storage";

interface FolderCardProps {
  folder: FolderWithStats;
  isAdmin: boolean;
  onOpen: (folderId: string) => void;
  onRename?: (folder: FolderWithStats) => void;
  onMove?: (folder: FolderWithStats) => void;
  onDelete?: (folder: FolderWithStats) => void;
}

export function FolderCard({
  folder,
  isAdmin,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const folderColor = folder.color || "#6366f1";
  const totalItems =
    (folder.childFolderCount ?? 0) + (folder.childFileCount ?? 0);

  return (
    <div
      onClick={() => onOpen(folder.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(folder.id);
        }
      }}
      aria-label={`Open folder ${folder.name}`}
      style={{
        position: "relative",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "var(--bg-card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-subtle)",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Folder Header: Icon + Name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            padding: "8px",
            borderRadius: "var(--radius-md)",
            backgroundColor: `${folderColor}15`,
            color: folderColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Folder size={22} />
        </div>

        <span
          title={folder.name}
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {folder.name}
        </span>
      </div>

      {/* Item Count & Action Menu */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--space-1)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          {totalItems} item{totalItems !== 1 ? "s" : ""}
        </span>

        {isAdmin && (
          <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <button
              ref={btnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              style={{
                width: "30px",
                height: "30px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              aria-label="Folder actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={16} />
            </button>

            <ActionContextMenu
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={btnRef}
              title={folder.name}
              subtitle={`${totalItems} item${totalItems !== 1 ? "s" : ""}`}
              icon={<Folder size={18} style={{ color: folderColor }} />}
              items={[
                {
                  icon: <Pencil size={15} />,
                  label: "Rename",
                  action: () => onRename?.(folder),
                },
                {
                  icon: <ArrowRightLeft size={15} />,
                  label: "Move",
                  action: () => onMove?.(folder),
                },
                {
                  icon: <Trash2 size={15} />,
                  label: "Move to Trash",
                  action: () => onDelete?.(folder),
                  danger: true,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
