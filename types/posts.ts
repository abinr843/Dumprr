import type { Database, PostStatus } from "./database.types";

export type { PostStatus };

/** Post row from the posts table */
export type PostRecord = Database["public"]["Tables"]["posts"]["Row"];

/** Post enriched with author profile info */
export interface PostWithAuthor extends PostRecord {
  author?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  } | null;
}

/** Payload for creating a new post */
export interface PostCreatePayload {
  title: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
  featured_image_url?: string;
  tags?: string[];
}

/** Payload for updating an existing post */
export interface PostUpdatePayload {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
  featured_image_url?: string;
  tags?: string[];
}
