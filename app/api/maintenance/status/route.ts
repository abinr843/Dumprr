import { ok } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/maintenance/status
 *
 * Lightweight public endpoint returning the current maintenance mode state.
 * Used by client components to auto-detect status changes without hard refreshes.
 * Always queries the DB directly (no cache) for real-time accuracy.
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "app.maintenance_mode")
      .maybeSingle();

    if (error) {
      return ok(
        { maintenance: false },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    }

    const maintenance = data?.value === "true" || data?.value === true;

    return ok(
      { maintenance },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch {
    // If we can't check, assume not in maintenance
    return ok(
      { maintenance: false },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}
