import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

/**
 * GET /api/auth/callback
 *
 * Handles the PKCE auth code exchange callback from Supabase Auth.
 * After a user signs in via magic link or OAuth, Supabase redirects here
 * with a `code` query parameter that is exchanged for a session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const ua = request.headers.get("user-agent") || "unknown";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      await logAction({
        actor_user_id: data.user.id,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        target_type: "auth",
        target_name: data.user.email,
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: { method: "oauth_callback" },
      });
      return NextResponse.redirect(`${origin}${next}`);
    }

    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
      target_type: "auth",
      target_name: "oauth_callback",
      result: "FAILED",
      ip_address: ip,
      user_agent: ua,
      metadata: { error: error?.message || "Exchange failed" },
    });
  } else {
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
      target_type: "auth",
      target_name: "oauth_callback",
      result: "FAILED",
      ip_address: ip,
      user_agent: ua,
      metadata: { reason: "Missing auth code" },
    });
  }

  // If there's an error or no code, redirect to an error page
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
