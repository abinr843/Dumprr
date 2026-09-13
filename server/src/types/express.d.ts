/**
 * Express type overrides for DUMPR backend.
 *
 * Express 5's @types/express v5 declares params values as
 * `string | string[]`. For our named-param routes (e.g., /:id),
 * params are always single strings. This override narrows the type.
 */

import type { UserRole } from "./index.js";

// Augment express module
declare module "express" {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: UserRole;
    };
    ipAddress?: string;
    userAgent?: string;
  }
}

// Augment express-serve-static-core to fix params type
declare module "express-serve-static-core" {
  interface Request {
    params: { [key: string]: string };
  }
}
