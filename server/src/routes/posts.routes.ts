/**
 * Post management routes.
 *
 * GET    /api/posts             — List posts (role-aware)
 * POST   /api/posts             — Create post with slug (admin)
 * GET    /api/posts/:id         — Get post by ID or slug (IDOR protected)
 * PATCH  /api/posts/:id         — Update post (admin)
 * DELETE /api/posts/:id         — Soft delete to trash (admin)
 * POST   /api/posts/:id/restore   — Restore from trash (admin)
 * DELETE /api/posts/:id/permanent — Permanently delete (admin)
 */

import { Router, Request, Response } from "express";
import { createAdminClient } from "../config/supabase.js";
import { authenticateUser, requireAdmin, isAdmin } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { sanitizePostContent } from "../services/security.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { humanizeTechnicalError } from "../utils/api-response.js";

const router = Router();

/** Generate a URL-safe slug from a title */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ─── GET /api/posts ─────────────────────────────────────────────────

router.get(
  "/",
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const admin = createAdminClient();
    let query = admin.from("posts").select("*", { count: "exact" });

    if (!userIsAdmin) {
      query = query.eq("status", "published").is("deleted_at", null);
    } else if (status && status !== "all") {
      if (status === "trash") {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.eq("status", status).is("deleted_at", null);
      }
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      res.status(500).json({ error: humanizeTechnicalError(error, "Couldn't load posts. Please try again.") });
      return;
    }

    res.json({ posts: posts || [], total: count ?? 0, limit, offset });
  })
);

// ─── POST /api/posts ────────────────────────────────────────────────

router.post(
  "/",
  authenticateUser,
  requireAdmin("POST /api/posts"),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, content, excerpt, status, tags } = req.body;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "Post title is required" });
      return;
    }

    const slug = generateSlug(title);
    const sanitizedContent = content ? sanitizePostContent(content) : "";
    const postStatus = status === "published" ? "published" : "draft";

    const { data: post, error: insertErr } = await admin
      .from("posts")
      .insert({
        title: title.trim(),
        slug,
        content: sanitizedContent,
        excerpt: excerpt || null,
        status: postStatus,
        tags: tags || [],
        author_id: req.user!.id,
        published_at: postStatus === "published" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertErr) {
      res.status(500).json({ error: humanizeTechnicalError(insertErr, "Couldn't create your post. Please try again.") });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.POST_CREATED,
      target_type: "post",
      target_id: post.id,
      target_name: post.title,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { slug, status: postStatus },
    });

    res.status(201).json({ post });
  })
);

// ─── GET /api/posts/:id ────────────────────────────────────────────

router.get(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const admin = createAdminClient();

    // Try by UUID first, then by slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = admin.from("posts").select("*");
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
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json({ post });
  })
);

// ─── PATCH /api/posts/:id ───────────────────────────────────────────

router.patch(
  "/:id",
  authenticateUser,
  requireAdmin("PATCH /api/posts/:id"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const { title, content, excerpt, status, tags } = req.body;

    if (title !== undefined) {
      updates.title = title;
      updates.slug = generateSlug(title);
    }
    if (content !== undefined) {
      updates.content = sanitizePostContent(content);
    }
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (tags !== undefined) updates.tags = tags;

    if (status !== undefined && status !== existing.status) {
      updates.status = status;
      if (status === "published" && !existing.published_at) {
        updates.published_at = new Date().toISOString();
      }
    }

    const { data: updated, error: updateErr } = await admin
      .from("posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: humanizeTechnicalError(updateErr, "Couldn't save your changes. Please try again.") });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.POST_UPDATED,
      target_type: "post",
      target_id: id,
      target_name: updated.title,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { fields: Object.keys(updates).filter((k) => k !== "updated_at") },
    });

    res.json({ post: updated });
  })
);

// ─── DELETE /api/posts/:id (soft delete) ────────────────────────────

router.delete(
  "/:id",
  authenticateUser,
  requireAdmin("DELETE /api/posts/:id"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: post, error } = await admin
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, title, slug")
      .single();

    if (error || !post) {
      res.status(404).json({ error: "Post not found or already in trash" });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.POST_DELETED,
      target_type: "post",
      target_id: post.id,
      target_name: post.title,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { slug: post.slug },
    });

    res.json({ message: "Post moved to trash", post });
  })
);

// ─── POST /api/posts/:id/restore ────────────────────────────────────

router.post(
  "/:id/restore",
  authenticateUser,
  requireAdmin("POST /api/posts/:id/restore"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: post, error } = await admin
      .from("posts")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select("id, title, slug")
      .single();

    if (error || !post) {
      res.status(404).json({ error: "Post not found in trash" });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.POST_RESTORED,
      target_type: "post",
      target_id: post.id,
      target_name: post.title,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { slug: post.slug },
    });

    res.json({ message: "Post restored", post });
  })
);

// ─── DELETE /api/posts/:id/permanent ────────────────────────────────

router.delete(
  "/:id/permanent",
  authenticateUser,
  requireAdmin("DELETE /api/posts/:id/permanent"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: post } = await admin
      .from("posts")
      .select("id, title, slug")
      .eq("id", id)
      .single();

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const { error: deleteErr } = await admin.from("posts").delete().eq("id", id);

    if (deleteErr) {
      res.status(500).json({ error: humanizeTechnicalError(deleteErr, "Couldn't permanently delete this post. Please try again.") });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.POST_PERMANENTLY_DELETED,
      target_type: "post",
      target_id: post.id,
      target_name: post.title,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { slug: post.slug },
    });

    res.json({ message: "Post permanently deleted", id: post.id });
  })
);

export default router;
