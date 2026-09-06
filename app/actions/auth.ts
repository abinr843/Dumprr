"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, forgotPasswordSchema } from "@/lib/validation/schema";
import { getPostLoginRedirect } from "@/lib/auth/session";
import {
  logLoginSuccess,
  logLoginFailed,
  logLogout,
  logSessionCreated,
  logSessionRevoked,
  logPasswordChanged,
  logPasswordResetRequested,
} from "@/lib/logging/auth-audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";

/**
 * Extracts IP address and user agent from request headers.
 */
async function getRequestMeta() {
  const headerStore = await headers();
  return {
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      "unknown",
    userAgent: headerStore.get("user-agent") ?? "unknown",
  };
}

// ─────────────────────────────────────────────
// Login Action
// ─────────────────────────────────────────────

export interface LoginState {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate input
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;
  const { ipAddress, userAgent } = await getRequestMeta();

  // Rate limiting check: 5 requests per 15 min
  const rateCheck = checkRateLimit("auth", ipAddress);
  if (!rateCheck.allowed) {
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.RATE_LIMITED,
      target_type: "security",
      target_name: "Authentication",
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { tier: "auth", retryAfter: rateCheck.retryAfter },
    });
    return {
      error: `Too many login attempts. Please try again in ${rateCheck.retryAfter} second(s).`,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Log failed attempt
    await logLoginFailed(email, ipAddress, userAgent, error?.message);
    return { error: "Invalid email or password" };
  }

  // Log success events
  await Promise.all([
    logLoginSuccess(data.user.id, email, ipAddress, userAgent),
    logSessionCreated(data.user.id, email, ipAddress),
  ]);

  // Fetch role for redirect
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = ((profile as { role?: UserRole } | null)?.role ?? "member") as UserRole;
  const redirectTo = formData.get("redirectTo") as string | null;
  const destination = getPostLoginRedirect(role, redirectTo);

  redirect(destination);
}

// ─────────────────────────────────────────────
// Logout Action
// ─────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const { ipAddress } = await getRequestMeta();

  // Get current user before signing out
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await Promise.all([
      logLogout(user.id, user.email, ipAddress),
      logSessionRevoked(user.id, user.email, ipAddress),
    ]);
  }

  await supabase.auth.signOut();
  redirect("/login");
}

// ─────────────────────────────────────────────
// Password Reset Request Action
// ─────────────────────────────────────────────

export interface ForgotPasswordState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const raw = { email: formData.get("email") as string };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email } = parsed.data;
  const { ipAddress } = await getRequestMeta();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
  });

  // Always log the attempt (even if email doesn't exist, for security monitoring)
  await logPasswordResetRequested(email, ipAddress);

  if (error) {
    // Don't reveal whether the email exists
    return {
      success: true,
      message:
        "If an account with that email exists, we've sent a password reset link.",
    };
  }

  return {
    success: true,
    message:
      "If an account with that email exists, we've sent a password reset link.",
  };
}

// ─────────────────────────────────────────────
// Update Password Action (from reset link)
// ─────────────────────────────────────────────

export interface UpdatePasswordState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function updatePasswordAction(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords don't match" };
  }

  const supabase = await createClient();
  const { ipAddress } = await getRequestMeta();

  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await logPasswordChanged(data.user.id, data.user.email, ipAddress);
  }

  return {
    success: true,
    message: "Password updated successfully. You can now log in.",
  };
}
