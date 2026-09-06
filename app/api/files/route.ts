import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files
 *
 * Role-aware file listing:
 * - Public visitors: Only active, non-deleted files.
 * - Admin: Supports filtering by ?status, ?folder_id, ?search, ?limit, ?offset.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const folderId = url.searchParams.get("folder_id"); // null = root
  const search = url.searchParams.get("search");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const adminClient = createAdminClient();

  let query = adminClient
    .from("files")
    .select("*", { count: "exact" });

  // Role-based filtering
  if (!userIsAdmin) {
    // Visitors can only see active files
    query = query.eq("status", "active").is("deleted_at", null);
  } else {
    // Admin can filter by status
    if (status && status !== "all") {
      query = query.eq("status", status as "active" | "trash" | "deleted");
    }
  }

  // Folder filtering
  if (folderId === "null" || folderId === "") {
    // Root level: files with no folder
    query = query.is("folder_id", null);
  } else if (folderId) {
    query = query.eq("folder_id", folderId);
  }

  // Search by name/extension
  if (search && search.trim()) {
    const q = search.trim();
    query = query.or(
      `display_name.ilike.%${q}%,original_name.ilike.%${q}%,extension.ilike.%${q}%`
    );
  }

  // Pagination & ordering
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: files, error, count } = await query;

  if (error) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const ua = req.headers.get("user-agent") || "unknown";
    await logAction({
      actor_user_id: session?.user?.id ?? null,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "file",
      result: "FAILED",
      ip_address: ip,
      user_agent: ua,
      metadata: { error: error.message },
    });
    return NextResponse.json(
      { error: `Failed to fetch files: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    files: files || [],
    total: count ?? 0,
    limit,
    offset,
  });
}
