import { NextRequest } from "next/server";
import { ok, fail, validationFailed } from "@/lib/api/response";
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
 * Role-aware post listing. Pinned posts surface first (Feature 10).
 * Supports ?type=article|code, ?tag=x, ?pinned=true filters.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "published";
  const typeFilter = url.searchParams.get("type");
  const tagFilter = url.searchParams.get("tag");
  const pinnedOnly = url.searchParams.get("pinned") === "true";
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

  // Graceful filters (ignored by PostgREST when columns missing → catch below)
  try {
    if (typeFilter === "article" || typeFilter === "code") {
      query = query.eq("post_type" as never, typeFilter as never);
    }
    if (tagFilter) {
      query = query.contains("tags" as never, [tagFilter] as never);
    }
    if (pinnedOnly) {
      query = query.eq("is_pinned" as never, true as never);
    }
  } catch {
    /* ignore filter errors on older schemas */
  }

  query = query
    .order("is_pinned" as never, { ascending: false } as never)
    .order("pinned_at" as never, { ascending: false, nullsFirst: false } as never)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: posts, error, count } = await query;

  if (error) {
    // Fallback for DBs without the new columns: retry without pin ordering
    if (/is_pinned|pinned_at|post_type/i.test(error.message)) {      let fallback = adminClient
        .from("posts")
        .select("*, profiles:author_id(id, username, full_name, avatar_url)");
      if (!userIsAdmin) {
        fallback = fallback.eq("status", "published").is("deleted_at", null);
      } else if (status === "all") {
      } else if (status === "trash") {
        fallback = fallback.not("deleted_at", "is", null);
      } else {
        fallback = fallback.eq("status", status as NonNullable<PostStatus>).is("deleted_at", null);
      }
      const retry = await fallback
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (retry.error) {
        return fail(
          "INTERNAL_ERROR",
          humanizeTechnicalError(retry.error, "Couldn't load posts. Please try again."),
          500
        );
      }
      return ok({ posts: retry.data || [], total: retry.count });
    }
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(error, "Couldn't load posts. Please try again."),
      500
    );
  }

  return ok({ posts: posts || [], total: count });
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
    return validationFailed(
      humanizeZodDetails(parsed.error.flatten()),
      parsed.error.flatten()
    );
  }

  const {
    title,
    content,
    excerpt,
    status: postStatus,
    featured_image_url,
    tags,
    post_type,
    code_language,
    code_filename,
    is_pinned,
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

  const pinned = Boolean(is_pinned);

  // Build insert payload; strip new columns if the DB hasn't migrated yet
  const baseInsert: Record<string, unknown> = {
    author_id: guard.auth.user.id,
    title: safeTitle,
    slug,
    content: safeContent,
    excerpt: safeExcerpt,
    status: postStatus || "draft",
    featured_image_url: featured_image_url || "",
    tags: tags || [],
    published_at: publishedAt,
  };
  const fullInsert: Record<string, unknown> = {
    ...baseInsert,
    post_type: post_type || "article",
    code_language: code_language || null,
    code_filename: code_filename ? sanitizeText(code_filename) : null,
    is_pinned: pinned,
    pinned_at: pinned ? new Date().toISOString() : null,
  };

  let post: Record<string, unknown> | null = null;
  let insertErr: { message: string } | null = null;
  {
    const attempt = await adminClient
      .from("posts")
      .insert(fullInsert as never)
      .select()
      .single();
    post = attempt.data as Record<string, unknown> | null;
    insertErr = attempt.error as { message: string } | null;
    if (insertErr && /post_type|code_|is_pinned|pinned_at/i.test(insertErr.message)) {
      const retry = await adminClient
        .from("posts")
        .insert(baseInsert as never)
        .select()
        .single();
      post = retry.data as Record<string, unknown> | null;
      insertErr = retry.error as { message: string } | null;
    }
  }

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
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(insertErr, "Couldn't create your post. Please try again."),
      500
    );
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: AUDIT_ACTIONS.POST_CREATED,
    target_type: "post",
    target_id: (post as { id: string }).id,
    target_name: (post as { title: string }).title,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { status: (post as { status: string }).status, slug: (post as { slug: string }).slug },
  });

  return ok({ post }, { status: 201 });
}
