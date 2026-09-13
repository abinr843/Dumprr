/**
 * Health check route.
 * GET /api/health
 */

import { Router } from "express";
import { createAdminClient } from "../config/supabase.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("system_settings")
      .select("key")
      .limit(1)
      .single();

    const dbConnected = !error;

    res.json({
      status: dbConnected ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? "connected" : "disconnected",
        api: "running",
      },
    });
  } catch {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "disconnected",
        api: "running",
      },
    });
  }
});

export default router;
