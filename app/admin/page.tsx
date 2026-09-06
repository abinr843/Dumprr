import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard — DUMPR",
  description: "Administrative control panel for DUMPR.",
};

export default async function AdminDashboardPage() {
  const session = await requireAdmin();

  const displayName =
    session.profile?.full_name || session.profile?.username || session.user.email || "Admin";
  const role = session.profile?.role ?? "admin";

  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <AdminDashboardClient displayName={displayName} role={role} />
    </LayoutShell>
  );
}
