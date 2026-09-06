/**
 * Unit tests for Day 3 — Content Status, Soft Delete & Single-Admin RBAC
 */

import {
  contentStatusSchema,
  postStatusSchema,
  fileSearchFilterSchema,
} from "@/lib/validation/schema";
import {
  canUploadFile,
  canCreateFolder,
  canDeleteFolder,
  canCreatePost,
  canPublishPost,
  canDeleteFile,
  canDeletePost,
  canViewTrash,
  canViewAuditLogs,
  canManageSettings,
  canManageUsers,
  canAccessAdminDashboard,
  canDownloadFile,
} from "@/lib/permissions";
import type { UserRole, ContentStatus } from "@/types/database.types";

describe("Day 3 — Schema & Lifecycle Validation", () => {
  describe("contentStatusSchema", () => {
    it.each(["active", "trash", "deleted"] as const)(
      "accepts '%s' as valid content status",
      (status) => {
        expect(contentStatusSchema.safeParse(status).success).toBe(true);
      }
    );

    it("rejects invalid status", () => {
      expect(contentStatusSchema.safeParse("unknown").success).toBe(false);
      expect(contentStatusSchema.safeParse("").success).toBe(false);
    });
  });

  describe("postStatusSchema", () => {
    it.each(["draft", "published", "archived", "trash", "deleted"] as const)(
      "accepts '%s' as valid post status",
      (status) => {
        expect(postStatusSchema.safeParse(status).success).toBe(true);
      }
    );
  });

  describe("fileSearchFilterSchema", () => {
    it("accepts valid search filters", () => {
      const parsed = fileSearchFilterSchema.safeParse({
        query: "report",
        extension: "pdf",
        status: "active",
      });
      expect(parsed.success).toBe(true);
    });

    it("defaults status to active when omitted", () => {
      const parsed = fileSearchFilterSchema.safeParse({
        query: "overview",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("active");
      }
    });
  });
});

describe("Day 3 — Single-Admin & Public Download Permission Matrix", () => {
  const adminRoles: UserRole[] = ["admin", "superadmin"];
  const nonAdminRoles: (UserRole | null)[] = ["member", "viewer", null];

  describe("Admin-Only Authoring & Management Operations", () => {
    it.each(adminRoles)("%s can upload files", (role) => {
      expect(canUploadFile(role)).toBe(true);
    });

    it.each(nonAdminRoles)("%s CANNOT upload files (read-only visitor)", (role) => {
      expect(canUploadFile(role)).toBe(false);
    });

    it.each(adminRoles)("%s can create and delete folders", (role) => {
      expect(canCreateFolder(role)).toBe(true);
      expect(canDeleteFolder(role)).toBe(true);
    });

    it.each(nonAdminRoles)("%s CANNOT create or delete folders", (role) => {
      expect(canCreateFolder(role)).toBe(false);
      expect(canDeleteFolder(role)).toBe(false);
    });

    it.each(adminRoles)("%s can create, publish, and delete posts", (role) => {
      expect(canCreatePost(role)).toBe(true);
      expect(canPublishPost(role)).toBe(true);
      expect(canDeletePost(role)).toBe(true);
    });

    it.each(nonAdminRoles)("%s CANNOT create, publish, or delete posts", (role) => {
      expect(canCreatePost(role)).toBe(false);
      expect(canPublishPost(role)).toBe(false);
      expect(canDeletePost(role)).toBe(false);
    });

    it.each(adminRoles)("%s can delete files", (role) => {
      expect(canDeleteFile(role)).toBe(true);
    });

    it.each(nonAdminRoles)("%s CANNOT delete files", (role) => {
      expect(canDeleteFile(role)).toBe(false);
    });

    it.each(adminRoles)("%s can view trash and audit logs", (role) => {
      expect(canViewTrash(role)).toBe(true);
      expect(canViewAuditLogs(role)).toBe(true);
    });

    it.each(nonAdminRoles)("%s CANNOT view trash or audit logs", (role) => {
      expect(canViewTrash(role)).toBe(false);
      expect(canViewAuditLogs(role)).toBe(false);
    });

    it.each(adminRoles)("%s can access admin dashboard", (role) => {
      expect(canAccessAdminDashboard(role)).toBe(true);
      expect(canManageSettings(role)).toBe(true);
    });

    it.each(nonAdminRoles)("%s CANNOT access admin dashboard or settings", (role) => {
      expect(canAccessAdminDashboard(role)).toBe(false);
      expect(canManageSettings(role)).toBe(false);
    });

    it("only superadmin can manage users", () => {
      expect(canManageUsers("superadmin")).toBe(true);
      expect(canManageUsers("admin")).toBe(false);
      expect(canManageUsers("member")).toBe(false);
      expect(canManageUsers(null)).toBe(false);
    });
  });

  describe("Public Download Permissions (canDownloadFile)", () => {
    it("allows public visitors to download active non-deleted files", () => {
      expect(canDownloadFile("active", null, null)).toBe(true);
      expect(canDownloadFile("active", undefined, null)).toBe(true);
      expect(canDownloadFile("active", null, "member")).toBe(true);
      expect(canDownloadFile("active", null, "viewer")).toBe(true);
    });

    it("denies public visitors from downloading trashed files", () => {
      const pastDate = new Date().toISOString();
      expect(canDownloadFile("trash", pastDate, null)).toBe(false);
      expect(canDownloadFile("trash", pastDate, "member")).toBe(false);
    });

    it("denies public visitors from downloading soft-deleted files", () => {
      const pastDate = new Date().toISOString();
      expect(canDownloadFile("deleted", pastDate, null)).toBe(false);
      expect(canDownloadFile("deleted", pastDate, "viewer")).toBe(false);
    });

    it("allows admins to access and download all files including trash and deleted", () => {
      const pastDate = new Date().toISOString();
      expect(canDownloadFile("active", null, "admin")).toBe(true);
      expect(canDownloadFile("trash", pastDate, "admin")).toBe(true);
      expect(canDownloadFile("deleted", pastDate, "superadmin")).toBe(true);
    });
  });
});
