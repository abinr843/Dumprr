import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
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
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ post });
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
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Fetch current post to detect status transitions
  const { data: existing } = await adminClient
    .from("posts")
    .select("status, published_at, title")
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
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const sanitizedData: Database["public"]["Tables"]["posts"]["Update"] = {
    ...(parsed.data as Database["public"]["Tables"]["posts"]["Update"]),
  };

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

  // If transitioning to published and not yet published, set published_at
  if (
    parsed.data.status === "published" &&
    existing.status !== "published" &&
    !existing.published_at
  ) {
    sanitizedData.published_at = new Date().toISOString();
  }

  const { data: post, error: updateErr } = await adminClient
    .from("posts")
    .update(sanitizedData)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "post",
      target_id: id,
      target_name: existing.title,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: updateErr.message },
    });
    return NextResponse.json(
      { error: `Update failed: ${updateErr.message}` },
      { status: 500 }
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_EDITED,
    target_type: "post",
    target_id: post.id,
    target_name: post.title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      slug: post.slug,
      updatedFields: Object.keys(parsed.data),
      previousStatus: existing.status,
      newStatus: post.status,
    },
  });

  return NextResponse.json({ post });
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
    return NextResponse.json(
      { error: "Post not found or already deleted" },
      { status: 404 }
    );
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

  return NextResponse.json({ message: "Post moved to trash", id: post.id });
}
