"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Clock,
  Settings,
  Shield,
  MoreHorizontal,
  X,
  Info,
} from "lucide-react";

interface MobileNavProps {
  userRole?: string;
}

const BASE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/recent", label: "Recent", icon: Clock },
];

const ADMIN_NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/admin", label: "Admin", icon: Shield, isAdmin: true },
];

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname();
  const isAdminUser = userRole === "admin" || userRole === "superadmin";
  const navItems = isAdminUser ? ADMIN_NAV_ITEMS : BASE_NAV_ITEMS;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer when tapping outside
  useEffect(() => {
    if (!drawerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [drawerOpen]);

  return (
    <>
      {/* ── Slide-up drawer (About · Privacy · Terms + credit) ── */}
      <div
        className={`mobile-drawer ${drawerOpen ? "mobile-drawer-open" : ""}`}
        ref={drawerRef}
        aria-hidden={!drawerOpen}
      >
        <div className="mobile-drawer-handle" />

        <div className="mobile-drawer-section">
          <p className="mobile-drawer-label">Pages</p>
          <div className="mobile-drawer-links">
            <Link href="/about"   className="mobile-drawer-link" onClick={() => setDrawerOpen(false)}>
              About
            </Link>
            <Link href="/privacy" className="mobile-drawer-link" onClick={() => setDrawerOpen(false)}>
              Privacy
            </Link>
            <Link href="/terms"   className="mobile-drawer-link" onClick={() => setDrawerOpen(false)}>
              Terms
            </Link>
            {isAdminUser && (
              <Link href="/admin/settings" className="mobile-drawer-link" onClick={() => setDrawerOpen(false)}>
                Settings
              </Link>
            )}
          </div>
        </div>

        <div className="mobile-drawer-credit">
          <span className="credit-dot" />
          <span>Platform developed by <strong>Abin</strong></span>
          <Info size={13} style={{ opacity: 0.5 }} />
        </div>

        {/* Close row */}
        <button
          className="mobile-drawer-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        >
          <X size={16} />
          Close
        </button>
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Bottom tab bar ── */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mnav-item ${isActive ? "mnav-active" : ""} ${"isAdmin" in item && item.isAdmin ? "mnav-admin" : ""}`}
            >
              <span className="mnav-icon-wrap">
                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                {isActive && <span className="mnav-active-dot" />}
              </span>
              <span className="mnav-label">{item.label}</span>
            </Link>
          );
        })}

        {/* More / drawer trigger */}
        <button
          type="button"
          className={`mnav-item mnav-more ${drawerOpen ? "mnav-active" : ""}`}
          aria-label="More options"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <span className="mnav-icon-wrap">
            {drawerOpen ? (
              <X size={20} strokeWidth={2.2} />
            ) : (
              <MoreHorizontal size={20} strokeWidth={1.7} />
            )}
          </span>
          <span className="mnav-label">More</span>
        </button>
      </nav>

      <style jsx>{`
        /* ─────────────────────────────────────────
           BOTTOM TAB BAR
        ───────────────────────────────────────── */
        .mobile-nav {
          display: none; /* hidden on desktop */
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: var(--bg-sidebar);
          backdrop-filter: blur(20px) saturate(200%);
          -webkit-backdrop-filter: blur(20px) saturate(200%);
          border-top: 1px solid var(--border-subtle);
          z-index: var(--z-sticky);
          align-items: center;
          justify-content: space-around;
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
        }

        .mnav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          gap: 2px;
          min-height: 48px;
          min-width: 0;
          max-width: 80px;
          padding: 6px 4px;
          border-radius: 10px;
          color: var(--text-muted);
          text-decoration: none;
          background: none;
          border: none;
          font-family: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          transition: color var(--transition-fast);
          position: relative;
          overflow: visible;
        }
        .mnav-item:active {
          transform: scale(0.88);
          transition: transform 80ms;
        }

        .mnav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 28px;
          border-radius: 8px;
          transition: background var(--transition-fast);
          flex-shrink: 0;
        }
        .mnav-active .mnav-icon-wrap {
          background: var(--bg-active);
        }

        .mnav-active-dot {
          position: absolute;
          bottom: 1px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-primary);
        }

        .mnav-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60px;
          text-align: center;
        }

        .mnav-active {
          color: var(--color-primary);
        }
        .mnav-admin {
          color: hsl(280, 70%, 60%);
        }
        .mnav-admin.mnav-active {
          color: hsl(280, 85%, 65%);
        }
        .mnav-admin.mnav-active .mnav-icon-wrap {
          background: hsla(280, 70%, 60%, 0.12);
        }
        .mnav-admin .mnav-active-dot {
          background: hsl(280, 70%, 60%);
        }

        /* ─────────────────────────────────────────
           SLIDE-UP DRAWER
        ───────────────────────────────────────── */
        .mobile-drawer-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: calc(var(--z-sticky) + 1);
          animation: fade-in-backdrop 0.2s ease;
        }

        .mobile-drawer {
          display: none;
          position: fixed;
          bottom: var(--mobile-nav-height);
          left: 0;
          right: 0;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-default);
          border-radius: 20px 20px 0 0;
          padding: 0 var(--space-5) var(--space-5);
          flex-direction: column;
          gap: var(--space-4);
          z-index: calc(var(--z-sticky) + 2);
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.25);
        }
        .mobile-drawer-open {
          transform: translateY(0);
        }

        .mobile-drawer-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: var(--border-default);
          margin: 12px auto 4px;
          flex-shrink: 0;
        }

        .mobile-drawer-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .mobile-drawer-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 0;
          padding: 0 4px;
        }

        .mobile-drawer-links {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
        }

        .mobile-drawer-link {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px var(--space-3);
          border-radius: var(--radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .mobile-drawer-link:active {
          background: var(--bg-hover);
          color: var(--color-primary);
          border-color: var(--color-primary);
          transform: scale(0.97);
        }

        .mobile-drawer-credit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px var(--space-4);
          border-radius: var(--radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          font-size: 11px;
          color: var(--text-muted);
        }
        .mobile-drawer-credit strong {
          color: var(--color-primary);
          font-weight: 700;
        }

        .credit-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-primary);
          flex-shrink: 0;
          box-shadow: 0 0 6px var(--color-primary-glow);
        }

        .mobile-drawer-close {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          width: 100%;
          padding: 11px;
          border-radius: var(--radius-md);
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background var(--transition-fast), color var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
        }
        .mobile-drawer-close:active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        @keyframes fade-in-backdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Show only on mobile ── */
        @media (max-width: 768px) {
          .mobile-nav {
            display: flex;
          }
          .mobile-drawer {
            display: flex;
          }
          .mobile-drawer-backdrop {
            display: block;
          }
        }
      `}</style>
    </>
  );
}
