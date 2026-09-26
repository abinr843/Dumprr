import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@/types/api";

/**
 * Standard response helpers (Phase 1: API contracts).
 *
 * - `ok(payload)` → `{ success: true, ...payload }`
 * - `fail(code, message, status, details?)` → `{ success: false, error: message, code, details? }`
 * - `internalError(err, context)` → sanitized 500: logs the technical error
 *   server-side, returns a generic user-facing message.
 */

export function ok<T extends object>(
  payload: T = {} as T,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse {
  return NextResponse.json({ success: true, ...payload }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  const body: Record<string, unknown> = {
    success: false,
    error: message,
    code,
  };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

/** 400 — malformed request / invalid JSON / bad parameters. */
export function badRequest(message: string, details?: unknown): NextResponse {
  return fail("BAD_REQUEST", message, 400, details);
}

/** 401 — authentication required. */
export function unauthorized(
  message = "Please sign in to continue."
): NextResponse {
  return fail("UNAUTHORIZED", message, 401);
}

/** 403 — authenticated but not permitted. */
export function forbidden(
  message = "You don't have permission to do that."
): NextResponse {
  return fail("FORBIDDEN", message, 403);
}

/** 404 — resource not found. */
export function notFound(message: string): NextResponse {
  return fail("NOT_FOUND", message, 404);
}

/** 409 — conflict (duplicate, already exists). */
export function conflict(message: string): NextResponse {
  return fail("CONFLICT", message, 409);
}

/**
 * 500 — sanitized internal error.
 * The technical error is logged server-side (never leaked to the client).
 */
export function internalError(err: unknown, context?: string): NextResponse {
  try {
    // eslint-disable-next-line no-console
    console.error(
      `[DUMPR:INTERNAL_ERROR]${context ? ` ${context}` : ""}`,
      err instanceof Error ? { message: err.message, stack: err.stack } : err
    );
  } catch {
    /* logging must never throw */
  }
  return fail(
    "INTERNAL_ERROR",
    "Something went wrong on our end. Please try again in a moment.",
    500
  );
}

/** 422 — Zod validation failure with field details. */
export function validationFailed(
  message = "Please check the highlighted fields and try again.",
  details?: unknown
): NextResponse {
  return fail("VALIDATION_FAILED", message, 422, details);
}
