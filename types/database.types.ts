/**
 * DUMPR — Supabase Database Types
 *
 * These types mirror the database schema defined in the migrations.
 * In production, generate these automatically with:
 *   npx supabase gen types typescript --project-id <your-project-id> > types/database.types.ts
 */

export type UserRole = "superadmin" | "admin" | "member" | "viewer";
export type PostStatus = "draft" | "published" | "archived" | "trash" | "deleted";
export type ContentStatus = "active" | "trash" | "deleted";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          avatar_url: string;
          role: UserRole;
          storage_quota_bytes: number;
          storage_used_bytes: number;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string;
          avatar_url?: string;
          role?: UserRole;
          storage_quota_bytes?: number;
          storage_used_bytes?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          avatar_url?: string;
          role?: UserRole;
          storage_quota_bytes?: number;
          storage_used_bytes?: number;
          metadata?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          owner_id: string;
          path: string;
          color: string;
          is_favorite: boolean;
          status: ContentStatus;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          owner_id: string;
          path?: string;
          color?: string;
          is_favorite?: boolean;
          status?: ContentStatus;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          parent_id?: string | null;
          path?: string;
          color?: string;
          is_favorite?: boolean;
          status?: ContentStatus;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      files: {
        Row: {
          id: string;
          folder_id: string | null;
          owner_id: string;
          uploaded_by: string | null;
          name: string;
          display_name: string | null;
          original_name: string;
          mime_type: string;
          extension: string | null;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          is_public: boolean;
          download_count: number;
          status: ContentStatus;
          deleted_at: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          folder_id?: string | null;
          owner_id: string;
          uploaded_by?: string | null;
          name: string;
          display_name?: string | null;
          original_name: string;
          mime_type?: string;
          extension?: string | null;
          size_bytes?: number;
          storage_bucket?: string;
          storage_path: string;
          is_public?: boolean;
          download_count?: number;
          status?: ContentStatus;
          deleted_at?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          folder_id?: string | null;
          uploaded_by?: string | null;
          name?: string;
          display_name?: string | null;
          original_name?: string;
          mime_type?: string;
          extension?: string | null;
          size_bytes?: number;
          storage_path?: string;
          is_public?: boolean;
          download_count?: number;
          status?: ContentStatus;
          deleted_at?: string | null;
          metadata?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          slug: string;
          content: string;
          excerpt: string;
          status: PostStatus;
          featured_image_url: string;
          tags: string[];
          published_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          slug: string;
          content?: string;
          excerpt?: string;
          status?: PostStatus;
          featured_image_url?: string;
          tags?: string[];
          published_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          content?: string;
          excerpt?: string;
          status?: PostStatus;
          featured_image_url?: string;
          tags?: string[];
          published_at?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: unknown;
          description: string;
          is_public: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: unknown;
          description?: string;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: unknown;
          description?: string;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_file_downloads: {
        Args: {
          target_file_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      user_role: UserRole;
      post_status: PostStatus;
      content_status: ContentStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
