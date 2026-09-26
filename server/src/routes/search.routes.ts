/**
 * Search routes.
 * GET /api/search
 */

import { Router, Request, Response } from "express";
import { createAdminClient } from "../config/supabase.js";
import { rateLimit } from "../middleware/rate-limiter.js";
import { authenticateUser, isAdmin } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { humanizeTechnicalError } from "../utils/api-response.js";

const router = Router();

router.get(
  "/",
  rateLimit("search"),
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const q = ((req.query.q as string) || "").trim();
    const type = (req.query.type as string) || "all";
    const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 100);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    if (!q || q.length < 2) {
      res.status(400).json({ error: "Search query must be at least 2 characters" });
      return;
    }

    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const admin = createAdminClient();

    const results: { files: any[]; folders: any[]; posts: any[] } = {
      files: [],
      folders: [],
      posts: [],
    };

    try {
      const searchPattern = `%${q}%`;

      // Search files
      if (type === "all" || type === "files") {
        let fileQuery = admin
          .from("files")
          .select("id, display_name, original_name, extension, size_bytes, mime_type, status, created_at")
          .or(
            `display_name.ilike.${searchPattern},original_name.ilike.${searchPattern},extension.ilike.${searchPattern}`
          );

        if (!userIsAdmin) {
          fileQuery = fileQuery.eq("status", "active").is("deleted_at", null);
        }

        const { data: files } = await fileQuery
          .order("created_at", { ascending: false })
          .limit(limit);

        results.files = files || [];
      }

      // Search folders
      if (type === "all" || type === "folders") {
        let folderQuery = admin
          .from("folders")
          .select("id, name, path, color, status, created_at")
          .ilike("name", searchPattern);

        if (!userIsAdmin) {
          folderQuery = folderQuery.eq("status", "active").is("deleted_at", null);
        }

        const { data: folders } = await folderQuery
          .order("name", { ascending: true })
          .limit(limit);

        results.folders = folders || [];
      }

      // Search posts
      if (type === "all" || type === "posts") {
        let postQuery = admin
          .from("posts")
          .select("id, title, slug, status, excerpt, published_at, created_at")
          .or(`title.ilike.${searchPattern},content.ilike.${searchPattern}`);

        if (!userIsAdmin) {
          postQuery = postQuery.eq("status", "published").is("deleted_at", null);
        }

        const { data: posts } = await postQuery
          .order("created_at", { ascending: false })
          .limit(limit);

        results.posts = posts || [];
      }

      const totalResults =
        results.files.length + results.folders.length + results.posts.length;

      res.json({
        query: q,
        totalResults,
        ...results,
      });
    } catch (err) {
      await logAction({
        actor_user_id: req.user?.id ?? null,
        action: AUDIT_ACTIONS.API_ERROR,
        target_type: "system",
        result: "FAILED",
        ip_address: req.ipAddress || "127.0.0.1",
        user_agent: req.userAgent || "unknown",
        metadata: {
          error: err instanceof Error ? err.message : "Search error",
          query: q,
        },
      });
      res.status(500).json({ error: humanizeTechnicalError(err, "Search isn't working right now. Please try again in a moment.") });
    }
  })
);

export default router;
