"use client";

import { Suspense, useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
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
    <div className="login-container">
      {/* Brand */}
      <div className="login-brand">
        <div className="brand-icon">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              width="40"
              height="40"
              rx="12"
              fill="url(#brand-gradient)"
            />
            <path
              d="M12 14h16v2H12v-2zm0 5h12v2H12v-2zm0 5h14v2H12v-2z"
              fill="white"
              opacity="0.9"
            />
            <defs>
              <linearGradient
                id="brand-gradient"
                x1="0"
                y1="0"
                x2="40"
                y2="40"
              >
                <stop stopColor="hsl(var(--hue-primary), 80%, 60%)" />
                <stop
                  offset="1"
                  stopColor="hsl(var(--hue-primary), 70%, 45%)"
                />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="brand-title">DUMPR</h1>
        <p className="brand-subtitle">Sign in to your workspace</p>
      </div>

      {/* Login Card */}
      <div className="login-card">
        {/* Error Messages */}
        {(state.error || errorParam) && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{state.error || (errorParam === "access_denied" ? "You don't have access to that page." : errorParam)}</span>
          </div>
        )}

        <form action={formAction} className="login-form">
          {redirectTo && (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="form-input"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <Link href="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </div>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="form-input"
                disabled={isPending}
              />
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 size={18} className="spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }

        .login-brand {
          text-align: center;
          margin-bottom: var(--space-8);
        }
        .brand-icon {
          display: inline-flex;
          margin-bottom: var(--space-4);
          filter: drop-shadow(0 4px 12px hsla(var(--hue-primary), 80%, 50%, 0.3));
        }
        .brand-title {
          font-size: 2rem;
          font-weight: var(--font-bold);
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin: 0;
        }
        .brand-subtitle {
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          margin-top: var(--space-1);
        }

        .login-card {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          padding: var(--space-8);
          box-shadow: var(--shadow-lg);
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: hsla(0, 80%, 50%, 0.1);
          border: 1px solid hsla(0, 80%, 50%, 0.2);
          border-radius: var(--radius-md);
          color: hsl(0, 80%, 65%);
          font-size: var(--text-sm);
          margin-bottom: var(--space-6);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .form-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
        }

        .forgot-link {
          font-size: var(--text-xs);
          color: var(--color-primary);
          text-decoration: none;
          transition: color var(--transition-fast);
        }
        .forgot-link:hover {
          color: var(--color-primary-hover);
          text-decoration: underline;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper :global(.input-icon) {
          position: absolute;
          left: var(--space-3);
          color: var(--text-tertiary);
          pointer-events: none;
          z-index: 1;
        }

        .form-input {
          width: 100%;
          padding: var(--space-3) var(--space-3) var(--space-3) var(--space-10);
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-sm);
          font-family: inherit;
          transition: border-color var(--transition-fast),
            box-shadow var(--transition-fast);
          outline: none;
        }
        .form-input::placeholder {
          color: var(--text-tertiary);
        }
        .form-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px hsla(var(--hue-primary), 80%, 50%, 0.15);
        }
        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-3) var(--space-4);
          background: var(--color-primary);
          color: var(--text-on-primary);
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-top: var(--space-2);
        }
        .login-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px hsla(var(--hue-primary), 80%, 50%, 0.3);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-btn :global(.spin) {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-container" style={{ minHeight: "400px" }} />}>
      <LoginForm />
    </Suspense>
  );
}
