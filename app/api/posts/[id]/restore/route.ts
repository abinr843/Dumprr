import { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api/response";
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
 * POST /api/posts/:id/restore
 * Admin only. Restore a trashed post back to draft.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const guard = await authenticateAdminApi(req, `POST /api/posts/${id}/restore`);
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const { data: post, error } = await adminClient
    .from("posts")
    .update({
      deleted_at: null,
    })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id, title, slug")
    .single();

  if (error || !post) {
    return notFound("That post isn't in trash, so there's nothing to restore.");
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_RESTORED,
    target_type: "post",
    target_id: post.id,
    target_name: post.title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { slug: post.slug },
  });

  return ok({ message: "Post restored", post });
}
