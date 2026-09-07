import { NextRequest, NextResponse } from "next/server";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import { getRecentFeed } from "@/lib/feed/recent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/feed/recent?limit=10
 * Returns recently uploaded files and published posts merged chronologically.
 *
 * This route handler now delegates to the shared `getRecentFeed()` helper,
 * which is also called directly by Server Components (zero-HTTP hydration).
 * The route exists for client-initiated refreshes (e.g. "Refresh" button).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "10", 10),
    100
  );

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const result = await getRecentFeed({ limit });
    return NextResponse.json(result);
  } catch (err) {
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "feed",
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: err instanceof Error ? err.message : "Unknown error" },
    });
    return NextResponse.json(
      { error: "Failed to load feed" },
      { status: 500 }
    );
  }
}
