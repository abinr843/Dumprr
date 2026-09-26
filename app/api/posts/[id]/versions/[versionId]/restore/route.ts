import { NextRequest } from "next/server";
import { ok, notFound, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAdminApi, getRequestContext } from "@/lib/permissions/api-guard";
import { sanitizePostContent, sanitizeText } from "@/lib/security/sanitize";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

/**
 * POST /api/posts/:id/versions/:versionId/restore — rollback to a snapshot (Feature 10).
 * Snapshots the live post first, then restores the selected revision.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, versionId } = await params;
  const guard = await authenticateAdminApi(req, `POST /api/posts/${id}/versions/${versionId}/restore`);
  if (guard.error) return guard.error;
  const { ipAddress, userAgent } = getRequestContext(req);
  const adminClient = createAdminClient();

  const { data: version } = await adminClient
    .from("post_versions")
    .select("*")
    .eq("id", versionId)
    .eq("post_id", id)
    .single();
  if (!version) {
    return notFound("That revision no longer exists.");
  }

  const { data: live } = await adminClient.from("posts").select("*").eq("id", id).single();
  if (!live) return notFound("This post no longer exists.");

  // Snapshot live before rollback
  try {
    const { data: latest } = await adminClient
      .from("post_versions")
      .select("version_number")
      .eq("post_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((latest as { version_number?: number } | null)?.version_number ?? 0) + 1;
    const liveRec = live as Record<string, unknown>;
    await adminClient.from("post_versions").insert({
      post_id: id,
      version_number: nextVersion,
      title: (liveRec.title as string) ?? "",
      content: (liveRec.content as string) ?? null,
      excerpt: (liveRec.excerpt as string) ?? null,
      tags: (liveRec.tags as string[]) ?? null,
      author_id: guard.auth.user.id,
      change_summary: `Pre-rollback snapshot before restoring v${(version as { version_number: number }).version_number}`,
    } as never);
  } catch {
    /* best-effort */
  }

  const v = version as {
    title: string;
    content: string | null;
    excerpt: string | null;
    tags: string[] | null;
    version_number: number;
  };
  const restorePayload: Record<string, unknown> = {
    title: sanitizeText(v.title),
    content: v.content ? sanitizePostContent(v.content) : v.content,
    excerpt: v.excerpt ? sanitizeText(v.excerpt) : v.excerpt,
    tags: v.tags ?? [],
  };

  const { data: post, error } = await adminClient
    .from("posts")
    .update(restorePayload as never)
    .eq("id", id)
    .select()
    .single();

  if (error || !post) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(error, "Couldn't restore that revision. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_EDITED,
    target_type: "post",
    target_id: id,
    target_name: (post as { title: string }).title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { action: "version_restore", restoredVersion: v.version_number },
  });

  return ok({ post });
}
