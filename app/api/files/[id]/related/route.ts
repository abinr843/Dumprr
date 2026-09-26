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
 * GET /api/files/:id/related — posts referencing this file + tag-similar files (Feature 9).
 * File tags live in files.metadata.tags (optional).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;
  const adminClient = createAdminClient();

  const { data: file } = await adminClient
    .from("files")
    .select("id, display_name, original_name, name, metadata")
    .eq("id", id)
    .single();
  if (!file) return notFound("This file no longer exists.");
  const fileRec = file as unknown as {
    id: string;
    metadata: Record<string, unknown> | null;
  };
  const meta = (fileRec.metadata || {}) as { tags?: unknown };
  const fileTags: string[] = Array.isArray(meta.tags)
    ? (meta.tags as unknown[]).map((t) => String(t).toLowerCase())
    : [];

  // Explicit: posts attaching this file
  let mentioningPosts: unknown[] = [];
  try {
    const { data: links } = await adminClient
      .from("post_attachments")
      .select("post_id")
      .eq("file_id", id);
    const postIds = (links || []).map((l: { post_id: string }) => l.post_id);
    if (postIds.length > 0) {
      let q = adminClient
        .from("posts")
        .select("id, title, slug, excerpt, tags, status, published_at")
        .in("id", postIds)
        .is("deleted_at", null);
      if (!userIsAdmin) q = q.eq("status", "published");
      const { data } = await q;
      mentioningPosts = data || [];
    }
  } catch {
    mentioningPosts = [];
  }

  // Semantic: posts sharing tags
  let tagRelatedPosts: unknown[] = [];
  if (fileTags.length > 0) {
    try {
      let q = adminClient
        .from("posts")
        .select("id, title, slug, excerpt, tags, status, published_at")
        .overlaps("tags", fileTags)
        .is("deleted_at", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (!userIsAdmin) q = q.eq("status", "published");
      const { data } = await q;
      const mentioned = new Set((mentioningPosts as { id: string }[]).map((p) => p.id));
      tagRelatedPosts = (data || []).filter((p: { id: string }) => !mentioned.has(p.id));
    } catch {
      tagRelatedPosts = [];
    }
  }

  return ok({
    fileId: id,
    mentioningPosts,
    tagRelatedPosts,
    fileTags,
  });
}
