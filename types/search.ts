/**
 * Types for unified search across files, folders, and posts.
 */

/** Search result categories */
export type SearchCategory = "all" | "files" | "posts" | "folders";

/** Search filter parameters */
export interface SearchQueryFilter {
  query: string;
  category: SearchCategory;
  limit?: number;
}

/** A single search result item */
export interface SearchResultItem {
  id: string;
  type: "file" | "post" | "folder";
  title: string;
  description?: string;
  /** File-specific */
  extension?: string | null;
  sizeBytes?: number;
  mimeType?: string;
  /** Post-specific */
  slug?: string;
  status?: string;
  publishedAt?: string;
  /** Folder-specific */
  color?: string;
  parentId?: string | null;
  /** Common */
  createdAt: string;
  updatedAt?: string;
}

/** Categorised search results */
export interface SearchResults {
  files: SearchResultItem[];
  posts: SearchResultItem[];
  folders: SearchResultItem[];
}

/** API response from the /api/search endpoint */
export interface SearchApiResponse {
  query: string;
  category: SearchCategory;
  results: SearchResults;
  totalCount: number;
}
