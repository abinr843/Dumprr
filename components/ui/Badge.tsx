"use client";

import React from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "blue" | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "default",
  dot = false,
  size = "md",
}: BadgeProps) {
  const styles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
    default:  { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)",            border: "rgba(255,255,255,0.08)" },
    primary:  { bg: "rgba(99,102,241,0.14)",  color: "#818cf8",                      border: "rgba(99,102,241,0.25)" },
    success:  { bg: "rgba(16,185,129,0.12)",  color: "#34d399",                      border: "rgba(16,185,129,0.2)" },
    warning:  { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24",                      border: "rgba(245,158,11,0.2)" },
    danger:   { bg: "rgba(239,68,68,0.12)",   color: "#f87171",                      border: "rgba(239,68,68,0.2)" },
    blue:     { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa",                      border: "rgba(59,130,246,0.2)" },
    purple:   { bg: "rgba(139,92,246,0.12)",  color: "#c4b5fd",                      border: "rgba(139,92,246,0.2)" },
  };

  const s = styles[variant];
  const padding = size === "sm" ? "1px 6px" : "2px 9px";
  const fontSize = size === "sm" ? "9px" : "11px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding,
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.02em",
        borderRadius: "var(--radius-full)",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
