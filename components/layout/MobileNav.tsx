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
  ExternalLink,
  Sparkles,
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

  // Close drawer when tapping outside or pressing escape
  useEffect(() => {
    if (!drawerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={`mobile-drawer-backdrop ${drawerOpen ? "backdrop-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── Slide-up drawer (About · Privacy · Terms · Settings + credit) ── */}
      <div
        className={`mobile-drawer ${drawerOpen ? "mobile-drawer-open" : ""}`}
        ref={drawerRef}
        aria-modal="true"
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className="mobile-drawer-handle-bar">
          <div className="mobile-drawer-handle" />
        </div>

        <div className="mobile-drawer-header">
          <div className="mobile-drawer-title-group">
            <span className="mobile-drawer-title">Workspace Navigation</span>
            <span className="mobile-drawer-sub">Quick links & platform information</span>
          </div>
          <button
            type="button"
            className="mobile-drawer-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mobile-drawer-grid">
          <Link
            href="/about"
            className={`drawer-card ${pathname === "/about" ? "drawer-card-active" : ""}`}
            onClick={() => setDrawerOpen(false)}
          >
            <div className="drawer-card-icon icon-info">
              <Info size={18} />
            </div>
            <div className="drawer-card-text">
              <span className="drawer-card-title">About</span>
              <span className="drawer-card-desc">Platform & mission</span>
            </div>
          </Link>

          <Link
            href="/privacy"
            className={`drawer-card ${pathname === "/privacy" ? "drawer-card-active" : ""}`}
            onClick={() => setDrawerOpen(false)}
          >
            <div className="drawer-card-icon icon-shield">
              <Shield size={18} />
            </div>
            <div className="drawer-card-text">
              <span className="drawer-card-title">Privacy</span>
              <span className="drawer-card-desc">Data & security</span>
            </div>
          </Link>

          <Link
            href="/terms"
            className={`drawer-card ${pathname === "/terms" ? "drawer-card-active" : ""}`}
            onClick={() => setDrawerOpen(false)}
          >
            <div className="drawer-card-icon icon-terms">
              <FileText size={18} />
            </div>
            <div className="drawer-card-text">
              <span className="drawer-card-title">Terms</span>
              <span className="drawer-card-desc">User agreements</span>
            </div>
          </Link>

          {isAdminUser ? (
            <Link
              href="/admin/settings"
              className={`drawer-card ${pathname.startsWith("/admin/settings") ? "drawer-card-active" : ""}`}
              onClick={() => setDrawerOpen(false)}
            >
              <div className="drawer-card-icon icon-settings">
                <Settings size={18} />
              </div>
              <div className="drawer-card-text">
                <span className="drawer-card-title">Settings</span>
                <span className="drawer-card-desc">Admin controls</span>
              </div>
            </Link>
          ) : (
            <Link
              href="/recent"
              className={`drawer-card ${pathname === "/recent" ? "drawer-card-active" : ""}`}
              onClick={() => setDrawerOpen(false)}
            >
              <div className="drawer-card-icon icon-recent">
                <Clock size={18} />
              </div>
              <div className="drawer-card-text">
                <span className="drawer-card-title">Timeline</span>
                <span className="drawer-card-desc">Latest updates</span>
              </div>
            </Link>
          )}
        </div>

        <div className="mobile-drawer-credit">
          <div className="credit-left">
            <span className="credit-dot" />
            <span className="credit-text">
              Engineered & developed by <strong>Abin</strong>
            </span>
          </div>
          <Sparkles size={14} className="credit-sparkle" />
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <div className="mobile-nav-inner">
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
                <div className="mnav-icon-box">
                  <item.icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                  {isActive && <span className="mnav-active-glow" />}
                </div>
                <span className="mnav-label">{item.label}</span>
              </Link>
            );
          })}

          {/* More drawer toggle button */}
          <button
            type="button"
            className={`mnav-item mnav-more ${drawerOpen ? "mnav-active" : ""}`}
            aria-label="More navigation options"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <div className="mnav-icon-box">
              {drawerOpen ? (
                <X size={20} strokeWidth={2.3} />
              ) : (
                <MoreHorizontal size={20} strokeWidth={1.8} />
              )}
            </div>
            <span className="mnav-label">More</span>
          </button>
        </div>
      </nav>

      <style jsx>{`
        /* ─────────────────────────────────────────
           BOTTOM TAB BAR — Edge-to-edge frosted dock
        ───────────────────────────────────────── */
        .mobile-nav {
          display: none; /* hidden on desktop */
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: calc(64px + max(12px, env(safe-area-inset-bottom, 12px)));
          padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
          background: rgba(11, 15, 26, 0.95);
          backdrop-filter: blur(28px) saturate(200%);
          -webkit-backdrop-filter: blur(28px) saturate(200%);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          z-index: var(--z-sticky);
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
        }

        :global([data-theme="light"]) .mobile-nav {
          background: rgba(255, 255, 255, 0.96);
          border-top-color: rgba(0, 0, 0, 0.07);
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.06);
        }

        .mobile-nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-around;
          width: 100%;
          height: 64px;
          max-width: 500px;
          margin: 0 auto;
          padding: 0 var(--space-2);
        }

        .mnav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          gap: 3px;
          height: 52px;
          min-width: 0;
          max-width: 76px;
          padding: 4px 2px;
          border-radius: 12px;
          color: var(--text-muted);
          text-decoration: none;
          background: transparent;
          border: none;
          font-family: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          transition: color 0.15s ease, transform 0.1s ease;
          position: relative;
        }

        .mnav-item:active {
          transform: scale(0.92);
        }

        .mnav-icon-box {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 28px;
          border-radius: 14px;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .mnav-active .mnav-icon-box {
          background: rgba(99, 102, 241, 0.16);
        }

        :global([data-theme="light"]) .mnav-active .mnav-icon-box {
          background: rgba(99, 102, 241, 0.12);
        }

        .mnav-active-glow {
          position: absolute;
          bottom: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-primary);
          box-shadow: 0 0 10px var(--color-primary);
        }

        .mnav-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
          white-space: nowrap;
          text-align: center;
          line-height: 1.1;
          transition: color 0.15s ease;
        }

        .mnav-active {
          color: var(--color-primary);
        }

        .mnav-active .mnav-label {
          color: var(--color-primary);
          font-weight: 700;
        }

        .mnav-admin.mnav-active {
          color: #a855f7;
        }
        .mnav-admin.mnav-active .mnav-icon-box {
          background: rgba(168, 85, 247, 0.16);
        }
        .mnav-admin.mnav-active .mnav-active-glow {
          background: #a855f7;
          box-shadow: 0 0 10px #a855f7;
        }

        /* ─────────────────────────────────────────
           SLIDE-UP DRAWER (ANCHORED AT BOTTOM: 0)
        ───────────────────────────────────────── */
        .mobile-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9998;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.25s ease, visibility 0.25s ease;
        }

        .mobile-drawer-backdrop.backdrop-open {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }

        .mobile-drawer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #0f1523;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 28px 28px 0 0;
          padding: 8px var(--space-5) max(28px, env(safe-area-inset-bottom, 24px));
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          z-index: 9999;
          transform: translateY(100%);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.25s ease,
                      visibility 0.25s ease;
          box-shadow: 0 -12px 60px rgba(0, 0, 0, 0.7);
          max-width: 600px;
          margin: 0 auto;
        }

        :global([data-theme="light"]) .mobile-drawer {
          background: #ffffff;
          border-top-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 -12px 60px rgba(0, 0, 0, 0.15);
        }

        .mobile-drawer-open {
          transform: translateY(0);
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }

        .mobile-drawer-handle-bar {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 8px 0 4px;
        }

        .mobile-drawer-handle {
          width: 44px;
          height: 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.2);
        }

        :global([data-theme="light"]) .mobile-drawer-handle {
          background: rgba(0, 0, 0, 0.15);
        }

        .mobile-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2px 2px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        :global([data-theme="light"]) .mobile-drawer-header {
          border-bottom-color: rgba(0, 0, 0, 0.06);
        }

        .mobile-drawer-title-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .mobile-drawer-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .mobile-drawer-sub {
          font-size: 11px;
          color: var(--text-muted);
        }

        .mobile-drawer-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          border: none;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        :global([data-theme="light"]) .mobile-drawer-close-btn {
          background: rgba(0, 0, 0, 0.06);
        }

        .mobile-drawer-close-btn:active {
          transform: scale(0.92);
        }

        .mobile-drawer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .drawer-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          text-decoration: none;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        :global([data-theme="light"]) .drawer-card {
          background: #f8fafc;
          border-color: rgba(0, 0, 0, 0.07);
        }

        .drawer-card:active {
          transform: scale(0.97);
          background: rgba(99, 102, 241, 0.1);
          border-color: var(--color-primary);
        }

        .drawer-card-active {
          border-color: rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.08);
        }

        .drawer-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .icon-info {
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
        }
        .icon-shield {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
        }
        .icon-terms {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
        }
        .icon-settings {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
        }
        .icon-recent {
          background: rgba(99, 102, 241, 0.12);
          color: #818cf8;
        }

        .drawer-card-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .drawer-card-title {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .drawer-card-desc {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-drawer-credit {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%);
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .credit-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .credit-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          flex-shrink: 0;
          animation: credit-pulse 2s infinite ease-in-out;
        }

        @keyframes credit-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .credit-text {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .credit-text strong {
          color: var(--color-primary);
          font-weight: 700;
        }

        .credit-sparkle {
          color: #f59e0b;
          animation: spin-sparkle 6s linear infinite;
        }

        @keyframes spin-sparkle {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* ── Responsive breakpoint ── */
        @media (max-width: 768px) {
          .mobile-nav {
            display: block;
          }
        }
      `}</style>
    </>
  );
}
