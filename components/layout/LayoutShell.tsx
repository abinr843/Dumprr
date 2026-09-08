"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { SmoothScrollProvider } from "./SmoothScrollProvider";

interface LayoutShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userRole?: string;
}

export function LayoutShell({ children, userEmail, userRole }: LayoutShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // GSAP page-entry animation — runs once on mount
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const { gsap } = await import("gsap");
      const ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }
        );
      }, el);
      cleanup = () => ctx.revert();
    })();

    return () => cleanup?.();
  }, []);

  return (
    <SmoothScrollProvider>
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
        ref={mainRef}
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
        }
        .main-sidebar-collapsed {
          margin-left: var(--sidebar-collapsed-width);
        }

        @media (max-width: 1024px) {
          .main-content {
            padding: var(--space-5);
          }
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

        @media (max-width: 480px) {
          .main-content {
            padding: var(--space-3);
            padding-bottom: calc(
              var(--mobile-nav-height) + var(--space-4) +
                env(safe-area-inset-bottom, 0px)
            );
          }
        }
      `}</style>
    </SmoothScrollProvider>
  );
}
