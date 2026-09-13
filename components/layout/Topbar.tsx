"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  Bell,
  User,
  LogOut,
  Shield,
  ChevronDown,
  UploadCloud,
  FileText as FileTextIcon,
  FolderPlus,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { SearchModal } from "@/components/search/SearchModal";
import { AdminUploadZone } from "@/components/storage/AdminUploadZone";
import { PostEditorModal } from "@/components/posts/PostEditorModal";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

interface TopbarProps {
  sidebarCollapsed: boolean;
  userEmail?: string;
  userRole?: string;
}

export function Topbar({ sidebarCollapsed, userEmail, userRole }: TopbarProps) {
  const [showMenu, setShowMenu]         = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [postEditorOpen, setPostEditorOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userIsAdmin = userRole ? isAdmin(userRole as UserRole) : false;

  const displayName = userEmail
    ? userEmail.split("@")[0].charAt(0).toUpperCase() + userEmail.split("@")[0].slice(1)
    : "Guest";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const roleLabel = userIsAdmin ? "Administrator" : userRole || "Viewer";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ⌘K / Ctrl+K to open search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((p) => !p);
      }
      if (e.key === "Escape") { setSearchOpen(false); setShowMenu(false); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <header className={`topbar${sidebarCollapsed ? " topbar-sidebar-collapsed" : ""}`}>
        {/* Mobile brand */}
        <div className="topbar-mobile-brand mobile-only">
          <span className="topbar-brand-dot" />
          <span className="topbar-brand-text">DUMPR</span>
        </div>

        {/* Search bar */}
        <div className="topbar-search desktop-only" style={{ flex: 1 }}>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", maxWidth: 480,
              height: 38,
              padding: "0 12px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              cursor: "text",
              transition: "border-color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
          >
            <Search size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "left" }}>
              Search files, posts, folders...
            </span>
            <span style={{
              display: "flex", alignItems: "center", gap: 1,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 5,
              padding: "2px 6px",
              fontSize: 10, fontWeight: 600,
              color: "var(--text-muted)",
            }}>
              <span>⌘</span><span> K</span>
            </span>
          </button>
        </div>

        {/* Right actions */}
        <div className="topbar-actions">
          {/* Admin quick-create buttons */}
          {userIsAdmin && (
            <>
              <button
                type="button"
                className="topbar-icon-btn desktop-only"
                title="Upload File"
                onClick={() => setUploadOpen(true)}
                style={{ width: "auto", padding: "0 12px", gap: 6, borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600 }}
              >
                <UploadCloud size={15} />
                <span style={{ color: "var(--text-secondary)" }}>Upload</span>
              </button>
            </>
          )}

          {/* Bell */}
          <button
            type="button"
            className="topbar-icon-btn"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={17} />
            {/* Unread badge */}
            <span className="topbar-badge" />
          </button>

          {/* User dropdown */}
          {userEmail ? (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="topbar-user"
                onClick={() => setShowMenu((p) => !p)}
                aria-expanded={showMenu}
              >
                <div className="topbar-user-avatar">{avatarLetter}</div>
                <div className="topbar-user-info desktop-only">
                  <span className="topbar-user-name">{displayName}</span>
                  <span className="topbar-user-role">{roleLabel}</span>
                </div>
                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} className="desktop-only" />
              </button>

              {showMenu && (
                <div className="topbar-dropdown">
                  {/* User info header */}
                  <div style={{ padding: "var(--space-3) var(--space-3) var(--space-2)", borderBottom: "1px solid var(--border-subtle)", marginBottom: "var(--space-1)" }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{userEmail}</div>
                  </div>

                  {userIsAdmin && (
                    <button
                      type="button"
                      className="topbar-dropdown-item"
                      onClick={() => { setPostEditorOpen(true); setShowMenu(false); }}
                    >
                      <FileTextIcon size={15} />
                      New Post
                    </button>
                  )}

                  {userIsAdmin && (
                    <a href="/admin" className="topbar-dropdown-item">
                      <Shield size={15} />
                      Admin Panel
                    </a>
                  )}

                  <div className="topbar-dropdown-sep" />

                  <form action={logoutAction} style={{ width: "100%" }}>
                    <button type="submit" className="topbar-dropdown-item" style={{ color: "#ef4444" }}>
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <a
              href="/login"
              className="topbar-user"
              style={{ gap: 8, textDecoration: "none" }}
            >
              <div className="topbar-user-avatar">
                <User size={16} />
              </div>
              <div className="topbar-user-info desktop-only">
                <span className="topbar-user-name">Sign in</span>
                <span className="topbar-user-role">Guest</span>
              </div>
            </a>
          )}
        </div>
      </header>

      {/* Search modal */}
      {searchOpen && (
        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Upload modal */}
      {userIsAdmin && uploadOpen && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: "var(--z-modal)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "var(--space-4)",
          }}
          onClick={() => setUploadOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AdminUploadZone
              folderId={null}
              onUploadSuccess={() => setUploadOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Post editor modal */}
      {userIsAdmin && postEditorOpen && (
        <PostEditorModal
          post={null}
          onClose={() => setPostEditorOpen(false)}
          onSaved={() => setPostEditorOpen(false)}
        />
      )}
    </>
  );
}
