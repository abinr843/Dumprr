import type { Database, ContentStatus } from "./database.types";

export type { ContentStatus };

/** File row from the files table */
export type FileRecord = Database["public"]["Tables"]["files"]["Row"];

/** Folder row from the folders table */
export type FolderRecord = Database["public"]["Tables"]["folders"]["Row"];

/** File upload payload */
export interface FileUploadPayload {
  file: File;
  folderId?: string;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

/** Storage usage info */
export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  remainingBytes: number;
}

/** Filter criteria for searching and browsing files */
export interface FileFilterCriteria {
  folderId?: string | null;
  status?: ContentStatus;
  extension?: string;
  searchQuery?: string;
  isPublic?: boolean;
}

// ─── Day 5: Folder Hierarchy & CRUD Types ───────────────────────────

/** A single breadcrumb segment from root → current folder */
export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

/** Folder row enriched with child counts and breadcrumbs */
export interface FolderWithStats extends FolderRecord {
  childFolderCount?: number;
  childFileCount?: number;
  breadcrumbs?: BreadcrumbItem[];
}

// ─── Day 5: Trash Lifecycle Types ───────────────────────────────────

/** Unified trash item shape for both files and folders */
export interface TrashItem {
  id: string;
  type: "file" | "folder";
  name: string;
  originalPath?: string;
  sizeBytes?: number;
  extension?: string | null;
  color?: string;
  deletedAt: string;
  expiresAt: string;
  daysRemaining: number;
  hoursRemaining: number;
  isExpired: boolean;
}

// ─── Day 5: Action Payloads ─────────────────────────────────────────

/** Payload for renaming / moving a file */
export interface FileActionPayload {
  display_name?: string;
  folder_id?: string | null;
}

/** Payload for creating, renaming, or moving a folder */
export interface FolderActionPayload {
  name?: string;
  parent_id?: string | null;
  color?: string;
  is_favorite?: boolean;
}
