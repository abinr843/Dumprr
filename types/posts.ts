import type { Database, PostStatus, PostType } from "./database.types";

export type { PostStatus, PostType };

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
  post_type?: PostType;
  code_language?: string | null;
  code_filename?: string | null;
  is_pinned?: boolean;
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
  post_type?: PostType;
  code_language?: string | null;
  code_filename?: string | null;
  is_pinned?: boolean;
}

/** Attached file row enriched with file metadata */
export interface PostAttachmentWithFile {
  id: string;
  post_id: string;
  file_id: string;
  display_order: number;
  created_at: string;
  file?: {
    id: string;
    display_name: string | null;
    original_name: string;
    name: string;
    extension: string | null;
    size_bytes: number;
    mime_type: string;
  } | null;
}

/** A single post revision snapshot */
export interface PostVersionRecord {
  id: string;
  post_id: string;
  version_number: number;
  title: string;
  content: string | null;
  excerpt: string | null;
  tags: string[] | null;
  post_type: string | null;
  code_language: string | null;
  code_filename: string | null;
  author_id: string | null;
  change_summary: string | null;
  created_at: string;
}
