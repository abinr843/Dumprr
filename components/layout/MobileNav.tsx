"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Clock,
  Settings,
} from "lucide-react";

interface MobileNavProps {
  userRole?: string;
}

const BASE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/recent", label: "Recent", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {BASE_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${isActive ? "mobile-nav-active" : ""}`}
            >
              <item.icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.6}
              />
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .mobile-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px));
          background: var(--bg-sidebar);
          backdrop-filter: var(--glass-blur) var(--glass-saturate);
          -webkit-backdrop-filter: var(--glass-blur) var(--glass-saturate);
          border-top: 1px solid var(--border-subtle);
          align-items: center;
          justify-content: space-around;
          padding: 0 var(--space-2);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          z-index: var(--z-sticky);
        }

        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          min-width: 52px;
          min-height: 44px;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          text-decoration: none;
          transition:
            color var(--transition-fast),
            transform var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .mobile-nav-item:active {
          transform: scale(0.92);
        }
        .mobile-nav-active {
          color: var(--color-primary);
        }
        .mobile-nav-label {
          font-size: 11px;
          font-weight: var(--font-medium);
          letter-spacing: 0.01em;
        }

        @media (max-width: 768px) {
          .mobile-nav {
            display: flex;
          }
        }
      `}</style>
    </>
  );
}
