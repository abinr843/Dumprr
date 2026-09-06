"use client";

import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <>
      <button
        className={`btn btn-${variant} btn-${size} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="btn-spinner" aria-hidden="true" />
        ) : icon ? (
          <span className="btn-icon">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          font-weight: var(--font-semibold);
          border-radius: var(--radius-md);
          transition:
            all var(--transition-fast),
            transform var(--transition-fast);
          white-space: nowrap;
          user-select: none;
          position: relative;
          overflow: hidden;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Variants */
        .btn-primary {
          background: var(--color-primary);
          color: var(--text-on-primary);
          box-shadow: var(--shadow-sm);
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
          box-shadow: var(--shadow-glow);
        }

        .btn-secondary {
          background: var(--bg-input);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
        }
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-hover);
          border-color: var(--color-primary);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
        }
        .btn-ghost:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .btn-danger {
          background: var(--color-danger);
          color: #ffffff;
        }
        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
        }

        /* Sizes */
        .btn-sm {
          height: 32px;
          padding: 0 var(--space-3);
          font-size: var(--text-xs);
        }
        .btn-md {
          height: 40px;
          padding: 0 var(--space-5);
          font-size: var(--text-sm);
        }
        .btn-lg {
          height: 48px;
          padding: 0 var(--space-6);
          font-size: var(--text-base);
        }

        /* Icon */
        .btn-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        /* Spinner */
        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
