"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Download,
  Search,
  ArrowUpDown,
  FolderOpen,
  Calendar,
  HardDrive,
  FolderPlus,
  Trash2,
  MoreVertical,
  Pencil,
  ArrowRightLeft,
  Loader2,
  Eye,
  LayoutGrid,
  List,
  ChevronRight,
} from "lucide-react";
import { AdminUploadZone } from "./AdminUploadZone";
import { Breadcrumbs } from "./Breadcrumbs";
import { FolderCard } from "./FolderCard";
import { TrashView } from "./TrashView";
import { FilePreviewModal } from "./FilePreviewModal";
import {
  CreateFolderModal,
  RenameModal,
  MoveModal,
  ConfirmDeleteModal,
} from "./ActionModals";
import { extractExtension } from "@/lib/storage/file-validation";
import type { Database } from "@/types/database.types";
import type { BreadcrumbItem, FolderWithStats } from "@/types/storage";

type FileRow = Database["public"]["Tables"]["files"]["Row"];

interface FilesManagerProps {
  initialFiles: FileRow[];
  isAdmin: boolean;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  } catch {
    return dateStr;
  }
}

function getFileIcon(filename: string) {
  const ext = extractExtension(filename);
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return <ImageIcon size={22} className="text-indigo-400" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet size={22} className="text-emerald-400" />;
  }
  if (["ppt", "pptx"].includes(ext)) {
    return <Presentation size={22} className="text-amber-400" />;
  }
  return <FileText size={22} className="text-blue-400" />;
}

type TabKey = "files" | "trash";

