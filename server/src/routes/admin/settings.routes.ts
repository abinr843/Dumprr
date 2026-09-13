/**
 * Admin settings routes.
 *
 * GET   /api/admin/settings     — Read all system_settings (admin)
 * PATCH /api/admin/settings     — Update one or more settings (admin)
 */

import { Router, Request, Response } from "express";
import { createAdminClient } from "../../config/supabase.js";
import { authenticateUser, requireAdmin } from "../../middleware/auth.js";
import { logAction } from "../../services/audit.service.js";
import { AUDIT_ACTIONS } from "../../types/index.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { invalidateMaintenanceCache } from "../../middleware/maintenance.js";

const router = Router();

// ─── GET /api/admin/settings ────────────────────────────────────────

router.get(
  "/",
  authenticateUser,
  requireAdmin("GET /api/admin/settings"),
  asyncHandler(async (_req: Request, res: Response) => {
    const admin = createAdminClient();

    const { data: settings, error } = await admin
      .from("system_settings")
      .select("*")
      .order("key", { ascending: true });

    if (error) {
      res.status(500).json({ error: `Failed to fetch settings: ${error.message}` });
      return;
    }

    // Convert array to key-value map for convenience
    const settingsMap: Record<string, unknown> = {};
    for (const s of settings || []) {
      settingsMap[s.key] = s.value;
    }

    res.json({ settings: settingsMap, raw: settings });
  })
);

// ─── PATCH /api/admin/settings ──────────────────────────────────────

router.patch(
  "/",
  authenticateUser,
  requireAdmin("PATCH /api/admin/settings"),
  asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body as Record<string, unknown>;
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No settings provided" });
      return;
    }

    const admin = createAdminClient();
    const results: Record<string, string> = {};

    for (const [key, value] of Object.entries(updates)) {
      const { error } = await admin
        .from("system_settings")
        .upsert(
          {
            key,
            value: String(value),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) {
        results[key] = `FAILED: ${error.message}`;
      } else {
        results[key] = "updated";
      }
    }

    // If maintenance mode was toggled, invalidate the cache immediately
    if ("app.maintenance_mode" in updates) {
      invalidateMaintenanceCache();
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      target_type: "settings",
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: {
        updatedKeys: Object.keys(updates),
        results,
      },
    });

    res.json({ message: "Settings updated", results });
  })
);

export default router;
