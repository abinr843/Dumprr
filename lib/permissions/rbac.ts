import type { UserRole } from "@/types/database.types";
import { hasMinimumRole } from "@/lib/auth/roles";

/**
 * Generic RBAC evaluator.
 * Maps resource + action to a minimum required role.
 */

type Resource = "file" | "folder" | "post" | "audit_log" | "settings" | "user";
type Action = "create" | "read" | "update" | "delete" | "manage";

/** Minimum role required for each resource/action combination */
const RBAC_MATRIX: Record<Resource, Partial<Record<Action, UserRole>>> = {
  file: {
    create: "member",
    read: "viewer",
    update: "member",
    delete: "member",
  },
  folder: {
    create: "member",
    read: "viewer",
    update: "member",
    delete: "member",
  },
  post: {
    create: "member",
    read: "viewer",
    update: "member",
    delete: "member",
    manage: "admin",
  },
  audit_log: {
    read: "admin",
  },
  settings: {
    read: "viewer",
    manage: "admin",
  },
  user: {
    read: "viewer",
    manage: "superadmin",
  },
};

/**
 * Check if a user's role permits a given action on a resource.
 * Returns false if the action is not defined in the matrix.
 */
export function checkPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const requiredRole = RBAC_MATRIX[resource]?.[action];
  if (!requiredRole) return false;
  return hasMinimumRole(role, requiredRole);
}
