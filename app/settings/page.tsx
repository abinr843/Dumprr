import { LayoutShell } from "@/components/layout/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Settings as SettingsIcon } from "lucide-react";
import { requireSession } from "@/lib/auth/session";

export const metadata = {
  title: "Settings — DUMPR",
  description: "System and profile settings",
};

export default async function SettingsPage() {
  const session = await requireSession();

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
            Settings
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            Manage your profile, preferences, and system configuration.
          </p>
        </div>

        <Card>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-16) 0",
              color: "var(--text-muted)",
              gap: "var(--space-3)",
            }}
          >
            <SettingsIcon size={48} strokeWidth={1.2} />
            <p style={{ fontSize: "var(--text-sm)" }}>
              Settings panel coming soon. Profile, theme, and system
              configuration.
            </p>
          </div>
        </Card>
      </div>
    </LayoutShell>
  );
}
