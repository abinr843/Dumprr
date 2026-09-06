/**
 * In-memory sliding-window rate limiter for DUMPR API endpoints.
 *
 * Implements a token-bucket / sliding window counter keyed by client IP
 * (or authenticated user ID). Each "tier" has its own configuration for
 * maximum requests and time window.
 *
 * Limitations:
 * - In-memory only — resets on server restart and is per-process (not
 *   shared across workers/instances). This is acceptable for a single-
 *   instance deployment; for multi-instance, use Redis.
 * - Periodic cleanup runs on every check to prevent memory leaks.
 */

import { NextResponse } from "next/server";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";

/** Rate limit tier configurations */
export const RATE_LIMIT_TIERS = {
  auth: { maxRequests: 5, windowSeconds: 900, label: "Authentication" },
  upload: { maxRequests: 10, windowSeconds: 60, label: "File Upload" },
  download: { maxRequests: 60, windowSeconds: 60, label: "File Download" },
  search: { maxRequests: 30, windowSeconds: 60, label: "Search" },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

interface WindowEntry {
  /** Timestamps of requests within the current window. */
  timestamps: number[];
  /** When this entry was last accessed (for cleanup). */
  lastAccess: number;
}

/**
 * Sliding window storage: Map<tier:identifier, WindowEntry>
 */
const windowStore = new Map<string, WindowEntry>();

/**
 * Cleanup stale entries older than 2x the largest window to prevent memory leaks.
 * Runs on every check but only evicts entries that are well past their window.
 */
const MAX_STALE_MS = 2 * 900 * 1000; // 2x the largest window (auth = 900s)

function cleanupStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of windowStore) {
    if (now - entry.lastAccess > MAX_STALE_MS) {
      windowStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Maximum requests permitted in the window. */
  limit: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets. */
  reset: number;
  /** Seconds until the caller can retry (0 if allowed). */
  retryAfter: number;
  /** Standard rate-limit response headers. */
  headers: Record<string, string>;
}

/**
 * Check whether a request is within the rate limit for the given tier.
 *
 * @param tier     - The rate limit tier (auth, upload, download, search).
 * @param identifier - A unique key for the caller (IP address or user ID).
 * @returns RateLimitResult with allowed status and headers.
 */
export function checkRateLimit(
  tier: RateLimitTier,
  identifier: string
): RateLimitResult {
  const config = RATE_LIMIT_TIERS[tier];
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;
  const key = `${tier}:${identifier}`;

  // Periodic cleanup
  if (Math.random() < 0.05) {
    cleanupStaleEntries();
  }

  // Get or create entry
  let entry = windowStore.get(key);
  if (!entry) {
    entry = { timestamps: [], lastAccess: now };
    windowStore.set(key, entry);
  }

  // Prune timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
  entry.lastAccess = now;

  const resetTimestamp = Math.ceil(
    (entry.timestamps.length > 0
      ? entry.timestamps[0] + config.windowSeconds * 1000
      : now + config.windowSeconds * 1000) / 1000
  );

  if (entry.timestamps.length >= config.maxRequests) {
    // Rate limited
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs =
      oldestInWindow + config.windowSeconds * 1000 - now;
    const retryAfterSecs = Math.max(1, Math.ceil(retryAfterMs / 1000));

    const headers: Record<string, string> = {
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(resetTimestamp),
      "Retry-After": String(retryAfterSecs),
    };

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: resetTimestamp,
      retryAfter: retryAfterSecs,
      headers,
    };
  }

  // Allow the request — record the timestamp
  entry.timestamps.push(now);

  const remaining = config.maxRequests - entry.timestamps.length;
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetTimestamp),
  };

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining,
    reset: resetTimestamp,
    retryAfter: 0,
    headers,
  };
}

/**
 * Extract a rate-limit identifier (client IP) from a request.
 */
export function getRateLimitIdentifier(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

/**
 * Build a standardised HTTP 429 Too Many Requests response.
 * Also logs RATE_LIMITED to the audit trail.
 */
export async function rateLimitResponse(
  tier: RateLimitTier,
  result: RateLimitResult,
  req: Request,
  userId?: string | null
): Promise<NextResponse> {
  const config = RATE_LIMIT_TIERS[tier];
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const ua = req.headers.get("user-agent") || "unknown";

  // Log the rate-limit event (fire-and-forget, never block response)
  logAction({
    actor_user_id: userId ?? null,
    action: AUDIT_ACTIONS.RATE_LIMITED,
    target_type: "security",
    target_name: config.label,
    result: "FAILED",
    ip_address: ip,
    user_agent: ua,
    metadata: {
      tier,
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
      retryAfter: result.retryAfter,
    },
  }).catch(() => {
    // swallow — logging must never block
  });

  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded for ${config.label.toLowerCase()}. Try again in ${result.retryAfter} second(s).`,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: result.headers,
    }
  );
}

/**
 * Reset the rate limiter state. Only use in tests.
 */
export function _resetRateLimiter(): void {
  windowStore.clear();
}
