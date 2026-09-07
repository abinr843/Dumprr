import { LayoutShell } from "@/components/layout/LayoutShell";
import { FilesManager } from "@/components/storage/FilesManager";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { getRootFiles, getRootFolders } from "@/lib/storage/files-server";
import type { UserRole } from "@/types/database.types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Files — DUMPR",
  description: "Browse and download shared files or manage uploads.",
};

export default async function FilesPage() {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  // Fetch root files + folders in parallel — eliminates client-side mount fetch
  const [rootFiles, rootFolders] = await Promise.all([
    getRootFiles(userIsAdmin),
    getRootFolders(userIsAdmin),
  ]);

  return (
    <LayoutShell userEmail={session?.user?.email} userRole={session?.profile?.role}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: "var(--space-1)",
            }}
          >
            Files
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            {userIsAdmin
              ? "Upload, organise, and publish files to the secure dump-files storage pipeline."
              : "Browse and download shared resources."}
          </p>
        </div>

        <FilesManager initialFiles={rootFiles} initialFolders={rootFolders} isAdmin={userIsAdmin} />
      </div>
    </LayoutShell>
  );
}

