import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export const metadata: Metadata = {
  title: "System Settings — DUMPR Admin",
  description: "Configure system-wide settings and limits.",
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();

  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <AdminSettingsClient />
    </LayoutShell>
  );
}
