"use client";

import React, { useState, useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  FileText,
  Folder,
  Loader2,
} from "lucide-react";
import type { TrashItem } from "@/types/storage";
import { ConfirmDeleteModal } from "./ActionModals";

interface TrashViewProps {
  onRefresh: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatCountdown(item: TrashItem): string {
  if (item.isExpired) return "Expired — pending cleanup";
  if (item.daysRemaining > 1) return `${item.daysRemaining} days remaining`;
  if (item.daysRemaining === 1) return "1 day remaining";
  return `${item.hoursRemaining} hours remaining`;
}

function getCountdownColor(item: TrashItem): string {
  if (item.isExpired) return "var(--color-danger)";
  if (item.daysRemaining <= 1) return "var(--color-warning)";
  if (item.daysRemaining <= 3) return "#f59e0b";
  return "var(--text-muted)";
}

export function TrashView({ onRefresh }: TrashViewProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trash");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    setActionLoading(item.id);
    try {
      const endpoint =
        item.type === "file"
          ? `/api/files/${item.id}/restore`
          : `/api/folders/${item.id}/restore`;

      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onRefresh();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    setActionLoading(item.id);
    try {
      const endpoint =
        item.type === "file"
          ? `/api/files/${item.id}/permanent`
          : `/api/folders/${item.id}/permanent`;

      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyTrash = async () => {
    const res = await fetch("/api/trash", { method: "DELETE" });
    if (res.ok) {
      setItems([]);
      onRefresh();
    }
  };

  const totalSize = items.reduce((s, i) => s + (i.sizeBytes || 0), 0);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-16)",
          color: "var(--text-muted)",
        }}
      >
        <Loader2
          size={24}
          style={{ animation: "spin 1s linear infinite" }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Trash Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <Trash2 size={18} style={{ color: "var(--text-muted)" }} />
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {items.length} item{items.length !== 1 ? "s" : ""} in trash
            {totalSize > 0 && ` (${formatBytes(totalSize)})`}
          </span>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setEmptyTrashOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: "var(--color-danger)",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <AlertTriangle size={13} />
            Empty Trash
          </button>
        )}
      </div>

      {/* Trash Items */}
      {items.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-16)",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
            gap: "var(--space-3)",
            textAlign: "center",
          }}
        >
          <Trash2 size={48} strokeWidth={1.2} />
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
            Trash is empty
          </p>
          <p style={{ fontSize: "var(--text-xs)" }}>
            Deleted items will appear here for 7 days before permanent removal.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "12px 16px",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor =
                  "var(--border-strong)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor =
                  "var(--border-subtle)")
              }
            >
              {/* Type Icon */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-input)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.type === "folder" ? (
                  <Folder
                    size={18}
                    style={{ color: item.color || "#64748b" }}
                    fill={`${item.color || "#64748b"}44`}
                  />
                ) : (
                  <FileText size={18} style={{ color: "var(--text-muted)" }} />
                )}
              </div>

              {/* Name + metadata */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <h4
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.name}
                </h4>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  {item.extension && (
                    <span
                      style={{
                        textTransform: "uppercase",
                        fontWeight: 600,
                        padding: "0 4px",
                        borderRadius: "2px",
                        backgroundColor: "rgba(99,102,241,0.1)",
                        color: "var(--color-primary)",
                        fontSize: "10px",
                      }}
                    >
                      {item.extension}
                    </span>
                  )}
                  {item.sizeBytes && item.sizeBytes > 0 && (
                    <span>{formatBytes(item.sizeBytes)}</span>
                  )}
                </div>
              </div>

              {/* Countdown Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                  color: getCountdownColor(item),
                  flexShrink: 0,
                }}
              >
                <Clock size={12} />
                <span>{formatCountdown(item)}</span>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  title="Restore"
                  disabled={actionLoading === item.id}
                  onClick={() => handleRestore(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-success)",
                    backgroundColor: "rgba(16,185,129,0.1)",
                    cursor:
                      actionLoading === item.id
                        ? "not-allowed"
                        : "pointer",
                    transition: "background 0.15s ease",
                    opacity: actionLoading === item.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(16,185,129,0.2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(16,185,129,0.1)")
                  }
                >
                  <RotateCcw size={12} />
                  Restore
                </button>

                <button
                  type="button"
                  title="Delete Forever"
                  disabled={actionLoading === item.id}
                  onClick={() => handlePermanentDelete(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-danger)",
                    backgroundColor: "rgba(239,68,68,0.1)",
                    cursor:
                      actionLoading === item.id
                        ? "not-allowed"
                        : "pointer",
                    transition: "background 0.15s ease",
                    opacity: actionLoading === item.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(239,68,68,0.2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(239,68,68,0.1)")
                  }
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Trash Confirmation */}
      <ConfirmDeleteModal
        open={emptyTrashOpen}
        onClose={() => setEmptyTrashOpen(false)}
        title="Empty Trash"
        message="This will permanently delete all items in trash. This action cannot be undone. All files will be removed from storage."
        confirmLabel="Empty Trash"
        isPermanent
        onConfirm={handleEmptyTrash}
      />
    </div>
  );
}
