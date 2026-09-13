/**
 * Recent feed service for the Express backend.
 *
 * Ported from lib/feed/recent.ts — merges recent files and posts
 * into a unified, date-grouped chronological timeline.
 */

import { createAdminClient } from "../config/supabase.js";

interface FeedItem {
  id: string;
  type: "file" | "post";
  title: string;
  subtitle?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface FeedGroup {
  date: string;
  label: string;
  items: FeedItem[];
}

interface FeedResult {
  groups: FeedGroup[];
  totalItems: number;
}

/**
 * Returns a human-readable date label.
 */
function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Fetches recent files and posts, merges them into a grouped feed.
 */
export async function getRecentFeed(options: {
  limit?: number;
}): Promise<FeedResult> {
  const limit = options.limit || 10;
  const admin = createAdminClient();

  // Fetch recent active files and published posts in parallel
  const [filesResult, postsResult] = await Promise.all([
    admin
      .from("files")
      .select("id, display_name, original_name, extension, size_bytes, mime_type, created_at")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("posts")
      .select("id, title, slug, status, published_at, created_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(limit),
  ]);

  const feedItems: FeedItem[] = [];

  // Map files to feed items
  if (filesResult.data) {
    for (const file of filesResult.data) {
      feedItems.push({
        id: file.id,
        type: "file",
        title: file.display_name || file.original_name || "Untitled File",
        subtitle: file.extension?.toUpperCase() || undefined,
        timestamp: file.created_at,
        metadata: {
          extension: file.extension,
          sizeBytes: file.size_bytes,
          mimeType: file.mime_type,
        },
      });
    }
  }

  // Map posts to feed items
  if (postsResult.data) {
    for (const post of postsResult.data) {
      feedItems.push({
        id: post.id,
        type: "post",
        title: post.title || "Untitled Post",
        subtitle: post.slug || undefined,
        timestamp: post.published_at || post.created_at,
        metadata: {
          slug: post.slug,
          status: post.status,
        },
      });
    }
  }

  // Sort by timestamp descending
  feedItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Trim to limit
  const trimmed = feedItems.slice(0, limit);

  // Group by date
  const groupMap = new Map<string, FeedItem[]>();
  for (const item of trimmed) {
    const dateKey = new Date(item.timestamp).toISOString().split("T")[0];
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, []);
    }
    groupMap.get(dateKey)!.push(item);
  }

  const groups: FeedGroup[] = Array.from(groupMap.entries()).map(
    ([date, items]) => ({
      date,
      label: getDateLabel(date),
      items,
    })
  );

  return {
    groups,
    totalItems: trimmed.length,
  };
}
