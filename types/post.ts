import type { Database, PostStatus } from "./database.types";

/** Post row from the posts table */
export type Post = Database["public"]["Tables"]["posts"]["Row"];

/** Post creation payload */
export interface PostCreatePayload {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status?: PostStatus;
  featuredImageUrl?: string;
  tags?: string[];
}

/** Post update payload */
export interface PostUpdatePayload {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
  featuredImageUrl?: string;
  tags?: string[];
  publishedAt?: string | null;
}
