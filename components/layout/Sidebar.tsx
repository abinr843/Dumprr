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
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Shield,
  LogOut,
  LogIn,
  Users,
  ShieldCheck,
  Database,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/storage", label: "Storage", icon: Database },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
];

/** Shown to every visitor (including unauthenticated guests) */
const GUEST_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/posts", label: "Posts", icon: FileText },
];

/** Extra items only shown when the user is signed in */
const AUTH_NAV_ITEMS: NavItem[] = [
  { href: "/recent", label: "Recent", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userRole?: string;
  userEmail?: string;
}

/** Circular storage ring SVG */
function StorageRing({ percent }: { percent: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke="url(#ring-grad-v3)" strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
      <defs>
        <linearGradient id="ring-grad-v3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <text x="26" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill="#f0f4ff">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

export function Sidebar({ collapsed, onToggle, userRole, userEmail }: SidebarProps) {
  const pathname = usePathname();

  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isAuthenticated = Boolean(userEmail);

  // Build the nav items based on auth state
  const mainNavItems = isAuthenticated
    ? [...GUEST_NAV_ITEMS, ...AUTH_NAV_ITEMS]
    : GUEST_NAV_ITEMS;

  // Placeholder storage values
  const usedGB = 12.4;
  const totalGB = 50;
  const percent = (usedGB / totalGB) * 100;

  const displayName = userEmail
    ? userEmail.split("@")[0].charAt(0).toUpperCase() + userEmail.split("@")[0].slice(1)
    : "Guest";

  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
      <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
        {/* ── Brand ── */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <HardDrive size={collapsed ? 16 : 18} strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <div>
              <div className="sidebar-title">DUMPR</div>
              <div className="sidebar-subtitle">Share Knowledge. Securely.</div>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          {isAdmin && (
            <>
              {!collapsed && <div className="nav-section-label">Admin</div>}
              {ADMIN_NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={`sidebar-link${isActive ? " sidebar-link-active" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={17} strokeWidth={isActive ? 2.3 : 1.8} />
                    {!collapsed && <span>{item.label}</span>}
                    {isActive && <span className="sidebar-link-indicator" />}
                  </Link>
                );
              })}
              <div className="nav-divider" />
            </>
          )}

          {!collapsed && !isAdmin && <div className="nav-section-label">Navigation</div>}
          {mainNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`sidebar-link${isActive ? " sidebar-link-active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={17} strokeWidth={isActive ? 2.3 : 1.8} />
                {!collapsed && <span>{item.label}</span>}
                {isActive && <span className="sidebar-link-indicator" />}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          {/* Storage ring widget */}
          {!collapsed && (
            <div className="storage-ring-wrapper">
              <StorageRing percent={percent} />
              <div className="storage-ring-info">
                <div className="storage-gb">{usedGB} GB</div>
                <div className="storage-of">of {totalGB} GB used</div>
                <div className="storage-bar" style={{ marginTop: 6 }}>
                  <div
                    className="storage-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Decorative promo card */}
          {!collapsed && (
            <div className="sidebar-promo">
              <div className="sidebar-promo-bg" />
              <div className="sidebar-promo-icon">⬡</div>
              <div className="sidebar-promo-title">Organize</div>
              <div className="sidebar-promo-sub">Share · Access</div>
              <div className="sidebar-promo-sub" style={{ opacity: 0.55, fontSize: 10, marginTop: 2 }}>All in one place.</div>
            </div>
          )}

          {/* Version + status */}
          {!collapsed && (
            <div className="sidebar-version">
              <span className="version-dot" />
              <span>DUMPR v0.1.0 · Built with Next.js & Supabase</span>
            </div>
          )}

          {/* User + auth */}
          <div className={`sidebar-user${collapsed ? " sidebar-user-collapsed" : ""}`}>
            <div className="sidebar-avatar">{avatarLetter}</div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{displayName}</span>
                <span className="sidebar-user-role-label">
                  {isAdmin ? "Administrator" : userRole || "Viewer"}
                </span>
              </div>
            )}
          </div>

          {userEmail ? (
            <form action={logoutAction} className="auth-form">
              <button
                type="submit"
                className="sidebar-logout"
                title={collapsed ? "Sign out" : undefined}
              >
                <LogOut size={14} />
                {!collapsed && <span>Sign out</span>}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              prefetch={false}
              className="sidebar-logout sidebar-signin-link"
              title={collapsed ? "Sign in" : undefined}
            >
              <LogIn size={14} />
              {!collapsed && <span>Sign in</span>}
            </Link>
          )}

          {/* Collapse toggle */}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <>
                <ChevronLeft size={14} />
                <span style={{ fontSize: "var(--text-xs)" }}>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
