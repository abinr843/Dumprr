import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Admin/Service Role Supabase client.
 *
 * ⚠️  CRITICAL SECURITY WARNING:
 *   - This client bypasses ALL Row Level Security.
 *   - NEVER import this module in client components.
 *   - NEVER expose SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_.
 *   - Only use in server-side code (API Routes, Server Actions, cron jobs).
 */

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/admin.ts must not be imported in browser code. " +
      "The service role key bypasses RLS and must remain server-only."
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Check your .env.local file."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
