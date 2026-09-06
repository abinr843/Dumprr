import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthSession } from "@/types/user";
import type { UserRole } from "@/types/database.types";

/**
 * Retrieves the current authenticated user and their profile.
 * Returns null values if no session exists.
 */
export async function getSession(): Promise<AuthSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const ADMIN_EMAIL = process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com";
  const isAdminUser =
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
    user.user_metadata?.role === "superadmin" ||
    user.user_metadata?.role === "admin";

  const effectiveProfile = profile || (isAdminUser ? {
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
  } : null);

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
    },
    profile: effectiveProfile,
  };
}

/**
 * Requires authentication. Redirects to /login if not authenticated.
 * Use in Server Components and Server Actions that need a guaranteed user.
 */
export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

/**
 * Requires admin-level authentication.
 * Redirects to /login if not authenticated, or to / if not an admin.
 */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireSession();

  if (!session.profile || !isAdmin(session.profile.role as UserRole)) {
    redirect("/?error=access_denied");
  }

  return session;
}

/**
 * Determines the correct post-login redirect URL based on user role.
 *
 * @param role - The user's role
 * @param redirectTo - Optional explicit redirect from query params
 * @returns The URL to redirect to after login
 */
export function getPostLoginRedirect(
  role: UserRole,
  redirectTo?: string | null
): string {
  // If there's a valid explicit redirect, use it (but validate)
  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    // Don't let non-admins redirect to /admin routes
    if (redirectTo.startsWith("/admin") && !isAdmin(role)) {
      return "/";
    }
    return redirectTo;
  }

  // Default: admins go to /admin, everyone else goes to /
  return isAdmin(role) ? "/admin" : "/";
}
