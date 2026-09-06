import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard — DUMPR",
  description: "Administrative control panel for DUMPR.",
};

export const dynamic = "force-dynamic";

const MAX_USERS = 20;
const QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default async function AdminDashboardPage() {
  const session = await requireAdmin();
  const admin = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    usersRes,
    filesRes,
    storageRes,
    postsRes,
    uploadsRes,
    downloadsRes,
    failedRes,
    recentRes,
  ] = await Promise.allSettled([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("files").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
    admin.from("files").select("size_bytes").eq("status", "active").is("deleted_at", null),
    admin.from("posts").select("id", { count: "exact", head: true }).eq("status", "published").is("deleted_at", null),
    admin.from("files").select("id", { count: "exact", head: true }).gte("created_at", since24h).is("deleted_at", null),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).in("action", ["file.download", "file.downloaded"]).gte("created_at", since24h),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).or("action.like.security.%,metadata->>result.eq.FAILED").gte("created_at", since24h),
    admin.from("audit_logs").select("id,action,entity_type,actor_id,ip_address,metadata,created_at").or("action.like.security.%,action.like.file.%,action.like.post.%,action.like.folder.%").order("created_at", { ascending: false }).limit(5),
  ]);

  const userCount = usersRes.status === "fulfilled" ? (usersRes.value.count ?? 0) : 0;
  const filesCount = filesRes.status === "fulfilled" ? (filesRes.value.count ?? 0) : 0;
  let storageUsed = 0;
  if (storageRes.status === "fulfilled" && storageRes.value.data) {
    storageUsed = storageRes.value.data.reduce((s: number, f: any) => s + (f.size_bytes || 0), 0);
  }
  const postsCount = postsRes.status === "fulfilled" ? (postsRes.value.count ?? 0) : 0;
  const uploadsToday = uploadsRes.status === "fulfilled" ? (uploadsRes.value.count ?? 0) : 0;
  const downloadsToday = downloadsRes.status === "fulfilled" ? (downloadsRes.value.count ?? 0) : 0;
  const failedToday = failedRes.status === "fulfilled" ? (failedRes.value.count ?? 0) : 0;
  const recentEvents = recentRes.status === "fulfilled" ? recentRes.value.data ?? [] : [];

  const initialStats = {
    users: { count: userCount, max: MAX_USERS },
    files: { count: filesCount },
    posts: { count: postsCount },
    storage: {
      usedBytes: storageUsed,
      totalBytes: QUOTA_BYTES,
      percentFull: Math.min(100, Math.round((storageUsed / QUOTA_BYTES) * 100)),
      usedFormatted: formatBytes(storageUsed),
      totalFormatted: formatBytes(QUOTA_BYTES),
    },
    activity: { uploadsToday, downloadsToday, failedActionsToday: failedToday },
    recentEvents,
  };

  const displayName =
    session.profile?.full_name || session.profile?.username || session.user.email || "Admin";
  const role = session.profile?.role ?? "admin";

  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <AdminDashboardClient displayName={displayName} role={role} initialStats={initialStats} />
    </LayoutShell>
  );
}
