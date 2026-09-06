import type { Database, UserRole } from "./database.types";

/** Profile row from the profiles table */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Minimal user info for UI display (avatar pill, sidebar, etc.) */
export interface UserInfo {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  role: UserRole;
}

/** Authenticated session with profile data */
export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile | null;
}

/** Role hierarchy for permission checks */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  superadmin: 3,
} as const;
