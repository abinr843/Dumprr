"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";

interface LayoutShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userRole?: string;
}

export function LayoutShell({ children, userEmail, userRole }: LayoutShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole={userRole}
        userEmail={userEmail}
      />

      {/* Top Bar */}
      <Topbar
        sidebarCollapsed={sidebarCollapsed}
        userEmail={userEmail}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <main
        className={`main-content ${sidebarCollapsed ? "main-sidebar-collapsed" : ""}`}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav userRole={userRole} />

      <style jsx>{`
        .main-content {
          margin-left: var(--sidebar-width);
          margin-top: var(--topbar-height);
          min-height: calc(100dvh - var(--topbar-height));
          padding: var(--space-6);
          transition: margin-left var(--transition-base);
          animation: fadeIn var(--transition-base) ease-out;
        }
        .main-sidebar-collapsed {
          margin-left: var(--sidebar-collapsed-width);
        }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
            padding: var(--space-4);
            padding-left: max(var(--space-4), env(safe-area-inset-left, 0px));
            padding-right: max(var(--space-4), env(safe-area-inset-right, 0px));
            padding-bottom: calc(
              var(--mobile-nav-height) + var(--space-6) +
                env(safe-area-inset-bottom, 0px)
            );
          }
        }
      `}</style>
    </>
  );
}
