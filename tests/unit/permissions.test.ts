/**
 * Unit tests for the RBAC permission matrix.
 *
 * Verifies that permissions align with the single-admin publishing
 * and public file sharing model.
 */

import {
  canUploadFile,
  canDeleteFile,
  canCreateFolder,
  canDeleteFolder,
  canCreatePost,
  canPublishPost,
  canDeletePost,
  canViewTrash,
  canViewAuditLogs,
  canManageSettings,
  canManageUsers,
  canAccessAdminDashboard,
  canDownloadFile,
} from "@/lib/permissions";
import type { UserRole } from "@/types/database.types";

describe("Single-Admin Permission Matrix", () => {
  describe("canUploadFile", () => {
    it("allows admin and superadmin", () => {
      expect(canUploadFile("admin")).toBe(true);
      expect(canUploadFile("superadmin")).toBe(true);
    });

    it("denies regular visitors", () => {
      expect(canUploadFile("member")).toBe(false);
      expect(canUploadFile("viewer")).toBe(false);
      expect(canUploadFile(null)).toBe(false);
    });
  });

  describe("canDeleteFile", () => {
    it("allows admin and superadmin", () => {
      expect(canDeleteFile("admin")).toBe(true);
      expect(canDeleteFile("superadmin")).toBe(true);
    });

    it("denies regular visitors", () => {
      expect(canDeleteFile("member")).toBe(false);
      expect(canDeleteFile("viewer")).toBe(false);
      expect(canDeleteFile(null)).toBe(false);
    });
  });

  describe("canCreateFolder & canDeleteFolder", () => {
    const roles: [UserRole, boolean][] = [
      ["viewer", false],
      ["member", false],
      ["admin", true],
      ["superadmin", true],
    ];

    it.each(roles)("canCreateFolder(%s) => %s", (role, expected) => {
      expect(canCreateFolder(role)).toBe(expected);
    });

    it.each(roles)("canDeleteFolder(%s) => %s", (role, expected) => {
      expect(canDeleteFolder(role)).toBe(expected);
    });
  });

  describe("canCreatePost, canPublishPost, canDeletePost", () => {
    it("denies non-admin visitors", () => {
      expect(canCreatePost("member")).toBe(false);
      expect(canPublishPost("member")).toBe(false);
      expect(canDeletePost("member")).toBe(false);
    });

    it("allows admins", () => {
      expect(canCreatePost("admin")).toBe(true);
      expect(canPublishPost("admin")).toBe(true);
      expect(canDeletePost("admin")).toBe(true);
    });
  });

  describe("canViewTrash & canViewAuditLogs", () => {
    it("denies non-admin visitors", () => {
      expect(canViewTrash("member")).toBe(false);
      expect(canViewAuditLogs("member")).toBe(false);
    });

    it("allows admins", () => {
      expect(canViewTrash("admin")).toBe(true);
      expect(canViewAuditLogs("admin")).toBe(true);
    });
  });

  describe("canManageUsers", () => {
    it("denies admins and members", () => {
      expect(canManageUsers("admin")).toBe(false);
      expect(canManageUsers("member")).toBe(false);
    });

    it("allows superadmins", () => {
      expect(canManageUsers("superadmin")).toBe(true);
    });
  });

  describe("canAccessAdminDashboard & canManageSettings", () => {
    it("allows admin and superadmin", () => {
      expect(canAccessAdminDashboard("admin")).toBe(true);
      expect(canAccessAdminDashboard("superadmin")).toBe(true);
      expect(canManageSettings("admin")).toBe(true);
    });

    it("denies non-admins", () => {
      expect(canAccessAdminDashboard("member")).toBe(false);
      expect(canManageSettings("member")).toBe(false);
    });
  });

  describe("canDownloadFile", () => {
    it("allows anyone to download active non-deleted files", () => {
      expect(canDownloadFile("active", null, null)).toBe(true);
    });

    it("blocks non-admins from downloading trashed or deleted files", () => {
      expect(canDownloadFile("trash", new Date().toISOString(), null)).toBe(false);
      expect(canDownloadFile("deleted", new Date().toISOString(), null)).toBe(false);
    });

    it("allows admins to access all files", () => {
      expect(canDownloadFile("trash", new Date().toISOString(), "admin")).toBe(true);
      expect(canDownloadFile("deleted", new Date().toISOString(), "superadmin")).toBe(true);
    });
  });
});
