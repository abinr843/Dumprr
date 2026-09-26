/**
 * Maintenance mode middleware for the Express backend.
 *
 * Checks system_settings with a 15-second in-memory cache.
 * Consistent with the Next.js centralized settings service TTL.
 */

import type { Request, Response, NextFunction } from "express";
import { createAdminClient } from "../config/supabase.js";

// ─── 15-second cache ────────────────────────────────────────────────

let maintenanceCache: { value: boolean; expiresAt: number } | null = null;

/**
 * Invalidate the in-memory maintenance cache immediately.
 * Called by the admin settings route when app.maintenance_mode is toggled.
 */
export function invalidateMaintenanceCache(): void {
  maintenanceCache = null;
}

async function isMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache.value;
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "app.maintenance_mode")
      .single();

    // Normalize JSONB: could be true, "true", or '"true"'
    let val = data?.value;
    if (typeof val === "string") {
      try { val = JSON.parse(val); } catch { /* keep as-is */ }
    }
    const enabled = val === true || val === "true";
    maintenanceCache = { value: enabled, expiresAt: now + 15_000 };
    return enabled;
  } catch {
    return false;
  }
}


// ─── Exempt paths ───────────────────────────────────────────────────

const EXEMPT_PREFIXES = [
  "/api/auth",
  "/api/admin",
  "/api/health",
  "/api/maintenance",
];

/**
 * Middleware that blocks non-exempt API traffic during maintenance mode.
 * Returns 503 with a maintenance message when active.
 */
export async function maintenanceGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Check if this route is exempt (handling both mounted req.path and req.originalUrl)
  const fullPath = (req.originalUrl || req.url || req.path).split("?")[0];
  const isExempt = EXEMPT_PREFIXES.some(
    (prefix) =>
      fullPath.startsWith(prefix) ||
      req.path.startsWith(prefix) ||
      req.path.startsWith(prefix.replace(/^\/api/, ""))
  );

  if (isExempt) {
    next();
    return;
  }

  const maintenance = await isMaintenanceMode();
  if (maintenance) {
    res.status(503).json({
      error: "Service temporarily unavailable",
      message: "DUMPR is currently undergoing maintenance. Please try again later.",
      maintenance: true,
    });
    return;
  }

  next();
}
