"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  RefreshCw,
  Save,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Users,
  HardDrive,
  FileUp,
  Clock,
  Shield,
  Globe,
  UserPlus,
  FileType,
  Lock,
  Power,
  Type,
  Info,
} from "lucide-react";
import Link from "next/link";

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  is_public: boolean;
}

// ─── Settings Configuration ─────────────────────────────────────────

interface SettingConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: "number" | "boolean" | "string" | "select";
  unit?: string;
  /** For number type: how to convert stored value to display value */
  displayConvert?: (raw: string) => string;
  /** For number type: how to convert display value back to stored value */
  storeConvert?: (display: string) => string;
  options?: { value: string; label: string }[];
  defaultValue: string;
}

const SECTIONS: { title: string; description: string; icon: React.ReactNode; settings: SettingConfig[] }[] = [
  {
    title: "General & Branding",
    description: "Platform identity and core settings",
    icon: <Info size={20} />,
    settings: [
      {
        key: "app.site_name",
        label: "Platform Name",
        description: "Display name for the platform (shown in headers and emails)",
        icon: <Type size={18} />,
        type: "string",
        defaultValue: "DUMPR",
      },
      {
        key: "app.site_description",
        label: "Platform Description",
        description: "Short tagline or description for the platform",
        icon: <Info size={18} />,
        type: "string",
        defaultValue: "Secure File Sharing & Announcement Workspace",
      },
      {
        key: "app.maintenance_mode",
        label: "Maintenance Mode",
        description: "When enabled, all non-admin users will be blocked and shown a maintenance page. Use for planned downtime or emergency shutdowns.",
        icon: <Power size={18} />,
        type: "boolean",
        defaultValue: "false",
      },
    ],
  },
  {
    title: "Access & User Management",
    description: "Control who can join and their default permissions",
    icon: <Users size={20} />,
    settings: [
      {
        key: "app.max_users",
        label: "Maximum Users",
        description: "Maximum number of user accounts allowed (1–100)",
        icon: <Users size={18} />,
        type: "number",
        unit: "users",
        defaultValue: "20",
      },
      {
        key: "auth.allow_registration",
        label: "Allow Registration",
        description: "When disabled, only admins can create new user accounts",
        icon: <UserPlus size={18} />,
        type: "boolean",
        defaultValue: "false",
      },
      {
        key: "auth.default_role",
        label: "Default Role for New Users",
        description: "Role assigned to newly registered users",
        icon: <Shield size={18} />,
        type: "select",
        options: [
          { value: "viewer", label: "Viewer (read-only)" },
          { value: "member", label: "Member (can interact)" },
        ],
        defaultValue: "viewer",
      },
    ],
  },
  {
    title: "Storage & Upload Limits",
    description: "Control storage usage and upload policies",
    icon: <HardDrive size={20} />,
    settings: [
      {
        key: "storage.storage_cap_bytes",
        label: "Total Storage Cap",
        description: "Maximum total storage for the entire platform",
        icon: <HardDrive size={18} />,
        type: "number",
        unit: "GB",
        displayConvert: (raw) => {
          const bytes = parseInt(raw, 10);
          return isNaN(bytes) ? raw : (bytes / (1024 * 1024 * 1024)).toFixed(1);
        },
        storeConvert: (display) => String(Math.round(parseFloat(display) * 1024 * 1024 * 1024)),
        defaultValue: String(8 * 1024 * 1024 * 1024),
      },
      {
        key: "storage.max_file_size_bytes",
        label: "Max File Size",
        description: "Maximum size for a single uploaded file",
        icon: <FileUp size={18} />,
        type: "number",
        unit: "MB",
        displayConvert: (raw) => {
          const bytes = parseInt(raw, 10);
          return isNaN(bytes) ? raw : (bytes / (1024 * 1024)).toFixed(0);
        },
        storeConvert: (display) => String(Math.round(parseFloat(display) * 1024 * 1024)),
        defaultValue: String(70 * 1024 * 1024),
      },
      {
        key: "storage.retention_days",
        label: "Trash Retention Period",
        description: "Days to keep trashed items before permanent deletion (1–365)",
        icon: <Clock size={18} />,
        type: "number",
        unit: "days",
        defaultValue: "7",
      },
      {
        key: "storage.allowed_file_types",
        label: "Allowed File Types",
        description: "Comma-separated list of allowed file extensions, or * for all types",
        icon: <FileType size={18} />,
        type: "string",
        defaultValue: "*",
      },
    ],
  },
  {
    title: "Security & Privacy",
    description: "Access control and session policies",
    icon: <Lock size={20} />,
    settings: [
      {
        key: "security.public_browsing",
        label: "Public Guest Browsing",
        description: "Allow unauthenticated visitors to browse files and posts without signing in",
        icon: <Globe size={18} />,
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "security.session_timeout_hours",
        label: "Session Timeout",
        description: "Auto-expire user sessions after this period of inactivity (1–720 hours)",
        icon: <Clock size={18} />,
        type: "number",
        unit: "hours",
        defaultValue: "72",
      },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function AdminSettingsClient() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch settings");
      const data = await res.json();
      setSettings(data.settings || []);
      const vals: Record<string, string> = {};
      for (const s of data.settings || []) {
        vals[s.key] = s.value;
      }
      setEditValues(vals);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch settings");
        }
        const data = await res.json();
        if (active) {
          setSettings(data.settings || []);
          const vals: Record<string, string> = {};
          for (const s of data.settings || []) {
            vals[s.key] = s.value;
          }
          setEditValues(vals);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to fetch settings");
          setLoading(false);
        }
      }
    }
    init();
    return () => { active = false; };
  }, []);

  const updateValue = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const updates: Record<string, number | boolean | string> = {};
    for (const section of SECTIONS) {
      for (const cfg of section.settings) {
        const current = editValues[cfg.key];
        const original = settings.find((s) => s.key === cfg.key)?.value;
        if (current === undefined || current === original) continue;

        if (cfg.type === "boolean") {
          updates[cfg.key] = current === "true";
        } else if (cfg.type === "number") {
          const stored = cfg.storeConvert ? cfg.storeConvert(current) : current;
          const num = parseFloat(stored);
          if (!isNaN(num)) updates[cfg.key] = num;
        } else if (cfg.type === "select") {
          updates[cfg.key] = current.replace(/"/g, "");
        } else {
          updates[cfg.key] = current.replace(/"/g, "");
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      setSuccess("No changes to save");
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updates }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error || "Failed to save");

      // Check if maintenance mode was toggled
      if ("app.maintenance_mode" in updates) {
        const mode = updates["app.maintenance_mode"];
        setSuccess(mode ? "⚠️ Maintenance mode ACTIVATED — all non-admin users will be blocked" : "✅ Maintenance mode deactivated — site is live");
      } else {
        setSuccess(data.message || "Settings saved successfully");
      }

      fetchSettings();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getDisplayValue = (cfg: SettingConfig): string => {
    const raw = editValues[cfg.key] ?? cfg.defaultValue;
    const clean = raw.replace(/^"|"$/g, "");
    if (cfg.displayConvert) return cfg.displayConvert(clean);
    return clean;
  };

  const isMaintenanceOn = (editValues["app.maintenance_mode"] ?? "false").replace(/"/g, "") === "true";

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
        <Loader2 size={28} className="spin" style={{ margin: "0 auto 0.5rem" }} />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: "1.5rem 2rem", maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/admin" style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Settings size={22} /> System Settings
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
                Configure platform limits, access controls, and security policies
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={fetchSettings} disabled={loading} className="settings-btn settings-btn-secondary">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={handleSave} disabled={saving || !hasChanges} className="settings-btn settings-btn-primary">
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Maintenance Mode Banner */}
        {isMaintenanceOn && (
          <div className="settings-maintenance-banner">
            <Power size={18} />
            <div>
              <strong>Maintenance Mode is ACTIVE</strong>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                All non-admin users are currently blocked from accessing the platform.
                Toggle off Maintenance Mode and save to restore access.
              </p>
            </div>
          </div>
        )}

        {/* Alerts */}
        {success && (
          <div className="settings-alert settings-alert-success">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="settings-alert settings-alert-error">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Settings Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {SECTIONS.map((section) => (
            <div key={section.title} className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-icon">{section.icon}</div>
                <div>
                  <h2 className="settings-section-title">{section.title}</h2>
                  <p className="settings-section-desc">{section.description}</p>
                </div>
              </div>

              <div className="settings-section-body">
                {section.settings.map((cfg) => (
                  <div key={cfg.key} className={`settings-row ${cfg.key === "app.maintenance_mode" ? "settings-row-danger" : ""}`}>
                    <div className="settings-row-icon">{cfg.icon}</div>
                    <div className="settings-row-info">
                      <div className="settings-row-label">{cfg.label}</div>
                      <div className="settings-row-desc">{cfg.description}</div>
                    </div>
                    <div className="settings-row-control">
                      {cfg.type === "boolean" ? (
                        <button
                          type="button"
                          className={`settings-toggle ${getDisplayValue(cfg) === "true" ? "settings-toggle-on" : "settings-toggle-off"} ${cfg.key === "app.maintenance_mode" && getDisplayValue(cfg) === "true" ? "settings-toggle-danger" : ""}`}
                          onClick={() => updateValue(cfg.key, getDisplayValue(cfg) === "true" ? "false" : "true")}
                          aria-label={`Toggle ${cfg.label}`}
                        >
                          <span className="settings-toggle-thumb" />
                        </button>
                      ) : cfg.type === "select" ? (
                        <select
                          className="settings-select"
                          value={getDisplayValue(cfg)}
                          onChange={(e) => updateValue(cfg.key, e.target.value)}
                        >
                          {cfg.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : cfg.type === "number" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="number"
                            step="any"
                            min="1"
                            className="settings-input"
                            value={getDisplayValue(cfg)}
                            onChange={(e) => {
                              if (cfg.storeConvert) {
                                updateValue(cfg.key, cfg.storeConvert(e.target.value));
                              } else {
                                updateValue(cfg.key, e.target.value);
                              }
                            }}
                          />
                          {cfg.unit && <span className="settings-unit">{cfg.unit}</span>}
                        </div>
                      ) : (
                        <input
                          type="text"
                          className="settings-input settings-input-wide"
                          value={getDisplayValue(cfg)}
                          onChange={(e) => updateValue(cfg.key, e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Raw Settings Table */}
        <details className="settings-raw-details">
          <summary className="settings-raw-summary">View All Raw Settings</summary>
          <table className="settings-raw-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.key}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.key}</td>
                  <td style={{ fontWeight: 500 }}>{s.value}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{s.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <style jsx>{`
        .settings-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .settings-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .settings-btn-secondary {
          border: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        .settings-btn-secondary:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .settings-btn-primary {
          border: none;
          background: var(--color-primary);
          color: #fff;
          font-weight: 600;
        }
        .settings-btn-primary:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .settings-maintenance-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(234,88,12,0.08));
          border: 1px solid rgba(239,68,68,0.3);
          color: hsl(0, 72%, 60%);
          animation: pulse-border 2s ease-in-out infinite;
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(239,68,68,0.3); }
          50% { border-color: rgba(239,68,68,0.6); }
        }

        .settings-alert {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
        }
        .settings-alert-success {
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
        }
        .settings-alert-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
        }

        .settings-section {
          border-radius: 14px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          overflow: hidden;
        }
        .settings-section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-tertiary);
        }
        .settings-section-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          flex-shrink: 0;
        }
        .settings-section-title {
          font-size: 1rem;
          font-weight: 650;
          color: var(--text-primary);
          margin: 0;
        }
        .settings-section-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin: 0.1rem 0 0;
        }
        .settings-section-body {
          display: flex;
          flex-direction: column;
        }

        .settings-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s ease;
        }
        .settings-row:last-child {
          border-bottom: none;
        }
        .settings-row:hover {
          background: rgba(255,255,255,0.02);
        }
        .settings-row-danger {
          background: rgba(239,68,68,0.03);
        }
        .settings-row-danger:hover {
          background: rgba(239,68,68,0.06);
        }
        .settings-row-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          flex-shrink: 0;
        }
        .settings-row-danger .settings-row-icon {
          color: hsl(0, 72%, 55%);
        }
        .settings-row-info {
          flex: 1;
          min-width: 0;
        }
        .settings-row-label {
          font-weight: 600;
          font-size: 0.92rem;
          color: var(--text-primary);
        }
        .settings-row-desc {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin-top: 0.1rem;
          line-height: 1.35;
        }
        .settings-row-control {
          flex-shrink: 0;
        }

        /* Toggle Switch */
        .settings-toggle {
          position: relative;
          width: 46px;
          height: 26px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease;
          padding: 0;
        }
        .settings-toggle-off {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
        }
        .settings-toggle-on {
          background: var(--color-primary);
        }
        .settings-toggle-danger {
          background: hsl(0, 72%, 50%) !important;
        }
        .settings-toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .settings-toggle-on .settings-toggle-thumb {
          transform: translateX(20px);
        }

        /* Select */
        .settings-select {
          padding: 0.45rem 2rem 0.45rem 0.6rem;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.85rem;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          cursor: pointer;
        }

        /* Input */
        .settings-input {
          width: 80px;
          padding: 0.45rem 0.55rem;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.9rem;
          text-align: right;
          font-weight: 600;
        }
        .settings-input-wide {
          width: 220px;
          text-align: left;
          font-weight: 400;
        }
        .settings-unit {
          color: var(--text-secondary);
          font-size: 0.8rem;
          min-width: 36px;
        }

        /* Raw Settings */
        .settings-raw-details {
          margin-top: 2rem;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          overflow: hidden;
        }
        .settings-raw-summary {
          padding: 0.75rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
        }
        .settings-raw-summary:hover {
          color: var(--text-primary);
        }
        .settings-raw-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .settings-raw-table th {
          text-align: left;
          padding: 0.5rem;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .settings-raw-table td {
          padding: 0.4rem 0.5rem;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
        }
        .settings-raw-table tr:last-child td {
          border-bottom: none;
        }

        @media (max-width: 640px) {
          .settings-row {
            flex-wrap: wrap;
          }
          .settings-row-control {
            width: 100%;
            margin-top: 0.25rem;
          }
          .settings-input-wide {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
