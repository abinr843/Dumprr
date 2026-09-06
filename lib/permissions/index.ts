import type { UserRole, ContentStatus } from "@/types/database.types";
import { isAdmin } from "@/lib/auth/roles";

/**
 * DUMPR Permission Matrix — Single-Admin & Public File Sharing Model
 *
 * All functions are pure — no database calls — so they can be
 * used in both server and client code.
 *
 * Rules:
 * - Admin (and superadmin) has full authoring, upload, editing, and management access.
 * - Public visitors have read & download access to active shared content.
 * - Trashed / deleted items and audit logs are strictly admin-only.
 */

/** Can the user upload files? (admins only in publishing model) */
export function canUploadFile(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user delete or soft-delete a file? (admins only) */
export function canDeleteFile(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user create folders? (admins only) */
export function canCreateFolder(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user delete a folder? (admins only) */
export function canDeleteFolder(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user create posts? (admins only) */
export function canCreatePost(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user publish posts? (admins only) */
export function canPublishPost(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user delete a post? (admins only) */
export function canDeletePost(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user view trash / soft-deleted items? (admins only) */
export function canViewTrash(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user view audit logs? (admins only) */
export function canViewAuditLogs(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user manage system settings? (admins only) */
export function canManageSettings(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can the user manage other users' roles? (superadmin only) */
export function canManageUsers(role?: UserRole | null): boolean {
  return role === "superadmin";
}

/** Can the user access the admin dashboard? (admin and superadmin) */
export function canAccessAdminDashboard(role?: UserRole | null): boolean {
  return role ? isAdmin(role) : false;
}

/** Can a visitor download a specific file? (public active files or admin) */
export function canDownloadFile(
  status: ContentStatus,
  deletedAt?: string | null,
  role?: UserRole | null
): boolean {
  if (role && isAdmin(role)) {
    return true;
  }
  return status === "active" && !deletedAt;
}
