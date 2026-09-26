"use client";

import { getToastApi } from "@/components/ui/Toast";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import type { ApiErrorCode } from "@/types/api";

/**
 * Phase 2: global API client wrapper.
 * Parses both the standard envelope (`{success, error, code}`) and legacy
 * shapes (`{error: string}`), throws ApiError with a human message,
 * and optionally fires a global error toast.
 */

export class ApiError extends Error {
  code: ApiErrorCode | "NETWORK_ERROR";
  status: number;
  details?: unknown;

  constructor(message: string, opts?: { code?: ApiErrorCode | "NETWORK_ERROR"; status?: number; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code ?? "INTERNAL_ERROR";
    this.status = opts?.status ?? 0;
    this.details = opts?.details;
  }
}

interface ApiFetchOptions extends RequestInit {
  /** Fire a global error toast on failure (default: false — callers decide). */
  toastOnError?: boolean;
}

function readErrorBody(body: unknown, status: number): { message: string; code: ApiErrorCode | "NETWORK_ERROR"; details?: unknown } {
  if (body && typeof body === "object") {
    const b = body as { error?: unknown; code?: unknown; message?: unknown; details?: unknown };
    const code =
      typeof b.code === "string" ? (b.code as ApiErrorCode) : undefined;
    if (typeof b.error === "string" && b.error.trim()) {
      return { message: b.error, code: code ?? statusToCode(status), details: b.details };
    }
    if (typeof b.message === "string" && b.message.trim()) {
      return { message: humanizeTechnicalError(b.message), code: code ?? statusToCode(status), details: b.details };
    }
  }
  return { message: statusToMessage(status), code: statusToCode(status) };
}

function statusToCode(status: number): ApiErrorCode | "NETWORK_ERROR" {
  if (status === 0) return "NETWORK_ERROR";
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "BAD_REQUEST";
}

function statusToMessage(status: number): string {
  if (status === 0) return "We couldn't reach the server. Please check your connection and try again.";
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for. It may have been moved or deleted.";
  if (status === 409) return "This already exists. Please change the name and try again.";
  if (status === 429) return "You're doing that too often. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

/**
 * fetch() wrapper with standard-envelope parsing + human errors.
 * Returns the full parsed body on success (including `success: true`).
 * Throws ApiError on HTTP errors, network failures, or `{success: false}`.
 */
export async function apiFetch<T = unknown>(url: string, opts?: ApiFetchOptions): Promise<T> {
  const { toastOnError, ...init } = opts ?? {};
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const error = new ApiError(humanizeTechnicalError(err), {
      code: "NETWORK_ERROR",
      status: 0,
    });
    if (toastOnError) getToastApi()?.error(error.message);
    throw error;
  }

  let body: unknown = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      const error = new ApiError(statusToMessage(res.status), {
        code: statusToCode(res.status),
        status: res.status,
      });
      if (toastOnError) getToastApi()?.error(error.message);
      throw error;
    }
    return body as T;
  }

  // Explicit failure envelope (standard or legacy)
  if (
    (body && typeof body === "object" && (body as { success?: unknown }).success === false) ||
    !res.ok
  ) {
    const parsed = readErrorBody(body, res.status);
    const error = new ApiError(parsed.message, {
      code: parsed.code,
      status: res.status,
      details: parsed.details,
    });
    if (toastOnError) getToastApi()?.error(error.message);
    throw error;
  }

  return body as T;
}
