import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { AdminStorageClient } from "@/components/admin/AdminStorageClient";

export const metadata: Metadata = {
  title: "Storage Monitor — DUMPR Admin",
  description: "Monitor storage usage, thresholds, and file distribution.",
};

export const dynamic = "force-dynamic";

export default async function AdminStoragePage() {
  const session = await requireAdmin();

  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <AdminStorageClient />
    </LayoutShell>
  );
}
