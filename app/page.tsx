import Link from "next/link";
import { FolderOpen, FileText, Clock, ArrowRight } from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { Card } from "@/components/ui/Card";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { FeaturedAnnouncement } from "@/components/posts/FeaturedAnnouncement";
import { getSession } from "@/lib/auth/session";
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

/**
 * Root page — renders the dashboard view within the app shell.
 * Prominently presents latest admin announcements, stats, and real-time activity feed.
 * Accessible to public visitors and authenticated members/admins.
 */
export default async function HomePage() {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const adminClient = createAdminClient();

  // Fetch file count & storage used
  let fileCount = 0;
  let totalBytes = 0;
  const { data: filesData } = await adminClient
    .from("files")
    .select("size_bytes")
    .is("deleted_at", null)
    .eq("status", "active");

  if (filesData) {
    fileCount = filesData.length;
    totalBytes = filesData.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  }

  // Fetch published post count
  let postCount = 0;
  const { count: postsDataCount } = await adminClient
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .is("deleted_at", null);

  if (postsDataCount != null) {
    postCount = postsDataCount;
  }

  // Fetch latest published announcement for upfront visibility
  const { data: latestPosts } = await adminClient
    .from("posts")
    .select("id, title, excerpt, content, published_at, created_at, profiles:author_id(full_name, username)")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1);

  const latestPost = latestPosts && latestPosts[0] ? latestPosts[0] : null;
  const authorProfile = latestPost?.profiles as unknown as { full_name?: string; username?: string } | null;

  return (
    <LayoutShell
      userEmail={session?.user?.email}
      userRole={session?.profile?.role}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          maxWidth: "1200px",
        }}
      >
        {/* Page Header */}
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: "var(--space-1)",
              color: "var(--text-primary)",
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            {session
              ? `Welcome back, ${session.profile?.full_name || session.user.email?.split("@")[0] || "User"}. Here's your workspace feed.`
              : "Welcome to DUMPR. Explore shared files, tools, and administrator announcements."}
          </p>
        </div>

        {/* Upfront Admin Announcement: Users see admin message immediately */}
        {latestPost && (
          <FeaturedAnnouncement
            post={{
              id: latestPost.id,
              title: latestPost.title,
              excerpt: latestPost.excerpt,
              content: latestPost.content,
              published_at: latestPost.published_at,
              created_at: latestPost.created_at,
              authorName: authorProfile?.full_name || authorProfile?.username || "Administrator",
            }}
            isAdmin={userIsAdmin}
          />
        )}

        {/* Quick Navigation Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <Link href="/files" style={{ textDecoration: "none" }}>
            <Card hover>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                    color: "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <FolderOpen size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      Browse Files
                    </h3>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                      Explore directories
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
              </div>
            </Card>
          </Link>

          <Link href="/posts" style={{ textDecoration: "none" }}>
            <Card hover>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(139, 92, 246, 0.12)",
                    color: "#8b5cf6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      Announcements
                    </h3>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                      Read team updates
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
              </div>
            </Card>
          </Link>

          <Link href="/recent" style={{ textDecoration: "none" }}>
            <Card hover>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      Recent Activity
                    </h3>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                      Live updates stream
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
              </div>
            </Card>
          </Link>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <StatCard
            label="Total Files"
            value={fileCount.toString()}
            change={fileCount === 1 ? "1 active file" : `${fileCount} active files`}
          />
          <StatCard
            label="Storage Used"
            value={formatBytes(totalBytes)}
            change="of 5.0 GB limit"
          />
          <StatCard
            label="Published Posts"
            value={postCount.toString()}
            change={postCount === 1 ? "1 published" : `${postCount} published`}
          />
          <StatCard
            label="Role Access"
            value={userIsAdmin ? "Admin" : "Viewer"}
            change={userIsAdmin ? "Full management access" : "Read-only access"}
          />
        </div>

        {/* Unified Live Activity Feed */}
        <Card>
          <ActivityFeed isAdmin={userIsAdmin} />
        </Card>
      </div>
    </LayoutShell>
  );
}

function StatCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: string;
}) {
  return (
    <Card hover>
      <p
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
          marginBottom: "var(--space-2)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginBottom: "var(--space-1)",
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-secondary)",
        }}
      >
        {change}
      </p>
    </Card>
  );
}
