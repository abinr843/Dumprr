"use client";

import React, { useState, useCallback } from "react";
import {
  Shield,
  Users,
  Activity,
  HardDrive,
  FileText,
  ShieldCheck,
  Settings as SettingsIcon,
  UploadCloud,
  Plus,
  RefreshCw,
  Clock,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Loader2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AdminUploadZone } from "@/components/storage/AdminUploadZone";
import { PostEditorModal } from "@/components/posts/PostEditorModal";

interface AdminStats {
  users: { count: number; max: number };
  files: { count: number };
  posts: { count: number };
  storage: {
    usedBytes: number;
    totalBytes: number;
    percentFull: number;
    usedFormatted: string;
    totalFormatted: string;
  };
  activity: {
    uploadsToday: number;
    downloadsToday: number;
    failedActionsToday: number;
  };
  recentEvents: Array<{
    id: string;
    action: string;
    entity_type: string;
    actor_id: string | null;
    ip_address: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
}

interface AdminDashboardClientProps {
  displayName: string;
  role: string;
  initialStats: AdminStats;
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function actionColor(action: string): string {
  if (action.startsWith("security.")) return "var(--color-danger)";
  if (action.includes("deleted") || action.includes("failed")) return "#f59e0b";
  if (action.includes("created") || action.includes("completed") || action.includes("success")) return "var(--color-success)";
  return "var(--color-primary)";
}

export function AdminDashboardClient({
  displayName,
  role,
  initialStats,
}: AdminDashboardClientProps) {
  const [stats, setStats] = useState<AdminStats>(initialStats);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [postEditorOpen, setPostEditorOpen] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
    finally { setRefreshing(false); }
  }, []);

  const storagePercent = stats.storage.percentFull;
  const storageColor =
    storagePercent >= 90 ? "var(--color-danger)" :
    storagePercent >= 70 ? "#f59e0b" :
    "var(--color-success)";

  const userPercent = Math.round((stats.users.count / stats.users.max) * 100);
  const userColor =
    userPercent >= 90 ? "var(--color-danger)" :
    userPercent >= 70 ? "#f59e0b" :
    "var(--color-primary)";

