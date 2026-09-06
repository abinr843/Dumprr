"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Trash2,
  FileCheck,
  Loader2,
} from "lucide-react";
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  extractExtension,
  type AllowedExtension,
} from "@/lib/storage/file-validation";

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  progress: number;
  status: "queued" | "uploading" | "processing" | "completed" | "error" | "cancelled";
  errorMessage?: string;
  xhr?: XMLHttpRequest;
  uploadedData?: {
    id: string;
    storagePath: string;
  };
}

interface AdminUploadZoneProps {
  folderId?: string | null;
  onUploadSuccess?: (uploadedFile: any) => void;
}

/** Format bytes into human-readable size */
function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Get appropriate icon based on file extension */
function getFileIcon(filename: string) {
  const ext = extractExtension(filename);
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return <ImageIcon size={20} className="text-indigo-400" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet size={20} className="text-emerald-400" />;
  }
  if (["ppt", "pptx"].includes(ext)) {
    return <Presentation size={20} className="text-amber-400" />;
  }
  return <FileText size={20} className="text-blue-400" />;
}

export function AdminUploadZone({ folderId, onUploadSuccess }: AdminUploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Upload an individual file via XMLHttpRequest to enable progress tracking and abortability
   */
  const startUpload = useCallback(
    (item: UploadQueueItem) => {
      // 1. Client-side pre-validation
      const ext = extractExtension(item.file.name);
      if (item.file.size > MAX_FILE_SIZE_BYTES) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  errorMessage: `File exceeds 70 MB limit (${formatBytes(item.file.size)})`,
                }
              : q
          )
        );
        return;
      }

      if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  errorMessage: `Extension '.${ext || "unknown"}' not permitted`,
                }
              : q
          )
        );
        return;
      }

      // 2. Prepare FormData payload
      const formData = new FormData();
      formData.append("file", item.file);
      if (folderId) {
        formData.append("folder_id", folderId);
      }

      // 3. Create XMLHttpRequest
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload", true);

      // Track upload transmission progress (scale to 0% - 90%)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          if (event.loaded < event.total) {
            // Scale transmission progress to 1% - 90%
            const progressPercent = Math.max(
              1,
              Math.min(90, Math.round((event.loaded / event.total) * 90))
            );
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, progress: progressPercent, status: "uploading" }
                  : q
              )
            );
          } else {
            // Client bytes sent; server is now validating magic bytes & saving to Supabase storage
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, progress: 92, status: "processing" }
                  : q
              )
            );
          }
        }
      };

      // Handle successful response
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      progress: 100,
                      status: "completed",
                      uploadedData: res.file,
                    }
                  : q
              )
            );
            if (onUploadSuccess) {
              onUploadSuccess(res.file);
            }
          } catch {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: "error", errorMessage: "Invalid server response" }
                  : q
              )
            );
          }
        } else {
          let errorMsg = `Upload failed (${xhr.status})`;
          try {
            const errRes = JSON.parse(xhr.responseText);
            if (errRes.error) errorMsg = errRes.error;
          } catch {
            // Ignore parse errors
          }
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, status: "error", errorMessage: errorMsg } : q
            )
          );
        }
      };

      // Handle network error
      xhr.onerror = () => {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error", errorMessage: "Network error occurred" }
              : q
          )
        );
      };

      // Handle abort
      xhr.onabort = () => {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "cancelled", errorMessage: "Upload cancelled" } : q
          )
        );
      };

      // Update state with active XHR instance
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: "uploading", progress: 0, xhr, errorMessage: undefined }
            : q
        )
      );

      // Fire request
      xhr.send(formData);
    },
    [folderId, onUploadSuccess]
  );

  /**
   * Enqueues incoming files and triggers upload
   */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: UploadQueueItem[] = Array.from(files).map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        progress: 0,
        status: "queued",
      }));

      setQueue((prev) => [...prev, ...newItems]);

      // Automatically launch upload for newly added items
      newItems.forEach((item) => {
        startUpload(item);
      });
    },
    [startUpload]
  );

  // Drag-and-drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Cancel an active upload
  const handleCancel = (item: UploadQueueItem) => {
    if (item.xhr && (item.status === "uploading" || item.status === "processing")) {
      item.xhr.abort();
    }
  };

  // Retry an errored or cancelled upload
  const handleRetry = (item: UploadQueueItem) => {
    startUpload(item);
  };

  // Remove item from queue
  const handleRemove = (itemId: string) => {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === itemId);
      if (item?.xhr && (item.status === "uploading" || item.status === "processing")) {
        item.xhr.abort();
      }
      return prev.filter((q) => q.id !== itemId);
    });
  };

  // Clear completed uploads
  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((q) => q.status !== "completed"));
  };

  const completedCount = queue.filter((q) => q.status === "completed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-8) var(--space-6)",
          borderRadius: "var(--radius-xl)",
          border: isDragActive
            ? "2px dashed var(--color-primary)"
            : "2px dashed var(--border-strong)",
          backgroundColor: isDragActive
            ? "var(--bg-hover)"
            : "var(--bg-card)",
          backdropFilter: "blur(16px)",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: isDragActive
            ? "0 0 24px var(--color-primary-glow)"
            : "var(--shadow-sm)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = ""; // Reset input so same file can be re-selected if needed
            }
          }}
        />

        {/* Upload Icon with dynamic pulse */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-primary-glow)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-primary)",
            marginBottom: "var(--space-3)",
            transform: isDragActive ? "scale(1.1)" : "scale(1)",
            transition: "transform 0.2s ease",
          }}
        >
          <UploadCloud size={28} strokeWidth={2} />
        </div>

        <h3
          style={{
            fontSize: "var(--text-base)",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          {isDragActive ? "Drop files to begin upload" : "Drag & drop files here, or click to browse"}
        </h3>

        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            maxWidth: "460px",
            lineHeight: 1.5,
            marginBottom: "var(--space-4)",
          }}
        >
          Single-admin upload pipeline. Files are stored securely in a private bucket with
          binary integrity checks.
        </p>

        {/* Format Badges & Limit Indicators */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-1)",
            justifyContent: "center",
            maxWidth: "600px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(99, 102, 241, 0.12)",
              color: "var(--color-primary)",
              fontWeight: 600,
            }}
          >
            Max 70 MB
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            PDF
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            DOC / DOCX
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            PPT / PPTX
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            XLS / XLSX
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            TXT / CSV
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            JPG / PNG / WEBP / GIF
          </span>
        </div>
      </div>

      {/* Multi-File Upload Queue */}
      {queue.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            backgroundColor: "var(--bg-card)",
            backdropFilter: "blur(12px)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            padding: "var(--space-4)",
          }}
        >
          {/* Queue Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--space-2)",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Upload Queue ({queue.length})
            </span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleClearCompleted}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Trash2 size={13} />
                Clear {completedCount} completed
              </button>
            )}
          </div>

          {/* Queue Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  gap: "var(--space-2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      overflow: "hidden",
                    }}
                  >
                    {getFileIcon(item.name)}
                    <div style={{ overflow: "hidden" }}>
                      <p
                        style={{
                          fontSize: "var(--text-sm)",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "340px",
                        }}
                      >
                        {item.name}
                      </p>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Status Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    {item.status === "uploading" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            color: "var(--color-primary)",
                          }}
                        >
                          {item.progress}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancel(item)}
                          title="Cancel upload"
                          style={{
                            color: "var(--color-danger)",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}

                    {item.status === "processing" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "var(--color-primary)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                        }}
                      >
                        <Loader2
                          size={14}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                        <span>Verifying &amp; Saving...</span>
                        <button
                          type="button"
                          onClick={() => handleCancel(item)}
                          title="Cancel upload"
                          style={{
                            color: "var(--color-danger)",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                            marginLeft: "2px",
                          }}
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    )}

                    {item.status === "completed" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--color-success)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>Ready</span>
                      </div>
                    )}

                    {(item.status === "error" || item.status === "cancelled") && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => handleRetry(item)}
                          title="Retry upload"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            color: "var(--color-primary)",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--bg-input)",
                          }}
                        >
                          <RotateCcw size={12} />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          title="Remove"
                          style={{ color: "var(--text-muted)", padding: "2px" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar for In-Flight Upload & Processing */}
                {(item.status === "uploading" || item.status === "processing") && (
                  <div
                    style={{
                      height: "4px",
                      width: "100%",
                      backgroundColor: "var(--bg-input)",
                      borderRadius: "var(--radius-full)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: item.status === "processing" ? "93%" : `${item.progress}%`,
                        backgroundColor: "var(--color-primary)",
                        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        opacity: item.status === "processing" ? 0.85 : 1,
                      }}
                    />
                  </div>
                )}

                {/* Error message feedback */}
                {item.status === "error" && item.errorMessage && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-danger)",
                    }}
                  >
                    <AlertCircle size={13} />
                    <span>{item.errorMessage}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
