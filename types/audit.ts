import type { Database } from "./database.types";

/** Audit log row from the audit_logs table */
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

/** Standard audit actions used across the application */
export const AUDIT_ACTIONS = {
  // Auth — Login & Session
  LOGIN_SUCCESS: "auth.login_success",
  LOGIN_FAILED: "auth.login_failed",
  LOGOUT: "auth.logout",
  SESSION_CREATED: "auth.session_created",
  SESSION_REVOKED: "auth.session_revoked",
  PASSWORD_CHANGED: "auth.password_changed",
  PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",

  // Auth — Legacy (kept for backward compat)
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SIGNUP: "auth.signup",
  AUTH_PASSWORD_RESET: "auth.password_reset",

  // Files — Upload lifecycle
  FILE_UPLOAD: "file.upload",
  FILE_UPLOAD_STARTED: "file.upload_started",
  FILE_UPLOAD_COMPLETED: "file.upload_completed",
  FILE_UPLOAD_FAILED: "file.upload_failed",
  FILE_UPLOAD_REJECTED: "file.upload_rejected",
  FILE_DOWNLOAD: "file.download",
  FILE_UPDATE: "file.update",
  FILE_SHARE: "file.share",

  // Files — CRUD lifecycle (Day 5)
  FILE_RENAMED: "file.renamed",
  FILE_MOVED: "file.moved",
  FILE_DELETE: "file.delete",
  FILE_DELETED: "file.deleted",
  FILE_RESTORED: "file.restored",
  FILE_PERMANENTLY_DELETED: "file.permanently_deleted",

  // Security (Day 4 + Day 7)
  SECURITY_UPLOAD_REJECTED: "security.upload_rejected",
  SECURITY_INVALID_FILE: "security.invalid_file",
  PERMISSION_DENIED: "security.permission_denied",
  UNAUTHORIZED_REQUEST: "security.unauthorized_request",
  RATE_LIMITED: "security.rate_limited",
  INVALID_FILE: "security.invalid_file",
  UPLOAD_REJECTED: "security.upload_rejected",
  DOWNLOAD_REJECTED: "file.download_rejected",

  // Folders — CRUD lifecycle (Day 5)
  FOLDER_CREATE: "folder.create",
  FOLDER_CREATED: "folder.created",
  FOLDER_DELETE: "folder.delete",
  FOLDER_RENAME: "folder.rename",
  FOLDER_RENAMED: "folder.renamed",
  FOLDER_MOVED: "folder.moved",
  FOLDER_DELETED: "folder.deleted",
  FOLDER_RESTORED: "folder.restored",
  FOLDER_PERMANENTLY_DELETED: "folder.permanently_deleted",

  // Posts — legacy
  POST_CREATE: "post.create",
  POST_UPDATE: "post.update",
  POST_PUBLISH: "post.publish",
  POST_DELETE: "post.delete",
  POST_ARCHIVE: "post.archive",

  // Posts — CRUD lifecycle (Day 6)
  POST_CREATED: "post.created",
  POST_VIEWED: "post.viewed",
  POST_EDITED: "post.edited",
  POST_DELETED: "post.deleted",
  POST_RESTORED: "post.restored",
  POST_PERMANENTLY_DELETED: "post.permanently_deleted",

  // Files — View & Download (Day 6)
  FILE_VIEWED: "file.viewed",
  FILE_DOWNLOADED: "file.downloaded",

  // Users
  USER_ROLE_CHANGE: "user.role_change",
  USER_PROFILE_UPDATE: "user.profile_update",

  // System / Day 7
  SETTINGS_UPDATE: "settings.update",
  API_ERROR: "system.api_error",

  // Search & Feed (Day 7)
  SEARCH_PERFORMED: "search.query",
  FEED_VIEWED: "feed.viewed",

  // Trash (Day 7)
  TRASH_VIEWED: "trash.viewed",
  TRASH_EMPTIED: "trash.emptied",
  TRASH_CLEANUP_COMPLETED: "trash.cleanup_completed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Entity types for audit log categorisation */
export type AuditEntityType =
  | "file"
  | "folder"
  | "post"
  | "user"
  | "settings"
  | "auth"
  | "security"
  | "search"
  | "feed"
  | "trash"
  | "system";

/** Payload for creating an audit log entry (legacy interface for backward compat) */
export interface AuditLogPayload {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Standardised parameters for the Day 7 centralised logAction() utility.
 *
 * This is the canonical interface — all new code should use logAction() with
 * these params rather than the older per-domain audit helpers.
 */
export interface LogActionParams {
  /** The user performing the action (null for unauthenticated events). */
  actor_user_id?: string | null;
  /** The audit action constant. */
  action: AuditAction | string;
  /** The type of entity being acted upon. */
  target_type: AuditEntityType | string;
  /** The ID of the target entity (file ID, post ID, etc.). */
  target_id?: string | null;
  /** Human-readable name of the target (filename, post title, etc.). */
  target_name?: string | null;
  /** Whether the action succeeded or failed. */
  result: "SUCCESS" | "FAILED";
  /** Client IP address. Auto-extracted from `req` if omitted. */
  ip_address?: string | null;
  /** Client user-agent string. Auto-extracted from `req` if omitted. */
  user_agent?: string | null;
  /** Arbitrary metadata (will be redacted for sensitive keys). */
  metadata?: Record<string, unknown>;
}
