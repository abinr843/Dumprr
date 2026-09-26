import { NextRequest } from "next/server";
import { ok, notFound, fail, conflict } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/files/:id/restore
 * Admin only. Restores a trashed file back to active status.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(req, `POST /api/files/${id}/restore`);
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const { data: existing, error: fetchErr } = await adminClient
    .from("files")
    .select("id, display_name, name, status")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.FILE_RESTORED,
      target_type: "file",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "File not found" },
    });
    return notFound("This file no longer exists.");
  }

  if (existing.status !== "trash") {
    return conflict("This file isn't in trash, so there's nothing to restore.");
  }

  const { data: restored, error: updateErr } = await adminClient
    .from("files")
    .update({
      status: "active",
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "file",
      target_id: id,
      target_name: existing.display_name || existing.name,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: updateErr.message },
    });
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(updateErr, "Couldn't restore this file. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FILE_RESTORED,
    target_type: "file",
    target_id: id,
    target_name: existing.display_name || existing.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return ok({ file: restored, message: "File restored" });
}
