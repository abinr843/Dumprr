import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { postCreateSchema } from "@/lib/validation/schema";
import { sanitizePostContent, sanitizeText } from "@/lib/security/sanitize";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import type { PostStatus, UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Derive a URL slug from a title string.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * GET /api/posts
 * Role-aware post listing.
 * Visitors see only published posts; admins can filter by status.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "published";
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "50", 10),
    100
  );
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const adminClient = createAdminClient();

  let query = adminClient
    .from("posts")
    .select("*, profiles:author_id(id, username, full_name, avatar_url)");

  if (!userIsAdmin) {
    // Visitors only see published active posts
    query = query
      .eq("status", "published")
      .is("deleted_at", null);
  } else if (status === "all") {
    // Admin sees everything
  } else if (status === "trash") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.eq("status", status as NonNullable<PostStatus>).is("deleted_at", null);
  }

  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: posts, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch posts: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ posts: posts || [], total: count });
}

/**
 * POST /api/posts
 * Admin only. Create a new post.
 */
export async function POST(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "POST /api/posts");
  if (guard.error) return guard.error;

  const body = await req.json();
  const parsed = postCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    title,
    content,
    excerpt,
    status: postStatus,
    featured_image_url,
    tags,
  } = parsed.data;

  // Auto-derive slug if not provided
  let slug = parsed.data.slug || slugify(title);

  const adminClient = createAdminClient();
  const { ipAddress, userAgent } = getRequestContext(req);

  // Ensure slug uniqueness
  const { data: existing } = await adminClient
    .from("posts")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const publishedAt =
    postStatus === "published" ? new Date().toISOString() : null;

  const safeTitle = sanitizeText(title);
  const safeContent = sanitizePostContent(content || "");
  const safeExcerpt = sanitizeText(excerpt || "");

  const { data: post, error: insertErr } = await adminClient
    .from("posts")
    .insert({
      author_id: guard.auth.user.id,
      title: safeTitle,
      slug,
      content: safeContent,
      excerpt: safeExcerpt,
      status: postStatus || "draft",
      featured_image_url: featured_image_url || "",
      tags: tags || [],
      published_at: publishedAt,
    })
    .select()
    .single();

  if (insertErr) {
    await logAction({
      actor_user_id: guard.auth.user.id,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "post",
      target_name: safeTitle,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { error: insertErr.message },
    });
    return NextResponse.json(
      { error: `Post creation failed: ${insertErr.message}` },
      { status: 500 }
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_CREATED,
    target_type: "post",
    target_id: post.id,
    target_name: post.title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { status: post.status, slug: post.slug },
  });

  return NextResponse.json({ post }, { status: 201 });
}
