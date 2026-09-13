/**
 * Global error handler middleware for the Express backend.
 *
 * Catches unhandled exceptions, logs them to the audit trail,
 * and returns safe structured error responses.
 */

import type { Request, Response, NextFunction } from "express";
import { logAction } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";

/**
 * Global error handler — must be registered LAST in the middleware stack.
 * Express identifies it as an error handler via the 4-parameter signature.
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = (err as any).statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Log to console
  console.error(
    `[ERROR] ${req.method} ${req.originalUrl}:`,
    err.message,
    isProduction ? "" : err.stack
  );

  // Log to audit trail (non-blocking)
  logAction({
    actor_user_id: req.user?.id ?? null,
    action: AUDIT_ACTIONS.API_ERROR,
    target_type: "system",
    target_name: `${req.method} ${req.originalUrl}`,
    result: "FAILED",
    ip_address: req.ipAddress || "127.0.0.1",
    user_agent: req.userAgent || "unknown",
    metadata: {
      error: err.message,
      statusCode,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  }).catch(() => {
    // Swallow audit logging errors
  });

  res.status(statusCode).json({
    error: isProduction ? "Internal server error" : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * Wraps an async Express handler to catch unhandled promise rejections.
 * Passes them to the next() error handler instead of crashing the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
