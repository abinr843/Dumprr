import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { FilesManager } from "@/components/storage/FilesManager";

export const metadata: Metadata = {
  title: "File Management — Admin — DUMPR",
  description: "Upload, rename, move and delete files.",
};

export default async function AdminFilesPage() {
  const session = await requireAdmin();
  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <div style={{ maxWidth: 1280 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-primary)" }}>
          <span>📁</span> File Management
        </h1>
        <FilesManager initialFiles={[]} isAdmin={true} />
      </div>
    </LayoutShell>
  );
}
