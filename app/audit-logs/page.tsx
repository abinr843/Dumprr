import { LayoutShell } from "@/components/layout/LayoutShell";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLogViewer } from "./AuditLogViewer";

export const metadata = {
  title: "Audit Logs — DUMPR",
  description: "Security and activity audit trail",
};

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const session = await requireAdmin();

  const adminClient = createAdminClient();
  const { data: logs } = await adminClient
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <LayoutShell userEmail={session.user.email} userRole={session.profile?.role}>
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
            Audit Logs
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            Traceable audit trail of platform events, security incidents, and user activity.
          </p>
        </div>

        <AuditLogViewer initialLogs={logs || []} />
      </div>
    </LayoutShell>
  );
}
