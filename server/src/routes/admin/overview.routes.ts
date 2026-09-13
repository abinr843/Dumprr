/**
 * Admin overview route.
 * GET /api/admin/overview
 */

import { Router } from "express";
import { createAdminClient } from "../../config/supabase.js";
import { authenticateUser, requireAdmin } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/error-handler.js";

const router = Router();

router.get(
  "/",
  authenticateUser,
  requireAdmin("GET /api/admin/overview"),
  asyncHandler(async (_req, res) => {
    const admin = createAdminClient();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayISO = yesterday.toISOString();

    const [
      usersResult,
      filesResult,
      recentFilesResult,
      postsResult,
      auditResult,
      storageResult,
    ] = await Promise.all([
      // Total user count
      admin.auth.admin.listUsers({ perPage: 1000 }),
      // Total active files
      admin
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      // Files uploaded in last 24h
      admin
        .from("files")
        .select("id", { count: "exact", head: true })
        .gte("created_at", yesterdayISO),
      // Total published posts
      admin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .is("deleted_at", null),
      // Recent audit events (last 10)
      admin
        .from("audit_logs")
        .select("id, action, target_type, target_name, result, created_at, actor_user_id")
        .order("created_at", { ascending: false })
        .limit(10),
      // Total storage used
      admin.rpc("get_total_storage_used"),
    ]);

    const totalUsers = usersResult.data?.users?.length ?? 0;
    const totalFiles = filesResult.count ?? 0;
    const recentUploads = recentFilesResult.count ?? 0;
    const totalPosts = postsResult.count ?? 0;
    const recentEvents = auditResult.data || [];
    const storageUsedBytes =
      typeof storageResult.data === "number" ? storageResult.data : 0;

    res.json({
      totalUsers,
      totalFiles,
      recentUploads,
      totalPosts,
      storageUsedBytes,
      storageCapBytes: 8 * 1024 * 1024 * 1024, // 8GB
      recentEvents,
    });
  })
);

export default router;
