/**
 * Tests for in-memory rate limiting engine (Day 7).
 */

import {
  checkRateLimit,
  RATE_LIMIT_TIERS,
  _resetRateLimiter,
} from "@/lib/security/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimiter();
  });

  it("allows requests under the rate limit for search tier (limit 30)", () => {
    const ip = "192.168.1.100";
    for (let i = 0; i < 30; i++) {
      const result = checkRateLimit("search", ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(30 - (i + 1));
      expect(result.limit).toBe(30);
    }
  });

  it("rejects the 31st request for search tier with retryAfter > 0", () => {
    const ip = "192.168.1.101";
    for (let i = 0; i < 30; i++) {
      checkRateLimit("search", ip);
    }

    const blocked = checkRateLimit("search", ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.headers["Retry-After"]).toBeDefined();
    expect(blocked.headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("tracks rate limits separately for different IPs", () => {
    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";

    // Exhaust ip1's auth quota (limit 5)
    for (let i = 0; i < 5; i++) {
      checkRateLimit("auth", ip1);
    }
    const ip1Blocked = checkRateLimit("auth", ip1);
    expect(ip1Blocked.allowed).toBe(false);

    // ip2 should still be allowed
    const ip2Result = checkRateLimit("auth", ip2);
    expect(ip2Result.allowed).toBe(true);
    expect(ip2Result.remaining).toBe(4);
  });

  it("tracks rate limits separately for different tiers on the same IP", () => {
    const ip = "10.0.0.5";

    // Exhaust auth tier (limit 5)
    for (let i = 0; i < 5; i++) {
      checkRateLimit("auth", ip);
    }
    expect(checkRateLimit("auth", ip).allowed).toBe(false);

    // Upload tier on the same IP should still be allowed
    const uploadResult = checkRateLimit("upload", ip);
    expect(uploadResult.allowed).toBe(true);
    expect(uploadResult.limit).toBe(10);
  });

  it("configures standard tiers properly", () => {
    expect(RATE_LIMIT_TIERS.auth.maxRequests).toBe(5);
    expect(RATE_LIMIT_TIERS.auth.windowSeconds).toBe(900); // 15 min

    expect(RATE_LIMIT_TIERS.upload.maxRequests).toBe(10);
    expect(RATE_LIMIT_TIERS.upload.windowSeconds).toBe(60);

    expect(RATE_LIMIT_TIERS.download.maxRequests).toBe(60);
    expect(RATE_LIMIT_TIERS.download.windowSeconds).toBe(60);

    expect(RATE_LIMIT_TIERS.search.maxRequests).toBe(30);
    expect(RATE_LIMIT_TIERS.search.windowSeconds).toBe(60);
  });
});
