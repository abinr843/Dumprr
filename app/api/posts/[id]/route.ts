import { NextRequest } from "next/server";
import { ok, badRequest, notFound, fail, validationFailed } from "@/lib/api/response";
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
import { postUpdateSchema } from "@/lib/validation/schema";
import { sanitizePostContent, sanitizeText } from "@/lib/security/sanitize";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { Database, UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/:id
 * Fetch a single post by UUID or slug. Non-admins only see published active posts.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return badRequest("We couldn't tell which post to open. Please try again.");
  }

  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Try by UUID first, then by slug
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    );
  let query = adminClient
    .from("posts")
    .select("*, profiles:author_id(id, username, full_name, avatar_url)");

  if (isUuid) {
    query = query.eq("id", id);
  } else {
    query = query.eq("slug", id);
  }

  if (!userIsAdmin) {
    query = query.eq("status", "published").is("deleted_at", null);
  }

  const { data: post, error } = await query.single();

  if (error || !post) {
    return notFound("This post is no longer available. It may have been moved or deleted.");
  }

  return ok({ post });
}

/**
 * PATCH /api/posts/:id
 * Admin only. Update post title, content, status, etc.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const guard = await authenticateAdminApi(req, `PATCH /api/posts/${id}`);
  if (guard.error) return guard.error;

  const body = await req.json();
  const parsed = postUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return validationFailed(
      humanizeZodDetails(parsed.error.flatten()),
      parsed.error.flatten()
    );
  }

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Fetch current post to detect status transitions + snapshot version history
  const { data: existing } = await adminClient
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.POST_EDITED,
      target_type: "post",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "Post not found" },
    });
    return notFound("This post no longer exists.");
  }

  // Snapshot current revision into post_versions (best-effort; table may not exist pre-migration)
  try {
    const existingRow = existing as Record<string, unknown>;
    const { data: latest } = await adminClient
      .from("post_versions")
      .select("version_number")
      .eq("post_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((latest as { version_number?: number } | null)?.version_number ?? 0) + 1;
    const changeSummary =
      (parsed.data as { change_summary?: string }).change_summary ||
      `Updated: ${Object.keys(parsed.data).filter((k) => k !== "change_summary").join(", ") || "content"}`;
    await adminClient.from("post_versions").insert({
      post_id: id,
      version_number: nextVersion,
      title: (existingRow.title as string) ?? "",
      content: (existingRow.content as string) ?? null,
      excerpt: (existingRow.excerpt as string) ?? null,
      tags: (existingRow.tags as string[]) ?? null,
      post_type: ((existingRow.post_type as string) ?? "article") as never,
      code_language: (existingRow.code_language as string) ?? null,
      code_filename: (existingRow.code_filename as string) ?? null,
      author_id: guard.auth.user.id,
      change_summary: changeSummary,
    } as never);
  } catch {
    /* versioning is best-effort */
  }

  const sanitizedData: Database["public"]["Tables"]["posts"]["Update"] = {
    ...(parsed.data as Database["public"]["Tables"]["posts"]["Update"]),
  };
  // change_summary is version metadata only, not a posts column
  delete (sanitizedData as Record<string, unknown>).change_summary;

  // Stored XSS Prevention: Sanitize text fields
  if (sanitizedData.title) {
    sanitizedData.title = sanitizeText(sanitizedData.title);
  }
  if (sanitizedData.content) {
    sanitizedData.content = sanitizePostContent(sanitizedData.content);
  }
  if (sanitizedData.excerpt) {
    sanitizedData.excerpt = sanitizeText(sanitizedData.excerpt);
  }
  if (sanitizedData.code_filename) {
    sanitizedData.code_filename = sanitizeText(sanitizedData.code_filename);
  }

  // Pin bookkeeping: toggling is_pinned maintains pinned_at
  const existingRec = existing as unknown as {
    status: string;
    published_at: string | null;
    title: string;
    is_pinned?: boolean;
  };
  if (typeof (sanitizedData as Record<string, unknown>).is_pinned === "boolean") {
    const wantPinned = Boolean((sanitizedData as Record<string, unknown>).is_pinned);
    if (wantPinned && !existingRec.is_pinned) {
      (sanitizedData as Record<string, unknown>).pinned_at = new Date().toISOString();
    } else if (!wantPinned) {
      (sanitizedData as Record<string, unknown>).pinned_at = null;
    }
  }

  // If transitioning to published and not yet published, set published_at
  if (
    parsed.data.status === "published" &&
    existingRec.status !== "published" &&
    !existingRec.published_at
  ) {
    sanitizedData.published_at = new Date().toISOString();
  }

  // Strip new columns + retry if DB hasn't migrated yet
  let post: Record<string, unknown> | null = null;
  let updateErr: { message: string } | null = null;
  {
    const attempt = await adminClient
      .from("posts")
      .update(sanitizedData as never)
      .eq("id", id)
      .select()
      .single();
    post = attempt.data as Record<string, unknown> | null;
    updateErr = attempt.error as { message: string } | null;
    if (updateErr && /post_type|code_|is_pinned|pinned_at/i.test(updateErr.message)) {
      const fallback = { ...sanitizedData } as Record<string, unknown>;
      delete fallback.post_type;
      delete fallback.code_language;
      delete fallback.code_filename;
      delete fallback.is_pinned;
      delete fallback.pinned_at;
      const retry = await adminClient
        .from("posts")
        .update(fallback as never)
        .eq("id", id)
        .select()
        .single();
      post = retry.data as Record<string, unknown> | null;
      updateErr = retry.error as { message: string } | null;
    }
  }

  if (updateErr || !post) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "post",
      target_id: id,
      target_name: existingRec.title,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: updateErr?.message ?? "Update failed" },
    });
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(updateErr, "Couldn't save your changes. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_EDITED,
    target_type: "post",
    target_id: (post as { id: string }).id,
    target_name: (post as { title: string }).title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      slug: (post as { slug?: string }).slug,
      updatedFields: Object.keys(parsed.data),
      previousStatus: existingRec.status,
      newStatus: (post as { status?: string }).status,
    },
  });

  return ok({ post });
}

/**
 * DELETE /api/posts/:id
 * Admin only. Soft delete (status=trash, sets deleted_at).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const guard = await authenticateAdminApi(req, `DELETE /api/posts/${id}`);
  if (guard.error) return guard.error;

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  const now = new Date().toISOString();
  const { data: post, error } = await adminClient
    .from("posts")
    .update({
      deleted_at: now,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, title, slug")
    .single();

  if (error || !post) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.POST_DELETED,
      target_type: "post",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "Post not found or already deleted" },
    });
    return notFound("This post was already deleted or never existed.");
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_DELETED,
    target_type: "post",
    target_id: post.id,
    target_name: post.title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { slug: post.slug },
  });

  return ok({ message: "Post moved to trash", id: post.id });
}
