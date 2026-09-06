"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

export function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <>
      <div
        className={`card card-pad-${padding} ${hover ? "card-hover" : ""} ${className}`}
      >
        {children}
      </div>
      <style jsx>{`
        .card {
          background: var(--bg-card);
          backdrop-filter: var(--glass-blur) var(--glass-saturate);
          -webkit-backdrop-filter: var(--glass-blur) var(--glass-saturate);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          transition:
            box-shadow var(--transition-base),
            border-color var(--transition-base),
            transform var(--transition-base);
        }
        .card-hover:hover {
          box-shadow: var(--shadow-md);
          border-color: var(--border-default);
          transform: translateY(-2px);
        }
        .card-pad-sm {
          padding: var(--space-3);
        }
        .card-pad-md {
          padding: var(--space-5);
        }
        .card-pad-lg {
          padding: var(--space-8);
        }
      `}</style>
    </>
  );
}
