/**
 * Audit logging service for the Express backend.
 *
 * Ported from lib/logging/log-action.ts — provides non-blocking audit log
 * insertion with recursive secret redaction.
 */

import { createAdminClient } from "../config/supabase.js";
import type { LogActionInput } from "../types/index.js";

/** Keys to recursively redact from metadata before logging */
const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "session",
  "api_key",
  "apiKey",
  "key",
  "credentials",
]);

/**
 * Recursively redacts sensitive data from an object.
 * Returns a new object with sensitive values replaced with "[REDACTED]".
 */
export function redactSensitiveData(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Inserts an audit log entry into public.audit_logs using the service-role client.
 * Non-blocking: errors are caught and logged to console, never thrown to callers.
 */
export async function logAction(input: LogActionInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const metadata = input.metadata
      ? redactSensitiveData(input.metadata)
      : {};

    await admin.from("audit_logs").insert({
      actor_user_id: input.actor_user_id,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id ?? null,
      target_name: input.target_name ?? null,
      result: input.result,
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      metadata,
    });
  } catch (err) {
    // Non-blocking: log to console but never throw
    console.error(
      "[AUDIT] Failed to write audit log:",
      err instanceof Error ? err.message : err
    );
  }
}
