"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { dedupFetch } from "@/lib/client/fetch-dedup";
import { ActionContextMenu } from "./ActionContextMenu";
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
  Check,
  X,
  FolderInput,
} from "lucide-react";
import { AdminUploadZone } from "./AdminUploadZone";
import { Breadcrumbs } from "./Breadcrumbs";
import { FolderCard } from "./FolderCard";
import { TrashView } from "./TrashView";
import { BookmarksPanel } from "@/components/bookmarks/BookmarksPanel";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { apiFetch, ApiError } from "@/lib/client/api";
import { toast } from "@/components/ui/Toast";
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
  initialFolders?: FolderWithStats[];
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

type TabKey = "files" | "trash" | "bookmarks";

export function FilesManager({ initialFiles, initialFolders, isAdmin }: FilesManagerProps) {
  // ─── State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("files");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "Home" },
  ]);

  const [files, setFiles] = useState<FileRow[]>(initialFiles);
  const [folders, setFolders] = useState<FolderWithStats[]>(initialFolders || []);
  const [loading, setLoading] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  // Track whether root data was hydrated from server (skip mount fetch)
  const hydratedRef = useRef(!!(initialFiles.length || initialFolders?.length));

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

  // Context menus
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);

  // ─── Multi-Select State ──────────────────────────────────────────
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const totalSelectedCount = selectedFiles.size + selectedFolders.size;
  const selectionMode = totalSelectedCount > 0;

  const toggleSelectFile = useCallback((id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectFolder = useCallback((id: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, []);

  // Bulk move state
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  // Deep-link support: /files?preview=<id> or ?folder=<id>
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const pid = sp.get("preview");
      if (pid) setPreviewFileId(pid);
      const fid = sp.get("folder");
      if (fid) setCurrentFolderId(fid);
    } catch {
      /* noop */
    }
  }, []);

  // ─── Data Loading ─────────────────────────────────────────────────

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const folderParam =
        currentFolderId === null ? "null" : currentFolderId;

      const [filesData, foldersData] = await Promise.all([
        dedupFetch<{ files: FileRow[] }>(
          `/api/files?folder_id=${folderParam}&status=active`,
          { signal }
        ),
        dedupFetch<{ folders: FolderWithStats[] }>(
          `/api/folders?parent_id=${folderParam}&status=active`,
          { signal }
        ),
      ]);

      setFiles(filesData.files || []);
      setFolders(foldersData.folders || []);

      // Load breadcrumbs if inside a folder
      if (currentFolderId) {
        const bcData = await dedupFetch<{ folder?: { breadcrumbs: BreadcrumbItem[] } }>(
          `/api/folders/${currentFolderId}`,
          { signal }
        );
        setBreadcrumbs(
          bcData.folder?.breadcrumbs || [{ id: null, name: "Home" }]
        );
      } else {
        setBreadcrumbs([{ id: null, name: "Home" }]);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // ignore other errors
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  const loadTrashCount = useCallback(async (signal?: AbortSignal) => {
    if (!isAdmin) return;
    try {
      const data = await dedupFetch<{ total: number }>("/api/trash", { signal });
      setTrashCount(data.total ?? 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    // If server already hydrated root data, skip the mount-time fetch
    if (hydratedRef.current && currentFolderId === null) {
      hydratedRef.current = false; // Next folder change will fetch normally
      // Still load trash count though
      const tc = new AbortController();
      loadTrashCount(tc.signal);
      return () => tc.abort();
    }

    const controller = new AbortController();
    loadData(controller.signal);
    loadTrashCount(controller.signal);
    return () => controller.abort();
  }, [loadData, loadTrashCount, currentFolderId]);

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
    clearSelection();
  };

  // Clear selection on tab change
  useEffect(() => {
    clearSelection();
  }, [activeTab, clearSelection]);

  // Escape key clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionMode) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionMode, clearSelection]);

  // ─── Action Handlers ─────────────────────────────────────────────

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;

    const endpoint =
      deleteTarget.type === "file"
        ? `/api/files/${deleteTarget.id}`
        : `/api/folders/${deleteTarget.id}`;

    try {
      await toast.promise(apiFetch(endpoint, { method: "DELETE" }), {
        loading: "Moving to trash…",
        success: "Moved to trash",
        error: (e) => (e instanceof Error ? e.message : "Couldn't move to trash"),
      });
      setDeleteTarget(null);
      loadData();
      loadTrashCount();
    } catch {
      // toast.promise already surfaced the error
    }
  };

  // ─── Bulk Action Handlers ───────────────────────────────────────────

  const handleBulkMove = async (destinationFolderId: string | null) => {
    setBulkLoading(true);
    try {
      const data = await apiFetch<{ message?: string }>(`/api/storage/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          fileIds: [...selectedFiles],
          folderIds: [...selectedFolders],
          destinationFolderId,
        }),
      });
      toast.success(data.message || "Items moved");
      clearSelection();
      loadData();
      loadTrashCount();
    } catch (err) {
      if (err instanceof ApiError && err.status === 207) {
        // Partial success: some items moved, some didn't
        const d = err.details as { message?: string } | undefined;
        toast.info("Partially completed", {
          description: d?.message || err.message,
        });
        clearSelection();
        loadData();
        loadTrashCount();
      } else {
        toast.error("Couldn't move items", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setBulkLoading(false);
      setBulkMoveOpen(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      const data = await apiFetch<{ message?: string }>(`/api/storage/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          fileIds: [...selectedFiles],
          folderIds: [...selectedFolders],
        }),
      });
      toast.success(data.message || "Items moved to trash");
      clearSelection();
      loadData();
      loadTrashCount();
    } catch (err) {
      if (err instanceof ApiError && err.status === 207) {
        const d = err.details as { message?: string } | undefined;
        toast.info("Partially completed", {
          description: d?.message || err.message,
        });
        clearSelection();
        loadData();
        loadTrashCount();
      } else {
        toast.error("Couldn't move items to trash", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setBulkLoading(false);
      setBulkDeleteOpen(false);
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

  // ─── Select All Visible Items ─────────────────────────────────────

  const selectAll = useCallback(() => {
    const allFileIds = new Set(filteredFiles.map((f) => f.id));
    const allFolderIds = new Set(filteredFolders.map((f) => f.id));

    // If all are already selected, deselect all
    const allSelected =
      allFileIds.size > 0 &&
      allFolderIds.size >= 0 &&
      [...allFileIds].every((id) => selectedFiles.has(id)) &&
      [...allFolderIds].every((id) => selectedFolders.has(id));

    if (allSelected) {
      clearSelection();
    } else {
      setSelectedFiles(allFileIds);
      setSelectedFolders(allFolderIds);
    }
  }, [filteredFiles, filteredFolders, selectedFiles, selectedFolders, clearSelection]);

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
      {/* Tab Switcher: Files / Trash / Bookmarks (Feature 8) */}
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
            { key: "bookmarks" as TabKey, label: "Bookmarks" },
            ...(isAdmin
              ? [
                  {
                    key: "trash" as TabKey,
                    label: `Trash${trashCount > 0 ? ` (${trashCount})` : ""}`,
                  },
                ]
              : []),
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
              border: "none",
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

      {/* Trash View Tab */}
      {activeTab === "trash" && isAdmin && (
        <TrashView
          onRefresh={() => {
            loadData();
            loadTrashCount();
          }}
        />
      )}

      {/* Bookmarks Tab */}
      {activeTab === "bookmarks" && <BookmarksPanel onPreview={setPreviewFileId} />}

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
                    {isAdmin && (
                      <div
                        className="file-col file-col-select"
                        style={{
                          width: "36px",
                          flex: "0 0 36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={selectAll}
                          aria-label="Select all items"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "var(--radius-sm)",
                            border:
                              filteredFiles.length > 0 &&
                              selectedFiles.size === filteredFiles.length &&
                              (filteredFolders.length === 0 ||
                                selectedFolders.size === filteredFolders.length)
                                ? "none"
                                : "1.5px solid var(--text-muted)",
                            background:
                              filteredFiles.length > 0 &&
                              selectedFiles.size === filteredFiles.length &&
                              (filteredFolders.length === 0 ||
                                selectedFolders.size === filteredFolders.length)
                                ? "var(--color-primary)"
                                : totalSelectedCount > 0
                                ? "var(--color-primary)"
                                : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          {filteredFiles.length > 0 &&
                          selectedFiles.size === filteredFiles.length &&
                          (filteredFolders.length === 0 ||
                            selectedFolders.size === filteredFolders.length) ? (
                            <Check size={12} color="#fff" strokeWidth={3} />
                          ) : totalSelectedCount > 0 ? (
                            <div
                              style={{
                                width: 8,
                                height: 2,
                                background: "#fff",
                                borderRadius: 1,
                              }}
                            />
                          ) : null}
                        </button>
                      </div>
                    )}
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
                      const isFolderSelected = selectedFolders.has(folder.id);

                      return (
                        <div
                          key={folder.id}
                          className={`file-list-row folder-row ${
                            isFolderSelected ? "selected-row" : ""
                          }`}
                          onClick={() => navigateToFolder(folder.id)}
                          role="button"
                          tabIndex={0}
                        >
                          {isAdmin && (
                            <div
                              className="file-col file-col-select"
                              style={{
                                width: "36px",
                                flex: "0 0 36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => toggleSelectFolder(folder.id)}
                                aria-label={
                                  isFolderSelected
                                    ? "Deselect folder"
                                    : "Select folder"
                                }
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "var(--radius-sm)",
                                  border: isFolderSelected
                                    ? "none"
                                    : "1.5px solid var(--text-muted)",
                                  background: isFolderSelected
                                    ? "var(--color-primary)"
                                    : "transparent",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {isFolderSelected && (
                                  <Check
                                    size={12}
                                    color="#fff"
                                    strokeWidth={3}
                                  />
                                )}
                              </button>
                            </div>
                          )}
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

                            {isAdmin && (
                              <FolderMenuTrigger
                                folder={folder}
                                folderMenuId={folderMenuId}
                                setFolderMenuId={setFolderMenuId}
                                onRename={() => {
                                  setFolderMenuId(null);
                                  setRenameTarget({
                                    type: "folder",
                                    id: folder.id,
                                    name: folder.name,
                                  });
                                }}
                                onMove={() => {
                                  setFolderMenuId(null);
                                  setMoveTarget({
                                    type: "folder",
                                    id: folder.id,
                                    name: folder.name,
                                    parentId: folder.parent_id,
                                  });
                                }}
                                onDelete={() => {
                                  setFolderMenuId(null);
                                  setDeleteTarget({
                                    type: "folder",
                                    id: folder.id,
                                    name: folder.name,
                                  });
                                }}
                                buttonClassName="list-action-btn"
                              />
                            )}
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
                      const isFileSelected = selectedFiles.has(file.id);

                      return (
                        <div
                          key={file.id}
                          className={`file-list-row file-row ${
                            isFileSelected ? "selected-row" : ""
                          }`}
                          onClick={() => setPreviewFileId(file.id)}
                          role="button"
                          tabIndex={0}
                        >
                          {isAdmin && (
                            <div
                              className="file-col file-col-select"
                              style={{
                                width: "36px",
                                flex: "0 0 36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => toggleSelectFile(file.id)}
                                aria-label={
                                  isFileSelected
                                    ? "Deselect file"
                                    : "Select file"
                                }
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "var(--radius-sm)",
                                  border: isFileSelected
                                    ? "none"
                                    : "1.5px solid var(--text-muted)",
                                  background: isFileSelected
                                    ? "var(--color-primary)"
                                    : "transparent",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {isFileSelected && (
                                  <Check
                                    size={12}
                                    color="#fff"
                                    strokeWidth={3}
                                  />
                                )}
                              </button>
                            </div>
                          )}
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
                            <BookmarkButton itemType="file" itemId={file.id} />
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
                              <FileMenuTrigger
                                file={file}
                                fileMenuId={fileMenuId}
                                setFileMenuId={setFileMenuId}
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
                                buttonClassName="list-action-btn"
                              />
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
                          "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                        gap: "var(--space-3)",
                      }}
                    >
                      {filteredFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          isAdmin={isAdmin}
                          onOpen={navigateToFolder}
                          selected={selectedFolders.has(folder.id)}
                          onToggleSelect={toggleSelectFolder}
                          selectionMode={selectionMode}
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
                            "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                          gap: "var(--space-4)",
                        }}
                      >
                        {filteredFiles.map((file) => {
                          const isFileSelected = selectedFiles.has(file.id);
                          const showCheckbox =
                            isAdmin && (selectionMode || isFileSelected);

                          return (
                            <div
                              key={file.id}
                              className="file-grid-card"
                              style={{
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                padding: "var(--space-4)",
                                borderRadius: "var(--radius-lg)",
                                backgroundColor: isFileSelected
                                  ? "rgba(99, 102, 241, 0.06)"
                                  : "var(--bg-card)",
                                backdropFilter: "blur(12px)",
                                border: `1px solid ${
                                  isFileSelected
                                    ? "var(--color-primary)"
                                    : "var(--border-subtle)"
                                }`,
                                transition:
                                  "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                                gap: "var(--space-3)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = isFileSelected
                                  ? "var(--color-primary)"
                                  : "var(--border-strong)";
                                e.currentTarget.style.transform =
                                  "translateY(-2px)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = isFileSelected
                                  ? "var(--color-primary)"
                                  : "var(--border-subtle)";
                                e.currentTarget.style.transform =
                                  "translateY(0)";
                              }}
                            >
                              {/* Selection checkbox */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectFile(file.id);
                                  }}
                                  className="file-card-checkbox"
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    left: 8,
                                    width: 20,
                                    height: 20,
                                    borderRadius: "var(--radius-sm)",
                                    border: isFileSelected
                                      ? "none"
                                      : "1.5px solid var(--text-muted)",
                                    background: isFileSelected
                                      ? "var(--color-primary)"
                                      : "rgba(255,255,255,0.06)",
                                    display: showCheckbox ? "flex" : "none",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    zIndex: 5,
                                    padding: 0,
                                  }}
                                  aria-label={
                                    isFileSelected
                                      ? "Deselect file"
                                      : "Select file"
                                  }
                                >
                                  {isFileSelected && (
                                    <Check
                                      size={13}
                                      color="#fff"
                                      strokeWidth={3}
                                    />
                                  )}
                                </button>
                              )}

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
                              <FileMenuTrigger
                                file={file}
                                fileMenuId={fileMenuId}
                                setFileMenuId={setFileMenuId}
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
                                buttonStyle={{
                                  padding: "4px",
                                  borderRadius: "var(--radius-sm)",
                                  color: "var(--text-muted)",
                                  transition: "background 0.15s ease",
                                }}
                              />
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
                              <BookmarkButton itemType="file" itemId={file.id} />
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
                      );
                    })}
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

      {/* Bulk Move Modal */}
      {bulkMoveOpen && (
        <MoveModal
          open={bulkMoveOpen}
          onClose={() => setBulkMoveOpen(false)}
          items={[
            ...[...selectedFiles].map((id) => ({
              id,
              type: "file" as const,
              name: filteredFiles.find((f) => f.id === id)?.name || "File",
            })),
            ...[...selectedFolders].map((id) => ({
              id,
              type: "folder" as const,
              name: filteredFolders.find((f) => f.id === id)?.name || "Folder",
            })),
          ]}
          onBulkMove={handleBulkMove}
          onMoved={() => {
            clearSelection();
            loadData();
          }}
        />
      )}

      {/* Bulk Delete Modal */}
      {bulkDeleteOpen && (
        <ConfirmDeleteModal
          open={bulkDeleteOpen}
          onClose={() => setBulkDeleteOpen(false)}
          title={`Move ${totalSelectedCount} items to Trash?`}
          message={`Are you sure you want to move ${totalSelectedCount} item${
            totalSelectedCount > 1 ? "s" : ""
          } (${selectedFiles.size} file${
            selectedFiles.size !== 1 ? "s" : ""
          }, ${selectedFolders.size} folder${
            selectedFolders.size !== 1 ? "s" : ""
          }) to the trash? You can restore them later.`}
          confirmLabel={bulkLoading ? "Moving to Trash..." : "Move to Trash"}
          onConfirm={handleBulkDelete}
        />
      )}

      {/* Floating Bulk Action Toolbar */}
      {isAdmin && totalSelectedCount > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 900,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 16px",
            borderRadius: "var(--radius-full, 9999px)",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(16px)",
            animation: "slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingRight: "8px",
              borderRight: "1px solid var(--border-subtle)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--color-primary)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              {totalSelectedCount}
            </span>
            <span>
              {totalSelectedCount === 1
                ? "1 item selected"
                : `${totalSelectedCount} items selected`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setBulkMoveOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(99, 102, 241, 0.12)",
              color: "var(--color-primary)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(99, 102, 241, 0.22)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(99, 102, 241, 0.12)";
            }}
          >
            <FolderInput size={14} />
            Move
          </button>

          <button
            type="button"
            onClick={() => setBulkDeleteOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "var(--color-danger, #ef4444)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(239, 68, 68, 0.22)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(239, 68, 68, 0.12)";
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>

          <button
            type="button"
            onClick={clearSelection}
            title="Clear selection (Esc)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "transparent",
              color: "var(--text-muted)",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-input)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <style jsx>{`
        .selected-row {
          background-color: rgba(99, 102, 241, 0.08) !important;
        }
        :global(.file-grid-card:hover .file-card-checkbox) {
          display: flex !important;
        }
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

// ─── File & Folder Context Menu Triggers ──────────────────────────────────────

function FileMenuTrigger({
  file,
  fileMenuId,
  setFileMenuId,
  onRename,
  onMove,
  onDelete,
  buttonClassName,
  buttonStyle,
}: {
  file: FileRow;
  fileMenuId: string | null;
  setFileMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
}) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const isOpen = fileMenuId === file.id;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        onClick={(e) => {
          e.stopPropagation();
          setFileMenuId(isOpen ? null : file.id);
        }}
        aria-label="File actions"
        aria-expanded={isOpen}
        style={buttonStyle}
        onMouseEnter={(e) => {
          if (!buttonClassName) {
            e.currentTarget.style.backgroundColor = "rgba(99,102,241,0.1)";
          }
        }}
        onMouseLeave={(e) => {
          if (!buttonClassName) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        <MoreVertical size={16} />
      </button>

      <ActionContextMenu
        isOpen={isOpen}
        onClose={() => setFileMenuId(null)}
        triggerRef={btnRef}
        title={file.display_name || file.name}
        subtitle={formatBytes(file.size_bytes)}
        icon={getFileIcon(file.name)}
        items={[
          {
            icon: <Pencil size={15} />,
            label: "Rename",
            action: onRename,
          },
          {
            icon: <ArrowRightLeft size={15} />,
            label: "Move",
            action: onMove,
          },
          {
            icon: <Trash2 size={15} />,
            label: "Move to Trash",
            action: onDelete,
            danger: true,
          },
        ]}
      />
    </>
  );
}

function FolderMenuTrigger({
  folder,
  folderMenuId,
  setFolderMenuId,
  onRename,
  onMove,
  onDelete,
  buttonClassName,
  buttonStyle,
}: {
  folder: FolderWithStats;
  folderMenuId: string | null;
  setFolderMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
}) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const isOpen = folderMenuId === folder.id;
  const folderColor = folder.color || "#6366f1";
  const totalItems = (folder.childFolderCount ?? 0) + (folder.childFileCount ?? 0);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        onClick={(e) => {
          e.stopPropagation();
          setFolderMenuId(isOpen ? null : folder.id);
        }}
        aria-label="Folder actions"
        aria-expanded={isOpen}
        style={buttonStyle}
        onMouseEnter={(e) => {
          if (!buttonClassName) {
            e.currentTarget.style.backgroundColor = "rgba(99,102,241,0.1)";
          }
        }}
        onMouseLeave={(e) => {
          if (!buttonClassName) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        <MoreVertical size={16} />
      </button>

      <ActionContextMenu
        isOpen={isOpen}
        onClose={() => setFolderMenuId(null)}
        triggerRef={btnRef}
        title={folder.name}
        subtitle={`${totalItems} item${totalItems !== 1 ? "s" : ""}`}
        icon={<FolderOpen size={18} style={{ color: folderColor }} />}
        items={[
          {
            icon: <Pencil size={15} />,
            label: "Rename",
            action: onRename,
          },
          {
            icon: <ArrowRightLeft size={15} />,
            label: "Move",
            action: onMove,
          },
          {
            icon: <Trash2 size={15} />,
            label: "Move to Trash",
            action: onDelete,
            danger: true,
          },
        ]}
      />
    </>
  );
}
