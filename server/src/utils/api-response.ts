/**
 * Standard API response helpers for the Express backend.
 * Mirrors lib/api/response.ts (Next.js) so both backends speak the same
 * contract: `{ success: true, ...payload }` /
 * `{ success: false, error: "<human message>", code: "<CODE>" }`.
 *
 * Self-contained (no imports outside server/src) so the compiled output
 * stays runtime-safe.
 */

import type { Request, Response, NextFunction } from "express";

export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "STORAGE_FULL",
  "FILE_TOO_LARGE",
  "FILE_TYPE_NOT_ALLOWED",
  "SECURITY_REJECTED",
  "MAINTENANCE",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function ok(res: Response, payload: Record<string, unknown> = {}, status = 200): Response {
  return res.status(status).json({ success: true, ...payload });
}

export function fail(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
): Response {
  const body: Record<string, unknown> = { success: false, error: message, code };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}

/** Map HTTP status → closest machine code (for the envelope middleware). */
export function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "MAINTENANCE";
  if (status >= 500) return "INTERNAL_ERROR";
  return "BAD_REQUEST";
}

/**
 * Envelope-normalizing middleware. Wraps res.json so every response —
 * including legacy `{ error: "..." }` shapes from older route handlers —
 * leaves the server in the standard contract without per-route rewrites:
 * - `{ error: string }` → `{ success: false, error, code }`
 * - anything else → `{ success: true, ...body }`
 */
export function standardizeEnvelope(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const b = body as Record<string, unknown>;
      if (typeof b.success === "boolean") return originalJson(b);
      if (typeof b.error === "string") {
        return originalJson({
          success: false,
          error: b.error,
          code: (b.code as ApiErrorCode) || codeForStatus(res.statusCode),
          ...(b.details !== undefined ? { details: b.details } : {}),
        });
      }
      return originalJson({ success: true, ...b });
    }
    return originalJson(body);
  }) as Response["json"];
  next();
}

/**
 * Convert a raw technical error into a user-facing message.
 * Compact server-side twin of lib/api/human-errors.ts (no cross-boundary imports).
 */
export function humanizeTechnicalError(
  raw: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  if (/PGRST116|Results contain 0 rows|Row not found/i.test(msg)) {
    return "We couldn't find what you were looking for. It may have been moved or deleted.";
  }
  if (/schema cache|PGRST20[0-9]|Could not find the table/i.test(msg)) {
    return "The database isn't set up for this yet. Please ask an admin to run the latest migration.";
  }
  const notNull = msg.match(/null value in column "([^"]+)"/i);
  if (notNull) {
    const field = notNull[1].replace(/_/g, " ");
    return `Please provide ${/^[aeiou]/i.test(field) ? "an" : "a"} ${field} before saving.`;
  }
  if (/duplicate key|unique constraint|already exists/i.test(msg)) {
    const col = msg.match(/Key \(([^)]+)\)/);
    if (col) return `That ${col[1].replace(/_/g, " ")} is already in use. Please choose another.`;
    return "This already exists. Please change the name and try again.";
  }
  if (/foreign key|violates foreign/i.test(msg)) {
    return "The linked item no longer exists. Please refresh and try again.";
  }
  if (/Failed to fetch|NetworkError|network error|ECONNREFUSED|ENOTFOUND|timed out/i.test(msg)) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
  if (/permission denied|row-level security|RLS|not authorized/i.test(msg)) {
    return "You don't have permission to do that.";
  }
  const trimmed = msg.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 160 &&
    !/column "|constraint|PGRST|SELECT|INSERT INTO|UPDATE |DELETE FROM|Error:|stack|node_modules|supabase/i.test(trimmed)
  ) {
    return trimmed;
  }
  return fallback;
}
