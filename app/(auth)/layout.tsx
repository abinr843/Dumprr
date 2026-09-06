import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication — DUMPR",
  description: "Secure access to your DUMPR account.",
};

/**
 * Auth layout — minimal shell without sidebar or topbar.
 * Used for /login, /signup, /forgot-password, /reset-password.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="auth-layout">{children}</div>;
}

