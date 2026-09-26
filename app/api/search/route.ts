import { NextRequest } from "next/server";
import { ok, fail, validationFailed } from "@/lib/api/response";
import { humanizeTechnicalError, humanizeZodDetails } from "@/lib/api/human-errors";
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
import { parseSearchOperators, buildSnippet } from "@/lib/search/operators";
import type { UserRole } from "@/types/database.types";
import type { SearchResultItem, SearchResults } from "@/types/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...&type=all|files|posts|folders&limit=20
 * Unified search across files, folders, and posts.
 * Advanced operators (Feature 5): tag:/#, type:, ext:, min-size:, author:
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
    return validationFailed(
      humanizeZodDetails(parsed.error.flatten()),
      parsed.error.flatten()
    );
  }

  const { q: rawQ, type, limit } = parsed.data;
  const ops = parseSearchOperators(rawQ);
  // If query was only operators (e.g. "tag:docker"), use wildcard text
  const q = ops.text || "";
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  const adminClient = createAdminClient();
  const searchPattern = q ? `%${q}%` : `%`;

  // Operator-driven category narrowing: type:code → posts filtered to code
  const wantFiles =
    (type === "all" || type === "files") &&
    (ops.typeFilter === "all" || ops.typeFilter === "file");
  const wantPosts =
    (type === "all" || type === "posts") &&
    (ops.typeFilter === "all" || ops.typeFilter === "post" || ops.typeFilter === "code");
  const wantFolders =
    (type === "all" || type === "folders") && ops.typeFilter === "all";

  const results: SearchResults = {
    files: [],
    posts: [],
    folders: [],
  };

  try {
    // Search files
    if (wantFiles) {
      let fileQuery = adminClient
        .from("files")
        .select(
          "id, name, display_name, original_name, extension, size_bytes, mime_type, created_at, updated_at"
        )
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (q) {
        fileQuery = fileQuery.or(
          `display_name.ilike.${searchPattern},original_name.ilike.${searchPattern},name.ilike.${searchPattern},extension.ilike.${searchPattern}`
        );
      }
      if (ops.ext) {
        fileQuery = fileQuery.eq("extension", ops.ext);
      }
      if (ops.minSizeBytes != null) {
        fileQuery = fileQuery.gte("size_bytes", ops.minSizeBytes);
      }

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
          snippet: buildSnippet(f.display_name || f.original_name, q),
        })
      );
    }

    // Search posts (incl. code posts + tags)
    if (wantPosts) {
      let postQuery = adminClient
        .from("posts")
        .select(
          "id, title, slug, excerpt, content, tags, status, published_at, created_at, updated_at, post_type, code_language"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (q) {
        postQuery = postQuery.or(
          `title.ilike.${searchPattern},slug.ilike.${searchPattern},excerpt.ilike.${searchPattern},content.ilike.${searchPattern}`
        );
      }
      if (ops.tags.length > 0) {
        // Require ALL requested tags (overlap → then client-filter for containment)
        try {
          postQuery = postQuery.overlaps("tags", ops.tags);
        } catch {
          /* older schema without tags overlap support */
        }
      }
      // type:code narrows to code posts (best-effort pre-migration)
      if (ops.typeFilter === "code") {
        try {
          postQuery = postQuery.eq("post_type" as never, "code" as never);
        } catch {
          /* ignore */
        }
      }
      if (ops.ext) {
        try {
          postQuery = postQuery.eq("code_language" as never, ops.ext as never);
        } catch {
          /* ignore */
        }
      }

      if (!userIsAdmin) {
        postQuery = postQuery.eq("status", "published");
      }

      const { data: posts } = await postQuery;
      let filtered = posts || [];
      // Enforce ALL-tags containment client-side (overlaps is ANY)
      if (ops.tags.length > 0) {
        filtered = filtered.filter((p: { tags?: string[] | null }) => {
          const pt = ((p.tags || []) as string[]).map((t) => String(t).toLowerCase());
          return ops.tags.every((t) => pt.includes(t));
        });
      }
      // Author filter needs profile join — resolve matching author ids first
      if (ops.author) {
        try {
          const { data: profiles } = await adminClient
            .from("profiles")
            .select("id, username")
            .ilike("username", `%${ops.author}%`)
            .limit(20);
          const ids = new Set((profiles || []).map((p) => p.id));
          // Re-fetch author ids for these posts
          const { data: withAuthors } = await adminClient
            .from("posts")
            .select("id, author_id")
            .in(
              "id",
              filtered.map((p: { id: string }) => p.id)
            );
          const authorOf = new Map(
            ((withAuthors || []) as { id: string; author_id: string }[]).map((r) => [r.id, r.author_id])
          );
          filtered = filtered.filter((p: { id: string }) => ids.has(authorOf.get(p.id) || ""));
        } catch {
          /* best-effort */
        }
      }
      results.posts = filtered.map(
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
          tags: (p as { tags?: string[] }).tags || [],
          postType: (p as { post_type?: string }).post_type,
          codeLanguage: (p as { code_language?: string | null }).code_language ?? null,
          snippet:
            buildSnippet(p.excerpt || p.content, q) || undefined,
        })
      );
    }

    // Search folders
    if (wantFolders) {
      let folderQuery = adminClient
        .from("folders")
        .select("id, name, color, parent_id, created_at, updated_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(limit);

      if (q) {
        folderQuery = folderQuery.ilike("name", searchPattern);
      }

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

    return ok({
      query: rawQ,
      category: type,
      parsed: {
        text: ops.text,
        tags: ops.tags,
        typeFilter: ops.typeFilter,
        ext: ops.ext,
        minSizeBytes: ops.minSizeBytes,
        author: ops.author,
      },
      results,
      totalCount,
    });
  } catch (err) {
    await logAction({
      actor_user_id: session?.user?.id ?? null,
      action: AUDIT_ACTIONS.API_ERROR,
      target_type: "search",
      target_name: rawQ,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        error: err instanceof Error ? err.message : "Unknown error",
        query: rawQ,
      },
    });
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Search isn't working right now. Please try again in a moment."),
      500
    );
  }
}
