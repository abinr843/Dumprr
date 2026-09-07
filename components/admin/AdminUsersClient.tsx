"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Loader2,
  Trash2,
  Ban,
  CheckCircle2,
  Key,
  AlertTriangle,
  ArrowLeft,
  Mail,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

interface UserInfo {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string;
  storage_used_bytes: number;
  disabled: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export function AdminUsersClient() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [maxUsers, setMaxUsers] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"member" | "viewer">("member");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setMaxUsers(data.maxUsers || 20);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch users");
        }
        const data = await res.json();
        if (active) {
          setUsers(data.users || []);
          setTotal(data.total || 0);
          setMaxUsers(data.maxUsers || 20);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to fetch users");
          setLoading(false);
        }
      }
    }
    init();
    return () => { active = false; };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("create");
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          full_name: newFullName || undefined,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setSuccessMsg(`User ${newEmail} created successfully`);
      setShowCreateForm(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("member");
      fetchUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (userId: string, action: string, label: string) => {
    if (!confirm(`Are you sure you want to ${label} this user?`)) return;
    setActionLoading(userId);
    setError(null);
    try {
      let res: Response;
      if (action === "delete") {
        res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${label} user`);
      setSuccessMsg(data.message || `User ${label} successful`);
      fetchUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${label} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Never";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatBytes = (b: number) => {
    if (b === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return <Badge variant="primary"><ShieldCheck size={12} className="mr-1" /> Super Admin</Badge>;
      case "admin":
        return <Badge variant="warning"><Shield size={12} className="mr-1" /> Admin</Badge>;
      case "member":
        return <Badge variant="success">Member</Badge>;
      default:
        return <Badge variant="default">Viewer</Badge>;
    }
  };

  return (
    <div className="admin-users-page" style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/admin" style={{ color: "var(--color-text-secondary)", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              <Users size={22} style={{ display: "inline", marginRight: "0.5rem", verticalAlign: "middle" }} />
              User Management
            </h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
              {total} of {maxUsers} users · Manage roles, access, and accounts
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={fetchUsers} disabled={loading} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)", color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.85rem" }}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} disabled={total >= maxUsers} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "none", background: total >= maxUsers ? "var(--color-border)" : "var(--color-accent)", color: total >= maxUsers ? "var(--color-text-secondary)" : "#fff", cursor: total >= maxUsers ? "not-allowed" : "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
            <Plus size={14} /> New User
          </button>
        </div>
      </div>

      {/* Success / Error */}
      {successMsg && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "var(--color-success, #22c55e)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}
      {error && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--color-error, #ef4444)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Capacity warning */}
      {total >= maxUsers && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "var(--color-warning, #f59e0b)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <AlertTriangle size={16} /> User limit reached ({total}/{maxUsers}). Delete users or increase the cap in Settings to add more.
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div style={{ padding: "1.5rem", marginBottom: "1.5rem", borderRadius: 12, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Create New User</h3>
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-secondary)", marginBottom: "0.3rem" }}>Email *</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-primary)", color: "var(--color-text-primary)", fontSize: "0.9rem" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-secondary)", marginBottom: "0.3rem" }}>Password *</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-primary)", color: "var(--color-text-primary)", fontSize: "0.9rem" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-secondary)", marginBottom: "0.3rem" }}>Full Name</label>
              <input type="text" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-primary)", color: "var(--color-text-primary)", fontSize: "0.9rem" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-secondary)", marginBottom: "0.3rem" }}>Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as "member" | "viewer")} style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-primary)", color: "var(--color-text-primary)", fontSize: "0.9rem" }}>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowCreateForm(false)} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={actionLoading === "create"} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#fff", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {actionLoading === "create" ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>
          <Loader2 size={24} className="spin" style={{ margin: "0 auto 0.5rem" }} />
          <p>Loading users...</p>
        </div>
      ) : (
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>User</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>Role</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>Storage</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>Last Sign In</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isRoot = u.role === "superadmin" || u.role === "admin";
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)", opacity: u.disabled ? 0.6 : 1 }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontWeight: 500, color: "var(--color-text-primary)", fontSize: "0.9rem" }}>{u.full_name || u.username || "—"}</div>
                      <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}><Mail size={12} /> {u.email}</div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>{getRoleBadge(u.role)}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {u.disabled
                        ? <Badge variant="danger">Disabled</Badge>
                        : <Badge variant="success">Active</Badge>}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>{formatBytes(u.storage_used_bytes)}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Clock size={12} /> {formatDate(u.last_sign_in_at)}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                        {!isRoot && !u.disabled && (
                          <button onClick={() => handleAction(u.id, "disable", "disable")} disabled={actionLoading === u.id} title="Disable user" style={{ padding: "0.4rem", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-warning, #f59e0b)", cursor: "pointer" }}>
                            {actionLoading === u.id ? <Loader2 size={14} className="spin" /> : <Ban size={14} />}
                          </button>
                        )}
                        {!isRoot && u.disabled && (
                          <button onClick={() => handleAction(u.id, "enable", "enable")} disabled={actionLoading === u.id} title="Enable user" style={{ padding: "0.4rem", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-success, #22c55e)", cursor: "pointer" }}>
                            {actionLoading === u.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                          </button>
                        )}
                        {!isRoot && (
                          <button onClick={() => handleAction(u.id, "reset_access", "reset access for")} disabled={actionLoading === u.id} title="Reset password" style={{ padding: "0.4rem", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-accent)", cursor: "pointer" }}>
                            <Key size={14} />
                          </button>
                        )}
                        {!isRoot && (
                          <button onClick={() => handleAction(u.id, "delete", "permanently delete")} disabled={actionLoading === u.id} title="Delete user" style={{ padding: "0.4rem", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-error, #ef4444)", cursor: "pointer" }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                        {isRoot && (
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", padding: "0.4rem" }}>Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
