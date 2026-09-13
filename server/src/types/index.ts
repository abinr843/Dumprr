/**
 * Shared types re-exported for the Express backend.
 *
 * These mirror the types defined in the Next.js frontend's types/ directory.
 * We re-define them here to avoid import path issues with the Next.js
 * module resolution (@/ aliases) while keeping them identical.
 */

// ─── Database Types ─────────────────────────────────────────────────
export type UserRole = "superadmin" | "admin" | "member" | "viewer";
export type ContentStatus = "active" | "trash" | "deleted";
export type PostStatus = "draft" | "published" | "archived";

// ─── Audit Types ────────────────────────────────────────────────────
export type AuditEntityType =
  | "file"
  | "folder"
  | "post"
  | "user"
  | "auth"
  | "system"
  | "security"
  | "feed"
  | "trash"
  | "settings";

export type AuditResult = "SUCCESS" | "FAILED";

export const AUDIT_ACTIONS = {
  // Auth events
  LOGIN_SUCCESS: "auth.login_success",
  LOGIN_FAILED: "auth.login_failed",
  LOGOUT: "auth.logout",
  SESSION_CREATED: "auth.session_created",
  SESSION_REVOKED: "auth.session_revoked",
  PASSWORD_CHANGED: "auth.password_changed",
  PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",

  // File lifecycle
  FILE_UPLOAD_STARTED: "file.upload_started",
  FILE_UPLOAD_COMPLETED: "file.upload_completed",
  FILE_UPLOAD_FAILED: "file.upload_failed",
  FILE_UPLOAD_REJECTED: "file.upload_rejected",
  FILE_DOWNLOADED: "file.downloaded",
  FILE_PREVIEWED: "file.previewed",
  FILE_RENAMED: "file.renamed",
  FILE_MOVED: "file.moved",
  FILE_DELETED: "file.deleted",
  FILE_RESTORED: "file.restored",
  FILE_PERMANENTLY_DELETED: "file.permanently_deleted",

  // Folder lifecycle
  FOLDER_CREATED: "folder.created",
  FOLDER_RENAMED: "folder.renamed",
  FOLDER_MOVED: "folder.moved",
  FOLDER_DELETED: "folder.deleted",
  FOLDER_RESTORED: "folder.restored",
  FOLDER_PERMANENTLY_DELETED: "folder.permanently_deleted",

  // Post lifecycle
  POST_CREATED: "post.created",
  POST_UPDATED: "post.updated",
  POST_PUBLISHED: "post.published",
  POST_UNPUBLISHED: "post.unpublished",
  POST_DELETED: "post.deleted",
  POST_RESTORED: "post.restored",
  POST_PERMANENTLY_DELETED: "post.permanently_deleted",

  // Security events
  SECURITY_UPLOAD_REJECTED: "security.upload_rejected",
  SECURITY_INVALID_FILE: "security.invalid_file",
  DOWNLOAD_REJECTED: "security.download_rejected",
  PERMISSION_DENIED: "security.permission_denied",
  UNAUTHORIZED_REQUEST: "security.unauthorized_request",

  // System events
  API_ERROR: "system.api_error",
  SETTINGS_UPDATED: "system.settings_updated",
  TRASH_CLEANUP_COMPLETED: "system.trash_cleanup_completed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export interface AuditLogPayload {
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

// ─── Storage Types ──────────────────────────────────────────────────
export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  detectedMime?: string;
}

// ─── LogAction Input ────────────────────────────────────────────────
export interface LogActionInput {
  actor_user_id: string | null;
  action: string;
  target_type: AuditEntityType | string;
  target_id?: string | null;
  target_name?: string;
  result: AuditResult;
  ip_address: string | null;
  user_agent: string | null;
  metadata?: Record<string, unknown>;
}
