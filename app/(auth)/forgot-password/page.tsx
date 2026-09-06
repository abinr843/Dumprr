"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type ForgotPasswordState } from "@/app/actions/auth";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialState
  );

  return (
    <div className="forgot-container">
      <div className="forgot-brand">
        <h1 className="brand-title">Reset Password</h1>
        <p className="brand-subtitle">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <div className="forgot-card">
        {state.success ? (
          <div className="success-state">
            <div className="success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="success-title">Check your email</h2>
            <p className="success-text">{state.message}</p>
            <Link href="/login" className="back-btn">
              <ArrowLeft size={16} />
              Back to login
            </Link>
          </div>
        ) : (
          <form action={formAction} className="forgot-form">
            {state.error && (
              <div className="form-error">{state.error}</div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="form-input"
                  disabled={isPending}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>

            <Link href="/login" className="back-link">
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </form>
        )}
      </div>

      <style jsx>{`
        .forgot-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }

        .forgot-brand {
          text-align: center;
          margin-bottom: var(--space-8);
        }
        .brand-title {
          font-size: 1.75rem;
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin: 0;
        }
        .brand-subtitle {
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          margin-top: var(--space-2);
        }

        .forgot-card {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          padding: var(--space-8);
          box-shadow: var(--shadow-lg);
        }

        .forgot-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .form-error {
          padding: var(--space-3) var(--space-4);
          background: hsla(0, 80%, 50%, 0.1);
          border: 1px solid hsla(0, 80%, 50%, 0.2);
          border-radius: var(--radius-md);
          color: hsl(0, 80%, 65%);
          font-size: var(--text-sm);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .form-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
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

        .submit-btn {
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
        }
        .submit-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .submit-btn :global(.spin) {
          animation: spin 1s linear infinite;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          text-decoration: none;
          transition: color var(--transition-fast);
          align-self: center;
        }
        .back-link:hover {
          color: var(--color-primary);
        }

        /* Success state */
        .success-state {
          text-align: center;
          padding: var(--space-4) 0;
        }
        .success-icon {
          color: hsl(142, 70%, 50%);
          margin-bottom: var(--space-4);
        }
        .success-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin: 0 0 var(--space-2);
        }
        .success-text {
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          margin-bottom: var(--space-6);
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          text-decoration: none;
          transition: all var(--transition-fast);
        }
        .back-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
