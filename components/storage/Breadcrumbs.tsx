"use client";

import React from "react";
import { ChevronRight, Home } from "lucide-react";
import type { BreadcrumbItem } from "@/types/storage";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Folder breadcrumbs"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "wrap",
        padding: "8px 14px",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        fontSize: "var(--text-sm)",
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={item.id ?? "root"}>
            {idx > 0 && (
              <ChevronRight
                size={14}
                style={{ color: "var(--text-muted)", flexShrink: 0 }}
              />
            )}
            <button
              type="button"
              onClick={() => !isLast && onNavigate(item.id)}
              disabled={isLast}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                color: isLast
                  ? "var(--text-primary)"
                  : "var(--color-primary)",
                fontWeight: isLast ? 600 : 400,
                cursor: isLast ? "default" : "pointer",
                background: isLast
                  ? "rgba(99, 102, 241, 0.08)"
                  : "transparent",
                transition: "background 0.15s ease, color 0.15s ease",
                border: "none",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!isLast) {
                  e.currentTarget.style.backgroundColor =
                    "rgba(99, 102, 241, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isLast) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {idx === 0 && <Home size={14} />}
              <span>{item.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
