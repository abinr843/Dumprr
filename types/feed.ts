/**
 * Types for the unified activity feed that merges files and posts chronologically.
 */

/** Types of items that can appear in the feed */
export type FeedItemType = "file" | "post";

/** Unified shape for a single feed item */
export interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  description?: string;
  timestamp: string;
  /** File-specific */
  extension?: string | null;
  sizeBytes?: number;
  mimeType?: string;
  downloadUrl?: string;
  previewable?: boolean;
  uploaderName?: string;
  /** Post-specific */
  slug?: string;
  status?: string;
  tags?: string[];
  authorName?: string;
}

/** A group of feed items under a date label */
export interface FeedGroup {
  label: string; // "Today", "Yesterday", "This Week", "Earlier this Month", "Older"
  date: string; // ISO date string for the group start
  items: FeedItem[];
}

/** API response from the /api/feed/recent endpoint */
export interface RecentFeedResponse {
  groups: FeedGroup[];
  totalItems: number;
}
