import { LayoutShell } from "@/components/layout/LayoutShell";
import { getSession } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — DUMPR",
  description: "Terms and conditions for using the DUMPR platform.",
};

export default async function TermsPage() {
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
          Terms &amp; Conditions
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
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using DUMPR, you agree to be bound by these Terms and Conditions.
              If you do not agree with any part of these terms, you must not use the platform.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              2. Platform Usage
            </h2>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <li>DUMPR is a private file-sharing and announcement platform for authorized users only.</li>
              <li>Access is granted and managed by the platform administrator.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must not share your login credentials with unauthorized individuals.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              3. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <li>Upload malicious files, malware, or harmful content.</li>
              <li>Attempt to gain unauthorized access to other users&apos; data or admin functions.</li>
              <li>Use the platform for illegal activities or to distribute copyrighted material without authorization.</li>
              <li>Interfere with or disrupt the platform&apos;s infrastructure or services.</li>
              <li>Circumvent or attempt to bypass security measures, rate limits, or access controls.</li>
              <li>Upload files that exceed the configured size limits or storage quotas.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              4. Content Ownership
            </h2>
            <p>
              You retain ownership of content you upload to DUMPR. By uploading content, you grant
              the platform a limited license to store, display, and serve your content to authorized
              users within the platform. The administrator may manage, organize, or remove content
              as necessary for platform operations.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              5. Storage Limits
            </h2>
            <p>
              The platform enforces storage limits including total platform capacity, individual file
              size limits, and user account caps. These limits are configured by the administrator
              and may change. Exceeding storage limits may result in upload restrictions.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              6. Account Termination
            </h2>
            <p>
              The administrator reserves the right to disable, suspend, or delete user accounts
              at any time for violations of these terms or for administrative reasons. Upon account
              deletion, associated data will be permanently removed.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              7. Service Availability
            </h2>
            <p>
              The platform may be temporarily unavailable during maintenance periods or system updates.
              The administrator may enable maintenance mode to restrict access during planned downtime
              or emergency situations. We strive for maximum uptime but do not guarantee uninterrupted service.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              8. Limitation of Liability
            </h2>
            <p>
              DUMPR is provided &ldquo;as is&rdquo; without warranties of any kind. The platform
              operators shall not be liable for any indirect, incidental, or consequential damages
              arising from your use of the platform. Users are responsible for maintaining their
              own backups of critical data.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              9. Changes to Terms
            </h2>
            <p>
              These terms may be updated periodically. Continued use of the platform after changes
              constitutes acceptance of the updated terms. Significant changes will be communicated
              through the platform.
            </p>
          </section>

          <section style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              By using DUMPR, you acknowledge that you have read, understood, and agree to these
              Terms and Conditions. For questions, contact the platform administrator.
            </p>
          </section>
        </div>
      </div>
    </LayoutShell>
  );
}
