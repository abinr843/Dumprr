"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  Folder,
  Lock,
  Compass,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export interface RawAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function formatAuditTimestamp(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { time: "-", date: "-" };

  const pad = (n: number) => n.toString().padStart(2, "0");
  const h = d.getHours();
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = pad(h % 12 || 12);
  const time = `${displayH}:${m}:${s} ${ampm}`;

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const date = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return { time, date };
}

interface AuditLogViewerProps {
  initialLogs: RawAuditLog[];
}

export function AuditLogViewer({ initialLogs }: AuditLogViewerProps) {
  const [logs] = useState<RawAuditLog[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Compute stats
  const stats = useMemo(() => {
    let successCount = 0;
    let failedCount = 0;
    let securityCount = 0;

    for (const log of logs) {
      const meta = log.metadata || {};
      const result = (meta.result as string) || "SUCCESS";
      if (result === "FAILED") {
        failedCount++;
      } else {
        successCount++;
      }
      if (log.action.startsWith("security.") || log.entity_type === "security") {
        securityCount++;
      }
    }

    return {
      total: logs.length,
      successCount,
      failedCount,
      securityCount,
    };
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const meta = log.metadata || {};
      const result = ((meta.result as string) || "SUCCESS").toUpperCase();

      // Result filter
      if (resultFilter !== "ALL" && result !== resultFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "ALL") {
        if (categoryFilter === "security") {
          if (!log.action.startsWith("security.") && log.entity_type !== "security") return false;
        } else if (categoryFilter === "file") {
          if (!log.action.startsWith("file.") && log.entity_type !== "file") return false;
        } else if (categoryFilter === "folder") {
          if (!log.action.startsWith("folder.") && log.entity_type !== "folder") return false;
        } else if (categoryFilter === "post") {
          if (!log.action.startsWith("post.") && log.entity_type !== "post") return false;
        } else if (categoryFilter === "auth") {
          if (!log.action.startsWith("auth.") && log.entity_type !== "auth") return false;
        } else if (categoryFilter === "trash") {
          if (!log.action.startsWith("trash.") && log.entity_type !== "trash") return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const targetName = (meta.target_name as string) || (meta.fileName as string) || (meta.postTitle as string) || "";
        const action = log.action.toLowerCase();
        const ip = log.ip_address?.toLowerCase() || "";
        const actor = log.actor_id?.toLowerCase() || "";
        const email = (meta.email as string)?.toLowerCase() || "";

        if (
          !action.includes(q) &&
          !targetName.toLowerCase().includes(q) &&
          !ip.includes(q) &&
          !actor.includes(q) &&
          !email.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [logs, resultFilter, categoryFilter, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getActionBadge = (action: string, result: string) => {
    if (result === "FAILED" || action.startsWith("security.") || action.includes("rejected")) {
      return <Badge variant="danger">{action}</Badge>;
    }
    if (action.includes("deleted") || action.includes("revoked")) {
      return <Badge variant="warning">{action}</Badge>;
    }
    if (action.includes("created") || action.includes("completed") || action.includes("success")) {
      return <Badge variant="success">{action}</Badge>;
    }
    return <Badge variant="primary">{action}</Badge>;
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "file":
        return <FileText size={15} style={{ color: "var(--color-primary)" }} />;
      case "folder":
        return <Folder size={15} style={{ color: "#f59e0b" }} />;
      case "post":
        return <Compass size={15} style={{ color: "#8b5cf6" }} />;
      case "auth":
      case "security":
        return <Lock size={15} style={{ color: "#ef4444" }} />;
      case "trash":
        return <Trash2 size={15} style={{ color: "#64748b" }} />;
      default:
        return <ShieldCheck size={15} style={{ color: "var(--text-secondary)" }} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Stats Overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card>
          <div style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>
              Total Logged Events
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-1)" }}>
              {stats.total}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "#10b981", fontWeight: 500 }}>
              Successful Actions
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-1)", color: "#10b981" }}>
              {stats.successCount}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "#ef4444", fontWeight: 500 }}>
              Failed / Rejected Attempts
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-1)", color: "#ef4444" }}>
              {stats.failedCount}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "#8b5cf6", fontWeight: 500 }}>
              Security Incidents
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-1)", color: "#8b5cf6" }}>
              {stats.securityCount}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div
          style={{
            padding: "var(--space-4)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              background: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "6px 12px",
              minWidth: "260px",
              flex: "1 1 260px",
            }}
          >
            <Search size={16} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search action, target, IP, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                width: "100%",
              }}
            />
          </div>

          {/* Result Filter Tabs */}
          <div style={{ display: "flex", gap: "var(--space-1)", background: "var(--bg-input)", padding: "3px", borderRadius: "var(--radius-md)" }}>
            {(["ALL", "SUCCESS", "FAILED"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResultFilter(r)}
                style={{
                  border: "none",
                  background: resultFilter === r ? "var(--bg-card)" : "transparent",
                  color: resultFilter === r ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: resultFilter === r ? 600 : 400,
                  fontSize: "var(--text-xs)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  boxShadow: resultFilter === r ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {r === "ALL" ? "All Results" : r === "SUCCESS" ? "✓ Success" : "✕ Failed"}
              </button>
            ))}
          </div>

          {/* Category Dropdown/Pills */}
          <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
            {[
              { key: "ALL", label: "All" },
              { key: "security", label: "Security" },
              { key: "file", label: "Files" },
              { key: "post", label: "Posts" },
              { key: "folder", label: "Folders" },
              { key: "auth", label: "Auth" },
              { key: "trash", label: "Trash" },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key)}
                style={{
                  border: "1px solid",
                  borderColor: categoryFilter === cat.key ? "var(--color-primary)" : "var(--border-color)",
                  background: categoryFilter === cat.key ? "var(--color-primary-glow)" : "transparent",
                  color: categoryFilter === cat.key ? "var(--color-primary)" : "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Log Events List */}
      <Card>
        {filteredLogs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-16) 0",
              color: "var(--text-muted)",
              gap: "var(--space-3)",
            }}
          >
            <ShieldCheck size={48} strokeWidth={1.2} />
            <p style={{ fontSize: "var(--text-sm)" }}>
              {logs.length === 0
                ? "No audit events recorded yet. Platform activity will appear here automatically."
                : "No audit events match your selected filters."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "var(--text-sm)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    background: "var(--bg-input)",
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-xs)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <th style={{ padding: "12px 16px", width: "40px" }}></th>
                  <th style={{ padding: "12px 16px" }}>Timestamp</th>
                  <th style={{ padding: "12px 16px" }}>Action</th>
                  <th style={{ padding: "12px 16px" }}>Result</th>
                  <th style={{ padding: "12px 16px" }}>Target</th>
                  <th style={{ padding: "12px 16px" }}>Actor / IP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const meta = log.metadata || {};
                  const result = ((meta.result as string) || "SUCCESS").toUpperCase();
                  const isExpanded = expandedId === log.id;
                  const { time: timeFormatted, date: dateFormatted } = formatAuditTimestamp(log.created_at);

                  const targetName =
                    (meta.target_name as string) ||
                    (meta.fileName as string) ||
                    (meta.postTitle as string) ||
                    log.entity_id ||
                    "-";

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                          background: isExpanded ? "var(--bg-input)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 500 }} suppressHydrationWarning>{timeFormatted}</div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }} suppressHydrationWarning>
                            {dateFormatted}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {getActionBadge(log.action, result)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {result === "SUCCESS" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                              <CheckCircle2 size={14} /> SUCCESS
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#ef4444", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                              <XCircle size={14} /> FAILED
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {getEntityIcon(log.entity_type)}
                            <span style={{ fontWeight: 500, maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {targetName}
                            </span>
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "21px" }}>
                            {log.entity_type}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: "var(--text-xs)", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                            {log.ip_address || "unknown IP"}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                            {log.actor_id ? `User: ${log.actor_id.slice(0, 8)}...` : (meta.email as string) || "Anonymous"}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Metadata Row */}
                      {isExpanded && (
                        <tr style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-color)" }}>
                          <td colSpan={6} style={{ padding: "16px 24px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
                                Event Details & Metadata
                              </div>
                              <pre
                                style={{
                                  background: "var(--bg-card)",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "var(--radius-sm)",
                                  padding: "12px",
                                  fontSize: "var(--text-xs)",
                                  fontFamily: "monospace",
                                  overflowX: "auto",
                                  color: "var(--text-primary)",
                                  margin: 0,
                                }}
                              >
                                {JSON.stringify(
                                  {
                                    id: log.id,
                                    actor_id: log.actor_id,
                                    action: log.action,
                                    entity_type: log.entity_type,
                                    entity_id: log.entity_id,
                                    ip_address: log.ip_address,
                                    user_agent: log.user_agent,
                                    metadata: log.metadata,
                                    created_at: log.created_at,
                                  },
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