  return (
    <div className="admin-dash">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="admin-dash-header">
        <div className="admin-dash-header-text">
          <h1 className="admin-dash-title">
            <Shield size={26} />
            Admin Dashboard
          </h1>
          <p className="admin-dash-subtitle">
            Welcome back, <strong>{displayName}</strong>
            <Badge variant="primary">{role}</Badge>
          </p>
        </div>
        <div className="admin-dash-header-actions">
          <button
            type="button"
            className="admin-quick-btn admin-quick-btn-secondary"
            onClick={refresh}
            disabled={refreshing}
            title="Refresh metrics"
          >
            {refreshing
              ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={15} />}
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-quick-btn admin-quick-btn-outline"
            onClick={() => setUploadOpen(true)}
          >
            <UploadCloud size={15} />
            <span>Upload</span>
          </button>
          <button
            type="button"
            className="admin-quick-btn admin-quick-btn-primary"
            onClick={() => setPostEditorOpen(true)}
          >
            <Plus size={15} />
            <span>New Post</span>
          </button>
        </div>
      </div>

      {/* ── Metrics Grid ────────────────────────────────────── */}
      <div className="admin-metrics-grid">

        {/* Users */}
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: `${userColor}18`, color: userColor }}>
            <Users size={20} />
          </div>
          <div className="metric-body">
            <div className="metric-label">Users Registered</div>
            <div className="metric-value">
              {stats.users.count}
              <span className="metric-suffix">/ {stats.users.max}</span>
            </div>
            <div className="metric-bar-track">
              <div
                className="metric-bar-fill"
                style={{ width: `${userPercent}%`, background: userColor }}
              />
            </div>
            <div className="metric-note">{userPercent}% capacity used</div>
          </div>
        </div>

        {/* Files */}
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: "hsl(220,80%,55%,0.12)", color: "hsl(220,80%,55%)" }}>
            <FolderOpen size={20} />
          </div>
          <div className="metric-body">
            <div className="metric-label">Active Files</div>
            <div className="metric-value">{stats.files.count}</div>
            <div className="metric-note">
              <Link href="/admin/files" className="metric-link">Manage files →</Link>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: "hsl(160,70%,45%,0.12)", color: "hsl(160,70%,45%)" }}>
            <FileText size={20} />
          </div>
          <div className="metric-body">
            <div className="metric-label">Published Posts</div>
            <div className="metric-value">{stats.posts.count}</div>
            <div className="metric-note">
              <Link href="/posts" className="metric-link">Manage posts →</Link>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: `${storageColor}18`, color: storageColor }}>
            <HardDrive size={20} />
          </div>
          <div className="metric-body">
            <div className="metric-label">Storage Used</div>
            <div className="metric-value">
              {stats.storage.usedFormatted}
              <span className="metric-suffix">/ {stats.storage.totalFormatted}</span>
            </div>
            <div className="metric-bar-track">
              <div
                className="metric-bar-fill"
                style={{ width: `${storagePercent}%`, background: storageColor }}
              />
            </div>
            <div className="metric-note">{storagePercent}% of quota used</div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="metric-card metric-card-wide">
          <div className="metric-icon-wrap" style={{ background: "hsl(280,70%,55%,0.12)", color: "hsl(280,70%,55%)" }}>
            <TrendingUp size={20} />
          </div>
          <div className="metric-body">
            <div className="metric-label">Today's Activity (24h)</div>
            <div className="activity-pills">
              <div className="activity-pill activity-pill-uploads">
                <UploadCloud size={13} />
                <span>{stats.activity.uploadsToday} uploads</span>
              </div>
              <div className="activity-pill activity-pill-downloads">
                <Download size={13} />
                <span>{stats.activity.downloadsToday} downloads</span>
              </div>
              {stats.activity.failedActionsToday > 0 && (
                <div className="activity-pill activity-pill-failed">
                  <AlertTriangle size={13} />
                  <span>{stats.activity.failedActionsToday} failed</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="metric-card metric-card-wide">
          <div className="metric-icon-wrap" style={{ background: stats.activity.failedActionsToday > 0 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", color: stats.activity.failedActionsToday > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
            {stats.activity.failedActionsToday > 0 ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div className="metric-body">
            <div className="metric-label">Security Status (24h)</div>
            <div className="metric-value">
              {stats.activity.failedActionsToday}
              <span className="metric-suffix"> failed actions</span>
            </div>
            <div className="metric-note">
              {stats.activity.failedActionsToday === 0
                ? "✓ No threats detected"
                : "⚠ Review audit logs for details"}
              {" · "}
              <Link href="/audit-logs" className="metric-link">View Audit Logs →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Navigation ────────────────────────────────── */}
      <div className="admin-section">
        <h2 className="admin-section-title">Quick Navigation</h2>
        <div className="admin-nav-grid">
          {[
            { href: "/files", icon: <FolderOpen size={20} />, label: "Files & Folders", desc: "Upload, organize, and manage storage" },
            { href: "/audit-logs", icon: <ShieldCheck size={20} />, label: "Audit Logs", desc: "Full activity trail & security events" },
            { href: "/posts", icon: <FileText size={20} />, label: "Post Editor", desc: "Manage announcements & posts" },
            { href: "/settings", icon: <SettingsIcon size={20} />, label: "System Settings", desc: "Configure platform options" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="admin-nav-card">
              <div className="admin-nav-card-icon">{item.icon}</div>
              <div className="admin-nav-card-text">
                <div className="admin-nav-card-label">{item.label}</div>
                <div className="admin-nav-card-desc">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Events ───────────────────────────────────── */}
      {stats.recentEvents.length > 0 && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Recent Activity</h2>
            <Link href="/audit-logs" className="admin-section-link">
              View all →
            </Link>
          </div>
          <div className="admin-events-list">
            {stats.recentEvents.map((event) => {
              const meta = event.metadata || {};
              const targetName =
                (meta.target_name as string) ||
                (meta.fileName as string) ||
                (meta.postTitle as string) ||
                "";
              const color = actionColor(event.action);
              const isSuccess = !(meta.result === "FAILED") && !event.action.startsWith("security.");

              return (
                <div key={event.id} className="admin-event-row">
                  <div className="admin-event-indicator" style={{ background: color }} />
                  <div className="admin-event-body">
                    <div className="admin-event-action" style={{ color }}>
                      {event.action}
                    </div>
                    {targetName && (
                      <div className="admin-event-target">{targetName}</div>
                    )}
                  </div>
                  <div className="admin-event-meta">
                    <span className="admin-event-result">
                      {isSuccess
                        ? <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} />
                        : <XCircle size={13} style={{ color: "var(--color-danger)" }} />}
                    </span>
                    <span className="admin-event-time" suppressHydrationWarning>
                      <Clock size={11} />
                      {timeAgo(event.created_at)}
                    </span>
                    {event.ip_address && (
                      <span className="admin-event-ip">{event.ip_address}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Upload Modal ─────────────────────────────────────── */}
      {uploadOpen && (
        <>
          <div
            className="admin-modal-backdrop"
            onClick={() => setUploadOpen(false)}
          />
          <div className="admin-modal" role="dialog" aria-modal="true">
            <div className="admin-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UploadCloud size={20} style={{ color: "var(--color-primary)" }} />
                <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Upload Files</h2>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="admin-modal-close"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body">
              <AdminUploadZone />
            </div>
          </div>
        </>
      )}

      {/* ── Post Editor Modal ────────────────────────────────── */}
      {postEditorOpen && (
        <PostEditorModal
          post={null}
          onClose={() => setPostEditorOpen(false)}
          onSaved={() => {
            setPostEditorOpen(false);
            refresh();
          }}
        />
      )}

      {/* ── Styles ───────────────────────────────────────────── */}
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .admin-dash { max-width: 1280px; }

        /* Header */
        .admin-dash-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }
        .admin-dash-title {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: 1.6rem;
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0;
        }
        .admin-dash-subtitle {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-2);
          color: var(--text-tertiary, var(--text-muted));
          font-size: var(--text-sm);
          margin-top: var(--space-2);
        }
        .admin-dash-header-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        .admin-quick-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          cursor: pointer;
          transition: all var(--transition-fast);
          border: none;
          white-space: nowrap;
        }
        .admin-quick-btn-primary {
          background: var(--color-primary);
          color: #fff;
        }
        .admin-quick-btn-primary:hover { background: var(--color-primary-hover); transform: translateY(-1px); }
        .admin-quick-btn-outline {
          background: var(--bg-input);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
        }
        .admin-quick-btn-outline:hover { background: var(--bg-hover); }
        .admin-quick-btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
        .admin-quick-btn-secondary:hover { background: var(--bg-input); }
        .admin-quick-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Metrics Grid */
        .admin-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }
        .metric-card-wide {
          grid-column: span 2;
        }
        .metric-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
          padding: var(--space-5);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition-fast), transform var(--transition-fast);
        }
        .metric-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .metric-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          flex-shrink: 0;
        }
        .metric-body { flex: 1; min-width: 0; }
        .metric-label {
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: var(--space-1);
        }
        .metric-value {
          font-size: 1.75rem;
          font-weight: var(--font-bold);
          color: var(--text-primary);
          line-height: 1.2;
          margin-bottom: var(--space-2);
        }
        .metric-suffix {
          font-size: var(--text-sm);
          font-weight: var(--font-normal);
          color: var(--text-muted);
          margin-left: 4px;
        }
        .metric-bar-track {
          height: 4px;
          background: var(--bg-input);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: var(--space-1);
        }
        .metric-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }
        .metric-note {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .metric-link {
          color: var(--color-primary);
          font-weight: var(--font-medium);
          text-decoration: none;
        }
        .metric-link:hover { text-decoration: underline; }

        /* Activity Pill */
        .activity-pills { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
        .activity-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
        }
        .activity-pill-uploads { background: rgba(99,102,241,0.1); color: var(--color-primary); }
        .activity-pill-downloads { background: rgba(16,185,129,0.1); color: var(--color-success); }
        .activity-pill-failed { background: rgba(239,68,68,0.1); color: var(--color-danger); }

        /* Admin Sections */
        .admin-section { margin-bottom: var(--space-8); }
        .admin-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }
        .admin-section-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0 0 var(--space-4);
        }
        .admin-section-link {
          font-size: var(--text-sm);
          color: var(--color-primary);
          text-decoration: none;
          font-weight: var(--font-medium);
        }
        .admin-section-link:hover { text-decoration: underline; }

        /* Nav Grid */
        .admin-nav-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-3);
        }
        .admin-nav-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: inherit;
          transition: all var(--transition-fast);
        }
        .admin-nav-card:hover {
          border-color: var(--color-primary);
          background: var(--bg-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .admin-nav-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--bg-input);
          color: var(--color-primary);
          flex-shrink: 0;
        }
        .admin-nav-card-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
        }
        .admin-nav-card-desc {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Recent Events */
        .admin-events-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .admin-event-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-subtle);
          transition: background var(--transition-fast);
        }
        .admin-event-row:last-child { border-bottom: none; }
        .admin-event-row:hover { background: var(--bg-hover); }
        .admin-event-indicator {
          width: 3px;
          height: 32px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }
        .admin-event-body { flex: 1; min-width: 0; }
        .admin-event-action {
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          font-family: var(--font-mono);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .admin-event-target {
          font-size: var(--text-xs);
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .admin-event-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .admin-event-time {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: var(--text-xs);
          color: var(--text-muted);
          white-space: nowrap;
        }
        .admin-event-ip {
          font-size: var(--text-xs);
          font-family: var(--font-mono);
          color: var(--text-muted);
          background: var(--bg-input);
          padding: 1px 5px;
          border-radius: var(--radius-sm);
        }

        /* Modal */
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: var(--z-modal);
        }
        .admin-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%,-50%);
          z-index: calc(var(--z-modal) + 1);
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          width: min(640px, calc(100dvw - 32px));
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .admin-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--border-subtle);
        }
        .admin-modal-close {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-input);
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: background var(--transition-fast);
        }
        .admin-modal-close:hover { background: var(--bg-hover); }
        .admin-modal-body {
          padding: var(--space-5) var(--space-6);
          overflow-y: auto;
        }

        /* ─── Responsive ─────────────────────────────────── */
        @media (max-width: 900px) {
          .metric-card-wide { grid-column: span 1; }
        }
        @media (max-width: 640px) {
          .admin-dash-header { gap: var(--space-3); }
          .admin-dash-title { font-size: 1.3rem; }
          .admin-dash-header-actions { width: 100%; justify-content: flex-start; }
          .admin-quick-btn span { display: none; }
          .admin-quick-btn { padding: 9px; }
          .admin-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-3);
          }
          .metric-card-wide { grid-column: span 2; }
          .metric-value { font-size: 1.4rem; }
          .admin-nav-grid { grid-template-columns: 1fr; }
          .admin-event-ip { display: none; }
        }
        @media (max-width: 400px) {
          .admin-metrics-grid { grid-template-columns: 1fr; }
          .metric-card-wide { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}
