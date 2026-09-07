import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAdminApi } from "@/lib/permissions/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USERS = 20;
const QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export async function GET(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "admin.overview");
  if (guard.error) return guard.error;

  const admin = createAdminClient();
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    usersResult,
    filesResult,
    storageResult,
    postsResult,
    uploadsResult,
    downloadsResult,
    failedResult,
    recentEventsResult,
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

  const userCount = usersResult.status === "fulfilled" ? (usersResult.value.count ?? 0) : 0;
  const filesCount = filesResult.status === "fulfilled" ? (filesResult.value.count ?? 0) : 0;
  let storageUsedBytes = 0;
  if (storageResult.status === "fulfilled" && storageResult.value.data) {
    storageUsedBytes = storageResult.value.data.reduce((sum: number, f: { size_bytes: number | null }) => sum + (f.size_bytes || 0), 0);
  }
  const postsCount = postsResult.status === "fulfilled" ? (postsResult.value.count ?? 0) : 0;
  const uploadsToday = uploadsResult.status === "fulfilled" ? (uploadsResult.value.count ?? 0) : 0;
  const downloadsToday = downloadsResult.status === "fulfilled" ? (downloadsResult.value.count ?? 0) : 0;
  const failedActionsToday = failedResult.status === "fulfilled" ? (failedResult.value.count ?? 0) : 0;
  const recentEvents = recentEventsResult.status === "fulfilled" ? recentEventsResult.value.data ?? [] : [];

  return NextResponse.json({
    users: { count: userCount, max: MAX_USERS, percentFull: Math.min(100, Math.round((userCount / MAX_USERS) * 100)) },
    files: { count: filesCount },
    posts: { count: postsCount },
    storage: {
      usedBytes: storageUsedBytes,
      totalBytes: QUOTA_BYTES,
      percentFull: Math.min(100, Math.round((storageUsedBytes / QUOTA_BYTES) * 100)),
      usedFormatted: formatBytes(storageUsedBytes),
      totalFormatted: formatBytes(QUOTA_BYTES),
    },
    activity: { uploadsToday, downloadsToday, failedActionsToday },
    recentEvents,
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
