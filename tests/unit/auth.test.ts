/**
 * Unit tests for Day 2 — Auth validation schemas and role helpers.
 */

import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from "@/lib/validation/schema";
import { isAdmin, isSuperAdmin, hasMinimumRole } from "@/lib/auth/roles";
import { getPostLoginRedirect } from "@/lib/auth/session";
import { canAccessAdminDashboard, canManageUsers } from "@/lib/permissions";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";

// ─────────────────────────────────────────────
// Auth Validation Schemas
// ─────────────────────────────────────────────

describe("Auth Validation Schemas", () => {
  describe("loginSchema", () => {
    it("accepts valid email and password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects short password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty email", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("accepts valid email", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "user@domain.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "bad-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("accepts matching strong passwords", () => {
      const result = resetPasswordSchema.safeParse({
        password: "StrongPass1",
        confirmPassword: "StrongPass1",
      });
      expect(result.success).toBe(true);
    });

    it("rejects mismatched passwords", () => {
      const result = resetPasswordSchema.safeParse({
        password: "StrongPass1",
        confirmPassword: "DifferentPass1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects weak passwords (no uppercase)", () => {
      const result = resetPasswordSchema.safeParse({
        password: "weakpass1",
        confirmPassword: "weakpass1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = resetPasswordSchema.safeParse({
        password: "Ab1",
        confirmPassword: "Ab1",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updatePasswordSchema", () => {
    it("accepts valid current + new password", () => {
      const result = updatePasswordSchema.safeParse({
        currentPassword: "OldPassword1",
        newPassword: "NewPassword1",
        confirmPassword: "NewPassword1",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty current password", () => {
      const result = updatePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "NewPassword1",
        confirmPassword: "NewPassword1",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// Role Helpers
// ─────────────────────────────────────────────

describe("Role Helpers", () => {
  describe("isAdmin", () => {
    it("returns true for admin", () => {
      expect(isAdmin("admin")).toBe(true);
    });
    it("returns true for superadmin", () => {
      expect(isAdmin("superadmin")).toBe(true);
    });
    it("returns false for member", () => {
      expect(isAdmin("member")).toBe(false);
    });
    it("returns false for viewer", () => {
      expect(isAdmin("viewer")).toBe(false);
    });
  });

  describe("isSuperAdmin", () => {
    it("returns true only for superadmin", () => {
      expect(isSuperAdmin("superadmin")).toBe(true);
      expect(isSuperAdmin("admin")).toBe(false);
    });
  });

  describe("canAccessAdminDashboard", () => {
    it("allows admin", () => {
      expect(canAccessAdminDashboard("admin")).toBe(true);
    });
    it("allows superadmin", () => {
      expect(canAccessAdminDashboard("superadmin")).toBe(true);
    });
    it("denies member", () => {
      expect(canAccessAdminDashboard("member")).toBe(false);
    });
    it("denies viewer", () => {
      expect(canAccessAdminDashboard("viewer")).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("allows only superadmin", () => {
      expect(canManageUsers("superadmin")).toBe(true);
      expect(canManageUsers("admin")).toBe(false);
      expect(canManageUsers("member")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// Post-Login Redirect Logic
// ─────────────────────────────────────────────

describe("getPostLoginRedirect", () => {
  it("redirects admin to /admin by default", () => {
    expect(getPostLoginRedirect("admin")).toBe("/admin");
  });

  it("redirects superadmin to /admin by default", () => {
    expect(getPostLoginRedirect("superadmin")).toBe("/admin");
  });

  it("redirects member to / by default", () => {
    expect(getPostLoginRedirect("member")).toBe("/");
  });

  it("redirects viewer to / by default", () => {
    expect(getPostLoginRedirect("viewer")).toBe("/");
  });

  it("respects explicit redirectTo for member", () => {
    expect(getPostLoginRedirect("member", "/files")).toBe("/files");
  });

  it("respects explicit redirectTo for admin", () => {
    expect(getPostLoginRedirect("admin", "/settings")).toBe("/settings");
  });

  it("blocks non-admin from /admin redirect", () => {
    expect(getPostLoginRedirect("member", "/admin")).toBe("/");
  });

  it("allows admin to redirect to /admin", () => {
    expect(getPostLoginRedirect("admin", "/admin")).toBe("/admin");
  });

  it("ignores invalid redirectTo (protocol-relative)", () => {
    expect(getPostLoginRedirect("member", "//evil.com")).toBe("/");
  });

  it("ignores empty redirectTo", () => {
    expect(getPostLoginRedirect("admin", "")).toBe("/admin");
    expect(getPostLoginRedirect("admin", null)).toBe("/admin");
  });
});

// ─────────────────────────────────────────────
// Audit Actions Completeness
// ─────────────────────────────────────────────

describe("Auth Audit Actions", () => {
  const requiredActions = [
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "LOGOUT",
    "SESSION_CREATED",
    "SESSION_REVOKED",
    "PASSWORD_CHANGED",
    "PASSWORD_RESET_REQUESTED",
  ] as const;

  it.each(requiredActions)("has %s action defined", (actionKey) => {
    expect(AUDIT_ACTIONS[actionKey]).toBeDefined();
    expect(typeof AUDIT_ACTIONS[actionKey]).toBe("string");
    expect(AUDIT_ACTIONS[actionKey].startsWith("auth.")).toBe(true);
  });
});
