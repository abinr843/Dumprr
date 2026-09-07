import { createAdminClient } from "@/lib/supabase/admin";
import type { FeedItem, FeedGroup, RecentFeedResponse } from "@/types/feed";

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

interface GetRecentFeedOptions {
  /** Max items to return (default 10, max 100) */
  limit?: number;
  /** Whether the requesting user is an admin */
  isAdmin?: boolean;
}

/**
 * Server-side feed aggregation function.
 *
 * Can be called directly from Server Components (zero HTTP overhead) or
 * from the route handler for client-initiated refreshes.
 *
 * Returns files + posts merged chronologically, grouped into date buckets.
 */
export async function getRecentFeed(
  options: GetRecentFeedOptions = {}
): Promise<RecentFeedResponse> {
  const limit = Math.min(options.limit ?? 10, 100);
  const adminClient = createAdminClient();

  // Fetch recent active files AND recent published posts concurrently
  const [filesResult, postsResult] = await Promise.all([
    adminClient
      .from("files")
      .select(
        "id, display_name, original_name, name, extension, size_bytes, mime_type, created_at, profiles:owner_id(full_name, username)"
      )
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    adminClient
      .from("posts")
      .select(
        "id, title, slug, excerpt, status, tags, published_at, created_at, profiles:author_id(full_name)"
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit),
  ]);

  const files = filesResult.data;
  const posts = postsResult.data;

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
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Group by relative date
  const groups = groupByDate(allItems.slice(0, limit));

  return {
    groups,
    totalItems: allItems.length,
  };
}
