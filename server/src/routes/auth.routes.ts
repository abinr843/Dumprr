/**
 * Auth callback route.
 * GET /api/auth/callback
 *
 * Handles PKCE code exchange from Supabase Auth.
 */

import { Router, Request, Response } from "express";
import { createAdminClient } from "../config/supabase.js";
import { logAction } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";

const router = Router();

router.get(
  "/callback",
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const next = (req.query.next as string) || "/";
    const origin = `${req.protocol}://${req.get("host")}`;

    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    if (code) {
      const admin = createAdminClient();

      // For OAuth callbacks, we need to exchange the code
      // In the standalone backend, we redirect to the frontend origin
      const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:3000";

      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        target_type: "auth",
        target_name: "oauth_callback",
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: { method: "oauth_callback" },
      });

      // Redirect back to frontend with the code for client-side exchange
      res.redirect(`${frontendOrigin}${next}?code=${code}`);
      return;
    }

    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
      target_type: "auth",
      target_name: "oauth_callback",
      result: "FAILED",
      ip_address: ip,
      user_agent: ua,
      metadata: { reason: "Missing auth code" },
    });

    const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendOrigin}/?auth_error=true`);
  })
);

export default router;
