/**
 * Admin user management routes.
 *
 * GET    /api/admin/users       — List all users with profiles (admin)
 * POST   /api/admin/users       — Create new user with cap enforcement (admin)
 * PATCH  /api/admin/users/:id   — Disable/enable/reset/update user (admin)
 * DELETE /api/admin/users/:id   — Permanently delete user (admin)
 */

import { Router } from "express";
import { createAdminClient } from "../../config/supabase.js";
import { getEnvConfig } from "../../config/env.js";
import { authenticateUser, requireAdmin } from "../../middleware/auth.js";
import { logAction } from "../../services/audit.service.js";
import { AUDIT_ACTIONS } from "../../types/index.js";
import type { UserRole } from "../../types/index.js";
import { asyncHandler } from "../../middleware/error-handler.js";

const router = Router();

const DEFAULT_MAX_USERS = 20;

async function getMaxUsers(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", "app.max_users")
    .single();
  if (data?.value) {
    const parsed = parseInt(String(data.value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MAX_USERS;
}

// ─── GET /api/admin/users ───────────────────────────────────────────

router.get(
  "/",
  authenticateUser,
  requireAdmin("GET /api/admin/users"),
  asyncHandler(async (_req, res) => {
    const admin = createAdminClient();

    const { data: authData, error: authError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      res.status(500).json({ error: `Failed to list users: ${authError.message}` });
      return;
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p])
    );

    const maxUsers = await getMaxUsers();

    const users = (authData?.users || []).map((u: any) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        username: profile?.username || null,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        role: (profile?.role as UserRole) || "viewer",
        storage_used_bytes: profile?.storage_used_bytes || 0,
        storage_quota_bytes: profile?.storage_quota_bytes || 0,
        disabled: !!u.banned_until || !!u.user_metadata?.disabled,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
        email_confirmed_at: u.email_confirmed_at || null,
      };
    });

    res.json({ users, total: users.length, maxUsers });
  })
);

// ─── POST /api/admin/users ──────────────────────────────────────────

router.post(
  "/",
  authenticateUser,
  requireAdmin("POST /api/admin/users"),
  asyncHandler(async (req, res) => {
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";
    const { email, password, full_name, role } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Block admin/superadmin role creation
    if (role === "admin" || role === "superadmin") {
      await logAction({
        actor_user_id: req.user!.id,
        action: AUDIT_ACTIONS.PERMISSION_DENIED,
        target_type: "user",
        target_name: email,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: { reason: "Attempted to create a second administrator", requestedRole: role },
      });
      res.status(400).json({
        error: "Cannot create additional administrator accounts. Only member and viewer roles are permitted.",
      });
      return;
    }

    const admin = createAdminClient();

    // Enforce MAX_USERS cap
    const maxUsers = await getMaxUsers();
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const currentCount = authData?.users?.length ?? 0;

    if (currentCount >= maxUsers) {
      await logAction({
        actor_user_id: req.user!.id,
        action: "user.creation_blocked",
        target_type: "user",
        target_name: email,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: { reason: "MAX_USERS cap reached", currentCount, maxUsers },
      });
      res.status(400).json({
        error: `User limit reached. Maximum ${maxUsers} users allowed. Current: ${currentCount}.`,
      });
      return;
    }

    const effectiveRole = (role === "member" || role === "viewer") ? role : "member";
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split("@")[0],
        role: effectiveRole,
      },
    });

    if (createError) {
      res.status(500).json({ error: `Failed to create user: ${createError.message}` });
      return;
    }

    // Ensure profile row with correct role
    const { error: profileError } = await admin.from("profiles").upsert({
      id: newUser.user.id,
      username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      full_name: full_name || email.split("@")[0],
      role: effectiveRole as UserRole,
    });

    if (profileError) {
      console.warn("Profile upsert warning:", profileError.message);
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: "user.created",
      target_type: "user",
      target_id: newUser.user.id,
      target_name: email,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { role: effectiveRole, full_name },
    });

    res.status(201).json({
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: effectiveRole,
        full_name: full_name || email.split("@")[0],
      },
      message: "User created successfully",
    });
  })
);

// ─── PATCH /api/admin/users/:id ─────────────────────────────────────

