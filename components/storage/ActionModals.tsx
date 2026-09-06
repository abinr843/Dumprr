"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FolderPlus,
  Pencil,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  Folder,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ─── Modal Shell ─────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  maxWidth = "420px",
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth,
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
          animation: "slideUp 0.2s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {icon}
            <h2
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-input)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>{children}</div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Action Button ──────────────────────────────────────────────────

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  loading?: boolean;
  variant?: "primary" | "danger";
  disabled?: boolean;
}

function ActionButton({
  onClick,
  label,
  loading,
  variant = "primary",
  disabled,
}: ActionButtonProps) {
  const bg =
    variant === "danger" ? "var(--color-danger)" : "var(--color-primary)";
  const hoverBg =
    variant === "danger"
      ? "var(--color-danger-hover, #dc2626)"
      : "var(--color-primary-hover)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "10px 20px",
        borderRadius: "var(--radius-md)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: disabled ? "var(--text-muted)" : bg,
        transition: "background 0.15s ease, transform 0.1s ease",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        width: "100%",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = bg;
      }}
    >
      {loading && (
        <Loader2
          size={14}
          style={{ animation: "spin 1s linear infinite" }}
        />
      )}
      {label}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

// ─── Colour Picker Chips ─────────────────────────────────────────────

const FOLDER_COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Purple", value: "#a855f7" },
  { name: "Slate", value: "#64748b" },
];

function ColorPicker({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (color: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {FOLDER_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.name}
          onClick={() => onChange(c.value)}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            backgroundColor: c.value,
            border:
              selected === c.value
                ? "2px solid var(--text-primary)"
                : "2px solid transparent",
            outline:
              selected === c.value
                ? `2px solid ${c.value}`
                : "none",
            outlineOffset: "2px",
            cursor: "pointer",
            transition: "transform 0.1s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.15)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "scale(1)")
          }
        />
      ))}
    </div>
  );
}

// ─── Create Folder Modal ──────────────────────────────────────────────

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  currentFolderId: string | null;
  onCreated: () => void;
}

export function CreateFolderModal({
  open,
  onClose,
  currentFolderId,
  onCreated,
}: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parent_id: currentFolderId,
          color,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create folder");
        return;
      }

      setName("");
      setColor("#6366f1");
      onCreated();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Folder"
      icon={<FolderPlus size={20} style={{ color: "var(--color-primary)" }} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Folder Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Documents, Resources..."
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            Folder Colour
          </label>
          <ColorPicker selected={color} onChange={setColor} />
        </div>

        {error && (
          <p
            style={{
              color: "var(--color-danger)",
              fontSize: "var(--text-sm)",
            }}
          >
            {error}
          </p>
        )}

        <ActionButton
          onClick={handleCreate}
          label={loading ? "Creating..." : "Create Folder"}
          loading={loading}
        />
      </div>
    </Modal>
  );
}

// ─── Rename Modal ──────────────────────────────────────────────────────

interface RenameModalProps {
  open: boolean;
  onClose: () => void;
  itemType: "file" | "folder";
  itemId: string;
  currentName: string;
  onRenamed: () => void;
}

