import { NextRequest } from "next/server";
import { ok, unauthorized, badRequest, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bookmarks API (Feature 8).
 * GET /api/bookmarks → current user's bookmarks (enriched best-effort)
 * POST /api/bookmarks { item_type: 'file'|'post', item_id } → add
 * DELETE /api/bookmarks?item_type=file&item_id=... → remove
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return unauthorized("Please sign in to manage your bookmarks.");
  }
  const adminClient = createAdminClient();
  try {
    const { data, error } = await adminClient
      .from("user_bookmarks")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = (data || []) as {
      id: string;
      item_type: "file" | "post";
      item_id: string;
      created_at: string;
    }[];

    // Enrich with titles (best-effort, tolerate failures)
    const fileIds = rows.filter((r) => r.item_type === "file").map((r) => r.item_id);
    const postIds = rows.filter((r) => r.item_type === "post").map((r) => r.item_id);
    const fileMap = new Map<string, unknown>();
    const postMap = new Map<string, unknown>();
    if (fileIds.length > 0) {
      const { data: files } = await adminClient
        .from("files")
        .select("id, display_name, original_name, name, extension, size_bytes, mime_type")
        .in("id", fileIds);
      (files || []).forEach((f: { id: string }) => fileMap.set(f.id, f));
    }
    if (postIds.length > 0) {
      const { data: posts } = await adminClient
        .from("posts")
        .select("id, title, slug, status")
        .in("id", postIds);
      (posts || []).forEach((p: { id: string }) => postMap.set(p.id, p));
    }
    const bookmarks = rows.map((r) => ({
      ...r,
      file: r.item_type === "file" ? fileMap.get(r.item_id) ?? null : null,
      post: r.item_type === "post" ? postMap.get(r.item_id) ?? null : null,
    }));
    return ok({ bookmarks });
  } catch {
    return ok({ bookmarks: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return unauthorized("Please sign in to manage your bookmarks.");
  }
  let body: { item_type?: string; item_id?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("We couldn't process your request. Please refresh and try again.");
  }
  if (body.item_type !== "file" && body.item_type !== "post") {
    return badRequest("Please specify whether you're saving a file or a post.");
  }
  if (!body.item_id) {
    return badRequest("Please choose an item to bookmark.");
  }
  const adminClient = createAdminClient();
  try {
    const { data, error } = await adminClient
      .from("user_bookmarks")
      .upsert(
        {
          user_id: session.user.id,
          item_type: body.item_type,
          item_id: body.item_id,
        } as never,
        { onConflict: "user_id,item_type,item_id", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) throw error;
    return ok({ bookmark: data }, { status: 201 });
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Couldn't save your bookmark. Please try again."),
      500
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return unauthorized("Please sign in to manage your bookmarks.");
  }
  const url = new URL(req.url);
  const itemType = url.searchParams.get("item_type");
  const itemId = url.searchParams.get("item_id");
  if ((itemType !== "file" && itemType !== "post") || !itemId) {
    return badRequest("We couldn't tell which bookmark to remove. Please try again.");
  }
  const adminClient = createAdminClient();
  try {
    const { error } = await adminClient
      .from("user_bookmarks")
      .delete()
      .eq("user_id", session.user.id)
      .eq("item_type", itemType)
      .eq("item_id", itemId);
    if (error) throw error;
    return ok({ message: "Bookmark removed" });
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(err, "Couldn't remove your bookmark. Please try again."),
      500
    );
  }
}
