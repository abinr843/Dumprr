"use client";

import { Suspense, useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Lock, Mail, Loader2, AlertCircle, HardDrive, ArrowLeft } from "lucide-react";
import Link from "next/link";

const initialState: LoginState = {};

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const errorParam = searchParams.get("error");
  const emailRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <div className="lc">
      {/* Ambient background blobs */}
      <div className="lc-blob lc-blob-1" />
      <div className="lc-blob lc-blob-2" />
      <div className="lc-blob lc-blob-3" />

      {/* Back button */}
      <div className="lc-back-wrap">
        <Link href="/" className="lc-back-btn">
          <ArrowLeft size={15} />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Brand */}
      <div className="lc-brand">
        <div className="lc-logo">
          <HardDrive size={22} strokeWidth={2.2} />
        </div>
        <h1 className="lc-title">DUMPR</h1>
        <p className="lc-subtitle">Sign in to your workspace</p>
      </div>

      {/* Card */}
      <div className="lc-card">
        {(state.error || errorParam) && (
          <div className="lc-error">
            <AlertCircle size={16} />
            <span>
              {state.error ||
                (errorParam === "access_denied"
                  ? "You don't have access to that page."
                  : errorParam)}
            </span>
          </div>
        )}

        <form action={formAction} className="lc-form">
          {redirectTo && (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          )}

          <div className="lc-field">
            <label htmlFor="email" className="lc-label">Email address</label>
            <div className="lc-input-wrap">
              <Mail size={16} className="lc-icon" />
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="lc-input"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="lc-field">
            <div className="lc-label-row">
              <label htmlFor="password" className="lc-label">Password</label>
              <Link href="/forgot-password" className="lc-forgot">Forgot password?</Link>
            </div>
            <div className="lc-input-wrap">
              <Lock size={16} className="lc-icon" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="lc-input"
                disabled={isPending}
              />
            </div>
          </div>

          <button type="submit" className="lc-btn" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="lc-footer">
          <span>🛡️ Secure · Private · Encrypted</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blob-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }

        .lc {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }

        .lc-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
          animation: blob-drift 12s ease-in-out infinite;
        }
        .lc-blob-1 {
          width: 400px; height: 400px;
          top: -100px; left: -150px;
          background: rgba(99, 102, 241, 0.1);
          animation-delay: 0s;
        }
        .lc-blob-2 {
          width: 300px; height: 300px;
          bottom: -80px; right: -100px;
          background: rgba(139, 92, 246, 0.08);
          animation-delay: 4s;
        }
        .lc-blob-3 {
          width: 250px; height: 250px;
          top: 50%; left: 60%;
          background: rgba(59, 130, 246, 0.06);
          animation-delay: 8s;
        }

        .lc-back-wrap {
          display: flex;
          align-items: center;
          margin-bottom: var(--space-4);
        }
        .lc-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: var(--text-xs);
          font-weight: 500;
          text-decoration: none;
          transition: all var(--transition-fast);
          backdrop-filter: blur(8px);
        }
        .lc-back-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--border-default);
          transform: translateX(-2px);
        }

        .lc-brand {
          text-align: center;
          margin-bottom: var(--space-8);
        }
        .lc-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px; height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #6366f1, #3730a3);
          color: white;
          margin-bottom: var(--space-4);
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.4);
        }
        .lc-title {
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          margin: 0;
        }
        .lc-subtitle {
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin-top: var(--space-1);
        }

        .lc-card {
          background: rgba(19, 25, 41, 0.8);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: var(--radius-xl);
          padding: var(--space-8);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5),
                      inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .lc-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-md);
          color: #f87171;
          font-size: var(--text-sm);
          margin-bottom: var(--space-6);
        }

        .lc-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .lc-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .lc-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .lc-label {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-secondary);
        }
        .lc-forgot {
          font-size: var(--text-xs);
          color: var(--color-primary-light);
          text-decoration: none;
          transition: color var(--transition-fast);
        }
        .lc-forgot:hover { color: white; text-decoration: underline; }

        .lc-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        :global(.lc-icon) {
          position: absolute;
          left: 13px;
          color: var(--text-muted);
          pointer-events: none;
          z-index: 1;
        }
        .lc-input {
          width: 100%;
          height: 44px;
          padding: 0 var(--space-4) 0 42px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-sm);
          font-family: inherit;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
          outline: none;
        }
        .lc-input::placeholder { color: var(--text-muted); }
        .lc-input:focus {
          border-color: var(--color-primary);
          background: rgba(99, 102, 241, 0.05);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        .lc-input:disabled { opacity: 0.6; cursor: not-allowed; }

        .lc-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          width: 100%;
          height: 46px;
          background: linear-gradient(135deg, var(--color-primary), #3730a3);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-top: var(--space-2);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
          letter-spacing: 0.01em;
        }
        .lc-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5);
        }
        .lc-btn:active:not(:disabled) { transform: translateY(0) scale(0.99); }
        .lc-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .lc-footer {
          margin-top: var(--space-5);
          text-align: center;
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-layout">
      <Suspense fallback={<div style={{ width: 420, minHeight: 400 }} />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