export function FilesManager({ initialFiles, isAdmin }: FilesManagerProps) {
  // ─── State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("files");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "Home" },
  ]);

  const [files, setFiles] = useState<FileRow[]>(initialFiles);
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size" | "downloads">(
    "date"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dumpr-file-view-mode") as "grid" | "list" | null;
      if (saved === "grid" || saved === "list") {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("dumpr-file-view-mode", mode);
    } catch {}
  };

  // Modal state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  const [renameTarget, setRenameTarget] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
  } | null>(null);

  const [moveTarget, setMoveTarget] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
    parentId: string | null;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
  } | null>(null);

  // File context menu
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  // ─── Data Loading ─────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const folderParam =
        currentFolderId === null ? "null" : currentFolderId;

      const [filesRes, foldersRes] = await Promise.all([
        fetch(`/api/files?folder_id=${folderParam}&status=active`),
        fetch(`/api/folders?parent_id=${folderParam}&status=active`),
      ]);

      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files || []);
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }

      // Load breadcrumbs if inside a folder
      if (currentFolderId) {
        const bcRes = await fetch(`/api/folders/${currentFolderId}`);
        if (bcRes.ok) {
          const bcData = await bcRes.json();
          setBreadcrumbs(
            bcData.folder?.breadcrumbs || [{ id: null, name: "Home" }]
          );
        }
      } else {
        setBreadcrumbs([{ id: null, name: "Home" }]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  const loadTrashCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/trash");
      if (res.ok) {
        const data = await res.json();
        setTrashCount(data.total ?? 0);
      }
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
    loadTrashCount();
  }, [loadData, loadTrashCount]);

  // ─── Upload Handler ───────────────────────────────────────────────

  const handleUploadSuccess = (newFile: any) => {
    const fileRow: FileRow = {
      id: newFile.id,
      name: newFile.name,
      display_name: newFile.displayName || newFile.name,
      original_name: newFile.originalName || newFile.name,
      extension: newFile.extension,
      size_bytes: newFile.sizeBytes,
      storage_bucket: "dump-files",
      storage_path: newFile.storagePath,
      mime_type: newFile.mimeType || "application/octet-stream",
      status: newFile.status || "active",
      folder_id: currentFolderId,
      owner_id: "",
      uploaded_by: null,
      is_public: true,
      download_count: 0,
      deleted_at: null,
      metadata: {},
      created_at: newFile.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setFiles((prev) => [fileRow, ...prev.filter((f) => f.id !== fileRow.id)]);
  };

  // ─── Navigation ───────────────────────────────────────────────────

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery("");
  };

  // ─── Action Handlers ─────────────────────────────────────────────

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;

    const endpoint =
      deleteTarget.type === "file"
        ? `/api/files/${deleteTarget.id}`
        : `/api/folders/${deleteTarget.id}`;

    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      loadData();
      loadTrashCount();
    }
  };

  // ─── Filtered & Sorted Files ──────────────────────────────────────

  const filteredFiles = useMemo(() => {
    let result = files.filter((f) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const name = (f.display_name || f.name || "").toLowerCase();
      const orig = (f.original_name || "").toLowerCase();
      const ext = (f.extension || "").toLowerCase();
      return name.includes(q) || orig.includes(q) || ext.includes(q);
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "date") {
        comparison =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === "name") {
        comparison = (a.display_name || a.name).localeCompare(
          b.display_name || b.name
        );
      } else if (sortBy === "size") {
        comparison = b.size_bytes - a.size_bytes;
      } else if (sortBy === "downloads") {
        comparison = (b.download_count || 0) - (a.download_count || 0);
      }
      return sortOrder === "asc" ? -comparison : comparison;
    });

    return result;
  }, [files, searchQuery, sortBy, sortOrder]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase().trim();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const totalBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  }, [files]);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Admin Tab Switcher */}
      {isAdmin && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            width: "fit-content",
          }}
        >
          {(
            [
              { key: "files" as TabKey, label: "Files & Folders" },
              {
                key: "trash" as TabKey,
                label: `Trash${trashCount > 0 ? ` (${trashCount})` : ""}`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                fontWeight: activeTab === tab.key ? 600 : 400,
                color:
                  activeTab === tab.key
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                backgroundColor:
                  activeTab === tab.key
                    ? "var(--bg-elevated)"
                    : "transparent",
                boxShadow:
                  activeTab === tab.key
                    ? "0 1px 3px rgba(0,0,0,0.1)"
                    : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.key === "trash" && (
                <Trash2
                  size={14}
                  style={{ display: "inline", marginRight: "6px", verticalAlign: "-2px" }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Trash View Tab */}
      {activeTab === "trash" && isAdmin && (
        <TrashView
          onRefresh={() => {
            loadData();
            loadTrashCount();
          }}
        />
      )}

      {/* Files & Folders Tab */}
      {activeTab === "files" && (
        <>
          {/* Admin Upload Zone */}
          {isAdmin && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-3)",
                }}
              >
                <h2
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Upload Files
                </h2>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  Admin Storage Pipeline
                </span>
              </div>
              <AdminUploadZone
                onUploadSuccess={handleUploadSuccess}
                folderId={currentFolderId}
              />
            </section>
          )}

          {/* Breadcrumbs Navigation */}
          {(currentFolderId !== null || breadcrumbs.length > 1) && (
            <Breadcrumbs items={breadcrumbs} onNavigate={navigateToFolder} />
          )}

          {/* Controls Bar */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
              }}
            >
              {/* Search Box */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  backgroundColor: "var(--bg-input)",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  minWidth: "260px",
                  flex: 1,
                  maxWidth: "400px",
                }}
              >
                <Search size={16} style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    width: "100%",
                  }}
                />
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                }}
              >
                {/* New Folder (admin) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setCreateFolderOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      backgroundColor: "rgba(99, 102, 241, 0.1)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "rgba(99, 102, 241, 0.2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "rgba(99, 102, 241, 0.1)")
                    }
                  >
                    <FolderPlus size={16} />
                    New Folder
                  </button>
                )}

                {/* Stats */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  <HardDrive size={14} />
                  <span>
                    {folders.length} folder{folders.length !== 1 ? "s" : ""},{" "}
                    {files.length} file{files.length !== 1 ? "s" : ""} (
                    {formatBytes(totalBytes)})
                  </span>
                </div>

                {/* Sort Selector */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "var(--text-xs)",
                    backgroundColor: "var(--bg-input)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <ArrowUpDown size={13} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    style={{
                      background: "none",
                      border: "none",
                      outline: "none",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="downloads">Downloads</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setSortOrder((prev) =>
                        prev === "asc" ? "desc" : "asc"
                      )
                    }
                    style={{
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 600,
                      marginLeft: "4px",
                    }}
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </button>
                </div>

                {/* View Mode Switcher: Grid / List */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    backgroundColor: "var(--bg-input)",
                    padding: "3px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("grid")}
                    title="Grid view"
                    aria-label="Grid view"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "30px",
                      height: "28px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        viewMode === "grid" ? "var(--bg-surface)" : "transparent",
                      color:
                        viewMode === "grid"
                          ? "var(--color-primary)"
                          : "var(--text-muted)",
                      boxShadow:
                        viewMode === "grid" ? "var(--shadow-sm)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("list")}
                    title="List view"
                    aria-label="List view"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "30px",
                      height: "28px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        viewMode === "list" ? "var(--bg-surface)" : "transparent",
                      color:
                        viewMode === "list"
                          ? "var(--color-primary)"
                          : "var(--text-muted)",
                      boxShadow:
                        viewMode === "list" ? "var(--shadow-sm)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "var(--space-4)",
                }}
              >
                <Loader2
                  size={24}
                  style={{
                    animation: "spin 1s linear infinite",
                    color: "var(--color-primary)",
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Empty State */}
            {!loading &&
              filteredFiles.length === 0 &&
              filteredFolders.length === 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "var(--space-16) var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    gap: "var(--space-3)",
                    textAlign: "center",
                  }}
                >
                  <FolderOpen size={48} strokeWidth={1.2} />
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {searchQuery
                      ? `No items matching "${searchQuery}"`
                      : "This folder is empty."}
                  </p>
                  {isAdmin && !searchQuery && (
                    <p style={{ fontSize: "var(--text-xs)" }}>
                      Drop files into the upload zone above or create a new
                      folder to get started.
                    </p>
                  )}
                </div>
              )}

            {/* List View */}
            {!loading &&
              (filteredFiles.length > 0 || filteredFolders.length > 0) &&
              viewMode === "list" && (
                <div className="file-list-container">
                  <div className="file-list-header">
                    <div className="file-col file-col-name">Name</div>
                    <div className="file-col file-col-size">Size / Items</div>
                    <div className="file-col file-col-date">Date</div>
                    <div className="file-col file-col-actions">Actions</div>
                  </div>

                  <div className="file-list-body">
                    {/* Folder Rows */}
                    {filteredFolders.map((folder) => {
                      const folderColor = folder.color || "#6366f1";
                      const totalItems =
                        (folder.childFolderCount ?? 0) +
                        (folder.childFileCount ?? 0);

                      return (
                        <div
                          key={folder.id}
                          className="file-list-row folder-row"
                          onClick={() => navigateToFolder(folder.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="file-col file-col-name">
                            <div
                              className="list-icon-wrapper"
                              style={{ color: folderColor }}
                            >
                              <FolderOpen size={18} />
                            </div>
                            <span className="list-item-name">
                              {folder.name}
                            </span>
                          </div>

                          <div className="file-col file-col-size">
                            <span className="list-badge folder-badge">
                              {totalItems} item{totalItems !== 1 ? "s" : ""}
                            </span>
                          </div>

                          <div
                            className="file-col file-col-date"
                            suppressHydrationWarning
                          >
                            {formatDate(folder.updated_at || folder.created_at)}
                          </div>

                          <div
                            className="file-col file-col-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="list-action-btn"
                              onClick={() => navigateToFolder(folder.id)}
                              title="Open folder"
                              aria-label={`Open folder ${folder.name}`}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* File Rows */}
                    {filteredFiles.map((file) => {
                      const ext =
                        file.extension ||
                        extractExtension(file.name) ||
                        "FILE";

                      return (
                        <div
                          key={file.id}
                          className="file-list-row file-row"
                          onClick={() => setPreviewFileId(file.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="file-col file-col-name">
                            <div className="list-icon-wrapper">
                              {getFileIcon(file.name)}
                            </div>
                            <span
                              className="list-item-name"
                              title={file.display_name || file.name}
                            >
                              {file.display_name || file.name}
                            </span>
                            <span className="list-badge file-badge">
                              {ext.toUpperCase()}
                            </span>
                          </div>

                          <div className="file-col file-col-size">
                            {formatBytes(file.size_bytes)}
                          </div>

                          <div
                            className="file-col file-col-date"
                            suppressHydrationWarning
                          >
                            {formatDate(file.created_at)}
                          </div>

                          <div
                            className="file-col file-col-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="list-action-btn"
                              onClick={() => setPreviewFileId(file.id)}
                              title="Preview file"
                              aria-label={`Preview ${file.display_name || file.name}`}
                            >
                              <Eye size={15} />
                            </button>
                            <a
                              href={`/api/files/${file.id}/download`}
                              download={file.original_name || file.name}
                              className="list-action-btn primary"
                              title="Download file"
                              aria-label={`Download ${file.display_name || file.name}`}
                            >
                              <Download size={15} />
                            </a>

                            {isAdmin && (
                              <div style={{ position: "relative" }}>
                                <button
                                  type="button"
                                  className="list-action-btn"
                                  onClick={() =>
                                    setFileMenuId(
                                      fileMenuId === file.id ? null : file.id
                                    )
                                  }
                                  aria-label="File actions"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {fileMenuId === file.id && (
                                  <FileActionMenu
                                    file={file}
                                    onClose={() => setFileMenuId(null)}
                                    onRename={() => {
                                      setFileMenuId(null);
                                      setRenameTarget({
                                        type: "file",
                                        id: file.id,
                                        name:
                                          file.display_name || file.name,
                                      });
                                    }}
                                    onMove={() => {
                                      setFileMenuId(null);
                                      setMoveTarget({
                                        type: "file",
                                        id: file.id,
                                        name:
                                          file.display_name || file.name,
                                        parentId: file.folder_id,
                                      });
                                    }}
                                    onDelete={() => {
                                      setFileMenuId(null);
                                      setDeleteTarget({
                                        type: "file",
                                        id: file.id,
                                        name:
                                          file.display_name || file.name,
                                      });
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Grid View */}
            {!loading &&
              (filteredFiles.length > 0 || filteredFolders.length > 0) &&
              viewMode === "grid" && (
                <>
                  {/* Folders Grid */}
                  {filteredFolders.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: "var(--space-3)",
                      }}
                    >
                      {filteredFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          isAdmin={isAdmin}
                          onOpen={navigateToFolder}
                          onRename={(f) =>
                            setRenameTarget({
                              type: "folder",
                              id: f.id,
                              name: f.name,
                            })
                          }
                          onMove={(f) =>
                            setMoveTarget({
                              type: "folder",
                              id: f.id,
                              name: f.name,
                              parentId: f.parent_id,
                            })
                          }
                          onDelete={(f) =>
                            setDeleteTarget({
                              type: "folder",
                              id: f.id,
                              name: f.name,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Files Grid */}
                  {filteredFiles.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: "var(--space-4)",
                      }}
                    >
                      {filteredFiles.map((file) => (
                        <div
                          key={file.id}
                          style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            padding: "var(--space-4)",
                            borderRadius: "var(--radius-lg)",
                            backgroundColor: "var(--bg-card)",
                            backdropFilter: "blur(12px)",
                            border: "1px solid var(--border-subtle)",
                            transition:
                              "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                            gap: "var(--space-3)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor =
                              "var(--border-strong)";
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor =
                              "var(--border-subtle)";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          {/* Header: Icon + Title + Extension Badge */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "var(--space-3)",
                            }}
                          >
                            <div
                              style={{
                                padding: "8px",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: "var(--bg-input)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {getFileIcon(file.name)}
                            </div>

                            <div style={{ overflow: "hidden", flex: 1 }}>
                              <h3
                                title={file.display_name || file.name}
                                style={{
                                  fontSize: "var(--text-sm)",
                                  fontWeight: 600,
                                  color: "var(--text-primary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  marginBottom: "2px",
                                }}
                              >
                                {file.display_name || file.name}
                              </h3>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    padding: "1px 6px",
                                    borderRadius: "var(--radius-sm)",
                                    backgroundColor:
                                      "rgba(99, 102, 241, 0.1)",
                                    color: "var(--color-primary)",
                                  }}
                                >
                                  {file.extension ||
                                    extractExtension(file.name) ||
                                    "FILE"}
                                </span>
                                <span
                                  style={{
                                    fontSize: "var(--text-xs)",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {formatBytes(file.size_bytes)}
                                </span>
                              </div>
                            </div>

                            {/* Admin file action menu */}
                            {isAdmin && (
                              <div
                                style={{
                                  position: "relative",
                                  flexShrink: 0,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFileMenuId(
                                      fileMenuId === file.id
                                        ? null
                                        : file.id
                                    );
                                  }}
                                  style={{
                                    padding: "4px",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-muted)",
                                    transition: "background 0.15s ease",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(99,102,241,0.1)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                  aria-label="File actions"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {fileMenuId === file.id && (
                                  <FileActionMenu
                                    file={file}
                                    onClose={() => setFileMenuId(null)}
                                    onRename={() => {
                                      setFileMenuId(null);
                                      setRenameTarget({
                                        type: "file",
                                        id: file.id,
                                        name:
                                          file.display_name || file.name,
                                      });
                                    }}
                                    onMove={() => {
                                      setFileMenuId(null);
                                      setMoveTarget({
                                        type: "file",
                                        id: file.id,
                                        name:
                                          file.display_name || file.name,
                                        parentId: file.folder_id,
                                      });
                                    }}
                                    onDelete={() => {
                                      setFileMenuId(null);
                                      setDeleteTarget({
                                        type: "file",
                                        id: file.id,
                                        name:
                                          file.display_name || file.name,
                                      });
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer: Metadata + Download */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingTop: "var(--space-2)",
                              borderTop: "1px solid var(--border-subtle)",
                              fontSize: "var(--text-xs)",
                              color: "var(--text-muted)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Calendar size={12} />
                              <span suppressHydrationWarning>
                                {formatDate(file.created_at)}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setPreviewFileId(file.id)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "var(--text-xs)",
                                  fontWeight: 500,
                                  color: "var(--text-secondary)",
                                  backgroundColor: "var(--bg-input)",
                                  padding: "4px 8px",
                                  borderRadius: "var(--radius-md)",
                                  border: "1px solid var(--border-subtle)",
                                  cursor: "pointer",
                                }}
                                title="Preview file"
                              >
                                <Eye size={12} />
                                <span>Preview</span>
                              </button>
                              <a
                                href={`/api/files/${file.id}/download`}
                                download={file.original_name || file.name}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "var(--text-xs)",
                                  fontWeight: 600,
                                  color: "var(--color-primary)",
                                  backgroundColor:
                                    "rgba(99, 102, 241, 0.1)",
                                  padding: "4px 10px",
                                  borderRadius: "var(--radius-md)",
                                  transition:
                                    "background-color 0.15s ease",
                                  textDecoration: "none",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor =
                                    "rgba(99, 102, 241, 0.2)")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor =
                                    "rgba(99, 102, 241, 0.1)")
                                }
                              >
                                <Download size={13} />
                                <span>Download</span>
                                {file.download_count > 0 && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      opacity: 0.8,
                                    }}
                                  >
                                    ({file.download_count})
                                  </span>
                                )}
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
          </section>
        </>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────── */}

      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        currentFolderId={currentFolderId}
        onCreated={() => loadData()}
      />

      {renameTarget && (
        <RenameModal
          open={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          itemType={renameTarget.type}
          itemId={renameTarget.id}
          currentName={renameTarget.name}
          onRenamed={() => loadData()}
        />
      )}

      {moveTarget && (
        <MoveModal
          open={!!moveTarget}
          onClose={() => setMoveTarget(null)}
          itemType={moveTarget.type}
          itemId={moveTarget.id}
          itemName={moveTarget.name}
          currentParentId={moveTarget.parentId}
          onMoved={() => loadData()}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title={`Delete ${
            deleteTarget.type === "file" ? "File" : "Folder"
          }`}
          message={
            deleteTarget.type === "folder"
              ? `"${deleteTarget.name}" and all its contents will be moved to Trash. Items in trash are permanently deleted after 7 days.`
              : `"${deleteTarget.name}" will be moved to Trash. Items in trash are permanently deleted after 7 days.`
          }
          confirmLabel="Move to Trash"
          onConfirm={handleDeleteItem}
        />
      )}

      {previewFileId && (
        <FilePreviewModal
          fileId={previewFileId}
          onClose={() => setPreviewFileId(null)}
        />
      )}

      <style jsx>{`
        .file-list-container {
          border-radius: var(--radius-lg);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .file-list-header {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          background: var(--bg-input);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .file-list-body {
          display: flex;
          flex-direction: column;
        }
        .file-list-row {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
          font-size: var(--text-sm);
          outline: none;
        }
        .file-list-row:last-child {
          border-bottom: none;
        }
        .file-list-row:hover,
        .file-list-row:focus-visible {
          background: var(--bg-hover);
        }
        .file-col-name {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .list-item-name {
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .file-col-size {
          width: 140px;
          color: var(--text-muted);
          font-size: var(--text-xs);
          flex-shrink: 0;
        }
        .file-col-date {
          width: 140px;
          color: var(--text-muted);
          font-size: var(--text-xs);
          flex-shrink: 0;
        }
        .file-col-actions {
          width: 120px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }
        .list-action-btn {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
        }
        .list-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }
        .list-action-btn.primary {
          background: rgba(99, 102, 241, 0.1);
          border-color: transparent;
          color: var(--color-primary);
        }
        .list-action-btn.primary:hover {
          background: var(--color-primary);
          color: #ffffff;
        }
        .list-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .list-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }
        .file-badge {
          background: rgba(99, 102, 241, 0.1);
          color: var(--color-primary);
        }
        .folder-badge {
          background: rgba(100, 116, 139, 0.12);
          color: var(--text-secondary);
        }

        @media (max-width: 640px) {
          .file-col-size,
          .file-col-date {
            display: none;
          }
          .file-list-row {
            padding: 10px 12px;
          }
          .list-action-btn {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </div>
  );
}

// ─── File Action Menu ──────────────────────────────────────────────────

function FileActionMenu({
  file,
  onClose,
  onRename,
  onMove,
  onDelete,
}: {
  file: FileRow;
  onClose: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        zIndex: 50,
        minWidth: "140px",
        marginTop: "4px",
        padding: "4px",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      {[
        { icon: <Pencil size={13} />, label: "Rename", action: onRename },
        {
          icon: <ArrowRightLeft size={13} />,
          label: "Move",
          action: onMove,
        },
        {
          icon: <Trash2 size={13} />,
          label: "Delete",
          action: onDelete,
          danger: true,
        },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            item.action();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "7px 10px",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            color: (item as any).danger
              ? "var(--color-danger)"
              : "var(--text-primary)",
            transition: "background 0.1s ease",
            textAlign: "left",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-input)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
