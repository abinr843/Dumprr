"use client";

import { useEffect, useState, useCallback } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("dumpr-theme") as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", t);
    }
  }, []);

  const cycleTheme = useCallback(() => {
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("dumpr-theme", next);
    applyTheme(next);
  }, [theme, applyTheme]);

  if (!mounted) {
    return (
      <button
        className="theme-toggle"
        aria-label="Toggle theme"
        style={{ width: 36, height: 36 }}
        suppressHydrationWarning
      />
    );
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light"
      ? "Light mode"
      : theme === "dark"
        ? "Dark mode"
        : "System theme";

  return (
    <button
      onClick={cycleTheme}
      className="theme-toggle"
      aria-label={`Current: ${label}. Click to change.`}
      title={label}
      suppressHydrationWarning
    >
      <Icon size={18} strokeWidth={2} />
      <style jsx>{`
        .theme-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          background: transparent;
          transition:
            background var(--transition-fast),
            color var(--transition-fast),
            transform var(--transition-fast);
        }
        .theme-toggle:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          transform: scale(1.05);
        }
        .theme-toggle:active {
          transform: scale(0.95);
        }
      `}</style>
    </button>
  );
}
