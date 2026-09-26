import { NextRequest } from "next/server";
import { ok, badRequest, notFound, fail, validationFailed, conflict } from "@/lib/api/response";
import {
  humanizeTechnicalError,
  humanizeZodDetails,
} from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { fileUpdateSchema } from "@/lib/validation/schema";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { UserRole, Database } from "@/types/database.types";

type FileUpdate = Database["public"]["Tables"]["files"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/files/:id
 * Role-aware file detail. Visitors can only view active files (IDOR protected).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const { ipAddress, userAgent } = getRequestContext(req);
  const adminClient = createAdminClient();
  let query = adminClient.from("files").select("*").eq("id", id);

  if (!userIsAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  }

  const { data: file, error } = await query.single();

  if (error || !file) {
    return notFound("This file is no longer available. It may have been moved or deleted.");
  }

  return ok({ file });
}

/**
 * PATCH /api/files/:id
 * Admin only. Rename (display_name) and/or move (folder_id).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(req, `PATCH /api/files/${id}`);
  if (guard.error) return guard.error;

  const body = await req.json();
  const parsed = fileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return validationFailed(
      humanizeZodDetails(parsed.error.flatten()),
      parsed.error.flatten()
    );
  }

  const { display_name, folder_id } = parsed.data;
  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Fetch current file (IDOR: verify existence)
  const { data: existing, error: fetchErr } = await adminClient
    .from("files")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "file",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "File not found for update" },
    });
    return notFound("This file no longer exists.");
  }

  const updates: FileUpdate = { updated_at: new Date().toISOString() };
  const auditEvents: { action: string; metadata: Record<string, unknown> }[] = [];

  if (display_name !== undefined && display_name !== existing.display_name) {
    updates.display_name = display_name;
    auditEvents.push({
      action: AUDIT_ACTIONS.FILE_RENAMED,
      metadata: {
        previousName: existing.display_name,
        newName: display_name,
      },
    });
  }

  if (folder_id !== undefined && folder_id !== existing.folder_id) {
    // Verify target folder exists if not null
    if (folder_id !== null) {
      const { data: targetFolder } = await adminClient
        .from("folders")
        .select("id")
        .eq("id", folder_id)
        .eq("status", "active")
        .single();

      if (!targetFolder) {
        return badRequest("The folder you're moving this to no longer exists. Please choose another.");
      }
    }

    updates.folder_id = folder_id;
    auditEvents.push({
      action: AUDIT_ACTIONS.FILE_MOVED,
      metadata: {
        previousFolderId: existing.folder_id,
        newFolderId: folder_id,
      },
    });
  }

  if (Object.keys(updates).length <= 1) {
    return ok({ file: existing, message: "No changes" });
  }

  const { data: updated, error: updateErr } = await adminClient
    .from("files")
    .update(updates)
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
      humanizeTechnicalError(updateErr, "Couldn't update this file. Please try again."),
      500
    );
  }

  // Log all audit events (single bulk insert)
  await logAction(
    auditEvents.map((evt) => ({
      actor_user_id: guard.auth.user.id,
      action: evt.action,
      target_type: "file" as const,
      target_id: id,
      target_name: updated.display_name || updated.name,
      result: "SUCCESS" as const,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: evt.metadata,
    }))
  );

  return ok({ file: updated });
}

/**
 * DELETE /api/files/:id
 * Admin only. Soft-deletes file → moves to trash.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const guard = await authenticateAdminApi(req, `DELETE /api/files/${id}`);
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
      action: AUDIT_ACTIONS.FILE_DELETED,
      target_type: "file",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "File not found" },
    });
    return notFound("This file no longer exists.");
  }

  if (existing.status === "trash") {
    return conflict("This file is already in trash.");
  }

  const { data: updated, error: updateErr } = await adminClient
    .from("files")
    .update({
      status: "trash",
      deleted_at: new Date().toISOString(),
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
      humanizeTechnicalError(updateErr, "Couldn't move this file to trash. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.FILE_DELETED,
    target_type: "file",
    target_id: id,
    target_name: existing.display_name || existing.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return ok({ file: updated, message: "File moved to trash" });
}
