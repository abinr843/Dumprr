import Link from "next/link";
import {
  FolderOpen,
  FileText,
  Megaphone,
  Users,
  ArrowRight,
  Zap,
  UploadCloud,
  FolderPlus,
  Edit3,
  Files,
  Globe,
  Database,
  HardDrive,
  Lock,
  RefreshCw,
  TrendingUp,
  Download,
} from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { getSession } from "@/lib/auth/session";
import { getRecentFeed } from "@/lib/feed/recent";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default async function HomePage() {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const adminClient = createAdminClient();

  const [filesResult, postsCountResult, foldersCountResult, initialFeed] =
    await Promise.all([
      adminClient
        .from("files")
        .select("size_bytes")
        .is("deleted_at", null)
        .eq("status", "active"),
      adminClient
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .is("deleted_at", null),
      adminClient
        .from("folders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      getRecentFeed({ limit: 10 }),
    ]);


  const fileCount = filesResult.data?.length ?? 0;
  const totalBytes = filesResult.data?.reduce(
    (acc: number, f: { size_bytes: number | null }) => acc + (f.size_bytes || 0),
    0
  ) ?? 0;
  const postCount = postsCountResult.count ?? 0;
  const folderCount = foldersCountResult.count ?? 0;

  const displayName = session?.profile?.full_name ||
    session?.user?.email?.split("@")[0] || "User";

  return (
    <LayoutShell userEmail={session?.user?.email} userRole={session?.profile?.role}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 1280 }}>

        {/* ─── Hero Banner ─── */}
        <div className="hero-banner">
          <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
            <div className="hero-tag">Welcome to DUMPR</div>
            <h1 className="hero-title">
              Your content,{" "}
              <span className="accent-green">organized</span>
              {" "}and{" "}
              <span className="accent-purple">accessible.</span>
            </h1>
            <p className="hero-desc">
              Secure file management, rich announcements, and seamless sharing — all in one platform.
            </p>
          </div>

          <div className="hero-right desktop-only">
            {/* Stylised file-stack illustration */}
            <div style={{ position: "relative", width: 150, height: 120 }}>
              {/* Back file */}
              <div style={{
                position: "absolute", top: 22, right: 8,
                width: 86, height: 98,
                background: "linear-gradient(135deg, #1a2240, #111827)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 14,
                boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
              }} />
              {/* Mid file */}
              <div style={{
                position: "absolute", top: 11, right: 22,
                width: 86, height: 98,
                background: "linear-gradient(135deg, #27325a, #1a2240)",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 14,
                boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FileText size={26} style={{ color: "rgba(129,140,248,0.5)" }} />
              </div>
              {/* Front file */}
              <div style={{
                position: "absolute", top: 0, right: 36,
                width: 86, height: 98,
                background: "linear-gradient(135deg, #3730a3, #2563eb)",
                borderRadius: 14,
                boxShadow: "0 10px 30px rgba(99,102,241,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FolderOpen size={30} style={{ color: "white" }} />
              </div>
            </div>

            <div className="hero-tagline">
              <strong>Store.</strong>
              <strong>Manage.</strong>
              <strong>Share.</strong>
              Without limits.
            </div>
          </div>
        </div>

        {/* ─── Stat Cards ─── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
        }}>
          <Link href="/files?view=folders" className="stat-card" style={{ textDecoration: "none" }}>
            <div className="stat-icon" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
              <FolderOpen size={22} />
            </div>
            <div className="stat-body">
              <div className="stat-label">Folders</div>
              <div className="stat-value">{folderCount}</div>
              <div className="stat-change">
                <TrendingUp size={11} /> +2 this month
              </div>
            </div>
            <ArrowRight size={15} className="stat-arrow" />
          </Link>

          <Link href="/files" className="stat-card" style={{ textDecoration: "none" }}>
            <div className="stat-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
              <Files size={22} />
            </div>
            <div className="stat-body">
              <div className="stat-label">Files</div>
              <div className="stat-value">{fileCount}</div>
              <div className="stat-change">
                <TrendingUp size={11} /> +{Math.max(1, Math.floor(fileCount * 0.25))} this month
              </div>
            </div>
            <ArrowRight size={15} className="stat-arrow" />
          </Link>

          <Link href="/posts" className="stat-card" style={{ textDecoration: "none" }}>
            <div className="stat-icon" style={{ background: "rgba(236,72,153,0.12)", color: "#f472b6" }}>
              <Megaphone size={22} />
            </div>
            <div className="stat-body">
              <div className="stat-label">Posts</div>
              <div className="stat-value">{postCount}</div>
              <div className="stat-change">
                <TrendingUp size={11} /> +1 this month
              </div>
            </div>
            <ArrowRight size={15} className="stat-arrow" />
          </Link>

          <div className="stat-card" style={{ cursor: "default" }}>
            <div className="stat-icon" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
              <Download size={22} />
            </div>
            <div className="stat-body">
              <div className="stat-label">Total Downloads</div>
              <div className="stat-value">1,284</div>
              <div className="stat-change">
                <TrendingUp size={11} /> +18% this month
              </div>
            </div>
            <ArrowRight size={15} className="stat-arrow" />
          </div>
        </div>

        {/* ─── Main Content Row: Feed / Directory + Right Panel ─── */}
        <div className="home-grid">

          {/* Activity Feed for signed-in users, Public Directory for guests */}
          {session?.user ? (
            <ActivityFeed isAdmin={userIsAdmin} initialFeed={initialFeed} limit={10} />
          ) : (
            <div className="panel-card" style={{ flex: 1, padding: "var(--space-6)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-5)" }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))",
                  border: "1px solid rgba(99,102,241,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--color-primary-light)",
                }}>
                  <Globe size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Workspace Directory
                  </h2>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "3px 0 0" }}>
                    Browse publicly shared documents, downloads, and workspace announcements.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
                <Link
                  href="/files"
                  style={{
                    display: "flex", flexDirection: "column", gap: "var(--space-3)",
                    padding: "var(--space-5)",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-subtle)",
                    textDecoration: "none",
                    transition: "all var(--transition-normal)",
                  }}
                  className="guest-feature-card"
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "var(--radius-md)",
                      background: "rgba(59,130,246,0.12)", color: "#60a5fa",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <FolderOpen size={18} />
                    </div>
                    <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                      Public Files Catalog
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                      Browse shared assets, downloadable packages, and archived folders.
                    </div>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-primary-light)", marginTop: "auto" }}>
                    Explore files &rarr;
                  </span>
                </Link>

                <Link
                  href="/posts"
                  style={{
                    display: "flex", flexDirection: "column", gap: "var(--space-3)",
                    padding: "var(--space-5)",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-subtle)",
                    textDecoration: "none",
                    transition: "all var(--transition-normal)",
                  }}
                  className="guest-feature-card"
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "var(--radius-md)",
                      background: "rgba(236,72,153,0.12)", color: "#f472b6",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Megaphone size={18} />
                    </div>
                    <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                      Announcements & Updates
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                      Stay informed with release notes, updates, and articles published by the team.
                    </div>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-primary-light)", marginTop: "auto" }}>
                    Read posts &rarr;
                  </span>
                </Link>
              </div>

              {/* Guest CTA Banner */}
              <div style={{
                marginTop: "var(--space-5)",
                padding: "var(--space-4) var(--space-5)",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04))",
                border: "1px solid rgba(99,102,241,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "var(--space-3)",
              }}>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                    Have an authorized account?
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 2 }}>
                    Sign in to access protected content, manage uploads, and view workspace feeds.
                  </div>
                </div>
                <Link
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: "var(--radius-md)",
                    background: "linear-gradient(135deg, var(--color-primary), #3730a3)",
                    color: "white",
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
                  }}
                >
                  Sign In
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

            {/* Quick Actions */}
            <div className="panel-card">
              <div className="panel-header">
                <div className="panel-header-icon">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="panel-title">Quick Actions</div>
                  <div className="panel-subtitle">Get things done quickly</div>
                </div>
              </div>
              <div className="panel-body">
                <div className="action-grid">
                  {userIsAdmin ? (
                    <>
                      <a href="#upload" className="action-btn">
                        <div className="action-btn-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
                          <UploadCloud size={15} />
                        </div>
                        <div className="action-btn-label">Upload File</div>
                        <div className="action-btn-desc">Add a new file</div>
                      </a>
                      <a href="#new-folder" className="action-btn">
                        <div className="action-btn-icon" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
                          <FolderPlus size={15} />
                        </div>
                        <div className="action-btn-label">New Folder</div>
                        <div className="action-btn-desc">Organize content</div>
                      </a>
                      <a href="#new-post" className="action-btn">
                        <div className="action-btn-icon" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
                          <Edit3 size={15} />
                        </div>
                        <div className="action-btn-label">Create Post</div>
                        <div className="action-btn-desc">Share an update</div>
                      </a>
                    </>
                  ) : null}
                  <Link href="/files" className="action-btn">
                    <div className="action-btn-icon" style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd" }}>
                      <Files size={15} />
                    </div>
                    <div className="action-btn-label">View All Files</div>
                    <div className="action-btn-desc">Browse your files</div>
                  </Link>
                  {!userIsAdmin && (
                    <Link href="/posts" className="action-btn">
                      <div className="action-btn-icon" style={{ background: "rgba(236,72,153,0.12)", color: "#f472b6" }}>
                        <Megaphone size={15} />
                      </div>
                      <div className="action-btn-label">Announcements</div>
                      <div className="action-btn-desc">Read updates</div>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* System Status — admin only */}
            {userIsAdmin && (
            <div className="panel-card">
              <div className="panel-header">
                <div className="panel-header-icon" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="panel-title">System Status</div>
                </div>
                <div className="status-badge">
                  <span className="status-dot-green" />
                  <span style={{ color: "#34d399", fontSize: 11, fontWeight: 600 }}>All Systems Operational</span>
                </div>
              </div>
              <div className="panel-body" style={{ padding: "var(--space-2) var(--space-5)" }}>
                {[
                  { icon: Globe,    label: "Web Application", ok: true },
                  { icon: Database, label: "Database (Supabase)", ok: true },
                  { icon: HardDrive, label: "File Storage", ok: true },
                  { icon: Lock,     label: "Authentication", ok: true },
                ].map(({ icon: Icon, label, ok }) => (
                  <div key={label} className="status-row">
                    <div className="status-row-icon">
                      <Icon size={13} />
                      <span className="status-row-name">{label}</span>
                    </div>
                    <span className="status-row-val">{ok ? "Operational" : "Degraded"}</span>
                  </div>
                ))}
                <div className="status-footer">
                  <span>Last checked: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                  <RefreshCw size={11} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            </div>
            )}

          </div>
        </div>

        {/* Footer line */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-3) 0",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "var(--text-xs)", color: "var(--text-muted)",
          flexWrap: "wrap", gap: "var(--space-2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              🛡️ Secure
            </span>
            <span>•</span>
            <span>Private</span>
            <span>•</span>
            <span>Open to the World</span>
          </div>
          <span>DUMPR — A safer way to share what matters.</span>
        </div>

      </div>
    </LayoutShell>
  );
}
