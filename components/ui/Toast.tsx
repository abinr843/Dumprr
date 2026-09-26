"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, Loader2, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "loading";

interface ToastItem {
  id: number;
  tone: Exclude<ToastTone, "loading"> | "loading";
  title: string;
  description?: string;
}

interface ToastOptions {
  description?: string;
  /** ms before auto-dismiss (0 = sticky). Defaults: success/info 3500, error 6000. */
  duration?: number;
}

interface ToastApi {
  success: (title: string, opts?: ToastOptions) => number;
  error: (title: string, opts?: ToastOptions) => number;
  info: (title: string, opts?: ToastOptions) => number;
  loading: (title: string, opts?: ToastOptions) => number;
  /** Resolve/replace a loading toast created earlier. */
  resolve: (id: number, tone: "success" | "error", title: string, opts?: ToastOptions) => void;
  dismiss: (id: number) => void;
  /** Wrap a promise with loading → success/error toasts. */
  promise<T>(
    p: Promise<T>,
    msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }
  ): Promise<T>;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Module-level singleton so non-component code (e.g. lib/client/api) can toast. */
let singleton: ToastApi | null = null;
export function getToastApi(): ToastApi | null {
  return singleton;
}

function defaultDuration(tone: ToastTone): number {
  if (tone === "error") return 6000;
  if (tone === "loading") return 0;
  return 3500;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastItem["tone"], title: string, opts?: ToastOptions): number => {
      const id = idRef.current++;
      const duration = opts?.duration ?? defaultDuration(tone);
      setToasts((prev) => [...prev.slice(-4), { id, tone, title, description: opts?.description }]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
      return id;
    },
    []
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, opts) => push("success", title, opts),
      error: (title, opts) => push("error", title, opts),
      info: (title, opts) => push("info", title, opts),
      loading: (title, opts) => push("loading", title, opts),
      resolve: (id, tone, title, opts) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, tone, title, description: opts?.description } : t)));
        const duration = opts?.duration ?? defaultDuration(tone);
        if (duration > 0) {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, duration);
        }
      },
      dismiss,
      promise: async (p, msgs) => {
        const id = push("loading", msgs.loading);
        try {
          const v = await p;
          const title = typeof msgs.success === "function" ? msgs.success(v) : msgs.success;
          api.resolve(id, "success", title);
          return v;
        } catch (e) {
          const title = typeof msgs.error === "function" ? msgs.error(e) : msgs.error;
          api.resolve(id, "error", title, {
            description: e instanceof Error ? e.message : undefined,
          });
          throw e;
        }
      },
    }),
    [push, dismiss]
  );

  singleton = api;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function toneIcon(tone: ToastItem["tone"]) {
  if (tone === "success") return <CheckCircle2 size={18} />;
  if (tone === "error") return <AlertTriangle size={18} />;
  if (tone === "loading") return <Loader2 size={18} className="t-spin" />;
  return <Info size={18} />;
}

function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="dumpr-toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`dumpr-toast tone-${t.tone}`}>
          <span className="t-icon">{toneIcon(t.tone)}</span>
          <span className="t-body">
            <span className="t-title">{t.title}</span>
            {t.description && <span className="t-desc">{t.description}</span>}
          </span>
          {t.tone !== "loading" && (
            <button type="button" className="t-x" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      <style jsx>{`
        .dumpr-toaster {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: min(92vw, 380px);
        }
        .dumpr-toast {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(17, 24, 39, 0.92);
          backdrop-filter: blur(14px);
          border: 1px solid var(--border-default);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
          animation: t-enter 0.22s ease-out;
          font-size: 13px;
        }
        @keyframes t-enter {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .tone-success {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 18px rgba(16, 185, 129, 0.18), 0 12px 32px rgba(0, 0, 0, 0.45);
        }
        .tone-success .t-icon {
          color: #34d399;
        }
        .tone-error {
          border-color: rgba(239, 68, 68, 0.5);
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.18), 0 12px 32px rgba(0, 0, 0, 0.45);
        }
        .tone-error .t-icon {
          color: #f87171;
        }
        .tone-info .t-icon,
        .tone-loading .t-icon {
          color: #818cf8;
        }
        .tone-loading {
          border-color: rgba(99, 102, 241, 0.5);
        }
        .t-icon {
          flex-shrink: 0;
          margin-top: 1px;
          display: inline-flex;
        }
        .t-icon :global(.t-spin) {
          animation: t-spin 1s linear infinite;
        }
        @keyframes t-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .t-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .t-title {
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          word-break: break-word;
        }
        .t-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.45;
          word-break: break-word;
        }
        .t-x {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: inline-flex;
          flex-shrink: 0;
        }
        .t-x:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        @media (max-width: 640px) {
          .dumpr-toaster {
            bottom: calc(var(--mobile-nav-height, 64px) + 12px);
            right: 12px;
            left: 12px;
            max-width: none;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}

/** Standalone imperative toast (works without the hook, no-ops if unmounted). */
export const toast: ToastApi = {
  success: (title: string, opts?: ToastOptions) => singleton?.success(title, opts) ?? 0,
  error: (title: string, opts?: ToastOptions) => singleton?.error(title, opts) ?? 0,
  info: (title: string, opts?: ToastOptions) => singleton?.info(title, opts) ?? 0,
  loading: (title: string, opts?: ToastOptions) => singleton?.loading(title, opts) ?? 0,
  resolve: (id: number, tone: "success" | "error", title: string, opts?: ToastOptions) =>
    singleton?.resolve(id, tone, title, opts),
  dismiss: (id: number) => singleton?.dismiss(id),
  promise: <T,>(
    p: Promise<T>,
    msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }
  ): Promise<T> => {
    if (!singleton) return p;
    return singleton.promise(p, msgs);
  },
};
