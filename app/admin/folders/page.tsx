import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { FilesManager } from "@/components/storage/FilesManager";

export const metadata: Metadata = {
  title: "Folder Management — Admin — DUMPR",
  description: "Create, rename, move and delete folders.",
};

export default async function AdminFoldersPage() {
  const session = await requireAdmin();
  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
      <div style={{ maxWidth: 1280 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-primary)" }}>
          <span>🗂️</span> Folder Management
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          Create folders, navigate the hierarchy, rename, move, or delete. Use the + Folder button or right-click (⋮) on any folder card.
        </p>
        <FilesManager initialFiles={[]} isAdmin={true} />
      </div>
    </LayoutShell>
  );
}
