/**
 * Rate limiting middleware for the Express backend.
 *
 * Ported from lib/security/rate-limit.ts — sliding-window, token-bucket
 * rate limiter with per-tier configuration.
 */

import type { Request, Response, NextFunction } from "express";

// ─── Rate Limit Tiers ───────────────────────────────────────────────

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  upload: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per 1 min
  download: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 per 1 min
  search: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per 1 min
  api: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per 1 min (default)
};

// ─── In-Memory Sliding Window Store ─────────────────────────────────

interface RequestRecord {
  timestamps: number[];
}

const store = new Map<string, RequestRecord>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter(
      (t) => now - t < 15 * 60 * 1000
    );
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate limiting middleware for the specified tier.
 *
 * Usage:
 *   router.post("/upload", rateLimit("upload"), uploadHandler);
 */
export function rateLimit(tier: string = "api") {
  const config = RATE_LIMITS[tier] || RATE_LIMITS.api;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const key = `${tier}:${ip}`;
    const now = Date.now();

    let record = store.get(key);
    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    // Remove expired timestamps
    record.timestamps = record.timestamps.filter(
      (t) => now - t < config.windowMs
    );

    if (record.timestamps.length >= config.maxRequests) {
      const retryAfterMs =
        config.windowMs - (now - record.timestamps[0]);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.ceil((now + retryAfterMs) / 1000))
      );

      res.status(429).json({
        error: "Too many requests",
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    record.timestamps.push(now);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(config.maxRequests - record.timestamps.length)
    );

    next();
  };
}
