import { NextRequest } from "next/server";
import { ok, unauthorized, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { cleanupExpiredTrash } from "@/lib/storage/trash";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/trash/cleanup
 * Scheduled or manual trigger to purge trash items older than 7 days.
 *
 * Can be called by:
 * - A cron job (Vercel Cron, external scheduler)
 * - Admin manually triggering cleanup
 *
 * Optional: Pass Authorization header with a secret for cron security.
 */
export async function POST(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Optional cron secret verification
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        target_type: "trash",
        target_name: "trash cleanup",
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: "Invalid cron secret" },
      });
      return unauthorized("That scheduled task key isn't valid.");
    }
  }

  try {
    const result = await cleanupExpiredTrash();

    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.TRASH_CLEANUP_COMPLETED,
      target_type: "trash",
      result: "SUCCESS",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: result,
    });

    return ok({
      message: "Trash cleanup completed",
      ...result,
    });
  } catch (err) {
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "trash",
      target_name: "trash cleanup",
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: err instanceof Error ? err.message : "Unknown error" },
    });
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Trash cleanup couldn't finish. Please try again."),
      500
    );
  }
}
