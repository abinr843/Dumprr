import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Healthcheck endpoint to verify the app is running and
 * environment variables are configured.
 */
export async function GET() {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabase_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      app_url: process.env.NEXT_PUBLIC_APP_URL || "not set",
    },
  };

  return NextResponse.json(checks);
}
