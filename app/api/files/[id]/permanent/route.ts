import { NextRequest, NextResponse } from "next/server";
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
 * DELETE /api/files/:id/permanent
 * Admin only. Permanently deletes file from storage and database.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(
    req,
    `DELETE /api/files/${id}/permanent`
  );
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Fetch file to get storage path
  const { data: file, error: fetchErr } = await adminClient
    .from("files")
    .select("id, display_name, name, original_name, storage_path, size_bytes")
    .eq("id", id)
    .single();

  if (fetchErr || !file) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.FILE_PERMANENTLY_DELETED,
      target_type: "file",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "File not found" },
    });
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Remove physical object from storage
  if (file.storage_path) {
    const { error: removeErr } = await adminClient.storage
      .from("dump-files")
      .remove([file.storage_path]);

    if (removeErr) {
      await logAction({
        actor_user_id: guard.auth.user.id,
        action: AUDIT_ACTIONS.API_ERROR,
        target_type: "file",
        target_id: id,
        target_name: file.display_name || file.name,
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { error: removeErr.message, stage: "storage_removal" },
      });
      return NextResponse.json(
        {
          error: `Storage removal failed: ${removeErr.message}`,
        },
        { status: 500 }
      );
    }
  }

  // Delete database row
  const { error: deleteErr } = await adminClient
    .from("files")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "file",
      target_id: id,
      target_name: file.display_name || file.name,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: deleteErr.message, stage: "database_deletion" },
    });
    return NextResponse.json(
      { error: `Database deletion failed: ${deleteErr.message}` },
      { status: 500 }
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FILE_PERMANENTLY_DELETED,
    target_type: "file",
    target_id: id,
    target_name: file.display_name || file.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      sizeBytes: file.size_bytes,
    },
  });

  return NextResponse.json({
    message: "File permanently deleted",
    deletedId: id,
  });
}
