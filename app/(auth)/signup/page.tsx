import { Rocket, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming Soon — DUMPR",
  description: "Sign up for DUMPR is coming soon.",
};

export default function SignupPage() {
  return (
    <div className="coming-soon-container">
      <div className="coming-soon-card">
        <div className="icon-wrapper">
          <Rocket size={56} strokeWidth={1.5} />
        </div>

        <h1 className="title">Coming Soon</h1>
        <p className="description">
          We&apos;re working hard to bring you an amazing experience.
          <br />
          Sign up will be available soon!
        </p>

        <div className="divider" />

        <p className="notify-text">
          Contact your administrator if you need an account.
        </p>

        <Link href="/login" className="back-btn">
          <ArrowLeft size={16} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
