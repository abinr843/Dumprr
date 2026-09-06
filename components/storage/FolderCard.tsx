"use client";

import React from "react";
import {
  Folder,
  MoreVertical,
  Pencil,
  ArrowRightLeft,
  Trash2,
} from "lucide-react";
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const folderColor = folder.color || "#6366f1";
  const totalItems =
    (folder.childFolderCount ?? 0) + (folder.childFileCount ?? 0);

  // Close menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "14px 16px",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "var(--bg-card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-subtle)",
        cursor: "pointer",
        transition:
          "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
      }}
      onClick={() => onOpen(folder.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = folderColor;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 4px 16px ${folderColor}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Folder Icon with colour accent */}
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "var(--radius-md)",
          backgroundColor: `${folderColor}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Folder size={22} style={{ color: folderColor }} fill={`${folderColor}44`} />
      </div>

      {/* Name + Item count */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <h3
          title={folder.name}
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {folder.name}
        </h3>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          {totalItems} item{totalItems !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Admin Action Menu */}
      {isAdmin && (
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((p) => !p);
            }}
            style={{
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "rgba(99, 102, 241, 0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            aria-label="Folder actions"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                zIndex: 50,
                minWidth: "150px",
                marginTop: "4px",
                padding: "4px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              {[
                {
                  icon: <Pencil size={14} />,
                  label: "Rename",
                  action: () => {
                    setMenuOpen(false);
                    onRename?.(folder);
                  },
                },
                {
                  icon: <ArrowRightLeft size={14} />,
                  label: "Move",
                  action: () => {
                    setMenuOpen(false);
                    onMove?.(folder);
                  },
                },
                {
                  icon: <Trash2 size={14} />,
                  label: "Delete",
                  action: () => {
                    setMenuOpen(false);
                    onDelete?.(folder);
                  },
                  danger: true,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.action();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--text-sm)",
                    color: item.danger
                      ? "var(--color-danger)"
                      : "var(--text-primary)",
                    transition: "background 0.1s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--bg-input)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
