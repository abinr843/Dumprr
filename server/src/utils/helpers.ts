/**
 * Utility helpers for Express request handling.
 *
 * Provides type-safe parameter extraction and header normalization
 * to work around Express 5's stricter `string | string[]` types.
 */

/**
 * Extracts a single string value from a value that might be string or string[].
 * Express 5 types headers and query params as string | string[] | undefined.
 */
export function str(value: string | string[] | undefined, fallback: string = ""): string {
  if (value === undefined) return fallback;
  return Array.isArray(value) ? value[0] || fallback : value;
}

/**
 * Extract a route param as a definite string.
 */
export function param(params: Record<string, string | string[]>, key: string): string {
  const val = params[key];
  if (val === undefined) return "";
  return Array.isArray(val) ? val[0] || "" : val;
}
