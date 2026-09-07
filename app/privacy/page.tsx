import { LayoutShell } from "@/components/layout/LayoutShell";
import { getSession } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DUMPR",
  description: "Privacy policy for the DUMPR platform.",
};

export default async function PrivacyPage() {
  const session = await getSession();

  return (
    <LayoutShell userEmail={session?.user?.email} userRole={session?.profile?.role}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1 style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginBottom: "var(--space-1)",
        }}>
          Privacy Policy
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", marginBottom: "var(--space-6)" }}>
          Last updated: September 2026
        </p>

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
          lineHeight: 1.7,
        }}>
          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              1. Information We Collect
            </h2>
            <p>
              When you use DUMPR, we may collect the following information:
            </p>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <li><strong>Account Information:</strong> Email address and authentication credentials when you sign in.</li>
              <li><strong>Usage Data:</strong> Access logs, IP addresses, browser type, and interaction timestamps for security and audit purposes.</li>
              <li><strong>Uploaded Content:</strong> Files, documents, and posts you create or upload to the platform.</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and screen resolution for optimizing your experience.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              2. How We Use Your Information
            </h2>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <li>To provide and maintain the file-sharing and announcement platform.</li>
              <li>To authenticate your identity and manage access permissions.</li>
              <li>To maintain audit logs for security compliance and accountability.</li>
              <li>To monitor storage usage and enforce platform limits.</li>
              <li>To improve platform performance and user experience.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              3. Data Storage & Security
            </h2>
            <p>
              Your data is stored in encrypted cloud infrastructure provided by Supabase. We implement
              industry-standard security measures including:
            </p>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <li>Row-Level Security (RLS) for database access control.</li>
              <li>Encrypted file storage with secure access URLs.</li>
              <li>Role-based access control (RBAC) for all operations.</li>
              <li>Comprehensive audit logging of all user actions.</li>
              <li>Automatic session management and expiration.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              4. Data Retention
            </h2>
            <p>
              Files and posts moved to trash are retained for a configurable period (default: 7 days)
              before permanent deletion. Active data is retained as long as your account exists.
              Account deletion results in removal of all associated data.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              5. Data Sharing
            </h2>
            <p>
              We do not sell, trade, or share your personal information with third parties.
              Your uploaded files are only accessible to users within your organization based
              on the access permissions configured by the administrator.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              6. Your Rights
            </h2>
            <p>
              You have the right to access, correct, or request deletion of your personal data.
              Contact your organization&apos;s administrator for data-related requests.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              7. Contact
            </h2>
            <p>
              For privacy-related inquiries, please contact the platform administrator.
            </p>
          </section>

          <section style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              This privacy policy applies to the DUMPR platform and may be updated periodically.
              Changes will be reflected on this page with an updated date.
            </p>
          </section>
        </div>
      </div>
    </LayoutShell>
  );
}
