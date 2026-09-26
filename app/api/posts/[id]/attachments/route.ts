import { NextRequest } from "next/server";
import { ok, badRequest, notFound, fail } from "@/lib/api/response";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/:id/attachments — list attached files (Feature 3).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const adminClient = createAdminClient();
  try {
    const { data, error } = await adminClient
      .from("post_attachments")
      .select(
        "id, post_id, file_id, display_order, created_at, files:file_id(id, display_name, original_name, name, extension, size_bytes, mime_type)"
      )
      .eq("post_id", id)
      .order("display_order", { ascending: true });
    if (error) throw error;
    const attachments = (data || []).map((row: Record<string, unknown>) => {
      const f = row.files as {
        id: string;
        display_name: string | null;
        original_name: string;
        name: string;
        extension: string | null;
        size_bytes: number;
        mime_type: string;
      } | null;
      return {
        id: row.id,
        post_id: row.post_id,
        file_id: row.file_id,
        display_order: row.display_order,
        created_at: row.created_at,
        file: f,
        downloadUrl: f ? `/api/files/${f.id}/download` : undefined,
        previewUrl: f ? `/api/files/${f.id}/preview` : undefined,
      };
    });
    return ok({ attachments });
  } catch {
    // Pre-migration: return empty list instead of failing
    return ok({
      attachments: [],
      _note: "post_attachments table unavailable",
    });
  }
}

/**
 * POST /api/posts/:id/attachments — attach { file_ids: string[] } (admin).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const guard = await authenticateAdminApi(req, `POST /api/posts/${id}/attachments`);
  if (guard.error) return guard.error;
  const { ipAddress, userAgent } = getRequestContext(req);

  let body: { file_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("We couldn't process your request. Please refresh and try again.");
  }
  const fileIds = Array.isArray(body.file_ids) ? body.file_ids : [];
  if (fileIds.length === 0) {
    return badRequest("Please select at least one file to attach.");
  }
  if (fileIds.length > 50) {
    return badRequest("Please attach no more than 50 files at a time.");
  }

  const adminClient = createAdminClient();
  // Verify post exists
  const { data: post } = await adminClient.from("posts").select("id").eq("id", id).single();
  if (!post) return notFound("This post no longer exists.");

  // Verify files exist + active
  const { data: files } = await adminClient
    .from("files")
    .select("id")
    .in("id", fileIds)
    .eq("status", "active")
    .is("deleted_at", null);
  const validIds = new Set((files || []).map((f) => f.id));
  const missing = fileIds.filter((fid) => !validIds.has(fid));
  if (missing.length > 0) {
    return notFound(
      "Some files are no longer available and couldn't be attached. Please refresh and try again."
    );
  }

  // Next display_order
  const { data: existing } = await adminClient
    .from("post_attachments")
    .select("display_order")
    .eq("post_id", id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrder = ((existing as { display_order?: number } | null)?.display_order ?? -1) + 1;

  const rows = fileIds.map((fid) => ({
    post_id: id,
    file_id: fid,
    display_order: nextOrder++,
  }));

  const { data: inserted, error } = await adminClient
    .from("post_attachments")
    .upsert(rows as never, { onConflict: "post_id,file_id", ignoreDuplicates: true })
    .select();
  if (error) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "post",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: error.message },
    });
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(error, "Couldn't attach those files. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_EDITED,
    target_type: "post",
    target_id: id,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { action: "attachments_added", fileIds },
  });

  return ok({ attachments: inserted || [] }, { status: 201 });
}
