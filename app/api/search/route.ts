import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { searchQuerySchema } from "@/lib/validation/schema";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import type { UserRole } from "@/types/database.types";
import type { SearchResultItem, SearchResults } from "@/types/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...&type=all|files|posts|folders&limit=20
 * Unified search across files, folders, and posts.
 */
export async function GET(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Rate limiting
  const rlIdentifier = getRateLimitIdentifier(req);
  const rlResult = checkRateLimit("search", rlIdentifier);
  if (!rlResult.allowed) {
    return rateLimitResponse("search", rlResult, req);
  }

  const url = new URL(req.url);
  const rawParams = {
    q: url.searchParams.get("q") || "",
    type: url.searchParams.get("type") || url.searchParams.get("category") || "all",
    limit: url.searchParams.get("limit") || "20",
  };

  const parsed = searchQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q, type, limit } = parsed.data;
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const adminClient = createAdminClient();
  const searchPattern = `%${q}%`;

  const results: SearchResults = {
    files: [],
    posts: [],
    folders: [],
  };

  try {
    // Search files
    if (type === "all" || type === "files") {
      let fileQuery = adminClient
        .from("files")
        .select(
          "id, name, display_name, original_name, extension, size_bytes, mime_type, created_at, updated_at"
        )
        .eq("status", "active")
        .is("deleted_at", null)
        .or(
          `display_name.ilike.${searchPattern},original_name.ilike.${searchPattern},name.ilike.${searchPattern},extension.ilike.${searchPattern}`
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      const { data: files } = await fileQuery;
      results.files = (files || []).map(
        (f): SearchResultItem => ({
          id: f.id,
          type: "file",
          title: f.display_name || f.original_name || f.name,
          description: f.original_name,
          extension: f.extension,
          sizeBytes: f.size_bytes,
          mimeType: f.mime_type,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })
      );
    }

    // Search posts
    if (type === "all" || type === "posts") {
      let postQuery = adminClient
        .from("posts")
        .select("id, title, slug, excerpt, status, published_at, created_at, updated_at")
        .is("deleted_at", null)
        .or(
          `title.ilike.${searchPattern},slug.ilike.${searchPattern},excerpt.ilike.${searchPattern},content.ilike.${searchPattern}`
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!userIsAdmin) {
        postQuery = postQuery.eq("status", "published");
      }

      const { data: posts } = await postQuery;
      results.posts = (posts || []).map(
        (p): SearchResultItem => ({
          id: p.id,
          type: "post",
          title: p.title,
          description: p.excerpt || undefined,
          slug: p.slug,
          status: p.status,
          publishedAt: p.published_at || undefined,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })
      );
    }

    // Search folders
    if (type === "all" || type === "folders") {
      let folderQuery = adminClient
        .from("folders")
        .select("id, name, color, parent_id, created_at, updated_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .ilike("name", searchPattern)
        .order("name", { ascending: true })
        .limit(limit);

      const { data: folders } = await folderQuery;
      results.folders = (folders || []).map(
        (f): SearchResultItem => ({
          id: f.id,
          type: "folder",
          title: f.name,
          color: f.color,
          parentId: f.parent_id,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })
      );
    }

    const totalCount =
      results.files.length + results.posts.length + results.folders.length;

    return NextResponse.json({
      query: q,
      category: type,
      results,
      totalCount,
    });
  } catch (err) {
    await logAction({
      actor_user_id: session?.user?.id ?? null,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "search",
      target_name: q,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        error: err instanceof Error ? err.message : "Unknown error",
        query: q,
      },
    });
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
