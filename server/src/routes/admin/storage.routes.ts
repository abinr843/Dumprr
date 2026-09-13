/**
 * Admin storage analytics route.
 * GET /api/admin/storage
 */

import { Router } from "express";
import { createAdminClient } from "../../config/supabase.js";
import { authenticateUser, requireAdmin } from "../../middleware/auth.js";
import { getStorageQuota } from "../../services/storage.service.js";
import { asyncHandler } from "../../middleware/error-handler.js";

const router = Router();

router.get(
  "/",
  authenticateUser,
  requireAdmin("GET /api/admin/storage"),
  asyncHandler(async (_req, res) => {
    const admin = createAdminClient();
    const quota = await getStorageQuota();

    // Get MIME category breakdown
    const { data: files } = await admin
      .from("files")
      .select("mime_type, size_bytes")
      .eq("status", "active")
      .is("deleted_at", null);

    const mimeCategories: Record<string, { count: number; totalBytes: number }> = {};
    if (files) {
      for (const file of files) {
        const category = (file.mime_type || "unknown").split("/")[0];
        if (!mimeCategories[category]) {
          mimeCategories[category] = { count: 0, totalBytes: 0 };
        }
        mimeCategories[category].count++;
        mimeCategories[category].totalBytes += file.size_bytes || 0;
      }
    }

    // Top 10 largest files
    const { data: topFiles } = await admin
      .from("files")
      .select("id, display_name, original_name, extension, size_bytes, mime_type, created_at")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("size_bytes", { ascending: false })
      .limit(10);

    res.json({
      quota,
      mimeCategories,
      topFiles: topFiles || [],
    });
  })
);

export default router;
