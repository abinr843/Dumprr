"use client";

import React from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  children,
  variant = "default",
  dot = false,
}: BadgeProps) {
  return (
    <>
      <span className={`badge badge-${variant}`}>
        {dot && <span className="badge-dot" />}
        {children}
      </span>
      <style jsx>{`
        .badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: 2px 10px;
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          border-radius: var(--radius-full);
          line-height: 1.5;
          white-space: nowrap;
        }

        .badge-default {
          background: var(--bg-input);
          color: var(--text-secondary);
        }
        .badge-primary {
          background: var(--color-primary-glow);
          color: var(--color-primary);
        }
        .badge-success {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
        }
        .badge-warning {
          background: rgba(245, 158, 11, 0.12);
          color: #d97706;
        }
        .badge-danger {
          background: rgba(239, 68, 68, 0.12);
          color: #dc2626;
        }

        [data-theme="dark"] .badge-success {
          color: #34d399;
        }
        [data-theme="dark"] .badge-warning {
          color: #fbbf24;
        }
        [data-theme="dark"] .badge-danger {
          color: #f87171;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }
      `}</style>
    </>
  );
}
