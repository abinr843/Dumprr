import { LayoutShell } from "@/components/layout/LayoutShell";
import { Card } from "@/components/ui/Card";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

export const metadata = {
  title: "Recent Activity — DUMPR",
  description: "Browse the latest files, posts, and announcements across the workspace",
};

export default async function RecentActivityPage() {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  return (
    <LayoutShell
      userEmail={session?.user?.email}
      userRole={session?.profile?.role}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          maxWidth: "1100px",
        }}
      >
        {/* Page Header */}
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: "var(--space-1)",
              color: "var(--text-primary)",
            }}
          >
            Recent Activity
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            Real-time chronological timeline of announcements and files in your workspace.
          </p>
        </div>

        {/* Unified Activity Feed Card */}
        <Card>
          <ActivityFeed isAdmin={userIsAdmin} title="All Timeline Items" />
        </Card>
      </div>
    </LayoutShell>
  );
}