export function RenameModal({
  open,
  onClose,
  itemType,
  itemId,
  currentName,
  onRenamed,
}: RenameModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(currentName);
    setError("");
  }, [currentName, open]);

  const handleRename = async () => {
    if (!name.trim() || name.trim() === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint =
        itemType === "file"
          ? `/api/files/${itemId}`
          : `/api/folders/${itemId}`;

      const body =
        itemType === "file"
          ? { display_name: name.trim() }
          : { name: name.trim() };

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Rename failed");
        return;
      }

      onRenamed();
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rename ${itemType === "file" ? "File" : "Folder"}`}
      icon={<Pencil size={18} style={{ color: "var(--color-primary)" }} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          autoFocus
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            outline: "none",
          }}
        />

        {error && (
          <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
            {error}
          </p>
        )}

        <ActionButton
          onClick={handleRename}
          label={loading ? "Renaming..." : "Rename"}
          loading={loading}
          disabled={!name.trim() || name.trim() === currentName}
        />
      </div>
    </Modal>
  );
}

// ─── Move Modal ──────────────────────────────────────────────────────

interface MoveModalProps {
  open: boolean;
  onClose: () => void;
  itemType: "file" | "folder";
  itemId: string;
  itemName: string;
  currentParentId: string | null;
  onMoved: () => void;
}

export function MoveModal({
  open,
  onClose,
  itemType,
  itemId,
  itemName,
  currentParentId,
  onMoved,
}: MoveModalProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setError("");
      loadFolderTree();
    }
  }, [open]);

  const loadFolderTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetch("/api/folders?parent_id=null&status=active");
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTree(false);
    }
  };

  const handleMove = async () => {
    if (selectedId === currentParentId) {
      onClose();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint =
        itemType === "file"
          ? `/api/files/${itemId}`
          : `/api/folders/${itemId}`;

      const body =
        itemType === "file"
          ? { folder_id: selectedId }
          : { parent_id: selectedId };

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Move failed");
        return;
      }

      onMoved();
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move "${itemName}"`}
      icon={
        <ArrowRightLeft size={18} style={{ color: "var(--color-primary)" }} />
      }
      maxWidth="480px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Choose a destination folder:
        </p>

        {/* Root option */}
        <div
          style={{
            maxHeight: "280px",
            overflowY: "auto",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "10px 14px",
              fontSize: "var(--text-sm)",
              color: "var(--text-primary)",
              backgroundColor:
                selectedId === null
                  ? "rgba(99, 102, 241, 0.1)"
                  : "transparent",
              borderBottom: "1px solid var(--border-subtle)",
              transition: "background 0.1s ease",
              fontWeight: selectedId === null ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (selectedId !== null)
                e.currentTarget.style.backgroundColor = "var(--bg-input)";
            }}
            onMouseLeave={(e) => {
              if (selectedId !== null)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Folder size={16} style={{ color: "var(--text-muted)" }} />
            Root (No Folder)
          </button>

          {loadingTree && (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <Loader2
                size={20}
                style={{ animation: "spin 1s linear infinite", margin: "auto" }}
              />
            </div>
          )}

          {folders
            .filter((f) => f.id !== itemId) // Can't move into itself
            .map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedId(folder.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                  backgroundColor:
                    selectedId === folder.id
                      ? "rgba(99, 102, 241, 0.1)"
                      : "transparent",
                  borderBottom: "1px solid var(--border-subtle)",
                  transition: "background 0.1s ease",
                  fontWeight: selectedId === folder.id ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (selectedId !== folder.id)
                    e.currentTarget.style.backgroundColor = "var(--bg-input)";
                }}
                onMouseLeave={(e) => {
                  if (selectedId !== folder.id)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Folder
                  size={16}
                  style={{ color: folder.color || "#6366f1" }}
                  fill={`${folder.color || "#6366f1"}44`}
                />
                {folder.name}
              </button>
            ))}
        </div>

        {error && (
          <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
            {error}
          </p>
        )}

        <ActionButton
          onClick={handleMove}
          label={loading ? "Moving..." : "Move Here"}
          loading={loading}
        />
      </div>
    </Modal>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isPermanent?: boolean;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Move to Trash",
  isPermanent = false,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error is handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={
        isPermanent ? (
          <AlertTriangle
            size={20}
            style={{ color: "var(--color-danger)" }}
          />
        ) : (
          <Trash2 size={18} style={{ color: "var(--color-warning)" }} />
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--bg-card)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--bg-input)")
            }
          >
            Cancel
          </button>
          <div style={{ flex: 1 }}>
            <ActionButton
              onClick={handleConfirm}
              label={loading ? "Deleting..." : confirmLabel}
              loading={loading}
              variant={isPermanent ? "danger" : "primary"}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
