"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Shield,
  Users,
  Activity,
  HardDrive,
  FileText,
  ShieldCheck,
  Settings as SettingsIcon,
} from "lucide-react";
import Link from "next/link";

interface AdminDashboardClientProps {
  displayName: string;
  role: string;
}

export function AdminDashboardClient({
  displayName,
  role,
}: AdminDashboardClientProps) {
  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="header-text">
          <h1 className="page-title">
            <Shield size={28} />
            Admin Dashboard
          </h1>
          <p className="page-subtitle">
            Welcome back, <strong>{displayName}</strong>
            <Badge variant="primary">
              {role}
            </Badge>
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <Card>
          <div className="stat-card">
            <div className="stat-icon users-icon">
              <Users size={22} />
            </div>
            <div className="stat-info">
              <p className="stat-label">Total Users</p>
              <p className="stat-value">—</p>
              <p className="stat-note">Connect Supabase to view</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-icon storage-icon">
              <HardDrive size={22} />
            </div>
            <div className="stat-info">
              <p className="stat-label">Storage Used</p>
              <p className="stat-value">—</p>
              <p className="stat-note">Across all users</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-icon posts-icon">
              <FileText size={22} />
            </div>
            <div className="stat-info">
              <p className="stat-label">Total Posts</p>
              <p className="stat-value">—</p>
              <p className="stat-note">Published &amp; drafts</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-icon security-icon">
              <Activity size={22} />
            </div>
            <div className="stat-info">
              <p className="stat-label">Auth Events (24h)</p>
              <p className="stat-value">—</p>
              <p className="stat-note">Login attempts &amp; sessions</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="actions-grid">
          <Link href="/files" className="action-card">
            <HardDrive size={20} />
            <span>Upload &amp; Manage Files</span>
          </Link>
          <Link href="/audit-logs" className="action-card">
            <ShieldCheck size={20} />
            <span>Audit Logs</span>
          </Link>
          <Link href="/settings" className="action-card">
            <SettingsIcon size={20} />
            <span>System Settings</span>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .admin-dashboard {
          max-width: 1200px;
        }

        .admin-header {
          margin-bottom: var(--space-8);
        }
        .page-title {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: 1.75rem;
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0;
        }
        .page-subtitle {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          margin-top: var(--space-2);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }

        .stat-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
          padding: var(--space-2);
        }
        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          flex-shrink: 0;
        }
        .users-icon {
          background: hsla(220, 80%, 55%, 0.12);
          color: hsl(220, 80%, 55%);
        }
        .storage-icon {
          background: hsla(280, 70%, 55%, 0.12);
          color: hsl(280, 70%, 55%);
        }
        .posts-icon {
          background: hsla(160, 70%, 45%, 0.12);
          color: hsl(160, 70%, 45%);
        }
        .security-icon {
          background: hsla(35, 90%, 55%, 0.12);
          color: hsl(35, 90%, 55%);
        }

        .stat-info {
          flex: 1;
        }
        .stat-label {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: var(--space-1) 0;
        }
        .stat-note {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin: 0;
        }

        .section-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0 0 var(--space-4);
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--space-3);
        }
        .action-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          transition: all var(--transition-fast);
        }
        .action-card:hover {
          background: var(--bg-secondary);
          color: var(--color-primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}
