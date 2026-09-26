/**
 * Standard API response contracts (Platform Error & Response Alignment).
 *
 * Every API endpoint returns this shape:
 * - Success: `{ success: true, ...payload }`
 * - Failure: `{ success: false, error: "<human-readable message>", code: "<MACHINE_CODE>", details? }`
 *
 * `error` is ALWAYS a plain user-facing string (never an object, never a raw
 * DB/constraint dump) so legacy clients reading `data.error` keep working.
 */

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

/** Machine-readable + human-readable error body. */
export interface ApiErrorBody {
  /** Stable machine code for client branching, e.g. "NOT_FOUND". */
  code: ApiErrorCode;
  /** Plain, non-technical, actionable message for the user. */
  message: string;
  /** Optional structured details (e.g. Zod field errors). */
  details?: unknown;
}

/** Standard envelope for all API responses. */
export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  /** Human-readable message on failure (kept as a string for compat). */
  error?: string;
  /** Machine code for the failure (present when success === false). */
  code?: ApiErrorCode;
  /** Optional structured details (present on some failures). */
  details?: unknown;
  /** Payload fields live alongside the envelope (e.g. `post`, `files`). */
  data?: T;
}

/** Type guard for failure responses. */
export function isApiError(
  body: unknown
): body is { success: false; error: string; code?: ApiErrorCode; details?: unknown } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { success?: unknown }).success === false
  );
}
