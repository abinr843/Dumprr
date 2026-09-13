/**
 * Trash management routes.
 *
 * GET    /api/trash         — List all trashed items with expiration countdowns (admin)
 * DELETE /api/trash         — Empty trash: purge all expired items (admin)
 * POST   /api/trash/cleanup — Trigger retention cleanup cycle (admin/cron)
 */

import { Router } from "express";
import { createAdminClient } from "../config/supabase.js";
import { authenticateUser, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { cleanupExpiredTrash, getRemainingDays } from "../services/trash.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";

const router = Router();

// ─── GET /api/trash ─────────────────────────────────────────────────

router.get(
  "/",
  authenticateUser,
  requireAdmin("GET /api/trash"),
  asyncHandler(async (req, res) => {
    const admin = createAdminClient();

    const [filesResult, foldersResult, postsResult] = await Promise.all([
      admin
        .from("files")
        .select("*")
        .eq("status", "trash")
        .order("deleted_at", { ascending: false }),
      admin
        .from("folders")
        .select("*")
        .eq("status", "trash")
        .order("deleted_at", { ascending: false }),
      admin
        .from("posts")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

    const files = (filesResult.data || []).map((f: any) => ({
      ...f,
      itemType: "file",
      remainingDays: f.deleted_at ? getRemainingDays(f.deleted_at) : 0,
    }));

    const folders = (foldersResult.data || []).map((f: any) => ({
      ...f,
      itemType: "folder",
      remainingDays: f.deleted_at ? getRemainingDays(f.deleted_at) : 0,
    }));

    const posts = (postsResult.data || []).map((p: any) => ({
      ...p,
      itemType: "post",
      remainingDays: p.deleted_at ? getRemainingDays(p.deleted_at) : 0,
    }));

    res.json({
      files,
      folders,
      posts,
      totalItems: files.length + folders.length + posts.length,
    });
  })
);

// ─── DELETE /api/trash (empty all) ──────────────────────────────────

router.delete(
  "/",
  authenticateUser,
  requireAdmin("DELETE /api/trash"),
  asyncHandler(async (req, res) => {
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    try {
      const result = await cleanupExpiredTrash();

      await logAction({
        actor_user_id: req.user!.id,
        action: AUDIT_ACTIONS.TRASH_CLEANUP_COMPLETED,
        target_type: "trash",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: { ...result, trigger: "manual_empty" },
      });

      res.json({ message: "Trash emptied", ...result });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to empty trash",
      });
    }
  })
);

// ─── POST /api/trash/cleanup (scheduled/manual) ────────────────────

router.post(
  "/cleanup",
  asyncHandler(async (req, res) => {
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    // Allow cron secret auth as alternative to admin session
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      // Fall back to admin auth check
      if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
        await logAction({
          actor_user_id: null,
          action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
          target_type: "trash",
          target_name: "trash cleanup",
          result: "FAILED",
          ip_address: ip,
          user_agent: ua,
          metadata: { reason: "Invalid auth for cleanup" },
        });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    try {
      const result = await cleanupExpiredTrash();

      await logAction({
        actor_user_id: req.user?.id ?? null,
        action: AUDIT_ACTIONS.TRASH_CLEANUP_COMPLETED,
        target_type: "trash",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: { ...result, trigger: isCronAuth ? "cron" : "manual" },
      });

      res.json({ message: "Trash cleanup completed", ...result });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Cleanup failed",
      });
    }
  })
);

export default router;
