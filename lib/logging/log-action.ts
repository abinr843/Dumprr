import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "./logger";
import type { LogActionParams } from "@/types/audit";

/**
 * Regex pattern for keys whose values must be redacted before writing to audit_logs.
 * Matches: password, token, secret, authorization, signedurl, signed_url, cookie,
 * credential, bearer, api_key, apikey, access_key, refresh_token, etc.
 */
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|signed_?url|cookie|credential|bearer|api_?key|access_?key|refresh/i;

/**
 * Regex pattern for string values that look like signed URLs or JWT tokens.
 */
const SENSITIVE_VALUE_PATTERN =
  /supabase\.co\/storage\/v1\/object\/sign\/|[?&]token=|eyJ[A-Za-z0-9_-]{10,}\./i;

/**
 * Recursively redact sensitive data from a metadata object.
 *
 * - Keys matching SENSITIVE_KEY_PATTERN have their values replaced with "[REDACTED]".
 * - String values matching SENSITIVE_VALUE_PATTERN are also replaced.
 * - Nested objects are traversed recursively (max depth 10).
 * - Arrays are traversed element by element.
 */
export function redactSensitiveData(
  data: Record<string, unknown>,
  depth = 0
): Record<string, unknown> {
  if (depth > 10) return { _redacted: "max depth exceeded" };

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Redact by key name
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    // Redact string values that look like tokens or signed URLs
    if (typeof value === "string" && SENSITIVE_VALUE_PATTERN.test(value)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    // Recurse into nested objects
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactSensitiveData(
        value as Record<string, unknown>,
        depth + 1
      );
      continue;
    }

    // Recurse into arrays
    if (Array.isArray(value)) {
      redacted[key] = value.map((item) => {
        if (typeof item === "string" && SENSITIVE_VALUE_PATTERN.test(item)) {
          return "[REDACTED]";
        }
        if (item !== null && typeof item === "object") {
          return redactSensitiveData(
            item as Record<string, unknown>,
            depth + 1
          );
        }
        return item;
      });
      continue;
    }

    redacted[key] = value;
  }

  return redacted;
}

/**
 * Extract client IP and User-Agent from a Request or NextRequest.
 */
function extractRequestContext(req?: Request | { headers: Headers }) {
  if (!req) return { ip: null, ua: null };

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const ua = req.headers.get("user-agent") || "unknown";
  return { ip, ua };
}

/**
 * Build a sanitized audit log row from a LogActionParams object.
 * Extracted so both single and batch paths share the same logic.
 */
function buildAuditRow(params: LogActionParams) {
  const rawMetadata: Record<string, unknown> = {
    ...(params.metadata ?? {}),
    target_name: params.target_name ?? undefined,
    result: params.result,
    timestamp: new Date().toISOString(),
  };

  const safeMetadata = redactSensitiveData(rawMetadata);

  // Remove undefined values from metadata
  for (const key of Object.keys(safeMetadata)) {
    if (safeMetadata[key] === undefined) {
      delete safeMetadata[key];
    }
  }

  return {
    actor_id: params.actor_user_id ?? null,
    action: params.action,
    entity_type: params.target_type,
    entity_id: params.target_id ?? null,
    ip_address: params.ip_address ?? null,
    user_agent: params.user_agent ?? null,
    metadata: safeMetadata,
  };
}

/**
 * Centralised audit logging function for the DUMPR platform.
 *
 * Accepts a **single event** or an **array of events**. When given an array
 * all rows are inserted in a single bulk INSERT — eliminating the N+1 trap
 * that occurs when callers loop and await logAction individually.
 *
 * Guarantees:
 * - Never throws — logging failures are swallowed and console-logged.
 * - Recursively redacts sensitive data (passwords, tokens, signed URLs).
 * - Uses the admin/service-role Supabase client to bypass RLS.
 * - Compatible with the existing audit_logs schema.
 */
export async function logAction(
  params: LogActionParams | LogActionParams[]
): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const events = Array.isArray(params) ? params : [params];

    if (events.length === 0) return;

    const rows = events.map(buildAuditRow);

    const { error } = await adminClient.from("audit_logs").insert(rows);

    if (error) {
      logger.error("logAction: Failed to write audit log", {
        error: error.message,
        count: rows.length,
        actions: events.map((e) => e.action),
      });
    }
  } catch (err) {
    // Audit logging must NEVER crash the main request flow
    const actions = Array.isArray(params)
      ? params.map((p) => p.action)
      : [params.action];
    logger.error("logAction: Exception during audit logging", {
      error: err instanceof Error ? err.message : String(err),
      actions,
    });
  }
}
