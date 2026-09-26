import { NextRequest } from "next/server";
import { ok, forbidden } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/:id/versions — list revision snapshots (Feature 10).
 * Admin only (versions contain draft history).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;
  if (!userIsAdmin) {
    return forbidden("Only admins can view version history.");
  }
  const adminClient = createAdminClient();
  try {
    const { data, error } = await adminClient
      .from("post_versions")
      .select("*")
      .eq("post_id", id)
      .order("version_number", { ascending: false });
    if (error) throw error;
    return ok({ versions: data || [] });
  } catch {
    return ok({ versions: [] });
  }
}
