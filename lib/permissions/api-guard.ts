import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/roles";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";

/**
 * Extract client IP and User-Agent from a NextRequest for audit logging.
 */
export function getRequestContext(req: NextRequest | Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

export interface AuthResult {
  user: { id: string; email?: string | null; created_at: string };
  profile: { role: UserRole; [key: string]: unknown };
}

/**
 * Reusable admin authentication guard for API routes.
 *
 * Verifies the caller is authenticated and has admin (or superadmin) role.
 * On failure, logs `PERMISSION_DENIED` or `UNAUTHORIZED_REQUEST` to audit_logs
 * and returns a NextResponse error that the calling route handler can
 * immediately return.
 *
 * @returns `{ auth }` on success, `{ error }` on failure.
 */
export async function authenticateAdminApi(
  req: NextRequest,
  actionDescription: string
): Promise<
  | { auth: AuthResult; error?: undefined }
  | { auth?: undefined; error: NextResponse }
> {
  const { ipAddress, userAgent } = getRequestContext(req);
  const authHeader = req.headers.get("authorization");

  let user: any = null;
  let profile: any = null;

  const ADMIN_EMAIL = (
    process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com"
  ).toLowerCase();

  if (authHeader && authHeader.startsWith("Bearer ")) {
    // Token-based auth
    const token = authHeader.replace("Bearer ", "").trim();
    const adminClient = createAdminClient();
    const {
      data: { user: tokenUser },
      error: tokenError,
    } = await adminClient.auth.getUser(token);

    if (tokenError || !tokenUser) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        target_type: "security",
        target_name: actionDescription,
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: "Invalid or expired token" },
      });
      return {
        error: NextResponse.json(
          { error: "Unauthorized: Invalid or expired token" },
          { status: 401 }
        ),
      };
    }

    user = tokenUser;
    const { data: p } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === ADMIN_EMAIL ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    profile = p || (isAdminUser ? makeFallbackProfile(user) : null);
  } else {
    // Cookie-based session auth
    const serverSupabase = await createClient();
    const {
      data: { user: sessionUser },
      error: sessionError,
    } = await serverSupabase.auth.getUser();

    if (sessionError || !sessionUser) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        target_type: "security",
        target_name: actionDescription,
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: "No active session" },
      });
      return {
        error: NextResponse.json(
          { error: "Unauthorized: Authentication required" },
          { status: 401 }
        ),
      };
    }

    user = sessionUser;
    const { data: p } = await serverSupabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === ADMIN_EMAIL ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    profile = p || (isAdminUser ? makeFallbackProfile(user) : null);
  }

  const role = (profile?.role as UserRole) || "viewer";
  if (!isAdmin(role)) {
    await logAction({
      actor_user_id: user?.id ?? null,
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      target_type: "security",
      target_name: actionDescription,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { email: user?.email, role },
    });
    return {
      error: NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      ),
    };
  }

  return { auth: { user, profile } };
}

/**
 * Authenticate any logged-in user (not necessarily admin).
 * Returns user + profile on success, or 401 error with audit logging on failure.
 */
export async function authenticateUserApi(
  req: NextRequest,
  actionDescription: string
): Promise<
  | { auth: AuthResult; error?: undefined }
  | { auth?: undefined; error: NextResponse }
> {
  const { ipAddress, userAgent } = getRequestContext(req);
  const authHeader = req.headers.get("authorization");

  const ADMIN_EMAIL = (
    process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com"
  ).toLowerCase();

  let user: any = null;
  let profile: any = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const adminClient = createAdminClient();
    const {
      data: { user: tokenUser },
      error: tokenError,
    } = await adminClient.auth.getUser(token);

    if (tokenError || !tokenUser) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        target_type: "security",
        target_name: actionDescription,
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: "Invalid or expired token" },
      });
      return {
        error: NextResponse.json(
          { error: "Unauthorized: Invalid or expired token" },
          { status: 401 }
        ),
      };
    }

    user = tokenUser;
    const { data: p } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === ADMIN_EMAIL ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    profile = p || (isAdminUser ? makeFallbackProfile(user) : null);
  } else {
    const serverSupabase = await createClient();
    const {
      data: { user: sessionUser },
      error: sessionError,
    } = await serverSupabase.auth.getUser();

    if (sessionError || !sessionUser) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        target_type: "security",
        target_name: actionDescription,
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: "No active session" },
      });
      return {
        error: NextResponse.json(
          { error: "Unauthorized: Authentication required" },
          { status: 401 }
        ),
      };
    }

    user = sessionUser;
    const { data: p } = await serverSupabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === ADMIN_EMAIL ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    profile = p || (isAdminUser ? makeFallbackProfile(user) : null);
  }

  return { auth: { user, profile: profile || { role: "viewer" as UserRole } } };
}

/**
 * IDOR protection: Verify a file is accessible to the caller.
 *
 * - Admin users can access any file regardless of status.
 * - Non-admin users can only access files where status === 'active' and deleted_at IS NULL.
 *
 * Returns the file row on success, or null if access is denied.
 */
export async function verifyFileAccess(
  fileId: string,
  userIsAdmin: boolean
): Promise<any | null> {
  const adminClient = createAdminClient();
  let query = adminClient.from("files").select("*").eq("id", fileId);

  if (!userIsAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  }

  const { data: file } = await query.single();
  return file || null;
}

/**
 * IDOR protection: Verify a post is accessible to the caller.
 *
 * - Admin users can access any post regardless of status.
 * - Non-admin users can only access published posts with no deleted_at.
 *
 * Returns the post row on success, or null if access is denied.
 */
export async function verifyPostAccess(
  postId: string,
  userIsAdmin: boolean
): Promise<any | null> {
  const adminClient = createAdminClient();
  let query = adminClient.from("posts").select("*").eq("id", postId);

  if (!userIsAdmin) {
    query = query.eq("status", "published").is("deleted_at", null);
  }

  const { data: post } = await query.single();
  return post || null;
}

/**
 * IDOR protection: Verify a folder is accessible to the caller.
 *
 * - Admin users can access any folder regardless of status.
 * - Non-admin users can only access active folders with no deleted_at.
 *
 * Returns the folder row on success, or null if access is denied.
 */
export async function verifyFolderAccess(
  folderId: string,
  userIsAdmin: boolean
): Promise<any | null> {
  const adminClient = createAdminClient();
  let query = adminClient.from("folders").select("*").eq("id", folderId);

  if (!userIsAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  }

  const { data: folder } = await query.single();
  return folder || null;
}

// ─── Internal helpers ─────────────────────────────────────────────────

function makeFallbackProfile(user: any) {
  return {
    id: user.id,
    username: "admin",
    full_name: "DUMPR Administrator",
    avatar_url: "",
    role: "superadmin" as UserRole,
    storage_quota_bytes: 5368709120,
    storage_used_bytes: 0,
    metadata: {},
    created_at: user.created_at,
    updated_at: user.created_at,
  };
}
