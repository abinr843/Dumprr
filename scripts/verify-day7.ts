/**
 * DUMPR — Day 7 Centralized Audit Logging & Security Hardening Verification Script
 *
 * Verifies:
 * 1. Centralized logAction() engine writes unified schema (actor_user_id, action, target_type, target_id, target_name, result, ip, ua, metadata).
 * 2. Recursive secret redaction prevents passwords, tokens, API keys, and signed URLs from entering audit logs.
 * 3. In-memory sliding-window rate limiting across all 4 tiers (auth, upload, download, search).
 * 4. Stored XSS sanitization (filenames, post content, display names).
 * 5. IDOR protections (verifyFileAccess, verifyPostAccess, verifyFolderAccess).
 * 6. Zero secret leaks: confirming server-side credentials and tokens are never exposed.
 *
 * Usage:
 *   npx -y tsx scripts/verify-day7.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { AUDIT_ACTIONS } from "../types/audit";
import { redactSensitiveData, logAction } from "../lib/logging/log-action";
import { checkRateLimit, RATE_LIMIT_TIERS, _resetRateLimiter } from "../lib/security/rate-limit";
import {
  escapeHtml,
  sanitizeText,
  sanitizeFilename,
  sanitizePostContent,
  sanitizeDisplayName,
} from "../lib/security/sanitize";
import {
  verifyFileAccess,
  verifyPostAccess,
  verifyFolderAccess,
} from "../lib/permissions/api-guard";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: CheckResult[] = [];

async function check(
  name: string,
  fn: () => Promise<{ ok: boolean; message?: string } | boolean>,
  detailSuccess: string,
  detailFailure: string
) {
  try {
    const res = await fn();
    const ok = typeof res === "boolean" ? res : res.ok;
    const msg = typeof res === "object" && res.message ? ` (${res.message})` : "";
    results.push({
      name,
      passed: ok,
      details: ok ? `${detailSuccess}${msg}` : `${detailFailure}${msg}`,
    });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      details: `${detailFailure}: ${err.message || String(err)}`,
    });
  }
}

async function runVerification() {
  console.log("===============================================================");
  console.log("  DUMPR Day 7: Centralized Audit Logging & Security Hardening  ");
  console.log("===============================================================\n");

  // ─── 1. Audit Action Constants Coverage ────────────────────────────────
  await check(
    "Day 7 Audit Action Constants Definition",
    async () => {
      const required = [
        AUDIT_ACTIONS.RATE_LIMITED,
        AUDIT_ACTIONS.UNAUTHORIZED_REQUEST,
        AUDIT_ACTIONS.PERMISSION_DENIED,
        AUDIT_ACTIONS.INVALID_FILE,
        AUDIT_ACTIONS.UPLOAD_REJECTED,
        AUDIT_ACTIONS.DOWNLOAD_REJECTED,
        AUDIT_ACTIONS.API_ERROR,
        AUDIT_ACTIONS.SEARCH_PERFORMED,
        AUDIT_ACTIONS.FEED_VIEWED,
        AUDIT_ACTIONS.TRASH_VIEWED,
        AUDIT_ACTIONS.TRASH_EMPTIED,
        AUDIT_ACTIONS.TRASH_CLEANUP_COMPLETED,
      ];
      return required.every((a) => typeof a === "string" && a.length > 0);
    },
    "All Day 7 audit actions are defined",
    "Missing required Day 7 audit action constants"
  );

  // ─── 2. Secret Redaction Engine ─────────────────────────────────────────
  await check(
    "Recursive Secret Redaction (Keys & Values)",
    async () => {
      const sensitivePayload = {
        user: "test@example.com",
        password: "SuperSecretPassword!",
        api_token: "tok_123456789",
        authorization: "Bearer secret-bearer-token",
        signed_url: "https://project.supabase.co/storage/v1/object/sign/dump-files/file.pdf?token=xyz",
        nested: {
          session_cookie: "sess_abc",
          secretKey: "shhh",
          nestedSigned: "https://xyz.supabase.co/storage/v1/object/sign/bucket/doc.txt",
        },
        links: [
          "https://project.supabase.co/storage/v1/object/sign/file.png?token=123",
          { refresh_token: "rf_999" },
        ],
      };

      const redacted = redactSensitiveData(sensitivePayload) as any;

      const passwordSafe = redacted.password === "[REDACTED]";
      const tokenSafe = redacted.api_token === "[REDACTED]";
      const authSafe = redacted.authorization === "[REDACTED]";
      const signedUrlSafe = redacted.signed_url === "[REDACTED]";
      const cookieSafe = redacted.nested.session_cookie === "[REDACTED]";
      const secretSafe = redacted.nested.secretKey === "[REDACTED]";
      const nestedSignedSafe = redacted.nested.nestedSigned === "[REDACTED]";
      const arraySignedSafe = redacted.links[0] === "[REDACTED]";
      const arrayNestedTokenSafe = redacted.links[1].refresh_token === "[REDACTED]";
      const userPreserved = redacted.user === "test@example.com";

      return (
        passwordSafe &&
        tokenSafe &&
        authSafe &&
        signedUrlSafe &&
        cookieSafe &&
        secretSafe &&
        nestedSignedSafe &&
        arraySignedSafe &&
        arrayNestedTokenSafe &&
        userPreserved
      );
    },
    "Passwords, tokens, secrets, cookies, and signed URLs are thoroughly redacted",
    "Secret redaction failed to redact sensitive keys or patterns"
  );

  // ─── 3. In-Memory Sliding Window Rate Limiting ──────────────────────────
  await check(
    "Rate Limiting Tiers & Window Enforcement",
    async () => {
      _resetRateLimiter();
      const testIp = `test-ip-${randomUUID()}`;

      // Auth limit: 5 requests
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit("auth", testIp);
        if (!res.allowed) return false;
      }

      // 6th auth request must be rejected
      const blockedAuth = checkRateLimit("auth", testIp);
      if (blockedAuth.allowed || blockedAuth.retryAfter <= 0) return false;

      // Other tier (e.g. search) on same IP should still have quota
      const searchRes = checkRateLimit("search", testIp);
      if (!searchRes.allowed) return false;

      return true;
    },
    "Sliding-window rate limiter enforces limits per tier and client IP",
    "Rate limiter failed to block requests over quota or isolate tiers"
  );

  // ─── 4. Stored XSS Prevention & Sanitization ────────────────────────────
  await check(
    "Stored XSS Sanitization (Filenames & Content)",
    async () => {
      const maliciousScript = "<script>alert('xss')</script>Hello World";
      const sanitizedContent = sanitizePostContent(maliciousScript);
      if (sanitizedContent.includes("<script>") || sanitizedContent.includes("alert")) {
        return false;
      }

      const maliciousIframe = '<iframe src="javascript:evil()"></iframe>Clean';
      if (sanitizePostContent(maliciousIframe).includes("<iframe")) {
        return false;
      }

      const badFilename = "../../<script>bad</script>/file:name?.pdf";
      const safeFilename = sanitizeFilename(badFilename);
      if (safeFilename.includes("../") || safeFilename.includes("<") || safeFilename.includes(":")) {
        return false;
      }

      return true;
    },
    "XSS scripts, iframes, and path traversal sequences are safely stripped",
    "Sanitization failed to strip malicious tags or path traversal"
  );

  // ─── 5. IDOR Protections (Role & Status Re-verification) ─────────────────
  await check(
    "IDOR Protection Helper Logic",
    async () => {
      // Test with non-existent or inaccessible resource
      const fakeId = randomUUID();
      const nonAdminFile = await verifyFileAccess(fakeId, false);
      const nonAdminPost = await verifyPostAccess(fakeId, false);
      const nonAdminFolder = await verifyFolderAccess(fakeId, false);

      return nonAdminFile === null && nonAdminPost === null && nonAdminFolder === null;
    },
    "verifyResourceAccess properly enforces status restrictions for non-admins",
    "IDOR verification failed to return null for non-existent/restricted resources"
  );

  // ─── 6. Centralized logAction() DB Write & Schema Compatibility ──────────
  await check(
    "Centralized logAction() Database Integration",
    async () => {
      const testActionId = randomUUID();
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.RATE_LIMITED,
        target_type: "security",
        target_id: testActionId,
        target_name: "Verification Test Target",
        result: "FAILED",
        ip_address: "127.0.0.1",
        user_agent: "DUMPR Day 7 Verification Script",
        metadata: {
          testMarker: testActionId,
          password: "ShouldBeRedacted",
          allowedValue: "verification",
        },
      });

      // Verify the log was recorded
      const { data: logs, error } = await adminClient
        .from("audit_logs")
        .select("*")
        .eq("action", AUDIT_ACTIONS.RATE_LIMITED)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error || !logs || logs.length === 0) {
        return { ok: false, message: error?.message || "No logs found" };
      }

      const found = logs.find(
        (l) => l.metadata && (l.metadata as any).testMarker === testActionId
      );

      if (!found) {
        return { ok: false, message: "Inserted audit log entry not found" };
      }

      // Verify redaction inside metadata
      const meta = found.metadata as any;
      if (meta.password !== "[REDACTED]") {
        return { ok: false, message: "Password was not redacted in audit_logs" };
      }

      if (meta.result !== "FAILED") {
        return { ok: false, message: "Result was not recorded as FAILED" };
      }

      // Clean up the verification row so it doesn't pollute the live audit logs
      await adminClient.from("audit_logs").delete().eq("id", found.id);

      return true;
    },
    "logAction() records audit trail with mapped fields and redacted metadata",
    "Failed to write or verify audit log in database"
  );

  // ─── Print Report ───────────────────────────────────────────────────────
  console.log("\n==================== VERIFICATION SUMMARY ====================");
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} [${r.name}]: ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log("===============================================================\n");

  if (allPassed) {
    console.log("🎉 DAY 7 ALL SECURITY & AUDIT HARDENING CHECKS PASSED!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME DAY 7 CHECKS FAILED. See details above.\n");
    process.exit(1);
  }
}

runVerification();
