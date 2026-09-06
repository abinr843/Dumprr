import type { UserRole } from "@/types/database.types";

/**
 * Role hierarchy (higher number = more privileges).
 */
export const ROLE_LEVELS: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  superadmin: 3,
};

/** All available roles ordered by privilege level */
export const ALL_ROLES: UserRole[] = [
  "viewer",
  "member",
  "admin",
  "superadmin",
];

/**
 * Check if a role meets the minimum required level.
 */
export function hasMinimumRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/**
 * Check if a role is an admin-level role (admin or superadmin).
 */
export function isAdmin(role: UserRole): boolean {
  return hasMinimumRole(role, "admin");
}

/**
 * Check if a role is superadmin.
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === "superadmin";
}
