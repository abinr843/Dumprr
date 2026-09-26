import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAdminApi, getRequestContext } from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; fileId: string }>;
}

/**
 * DELETE /api/posts/:id/attachments/:fileId — detach a file (admin).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id, fileId } = await params;
  const guard = await authenticateAdminApi(req, `DELETE /api/posts/${id}/attachments/${fileId}`);
  if (guard.error) return guard.error;
  const { ipAddress, userAgent } = getRequestContext(req);
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("post_attachments")
    .delete()
    .eq("post_id", id)
    .eq("file_id", fileId);

  if (error) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(error, "Couldn't remove that attachment. Please try again."),
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
    metadata: { action: "attachment_removed", fileId },
  });

  return ok({ message: "Attachment removed", postId: id, fileId });
}
