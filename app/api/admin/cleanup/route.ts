import { NextRequest, NextResponse } from "next/server";
import { authenticateAdminApi, getRequestContext } from "@/lib/permissions/api-guard";
import { cleanupExpiredTrash } from "@/lib/storage/trash";
import { logAction } from "@/lib/logging/log-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/cleanup
 * Runs the 7-day retention cleanup job.
 * Accessible by admin auth or CRON_SECRET bearer token.
 */
export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestContext(req);

  // Allow cron secret auth as alternative to admin session
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth =
    cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const guard = await authenticateAdminApi(req, "POST /api/admin/cleanup");
    if (guard.error) return guard.error;
  }

  try {
    const result = await cleanupExpiredTrash();

    await logAction({
      actor_user_id: null,
      action: "system.cleanup_completed",
      target_type: "system",
      result: "SUCCESS",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        filesRemoved: result.filesRemoved,
        foldersRemoved: result.foldersRemoved,
        postsRemoved: result.postsRemoved,
        trigger: isCronAuth ? "cron" : "manual",
      },
    });

    return NextResponse.json({
      message: "Cleanup completed successfully",
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
