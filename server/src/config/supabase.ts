/**
 * Supabase client configuration for the Express backend.
 *
 * Provides a service-role admin client for bypassing RLS,
 * and a helper to create per-request user clients from cookies.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnvConfig } from "./env.js";

let _adminClient: SupabaseClient | null = null;

/**
 * Returns the service-role Supabase client.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for server-side operations.
 */
export function createAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const config = getEnvConfig();
  _adminClient = createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return _adminClient;
}

/**
 * Creates a Supabase client authenticated with a user's access token.
 * Used to verify user sessions and fetch user data.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  const config = getEnvConfig();
  return createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
