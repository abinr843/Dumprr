"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Bell, Plus, User, LogOut, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { logoutAction } from "@/app/actions/auth";
import { SearchModal } from "@/components/search/SearchModal";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

interface TopbarProps {
  sidebarCollapsed: boolean;
  userEmail?: string;
  userRole?: string;
}

export function Topbar({ sidebarCollapsed, userEmail, userRole }: TopbarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);
  return (
    <>
      <header
        className={`topbar ${sidebarCollapsed ? "topbar-sidebar-collapsed" : ""}`}
      >
        {/* Mobile brand (shown only on mobile) */}
        <div className="topbar-mobile-brand mobile-only">
          <span className="topbar-brand-text">DUMPR</span>
        </div>

        {/* Search */}
        <div
          className="topbar-search desktop-only"
          onClick={() => setSearchOpen(true)}
          role="button"
          tabIndex={0}
        >
          <Search size={16} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Search files, posts, settings…"
            className="topbar-search-input"
            aria-label="Search"
            readOnly
            onClick={() => setSearchOpen(true)}
          />
          <kbd className="topbar-search-kbd">⌘K</kbd>
        </div>

        {/* Spacer for mobile */}
        <div className="topbar-spacer" />

        {/* Actions */}
        <div className="topbar-actions">
          {/* Mobile Search Button */}
          <button
            type="button"
            className="topbar-action-btn mobile-only"
            aria-label="Open search"
            title="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
          </button>

          {userRole && isAdmin(userRole as UserRole) && (
            <button
              type="button"
              className="topbar-action-btn topbar-new-btn desktop-only"
              aria-label="Create new"
              title="Create new"
            >
              <Plus size={18} strokeWidth={2.2} />
              <span className="topbar-new-label">New</span>
            </button>
          )}

          <button
            className="topbar-action-btn"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={18} />
            <span className="topbar-notif-dot" />
          </button>

          <ThemeToggle />

          <div className="topbar-user-wrapper" ref={menuRef}>
            <button
              className="topbar-avatar"
              aria-label="User menu"
              title={userEmail || "User menu"}
              onClick={() => setShowMenu(!showMenu)}
            >
              <User size={18} />
            </button>

            {showMenu && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <p className="dropdown-email">{userEmail || "Guest Visitor"}</p>
                  <span className="dropdown-role">
                    <Shield size={12} />
                    {userRole || "Viewer"}
                  </span>
                </div>
                <div className="dropdown-divider" />
                {userEmail ? (
                  <form action={logoutAction}>
                    <button type="submit" className="dropdown-item dropdown-logout">
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </form>
                ) : (
                  <a href="/login" className="dropdown-item" style={{ textDecoration: "none", color: "var(--text-primary)" }}>
                    <LogOut size={15} style={{ transform: "rotate(180deg)" }} />
                    Sign in
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        isAdmin={userRole ? isAdmin(userRole as UserRole) : false}
      />

      <style jsx>{`
        .topbar {
          position: fixed;
          top: 0;
          left: var(--sidebar-width);
          right: 0;
          height: var(--topbar-height);
          background: var(--bg-topbar);
          backdrop-filter: var(--glass-blur) var(--glass-saturate);
          -webkit-backdrop-filter: var(--glass-blur) var(--glass-saturate);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          padding: 0 var(--space-6);
          gap: var(--space-4);
          z-index: var(--z-sticky);
          transition: left var(--transition-base);
        }
        .topbar-sidebar-collapsed {
          left: var(--sidebar-collapsed-width);
        }

        /* Mobile brand */
        .topbar-mobile-brand {
          display: none;
        }

        /* Search */
        .topbar-search {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0 var(--space-3);
          height: 40px;
          max-width: 400px;
          flex: 1;
          transition:
            border-color var(--transition-fast),
            box-shadow var(--transition-fast);
        }
        .topbar-search:focus-within {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-glow);
        }
        .topbar-search :global(.topbar-search-icon) {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .topbar-search-input {
          border: none;
          background: transparent;
          outline: none;
          flex: 1;
          font-size: var(--text-sm);
          color: var(--text-primary);
        }
        .topbar-search-input::placeholder {
          color: var(--text-muted);
        }
        .topbar-search-kbd {
          font-size: 11px;
          font-family: var(--font-sans);
          padding: 2px 6px;
          border: 1px solid var(--border-default);
          border-radius: 4px;
          color: var(--text-muted);
          background: var(--bg-surface);
          flex-shrink: 0;
        }

        .topbar-spacer {
          flex: 1;
        }

        /* Actions */
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .topbar-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          position: relative;
          transition:
            background var(--transition-fast),
            color var(--transition-fast),
            transform var(--transition-fast);
        }
        .topbar-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          transform: scale(1.05);
        }
        .topbar-action-btn:active {
          transform: scale(0.95);
        }

        .topbar-new-btn {
          width: auto;
          gap: var(--space-1);
          padding: 0 var(--space-3);
          background: var(--color-primary);
          color: var(--text-on-primary);
          border-radius: var(--radius-md);
        }
        .topbar-new-btn:hover {
          background: var(--color-primary-hover);
          color: var(--text-on-primary);
          box-shadow: var(--shadow-glow);
        }
        .topbar-new-label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
        }

        .topbar-notif-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 7px;
          height: 7px;
          background: var(--color-danger);
          border-radius: 50%;
          border: 1.5px solid var(--bg-topbar);
        }

        .topbar-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: linear-gradient(
            135deg,
            var(--color-primary),
            var(--color-primary-light)
          );
          color: white;
          transition: box-shadow var(--transition-fast), transform var(--transition-fast);
        }
        .topbar-avatar:hover {
          box-shadow: var(--shadow-glow);
          transform: scale(1.05);
        }

        .topbar-user-wrapper {
          position: relative;
        }
        .user-dropdown {
          position: absolute;
          top: calc(100% + var(--space-2));
          right: 0;
          min-width: 220px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-dropdown);
          overflow: hidden;
          animation: dropdown-enter 0.15s ease-out;
        }
        @keyframes dropdown-enter {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .dropdown-header {
          padding: var(--space-3) var(--space-4);
        }
        .dropdown-email {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dropdown-role {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin-top: var(--space-1);
          text-transform: capitalize;
        }
        .dropdown-divider {
          height: 1px;
          background: var(--border-subtle);
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: all var(--transition-fast);
        }
        .dropdown-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .dropdown-logout:hover {
          background: hsla(0, 70%, 50%, 0.08);
          color: hsl(0, 70%, 60%);
        }

        @media (min-width: 769px) {
          .mobile-only {
            display: none !important;
          }
        }

        @media (max-width: 768px) {
          .topbar {
            left: 0;
            padding-left: max(var(--space-4), env(safe-area-inset-left, 0px));
            padding-right: max(var(--space-4), env(safe-area-inset-right, 0px));
          }
          .desktop-only {
            display: none !important;
          }
          .mobile-only {
            display: inline-flex !important;
          }
          .topbar-mobile-brand {
            display: flex !important;
          }
          .topbar-brand-text {
            font-size: var(--text-lg);
            font-weight: var(--font-bold);
            letter-spacing: -0.02em;
          }
        }
      `}</style>
    </>
  );
}
