"use client";

import { useActionState } from "react";
import { updatePasswordAction, type UpdatePasswordState } from "@/app/actions/auth";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const initialState: UpdatePasswordState = {};

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    initialState
  );

  return (
    <div className="reset-container">
      <div className="reset-brand">
        <h1 className="brand-title">Set New Password</h1>
        <p className="brand-subtitle">
          Choose a strong password for your account
        </p>
      </div>

      <div className="reset-card">
        {state.success ? (
          <div className="success-state">
            <div className="success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="success-title">Password Updated</h2>
            <p className="success-text">{state.message}</p>
            <Link href="/login" className="login-btn">
              Sign in with new password
            </Link>
          </div>
        ) : (
          <form action={formAction} className="reset-form">
            {state.error && (
              <div className="form-error">{state.error}</div>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                New password
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Min 8 characters"
                  className="form-input"
                  disabled={isPending}
                  autoFocus
                />
              </div>
              <p className="input-hint">
                Must contain uppercase, lowercase, and a number
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm password
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter password"
                  className="form-input"
                  disabled={isPending}
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
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .reset-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }

        .reset-brand {
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

        .reset-card {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          padding: var(--space-8);
          box-shadow: var(--shadow-lg);
        }

        .reset-form {
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

        .input-hint {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin: 0;
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
        .login-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          background: var(--color-primary);
          color: var(--text-on-primary);
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          text-decoration: none;
          transition: all var(--transition-fast);
        }
        .login-btn:hover {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
