import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole, Database } from "@/types/database.types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (
  process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com"
).toLowerCase();

/**
 * PATCH /api/admin/users/[id]
 * Disable, enable, reset access, or update a user.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await authenticateAdminApi(req, "PATCH /api/admin/users/:id");
  if (guard.error) return guard.error;

  const { id } = await params;
  const { ipAddress, userAgent } = getRequestContext(req);
  const body = await req.json();
  const { action, role, full_name } = body as {
    action?: "disable" | "enable" | "reset_access";
    role?: string;
    full_name?: string;
  };

  const admin = createAdminClient();

  // Fetch the target user
  const { data: targetAuthData, error: fetchErr } =
    await admin.auth.admin.getUserById(id);

  if (fetchErr || !targetAuthData?.user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const targetUser = targetAuthData.user;
  const isRootAdmin = targetUser.email?.toLowerCase() === ADMIN_EMAIL;

  // Protect root administrator from being disabled/demoted/deleted
  if (isRootAdmin && (action === "disable" || role === "viewer" || role === "member")) {
    return NextResponse.json(
      { error: "Cannot disable or demote the root administrator" },
      { status: 403 }
    );
  }

  // Block promotion to admin/superadmin
  if (role === "admin" || role === "superadmin") {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      target_type: "user",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "Cannot promote to admin role", requestedRole: role },
    });
    return NextResponse.json(
      { error: "Cannot promote users to administrator roles" },
      { status: 400 }
    );
  }

  try {
    if (action === "disable") {
      // Ban the user (effectively disables login)
      await admin.auth.admin.updateUserById(id, {
        ban_duration: "876000h", // ~100 years
        user_metadata: { ...targetUser.user_metadata, disabled: true },
      });

      await logAction({
        actor_user_id: guard.auth.user.id,
        action: "user.disabled",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return NextResponse.json({ message: "User disabled successfully" });
    }

    if (action === "enable") {
      await admin.auth.admin.updateUserById(id, {
        ban_duration: "none",
        user_metadata: { ...targetUser.user_metadata, disabled: false },
      });

      await logAction({
        actor_user_id: guard.auth.user.id,
        action: "user.enabled",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return NextResponse.json({ message: "User enabled successfully" });
    }

    if (action === "reset_access") {
      // Generate a password recovery link
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "recovery",
          email: targetUser.email!,
        });

      if (linkError) {
        return NextResponse.json(
          { error: `Failed to generate recovery link: ${linkError.message}` },
          { status: 500 }
        );
      }

      await logAction({
        actor_user_id: guard.auth.user.id,
        action: "user.access_reset",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return NextResponse.json({
        message: "Access reset initiated. Recovery link generated.",
        recoveryLink: linkData?.properties?.action_link || null,
      });
    }

    // Default: update profile fields (role, full_name)
    const updates: ProfileUpdate = {};
    if (role && (role === "member" || role === "viewer")) {
      updates.role = role as UserRole;
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
        return NextResponse.json(
          { error: `Failed to update user: ${updateErr.message}` },
          { status: 500 }
        );
      }

      await logAction({
        actor_user_id: guard.auth.user.id,
        action: "user.updated",
        target_type: "user",
        target_id: id,
        target_name: targetUser.email || "",
        result: "SUCCESS",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: updates,
      });

      return NextResponse.json({ message: "User updated successfully" });
    }

    return NextResponse.json(
      { error: "No valid action or update fields provided" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Permanently delete a user. Cannot delete the root administrator.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await authenticateAdminApi(req, "DELETE /api/admin/users/:id");
  if (guard.error) return guard.error;

  const { id } = await params;
  const { ipAddress, userAgent } = getRequestContext(req);
  const admin = createAdminClient();

  // Fetch the target user to verify
  const { data: targetAuthData, error: fetchErr } =
    await admin.auth.admin.getUserById(id);

  if (fetchErr || !targetAuthData?.user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const targetUser = targetAuthData.user;
  const isRootAdmin = targetUser.email?.toLowerCase() === ADMIN_EMAIL;

  // Protect root admin
  if (isRootAdmin) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      target_type: "user",
      target_id: id,
      target_name: targetUser.email || "",
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "Cannot delete root administrator" },
    });
    return NextResponse.json(
      { error: "Cannot delete the root administrator" },
      { status: 403 }
    );
  }

  // Cannot delete self
  if (id === guard.auth.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  try {
    // Delete from auth (cascade will remove profile via FK)
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete user: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Also explicitly delete profile in case cascade doesn't cover it
    await admin.from("profiles").delete().eq("id", id);

    await logAction({
      actor_user_id: guard.auth.user.id,
      action: "user.deleted",
      target_type: "user",
      target_id: id,
      target_name: targetUser.email || "",
      result: "SUCCESS",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
