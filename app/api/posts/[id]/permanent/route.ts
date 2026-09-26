import { NextRequest } from "next/server";
import { ok, notFound, fail } from "@/lib/api/response";
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
 * DELETE /api/posts/:id/permanent
 * Admin only. Permanently delete a post row.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const guard = await authenticateAdminApi(
    req,
    `DELETE /api/posts/${id}/permanent`
  );
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Fetch before deletion for audit
  const { data: post } = await adminClient
    .from("posts")
    .select("id, title, slug")
    .eq("id", id)
    .single();

  if (!post) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.POST_PERMANENTLY_DELETED,
      target_type: "post",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "Post not found" },
    });
    return notFound("This post no longer exists.");
  }

  const { error: deleteErr } = await adminClient
    .from("posts")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "post",
      target_id: post.id,
      target_name: post.title,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: deleteErr.message },
    });
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(deleteErr, "Couldn't permanently delete this post. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_PERMANENTLY_DELETED,
    target_type: "post",
    target_id: post.id,
    target_name: post.title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      slug: post.slug,
    },
  });

  return ok({
    message: "Post permanently deleted",
    id: post.id,
  });
}
