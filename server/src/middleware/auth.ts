/**
 * Authentication middleware for the Express backend.
 *
 * Ported from lib/auth/session.ts, lib/auth/roles.ts, and lib/permissions/api-guard.ts.
 * Provides session extraction, admin enforcement, and request context helpers.
 */

import type { Request, Response, NextFunction } from "express";
import { createAdminClient } from "../config/supabase.js";
import { getEnvConfig } from "../config/env.js";
import { logAction } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import type { UserRole } from "../types/index.js";

// ─── Types ──────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

// Express augmentation is in types/express.d.ts

// ─── Helpers ────────────────────────────────────────────────────────

export function isAdmin(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

/**
 * Extracts IP address and user agent from Express request.
 */
export function extractRequestContext(req: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "127.0.0.1";
  const userAgent = (req.headers["user-agent"] as string) || "unknown";
  return { ipAddress, userAgent };
}

/**
 * Extracts access token from Authorization header or cookies.
 */
function extractAccessToken(req: Request): string | null {
  // Try Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Try Supabase auth cookies
  // Supabase SSR stores tokens in cookies named sb-<ref>-auth-token
  const cookies = req.cookies || {};
  for (const [key, value] of Object.entries(cookies)) {
    if (key.includes("-auth-token") && typeof value === "string") {
      try {
        // Supabase stores a JSON array [access_token, refresh_token]
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed[0]) {
          return parsed[0];
        }
      } catch {
        // Cookie value might be the token directly
        if (value.includes(".")) return value;
      }
    }
  }

  return null;
}

// ─── Middleware: Inject Context ─────────────────────────────────────

/**
 * Middleware that injects ipAddress and userAgent onto every request.
 */
export function injectContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { ipAddress, userAgent } = extractRequestContext(req);
  req.ipAddress = ipAddress;
  req.userAgent = userAgent;
  next();
}

// ─── Middleware: Authenticate User (Optional) ───────────────────────

/**
 * Middleware that resolves the user session if present.
 * Does NOT reject unauthenticated requests — sets req.user = undefined.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      next();
      return;
    }

    const admin = createAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user) {
      next();
      return;
    }

    // Fetch profile for role
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const config = getEnvConfig();
    const isRootAdmin =
      user.email?.toLowerCase() === config.ADMIN_DEFAULT_EMAIL;

    const role: UserRole =
      (profile?.role as UserRole) ??
      (isRootAdmin ? "superadmin" : "viewer");

    req.user = {
      id: user.id,
      email: user.email || "",
      role,
    };
  } catch {
    // Fail open — user remains undefined
  }
  next();
}

// ─── Middleware: Require Admin ───────────────────────────────────────

/**
 * Middleware that enforces admin-level access. Must be used AFTER authenticateUser.
 * Returns 401 for unauthenticated and 403 for non-admin users.
 */
export function requireAdmin(routeLabel?: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        target_type: "auth",
        target_name: routeLabel || req.originalUrl,
        result: "FAILED",
        ip_address: req.ipAddress || "127.0.0.1",
        user_agent: req.userAgent || "unknown",
        metadata: { reason: "No authentication token" },
      });
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!isAdmin(req.user.role)) {
      await logAction({
        actor_user_id: req.user.id,
        action: AUDIT_ACTIONS.PERMISSION_DENIED,
        target_type: "auth",
        target_name: routeLabel || req.originalUrl,
        result: "FAILED",
        ip_address: req.ipAddress || "127.0.0.1",
        user_agent: req.userAgent || "unknown",
        metadata: { role: req.user.role },
      });
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    next();
  };
}
