import { LayoutShell } from "@/components/layout/LayoutShell";
import { getSession } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — DUMPR",
  description: "Learn about the DUMPR platform.",
};

export default async function AboutPage() {
  const session = await getSession();

  return (
    <LayoutShell userEmail={session?.user?.email} userRole={session?.profile?.role}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1 style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginBottom: "var(--space-2)",
        }}>
          About DUMPR
        </h1>

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
              What is DUMPR?
            </h2>
            <p>
              DUMPR is a secure, private file-sharing and announcement platform designed for teams and organizations.
              It provides a centralized workspace where administrators can upload files, publish announcements, and
              manage access — while viewers enjoy a clean, read-only browsing experience.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              Key Features
            </h2>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <li><strong>Secure File Storage</strong> — Files are stored in encrypted cloud storage with role-based access controls.</li>
              <li><strong>Organized Folders</strong> — Hierarchical folder structure with drag-and-drop organization.</li>
              <li><strong>Announcements & Posts</strong> — Rich-text posts with drafts, publishing workflows, and archive capabilities.</li>
              <li><strong>Activity Feed</strong> — Real-time feed showing the latest uploads, posts, and platform activity.</li>
              <li><strong>Role-Based Access</strong> — Viewer, Member, and Admin roles with granular permissions.</li>
              <li><strong>Audit Logging</strong> — Complete audit trail of all actions for security and compliance.</li>
              <li><strong>Trash & Recovery</strong> — Soft-delete with configurable retention before permanent cleanup.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              Technology
            </h2>
            <p>
              Built with Next.js, Supabase, and modern web technologies. DUMPR prioritizes performance,
              security, and a premium user experience across all devices.
            </p>
          </section>

          <section style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              DUMPR is a private platform. Access is managed by the system administrator.
              For questions or support, contact your organization&apos;s admin.
            </p>
          </section>
        </div>
      </div>
    </LayoutShell>
  );
}
