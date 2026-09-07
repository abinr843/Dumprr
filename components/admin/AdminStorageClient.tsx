"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  File,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

interface StorageData {
  usage: {
    usedBytes: number;
    capBytes: number;
    usedFormatted: string;
    capFormatted: string;
    percentUsed: number;
    remainingFormatted: string;
  };
  status: {
    level: string;
    label: string;
  };
  trash: {
    bytes: number;
    formatted: string;
    fileCount: number;
  };
  categoryBreakdown: Array<{
    name: string;
    count: number;
    bytes: number;
    formatted: string;
    percent: number;
  }>;
  topFiles: Array<{
    id: string;
    name: string;
    extension: string;
    sizeBytes: number;
    sizeFormatted: string;
    mimeType: string;
    createdAt: string;
  }>;
  activeFileCount: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  images: <ImageIcon size={16} />,
  documents: <FileText size={16} />,
  videos: <Film size={16} />,
  audio: <Music size={16} />,
  archives: <Archive size={16} />,
  other: <File size={16} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  images: "#8b5cf6",
  documents: "#3b82f6",
  videos: "#ef4444",
  audio: "#f59e0b",
  archives: "#6366f1",
  other: "#6b7280",
};

const STATUS_COLORS: Record<string, string> = {
  normal: "#22c55e",
  warning: "#f59e0b",
  critical: "#f97316",
  emergency: "#ef4444",
  blocked: "#dc2626",
};

export function AdminStorageClient() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const fetchStorage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage");
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch storage data");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch storage data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/admin/storage");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch storage data");
        }
        const json = await res.json();
        if (active) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to fetch storage data");
          setLoading(false);
        }
      }
    }
    init();
    return () => { active = false; };
  }, []);

  const runCleanup = async () => {
    setCleanupLoading(true);
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Cleanup failed");
      setCleanupResult(`Cleanup complete: ${result.filesRemoved || 0} files, ${result.foldersRemoved || 0} folders, ${result.postsRemoved || 0} posts removed`);
      fetchStorage();
      setTimeout(() => setCleanupResult(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleanupLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
        <Loader2 size={28} className="spin" style={{ margin: "0 auto 0.5rem" }} />
        <p>Loading storage data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-error, #ef4444)" }}>
        <AlertTriangle size={28} style={{ margin: "0 auto 0.5rem" }} />
        <p>{error || "Failed to load storage data"}</p>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[data.status.level] || "#22c55e";

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/admin" style={{ color: "var(--color-text-secondary)", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              <HardDrive size={22} style={{ display: "inline", marginRight: "0.5rem", verticalAlign: "middle" }} />
              Storage Monitor
            </h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
              {data.activeFileCount} active files · {data.usage.usedFormatted} of {data.usage.capFormatted} used
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={runCleanup} disabled={cleanupLoading} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)", color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.85rem" }}>
            {cleanupLoading ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Run Cleanup
          </button>
          <button onClick={fetchStorage} disabled={loading} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)", color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.85rem" }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {cleanupResult && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: "0.85rem" }}>{cleanupResult}</div>
      )}
      {error && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "0.85rem" }}>{error}</div>
      )}

      {/* Main Usage Bar */}
      <div style={{ padding: "1.5rem", borderRadius: 12, background: "var(--color-bg-secondary)", border: `1px solid ${statusColor}33`, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{data.usage.percentUsed}%</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginLeft: "0.5rem" }}>of capacity used</span>
          </div>
          <Badge variant={data.status.level === "normal" ? "success" : data.status.level === "warning" ? "warning" : "danger"}>
            {data.status.label}
          </Badge>
        </div>
        <div style={{ height: 12, borderRadius: 6, background: "var(--color-bg-primary)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, data.usage.percentUsed)}%`, borderRadius: 6, background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
          <span>{data.usage.usedFormatted} used</span>
          <span>{data.usage.remainingFormatted} remaining</span>
        </div>
      </div>

      {/* Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Category Breakdown */}
        <div style={{ padding: "1.25rem", borderRadius: 12, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>File Distribution</h3>
          {data.categoryBreakdown.filter((c) => c.count > 0).map((cat) => (
            <div key={cat.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: CATEGORY_COLORS[cat.name] || "#6b7280" }}>
                {CATEGORY_ICONS[cat.name] || <File size={16} />}
                <span style={{ textTransform: "capitalize", color: "var(--color-text-primary)", fontSize: "0.85rem" }}>{cat.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--color-text-primary)", fontWeight: 500 }}>{cat.formatted}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginLeft: "0.5rem" }}>{cat.count} files · {cat.percent}%</span>
              </div>
            </div>
          ))}
          {data.categoryBreakdown.every((c) => c.count === 0) && (
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>No files uploaded yet</p>
          )}
        </div>

        {/* Reclaimable Space */}
        <div style={{ padding: "1.25rem", borderRadius: 12, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
            <Trash2 size={16} style={{ display: "inline", marginRight: "0.4rem", verticalAlign: "middle" }} />
            Trash & Reclaimable
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: data.trash.bytes > 0 ? "#f59e0b" : "var(--color-text-secondary)" }}>
            {data.trash.formatted}
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", margin: "0.5rem 0" }}>
            {data.trash.fileCount} files in trash · Auto-deleted after 7 days
          </p>
          {data.trash.fileCount > 0 && (
            <button onClick={runCleanup} disabled={cleanupLoading} style={{ marginTop: "0.5rem", padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-accent)", cursor: "pointer", fontSize: "0.85rem" }}>
              {cleanupLoading ? "Cleaning up..." : "Force Cleanup Now"}
            </button>
          )}
        </div>
      </div>

      {/* Top Files */}
      {data.topFiles.length > 0 && (
        <div style={{ padding: "1.25rem", borderRadius: 12, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Largest Files</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "0.5rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>Name</th>
                <th style={{ padding: "0.5rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>Type</th>
                <th style={{ padding: "0.5rem", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {data.topFiles.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-primary)" }}>{f.name}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>.{f.extension}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right", fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-primary)" }}>{f.sizeFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