router.patch(
  "/:id",
  authenticateUser,
  requireAdmin("PATCH /api/admin/users/:id"),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";
    const { action, role, full_name } = req.body as {
      action?: "disable" | "enable" | "reset_access";
      role?: string;
      full_name?: string;
    };

    const admin = createAdminClient();
    const config = getEnvConfig();

    const { data: targetAuthData, error: fetchErr } =
      await admin.auth.admin.getUserById(id);

    if (fetchErr || !targetAuthData?.user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const targetUser = targetAuthData.user;
    const isRootAdmin = targetUser.email?.toLowerCase() === config.ADMIN_DEFAULT_EMAIL;

    // Protect root administrator
    if (isRootAdmin && (action === "disable" || role === "viewer" || role === "member")) {
      res.status(403).json({ error: "Cannot disable or demote the root administrator" });
      return;
    }

    // Block promotion to admin/superadmin
    if (role === "admin" || role === "superadmin") {
      await logAction({
        actor_user_id: req.user!.id,
        action: AUDIT_ACTIONS.PERMISSION_DENIED,
        target_type: "user",
        target_id: id,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: { reason: "Cannot promote to admin role", requestedRole: role },
      });
      res.status(400).json({ error: "Cannot promote users to administrator roles" });
      return;
    }

    if (action === "disable") {
      await admin.auth.admin.updateUserById(id, {
        ban_duration: "876000h",
        user_metadata: { ...targetUser.user_metadata, disabled: true },
      });

      await logAction({
        actor_user_id: req.user!.id,
        action: "user.disabled",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
      });

      res.json({ message: "User disabled successfully" });
      return;
    }

    if (action === "enable") {
      await admin.auth.admin.updateUserById(id, {
        ban_duration: "none",
        user_metadata: { ...targetUser.user_metadata, disabled: false },
      });

      await logAction({
        actor_user_id: req.user!.id,
        action: "user.enabled",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
      });

      res.json({ message: "User enabled successfully" });
      return;
    }

    if (action === "reset_access") {
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "recovery",
          email: targetUser.email!,
        });

      if (linkError) {
        res.status(500).json({
          error: `Failed to generate recovery link: ${linkError.message}`,
        });
        return;
      }

      await logAction({
        actor_user_id: req.user!.id,
        action: "user.access_reset",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
      });

      res.json({
        message: "Access reset initiated. Recovery link generated.",
        recoveryLink: linkData?.properties?.action_link || null,
      });
      return;
    }

    // Default: update profile fields
    const updates: Record<string, unknown> = {};
    if (role && (role === "member" || role === "viewer")) {
      updates.role = role;
    }
    if (full_name) {
      updates.full_name = full_name;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await admin
        .from("profiles")
        .update(updates)
        .eq("id", id);

      if (updateErr) {
        res.status(500).json({ error: `Failed to update user: ${updateErr.message}` });
        return;
      }

      await logAction({
        actor_user_id: req.user!.id,
        action: "user.updated",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: updates,
      });

      res.json({ message: "User updated successfully" });
      return;
    }

    res.status(400).json({ error: "No valid action or update fields provided" });
  })
);

// ─── DELETE /api/admin/users/:id ────────────────────────────────────

router.delete(
  "/:id",
  authenticateUser,
  requireAdmin("DELETE /api/admin/users/:id"),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";
    const admin = createAdminClient();
    const config = getEnvConfig();

    const { data: targetAuthData, error: fetchErr } =
      await admin.auth.admin.getUserById(id);

    if (fetchErr || !targetAuthData?.user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const targetUser = targetAuthData.user;
    const isRootAdmin = targetUser.email?.toLowerCase() === config.ADMIN_DEFAULT_EMAIL;

    if (isRootAdmin) {
      await logAction({
        actor_user_id: req.user!.id,
        action: AUDIT_ACTIONS.PERMISSION_DENIED,
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: { reason: "Cannot delete root administrator" },
      });
      res.status(403).json({ error: "Cannot delete the root administrator" });
      return;
    }

    if (id === req.user!.id) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) {
      res.status(500).json({ error: `Failed to delete user: ${deleteError.message}` });
      return;
    }

    // Explicit profile cleanup
    await admin.from("profiles").delete().eq("id", id);

    await logAction({
      actor_user_id: req.user!.id,
      action: "user.deleted",
      target_type: "user",
      target_id: id,
      target_name: targetUser.email || "",
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
    });

    res.json({ message: "User deleted successfully" });
  })
);

export default router;
