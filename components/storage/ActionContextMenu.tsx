"use client";

import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";

export interface ActionMenuItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  danger?: boolean;
}

export interface ActionContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  items: ActionMenuItem[];
}

export function ActionContextMenu({
  isOpen,
  onClose,
  triggerRef,
  title,
  subtitle,
  icon,
  items,
}: ActionContextMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Compute position for desktop
  useEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 180;
      const menuHeight = items.length * 40 + 20;

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight + 16 && rect.top > menuHeight + 16;

      // Calculate horizontal alignment (align with right edge of trigger, clamped to viewport)
      const rightDistance = Math.max(12, Math.min(window.innerWidth - 12, window.innerWidth - rect.right));

      setMenuPos({
        top: openUpward ? undefined : Math.round(rect.bottom + 6),
        bottom: openUpward ? Math.round(window.innerHeight - rect.top + 6) : undefined,
        right: rightDistance,
      });
    };

    updatePosition();
    window.addEventListener("scroll", onClose, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onClose, { capture: true });
  }, [isOpen, isMobile, items.length, onClose, triggerRef]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMobile]);

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  // ─── Mobile View: Bottom Action Sheet ──────────────────────────
  if (isMobile) {
    return ReactDOM.createPortal(
      <div className="action-sheet-portal" role="dialog" aria-modal="true">
        {/* Dimmed Backdrop */}
        <div className="action-sheet-backdrop" onClick={onClose} />

        {/* Bottom Drawer */}
        <div className="action-sheet-drawer">
          <div className="action-sheet-handle-wrap" onClick={onClose}>
            <div className="action-sheet-handle" />
          </div>

          {(title || icon) && (
            <div className="action-sheet-header">
              {icon && <div className="action-sheet-header-icon">{icon}</div>}
              <div className="action-sheet-header-text">
                {title && <div className="action-sheet-title">{title}</div>}
                {subtitle && <div className="action-sheet-subtitle">{subtitle}</div>}
              </div>
            </div>
          )}

          <div className="action-sheet-items">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`action-sheet-btn ${item.danger ? "action-sheet-btn-danger" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  item.action();
                }}
              >
                <span className="action-sheet-btn-icon">{item.icon}</span>
                <span className="action-sheet-btn-label">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="action-sheet-cancel-wrap">
            <button
              type="button"
              className="action-sheet-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>

        <style jsx>{`
          .action-sheet-portal {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
          }
          .action-sheet-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            animation: fadeIn 0.18s ease-out;
          }
          .action-sheet-drawer {
            position: relative;
            background: var(--bg-elevated);
            border-top: 1px solid var(--border-default);
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            padding: 12px 16px;
            padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
            box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            max-height: 85dvh;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .action-sheet-handle-wrap {
            display: flex;
            justify-content: center;
            padding: 4px 0 8px;
            cursor: pointer;
          }
          .action-sheet-handle {
            width: 40px;
            height: 4px;
            border-radius: 9999px;
            background: var(--border-default);
          }
          .action-sheet-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 0 8px 10px;
            border-bottom: 1px solid var(--border-subtle);
          }
          .action-sheet-header-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: var(--radius-md);
            background: var(--bg-input);
            flex-shrink: 0;
          }
          .action-sheet-header-text {
            min-width: 0;
            flex: 1;
          }
          .action-sheet-title {
            font-size: var(--text-sm);
            font-weight: 600;
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .action-sheet-subtitle {
            font-size: var(--text-xs);
            color: var(--text-muted);
            margin-top: 2px;
          }
          .action-sheet-items {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .action-sheet-btn {
            display: flex;
            align-items: center;
            gap: 14px;
            width: 100%;
            min-height: 48px;
            padding: 12px 16px;
            border-radius: var(--radius-lg);
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            color: var(--text-primary);
            font-size: var(--text-sm);
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease, transform 0.1s ease;
            -webkit-tap-highlight-color: transparent;
          }
          .action-sheet-btn:active {
            background: var(--bg-hover);
            transform: scale(0.98);
          }
          .action-sheet-btn-danger {
            color: var(--color-danger);
            border-color: rgba(239, 68, 68, 0.2);
            background: rgba(239, 68, 68, 0.04);
          }
          .action-sheet-btn-danger:active {
            background: rgba(239, 68, 68, 0.12);
          }
          .action-sheet-btn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .action-sheet-btn-label {
            flex: 1;
            text-align: left;
          }
          .action-sheet-cancel-wrap {
            margin-top: 4px;
          }
          .action-sheet-cancel-btn {
            width: 100%;
            min-height: 48px;
            padding: 12px;
            border-radius: var(--radius-lg);
            background: var(--bg-input);
            border: 1px solid var(--border-default);
            color: var(--text-secondary);
            font-size: var(--text-sm);
            font-weight: 600;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .action-sheet-cancel-btn:active {
            background: var(--bg-hover);
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>,
      document.body
    );
  }

  // ─── Desktop View: Smart High-ZIndex Portal Menu ───────────────
  return ReactDOM.createPortal(
    <div className="action-menu-portal" role="dialog">
      {/* Invisible Fullscreen Backdrop to catch clicks outside */}
      <div
        className="action-menu-backdrop"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Floating Menu */}
      <div
        ref={menuRef}
        className="action-menu-dropdown"
        style={{
          top: menuPos.top !== undefined ? `${menuPos.top}px` : undefined,
          bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : undefined,
          right: menuPos.right !== undefined ? `${menuPos.right}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`action-menu-item ${item.danger ? "action-menu-item-danger" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              item.action();
            }}
          >
            <span className="action-menu-item-icon">{item.icon}</span>
            <span className="action-menu-item-label">{item.label}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .action-menu-portal {
          position: fixed;
          inset: 0;
          z-index: 999999;
          pointer-events: auto;
        }
        .action-menu-backdrop {
          position: fixed;
          inset: 0;
          background: transparent;
          cursor: default;
        }
        .action-menu-dropdown {
          position: fixed;
          min-width: 170px;
          padding: 5px;
          border-radius: var(--radius-lg);
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.25), 0 2px 10px rgba(0, 0, 0, 0.12);
          animation: dropPop 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1000000;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .action-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--text-primary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
          text-align: left;
          font-family: inherit;
        }
        .action-menu-item:hover {
          background: var(--bg-input);
          color: var(--color-primary);
        }
        .action-menu-item-danger {
          color: var(--color-danger);
        }
        .action-menu-item-danger:hover {
          background: rgba(239, 68, 68, 0.08);
          color: var(--color-danger);
        }
        .action-menu-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .action-menu-item-label {
          flex: 1;
        }
        @keyframes dropPop {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
