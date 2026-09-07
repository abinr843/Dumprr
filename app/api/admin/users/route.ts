import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Default maximum users (overridden by system_settings) */
const DEFAULT_MAX_USERS = 20;

/**
 * Fetch the max users cap from system_settings or fallback to default.
 */
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
      return NextResponse.json(
        { error: `Failed to list users: ${authError.message}` },
        { status: 500 }
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

    const maxUsers = await getMaxUsers();

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

    return NextResponse.json({
      users,
      total: users.length,
      maxUsers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list users" },
      { status: 500 }
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
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Cannot create additional administrator accounts. Only member and viewer roles are permitted." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Enforce MAX_USERS cap
  const maxUsers = await getMaxUsers();
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
    return NextResponse.json(
      { error: `User limit reached. Maximum ${maxUsers} users allowed. Current: ${currentCount}.` },
      { status: 400 }
    );
  }

  // Create user in Supabase Auth
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
    return NextResponse.json(
      { error: `Failed to create user: ${createError.message}` },
      { status: 500 }
    );
  }

  // Ensure profile row with correct role
  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUser.user.id,
    username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    full_name: full_name || email.split("@")[0],
    role: effectiveRole as UserRole,
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

  return NextResponse.json(
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
