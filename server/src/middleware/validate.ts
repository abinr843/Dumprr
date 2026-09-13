/**
 * Zod validation middleware for the Express backend.
 *
 * Provides reusable middleware factories for validating request body,
 * query parameters, and route parameters against Zod schemas.
 */

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Middleware that validates req.body against a Zod schema.
 * Returns 400 with flattened errors on validation failure.
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware that validates req.query against a Zod schema.
 */
export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: result.error.flatten(),
      });
      return;
    }
    next();
  };
}

/**
 * Middleware that validates req.params against a Zod schema.
 */
export function validateParams(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid route parameters",
        details: result.error.flatten(),
      });
      return;
    }
    next();
  };
}
