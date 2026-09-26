import { NextRequest } from "next/server";
import { ok, badRequest, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";
import {
  getMaxUsers as getMaxUsersFromSettings,
  getDefaultUserRole,
  getDefaultQuotaBytes,
} from "@/lib/settings/system-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Lists all users with profile data and auth metadata.
 */
export async function GET(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "GET /api/admin/users");
  if (guard.error) return guard.error;

  const admin = createAdminClient();

  try {
    // Fetch all auth users
    const { data: authData, error: authError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      return fail(
        "INTERNAL_ERROR",
        humanizeTechnicalError(authError, "Couldn't load users. Please try again."),
        500
      );
    }

    // Fetch all profiles
    const { data: profiles } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    const maxUsers = await getMaxUsersFromSettings();

    const users = (authData?.users || []).map((u) => {
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

    return ok({
      users,
      total: users.length,
      maxUsers,
    });
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Couldn't load users. Please try again."),
      500
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user. Enforces MAX_USERS cap and blocks second admin creation.
 */
export async function POST(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "POST /api/admin/users");
  if (guard.error) return guard.error;

  const { ipAddress, userAgent } = getRequestContext(req);
  const body = await req.json();

  const { email, password, full_name, role } = body as {
    email?: string;
    password?: string;
    full_name?: string;
    role?: string;
  };

  if (!email || !password) {
    return badRequest("Please provide both an email address and a password.");
  }

  // Block admin/superadmin role creation
  if (role === "admin" || role === "superadmin") {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      target_type: "user",
      target_name: email,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "Attempted to create a second administrator", requestedRole: role },
    });
    return badRequest("New administrator accounts can't be created here. Only member and viewer roles are allowed.");
  }

  const admin = createAdminClient();

  // Enforce MAX_USERS cap
  const maxUsers = await getMaxUsersFromSettings();
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const currentCount = authData?.users?.length ?? 0;

  if (currentCount >= maxUsers) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: "user.creation_blocked",
      target_type: "user",
      target_name: email,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "MAX_USERS cap reached", currentCount, maxUsers },
    });
    return badRequest(
      `The user limit has been reached (${currentCount} of ${maxUsers}). Please remove someone or raise the limit first.`
    );
  }

  // Create user in Supabase Auth
  const settingsDefaultRole = await getDefaultUserRole();
  const effectiveRole = (role === "member" || role === "viewer") ? role : settingsDefaultRole;
  const defaultQuota = await getDefaultQuotaBytes();
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
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(createError, "Couldn't create that user. Please check the email and try again."),
      500
    );
  }

  // Ensure profile row with correct role and quota
  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUser.user.id,
    username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    full_name: full_name || email.split("@")[0],
    role: effectiveRole as UserRole,
    storage_quota_bytes: defaultQuota,
  });

  if (profileError) {
    // Non-fatal: trigger may handle it
    console.warn("Profile upsert warning:", profileError.message);
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: "user.created",
    target_type: "user",
    target_id: newUser.user.id,
    target_name: email,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { role: effectiveRole, full_name },
  });

  return ok(
    {
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: effectiveRole,
        full_name: full_name || email.split("@")[0],
      },
      message: "User created successfully",
    },
    { status: 201 }
  );
}
