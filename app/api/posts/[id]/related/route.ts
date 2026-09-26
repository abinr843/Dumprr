import { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/:id/related — attached files + tag-similar posts (Feature 9).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;
  const adminClient = createAdminClient();

  const { data: post } = await adminClient
    .from("posts")
    .select("id, title, tags")
    .eq("id", id)
    .single();
  if (!post) return notFound("This post no longer exists.");
  const postRec = post as unknown as { id: string; title: string; tags: string[] | null };
  const tags: string[] = Array.isArray(postRec.tags) ? postRec.tags : [];

  // Explicit attachments
  let attachedFiles: unknown[] = [];
  try {
    const { data } = await adminClient
      .from("post_attachments")
      .select(
        "file_id, display_order, files:file_id(id, display_name, original_name, name, extension, size_bytes, mime_type)"
      )
      .eq("post_id", id)
      .order("display_order", { ascending: true });
    attachedFiles = (data || []).map((r: Record<string, unknown>) => ({
      file_id: r.file_id,
      display_order: r.display_order,
      file: r.files,
    }));
  } catch {
    attachedFiles = [];
  }

  // Tag-similar posts
  let relatedPosts: unknown[] = [];
  if (tags.length > 0) {
    try {
      let q = adminClient
        .from("posts")
        .select("id, title, slug, excerpt, tags, status, published_at")
        .neq("id", id)
        .overlaps("tags", tags)
        .is("deleted_at", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (!userIsAdmin) q = q.eq("status", "published");
      const { data } = await q;
      relatedPosts = data || [];
    } catch {
      relatedPosts = [];
    }
  }

  return ok({
    postId: id,
    attachedFiles,
    relatedPosts,
    sharedTags: tags,
  });
}
