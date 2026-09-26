import { NextRequest } from "next/server";
import { ok, badRequest, notFound, forbidden, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
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
    return notFound("That user no longer exists.");
  }

  const targetUser = targetAuthData.user;
  const isRootAdmin = targetUser.email?.toLowerCase() === ADMIN_EMAIL;

  // Protect root administrator from being disabled/demoted/deleted
  if (isRootAdmin && (action === "disable" || role === "viewer" || role === "member")) {
    return forbidden("The root administrator account can't be disabled or demoted.");
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
    return badRequest("Users can't be promoted to administrator roles here.");
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

      return ok({ message: "User disabled successfully" });
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

      return ok({ message: "User enabled successfully" });
    }

    if (action === "reset_access") {
      // Generate a password recovery link
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "recovery",
          email: targetUser.email!,
        });

      if (linkError) {
        return fail(
          "INTERNAL_ERROR",
          humanizeTechnicalError(linkError, "Couldn't create a recovery link. Please try again."),
          500
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

      return ok({
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
        return fail(
          "INTERNAL_ERROR",
          humanizeTechnicalError(updateErr, "Couldn't update that user. Please try again."),
          500
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

      return ok({ message: "User updated successfully" });
    }

    return badRequest("Please choose an action (disable, enable, reset access) or update a field first.");
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Couldn't update that user. Please try again."),
      500
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
    return notFound("That user no longer exists.");
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
    return forbidden("The root administrator account can't be deleted.");
  }

  // Cannot delete self
  if (id === guard.auth.user.id) {
    return badRequest("You can't delete your own account.");
  }

  try {
    // Delete from auth (cascade will remove profile via FK)
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);

    if (deleteError) {
      return fail(
        "INTERNAL_ERROR",
        humanizeTechnicalError(deleteError, "Couldn't delete that user. Please try again."),
        500
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

    return ok({ message: "User deleted successfully" });
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Couldn't delete that user. Please try again."),
      500
    );
  }
}
