import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { FeedItem, FeedGroup } from "@/types/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Previewable file extensions */
const PREVIEWABLE_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "txt",
]);

/**
 * Group a flat list of feed items into relative date buckets.
 */
function groupByDate(items: FeedItem[]): FeedGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeekStart = new Date(
    today.getTime() - today.getDay() * 24 * 60 * 60 * 1000
  );
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: Record<string, FeedItem[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "Earlier this Month": [],
    Older: [],
  };

  for (const item of items) {
    const d = new Date(item.timestamp);
    if (d >= today) {
      groups["Today"].push(item);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(item);
    } else if (d >= thisWeekStart) {
      groups["This Week"].push(item);
    } else if (d >= thisMonthStart) {
      groups["Earlier this Month"].push(item);
    } else {
      groups["Older"].push(item);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({
      label,
      date: items[0]?.timestamp || new Date().toISOString(),
      items,
    }));
}

/**
 * GET /api/feed/recent?limit=30
 * Returns recently uploaded files and published posts merged chronologically.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "30", 10),
    100
  );

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const adminClient = createAdminClient();

  try {
    // Fetch recent active files
    const { data: files } = await adminClient
      .from("files")
      .select(
        "id, display_name, original_name, name, extension, size_bytes, mime_type, created_at, profiles:owner_id(full_name, username)"
      )
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Fetch recent published posts
    const { data: posts } = await adminClient
      .from("posts")
      .select(
        "id, title, slug, excerpt, status, tags, published_at, created_at, profiles:author_id(full_name)"
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    // Normalize files into FeedItems
    const fileItems: FeedItem[] = (files || []).map((f) => {
      const profile = f.profiles as unknown as {
        full_name?: string;
        username?: string;
      } | null;
      return {
        id: f.id,
        type: "file" as const,
        title: f.display_name || f.original_name || f.name,
        timestamp: f.created_at,
        extension: f.extension,
        sizeBytes: f.size_bytes,
        mimeType: f.mime_type,
        downloadUrl: `/api/files/${f.id}/download`,
        previewable: f.extension
          ? PREVIEWABLE_EXTENSIONS.has(f.extension.toLowerCase())
          : false,
        uploaderName: profile?.full_name || profile?.username || "Admin",
      };
    });

    // Normalize posts into FeedItems
    const postItems: FeedItem[] = (posts || []).map((p) => ({
      id: p.id,
      type: "post" as const,
      title: p.title,
      description: p.excerpt || undefined,
      timestamp: p.published_at || p.created_at,
      slug: p.slug,
      status: p.status,
      tags: p.tags,
      authorName:
        (p.profiles as unknown as { full_name: string } | null)?.full_name ||
        "Admin",
    }));

    // Merge and sort by timestamp descending
    const allItems = [...fileItems, ...postItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Group by relative date
    const groups = groupByDate(allItems.slice(0, limit));

    return NextResponse.json({
      groups,
      totalItems: allItems.length,
    });
  } catch (err) {
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "feed",
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: err instanceof Error ? err.message : "Unknown error" },
    });
    return NextResponse.json(
      { error: "Failed to load feed" },
      { status: 500 }
    );
  }
}
