"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  const isAdminUser = userRole === "admin" || userRole === "superadmin";

  // Check maintenance status periodically for guest users
  const checkMaintenance = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.maintenance) {
          if (!isAdminUser) {
            window.location.href = "/maintenance";
            return;
          }
          setMaintenanceActive(true);
        } else {
          setMaintenanceActive(false);
        }
      }
    } catch {
      // ignore network errors
    }
  }, [isAdminUser]);

  useEffect(() => {
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000); // Poll every 30 seconds
    const handleFocus = () => checkMaintenance();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkMaintenance]);

  // GSAP page-entry animation
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { gsap } = await import("gsap");
      const ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }
        );
      }, el);
      cleanup = () => ctx.revert();
    })();
    return () => cleanup?.();
  }, []);

  return (
    <SmoothScrollProvider>
      {/* Maintenance Mode Admin Banner */}
      {maintenanceActive && isAdminUser && (
        <div className="maintenance-admin-banner">
          <span className="maintenance-banner-dot" />
          <span>⚠️ Maintenance Mode Active — only administrators can see the site</span>
        </div>
      )}

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
        className={`main-content ${sidebarCollapsed ? "main-sidebar-collapsed" : ""} ${maintenanceActive ? "main-maintenance-offset" : ""}`}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav userRole={userRole} userEmail={userEmail} />

      <style jsx>{`
        .maintenance-admin-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 16px;
          background: linear-gradient(90deg, rgba(220, 38, 38, 0.9), rgba(234, 88, 12, 0.85));
          color: #fff;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(239,68,68,0.3);
        }
        .maintenance-banner-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fbbf24;
          animation: banner-pulse 1.5s ease-in-out infinite;
        }
        @keyframes banner-pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

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
        .main-maintenance-offset {
          margin-top: calc(var(--topbar-height) + 38px);
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
