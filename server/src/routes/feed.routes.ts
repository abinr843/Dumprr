/**
 * Feed routes.
 * GET /api/feed/recent
 */

import { Router } from "express";
import { getRecentFeed } from "../services/feed.service.js";
import { logAction } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";

const router = Router();

router.get(
  "/recent",
  asyncHandler(async (req, res) => {
    const limit = Math.min(
      parseInt((req.query.limit as string) || "10", 10),
      100
    );

    try {
      const result = await getRecentFeed({ limit });
      res.json(result);
    } catch (err) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.API_ERROR,
        target_type: "feed",
        result: "FAILED",
        ip_address: req.ipAddress || "127.0.0.1",
        user_agent: req.userAgent || "unknown",
        metadata: {
          error: err instanceof Error ? err.message : "Unknown error",
        },
      });
      res.status(500).json({ error: "Failed to load feed" });
    }
  })
);

export default router;
