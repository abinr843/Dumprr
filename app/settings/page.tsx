import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

/**
 * /settings route handler.
 * - Admins → redirect to /admin/settings
 * - Everyone else → redirect to home (settings are admin-only)
 */
export default async function SettingsPage() {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  if (userIsAdmin) {
    redirect("/admin/settings");
  }

  redirect("/");
}
