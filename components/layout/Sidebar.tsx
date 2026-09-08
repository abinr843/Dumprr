"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Clock,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Shield,
  LogOut,
  LogIn,
  User,
  Users,
  Info,
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
  { href: "/admin/storage", label: "Storage", icon: HardDrive },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
];

const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/recent", label: "Recent", icon: Clock },
];


interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userRole?: string;
  userEmail?: string;
}

export function Sidebar({ collapsed, onToggle, userRole, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [infoVisible, setInfoVisible] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  // Mock storage usage for UI display
  const usedGB = 1.2;
  const totalGB = 5.0;
  const percent = (usedGB / totalGB) * 100;

  // Close info tooltip on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoVisible(false);
      }
    }
    if (infoVisible) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [infoVisible]);

  return (
    <>
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <HardDrive size={collapsed ? 22 : 24} strokeWidth={2.2} />
          </div>
          {!collapsed && <span className="sidebar-title">DUMPR</span>}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* Admin Panel & Audit Logs (visible only to admins) */}
          {isAdmin && (
            <>
              {ADMIN_NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={`sidebar-link sidebar-link-admin ${
                      isActive ? "sidebar-link-active" : ""
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      size={20}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {!collapsed && <span>{item.label}</span>}
                    {isActive && <span className="sidebar-link-indicator" />}
                  </Link>
                );
              })}
              <div className="nav-divider" />
            </>
          )}

          {/* Main Navigation */}
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && <span>{item.label}</span>}
                {isActive && <span className="sidebar-link-indicator" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer Area: Info Links + Storage + User Profile + Auth Action + Toggle */}
        <div className="sidebar-footer">
          {/* Info Links (About, Privacy, Terms) */}
          {!collapsed && (
            <div className="sidebar-info-links">
              <Link href="/about" prefetch={false} className="sidebar-info-link">About</Link>
              <span className="sidebar-info-dot">·</span>
              <Link href="/privacy" prefetch={false} className="sidebar-info-link">Privacy</Link>
              <span className="sidebar-info-dot">·</span>
              <Link href="/terms" prefetch={false} className="sidebar-info-link">Terms</Link>
            </div>
          )}
          {/* Storage Meter */}
          {!collapsed && (
            <div className="sidebar-storage">
              <div className="storage-label">
                <span className="storage-text">Storage</span>
                <span className="storage-value">
                  {usedGB} GB / {totalGB} GB
                </span>
              </div>
              <div className="storage-bar">
                <div
                  className="storage-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {/* User Profile Card */}
          <div
            className={`sidebar-user ${collapsed ? "sidebar-user-collapsed" : ""}`}
            title={userEmail ? `${userEmail} (${isAdmin ? "Admin" : "Viewer"})` : "Guest Visitor (Viewer)"}
          >
            <div className="sidebar-avatar">
              {isAdmin ? <Shield size={16} /> : <User size={16} />}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-email">
                  {userEmail ? userEmail.split("@")[0] : "Guest Visitor"}
                </span>
                <span className={`sidebar-user-role ${isAdmin ? "role-admin" : "role-viewer"}`}>
                  <span className="role-dot" />
                  {isAdmin ? "Admin" : (userRole || "Viewer")}
                </span>
              </div>
            )}
          </div>

          {/* Auth Action Button: Sign out if logged in, Sign in if guest */}
          {userEmail ? (
            <form action={logoutAction} className="auth-form">
              <button
                type="submit"
                className="sidebar-logout"
                title={collapsed ? "Sign out" : undefined}
              >
                <LogOut size={16} />
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
              <LogIn size={16} />
              {!collapsed && <span>Sign in</span>}
            </Link>
          )}

          {/* Info Icon — "Platform developed by Abin" */}
          <div className="sidebar-info-btn-wrapper" ref={infoRef}>
            <button
              type="button"
              className={`sidebar-info-btn ${collapsed ? "sidebar-info-btn-collapsed" : ""}`}
              aria-label="Platform info"
              title="Platform developed by Abin"
              onMouseEnter={() => setInfoVisible(true)}
              onMouseLeave={() => setInfoVisible(false)}
              onClick={() => setInfoVisible((v) => !v)}
            >
              <Info size={14} />
              {!collapsed && <span className="sidebar-info-btn-label">Platform info</span>}
            </button>

            {infoVisible && (
              <div className={`sidebar-info-tooltip ${collapsed ? "sidebar-info-tooltip-collapsed" : ""}`} role="tooltip">
                <span className="info-tooltip-dot" />
                <span>Platform developed by <strong>Abin</strong></span>
              </div>
            )}
          </div>

          {/* Collapse Toggle */}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
              <>
                <ChevronLeft size={15} />
                <span className="toggle-label">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100dvh;
          width: var(--sidebar-width);
          background: var(--bg-sidebar);
          backdrop-filter: var(--glass-blur) var(--glass-saturate);
          -webkit-backdrop-filter: var(--glass-blur) var(--glass-saturate);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          padding: var(--space-4);
          z-index: var(--z-sticky);
          transition: width var(--transition-base);
          overflow: hidden;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .sidebar::-webkit-scrollbar { display: none; }
        .sidebar-collapsed {
          width: var(--sidebar-collapsed-width);
          padding: var(--space-4) var(--space-2);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-2);
          margin-bottom: var(--space-6);
          flex-shrink: 0;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: linear-gradient(
            135deg,
            var(--color-primary),
            var(--color-primary-light)
          );
          color: white;
          flex-shrink: 0;
          box-shadow: var(--shadow-glow);
        }
        .sidebar-title {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          flex: 1;
        }
        .nav-divider {
          height: 1px;
          background: var(--border-subtle);
          margin: var(--space-2) var(--space-2);
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          position: relative;
          transition:
            background var(--transition-fast),
            color var(--transition-fast),
            transform var(--transition-fast);
          text-decoration: none;
        }
        .sidebar-link:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          transform: translateX(2px);
        }
        .sidebar-link-active {
          background: var(--bg-active);
          color: var(--color-primary);
        }
        .sidebar-link-active:hover {
          transform: none;
        }
        .sidebar-link-admin {
          color: hsl(280, 70%, 60%);
        }
        .sidebar-link-admin:hover {
          color: hsl(280, 70%, 70%);
        }
        .sidebar-link-admin.sidebar-link-active {
          color: hsl(280, 80%, 60%);
          background: hsla(280, 70%, 60%, 0.1);
        }
        .sidebar-link-indicator {
          position: absolute;
          left: -4px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: var(--color-primary);
          border-radius: var(--radius-full);
        }

        .sidebar-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding-top: var(--space-3);
          border-top: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }

        .sidebar-storage {
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .storage-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .storage-text {
          font-size: 11px;
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .storage-value {
          font-size: 11px;
          font-weight: var(--font-medium);
          color: var(--text-muted);
        }
        .storage-bar {
          width: 100%;
          height: 5px;
          background: var(--bg-input);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .storage-fill {
          height: 100%;
          background: linear-gradient(
            90deg,
            var(--color-primary),
            #a855f7
          );
          border-radius: var(--radius-full);
          transition: width var(--transition-slow);
          box-shadow: 0 0 8px var(--color-primary-glow);
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: var(--radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          transition: all var(--transition-fast);
        }
        .sidebar-user:hover {
          background: var(--bg-hover);
          border-color: var(--border-default);
        }
        .sidebar-user-collapsed {
          justify-content: center;
          padding: 8px 0;
          background: transparent;
          border-color: transparent;
        }
        .sidebar-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-primary), #818cf8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
        }
        .sidebar-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .sidebar-user-email {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
        }
        .sidebar-user-role {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          line-height: 1;
        }
        .role-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .role-admin {
          color: #c084fc;
        }
        .role-admin .role-dot {
          background: #a855f7;
          box-shadow: 0 0 6px #a855f7;
        }
        .role-viewer {
          color: #60a5fa;
        }
        .role-viewer .role-dot {
          background: #3b82f6;
          box-shadow: 0 0 6px #3b82f6;
        }

        .auth-form {
          margin: 0;
          padding: 0;
          width: 100%;
        }
        .sidebar-logout {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: var(--font-medium);
          background: none;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: inherit;
          text-decoration: none;
          box-sizing: border-box;
        }
        .sidebar-collapsed .sidebar-logout {
          justify-content: center;
          padding: 7px 0;
        }
        .sidebar-logout:hover {
          background: hsla(0, 70%, 50%, 0.08);
          color: hsl(0, 70%, 65%);
          border-color: hsla(0, 70%, 50%, 0.15);
        }
        .sidebar-signin-link {
          color: var(--color-primary);
        }
        .sidebar-signin-link:hover {
          background: rgba(99, 102, 241, 0.1);
          color: var(--color-primary-light);
          border-color: rgba(99, 102, 241, 0.2);
        }

        /* ---- Info button ---- */
        .sidebar-info-btn-wrapper {
          position: relative;
          width: 100%;
        }
        .sidebar-info-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 10px;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: var(--font-medium);
          background: none;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: inherit;
          box-sizing: border-box;
        }
        .sidebar-info-btn-collapsed {
          justify-content: center;
          padding: 6px 0;
        }
        .sidebar-info-btn:hover {
          background: var(--bg-hover);
          color: var(--color-primary);
        }
        .sidebar-info-btn-label {
          font-size: 11px;
        }
        .sidebar-info-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 8px;
          right: 8px;
          background: var(--bg-elevated, #1e293b);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          font-size: 12px;
          color: var(--text-primary);
          white-space: nowrap;
          box-shadow: var(--shadow-lg);
          display: flex;
          align-items: center;
          gap: 6px;
          animation: tooltip-pop 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: calc(var(--z-sticky) + 10);
          pointer-events: none;
        }
        .sidebar-info-tooltip-collapsed {
          left: 56px;
          right: auto;
          bottom: 0;
          white-space: nowrap;
        }
        @keyframes tooltip-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .info-tooltip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-primary);
          flex-shrink: 0;
          box-shadow: 0 0 6px var(--color-primary-glow);
        }

        .sidebar-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 10px;
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: var(--font-medium);
          background: none;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: inherit;
          box-sizing: border-box;
        }
        .sidebar-collapsed .sidebar-toggle {
          justify-content: center;
          padding: 6px 0;
        }
        .sidebar-toggle:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .toggle-label {
          font-size: 11px;
        }

        /* Admin Sub-links */
        .sidebar-sub-link {
          padding-left: calc(var(--space-3) + 18px);
          font-size: calc(var(--text-sm) - 1px);
          color: var(--text-muted);
          opacity: 0.9;
        }
        .sidebar-collapsed .sidebar-sub-link {
          padding-left: var(--space-3);
        }
        .sidebar-sub-link:hover {
          color: hsl(280, 70%, 65%);
          background: hsla(280, 70%, 60%, 0.08);
        }
        .sidebar-sub-link-active {
          color: hsl(280, 80%, 60%) !important;
          background: hsla(280, 70%, 60%, 0.1) !important;
        }

        /* Info Links (About, Privacy, Terms) */
        .sidebar-info-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: var(--space-2) var(--space-2) 0;
          margin-bottom: var(--space-1);
          flex-wrap: wrap;
        }
        .sidebar-info-link {
          font-size: 11px;
          color: var(--text-muted);
          text-decoration: none;
          transition: color var(--transition-fast);
        }
        .sidebar-info-link:hover {
          color: var(--text-secondary);
          text-decoration: underline;
        }
        .sidebar-info-dot {
          color: var(--text-muted);
          font-size: 10px;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
