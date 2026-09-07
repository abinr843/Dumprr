import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export const metadata: Metadata = {
  title: "User Management — DUMPR Admin",
  description: "Manage users, roles, and access control.",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <AdminUsersClient />
    </LayoutShell>
  );
}
