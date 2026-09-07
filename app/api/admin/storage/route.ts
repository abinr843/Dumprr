import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAdminApi } from "@/lib/permissions/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Storage thresholds in bytes (based on 8 GB cap) */
const DEFAULT_STORAGE_CAP = 8 * 1024 * 1024 * 1024; // 8 GB

interface StorageThreshold {
  level: "normal" | "warning" | "critical" | "emergency" | "blocked";
  label: string;
  thresholdBytes: number;
  thresholdPercent: number;
}

function getStorageStatus(usedBytes: number, capBytes: number): StorageThreshold {
  const percent = capBytes > 0 ? (usedBytes / capBytes) * 100 : 0;

  if (percent >= 100) {
    return { level: "blocked", label: "Storage Full — Uploads Blocked", thresholdBytes: capBytes, thresholdPercent: 100 };
  }
  if (usedBytes >= capBytes * 0.9375) { // 7.5 GB of 8 GB
    return { level: "emergency", label: "Emergency — Storage Almost Full", thresholdBytes: Math.floor(capBytes * 0.9375), thresholdPercent: 93.75 };
  }
  if (usedBytes >= capBytes * 0.875) { // 7 GB of 8 GB
    return { level: "critical", label: "Critical — Running Low on Storage", thresholdBytes: Math.floor(capBytes * 0.875), thresholdPercent: 87.5 };
  }
  if (usedBytes >= capBytes * 0.75) { // 6 GB of 8 GB
    return { level: "warning", label: "Warning — Storage Usage High", thresholdBytes: Math.floor(capBytes * 0.75), thresholdPercent: 75 };
  }
  return { level: "normal", label: "Normal", thresholdBytes: 0, thresholdPercent: 0 };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * GET /api/admin/storage
 * Returns detailed storage usage, thresholds, category breakdown, and top files.
 */
export async function GET(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "GET /api/admin/storage");
  if (guard.error) return guard.error;

  const admin = createAdminClient();

  // Get storage cap from settings
  let storageCap = DEFAULT_STORAGE_CAP;
  const { data: capSetting } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", "storage.storage_cap_bytes")
    .single();
  if (capSetting?.value) {
    const parsed = parseInt(String(capSetting.value), 10);
    if (!isNaN(parsed) && parsed > 0) storageCap = parsed;
  }

  // Fetch all active files with size and mime info
  const [activeResult, trashedResult, topFilesResult] = await Promise.all([
    admin
      .from("files")
      .select("size_bytes, mime_type")
      .eq("status", "active")
      .is("deleted_at", null),
    admin
      .from("files")
      .select("size_bytes")
      .eq("status", "trash"),
    admin
      .from("files")
      .select("id, display_name, original_name, name, extension, size_bytes, mime_type, created_at")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("size_bytes", { ascending: false })
      .limit(10),
  ]);

  const activeFiles = activeResult.data || [];
  const trashedFiles = trashedResult.data || [];

  // Calculate total usage
  const totalUsedBytes = activeFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);
  const trashBytes = trashedFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);

  // Category breakdown
  const categories: Record<string, { count: number; bytes: number }> = {
    images: { count: 0, bytes: 0 },
    documents: { count: 0, bytes: 0 },
    videos: { count: 0, bytes: 0 },
    audio: { count: 0, bytes: 0 },
    archives: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };

  for (const file of activeFiles) {
    const mime = (file.mime_type || "").toLowerCase();
    const size = file.size_bytes || 0;
    if (mime.startsWith("image/")) {
      categories.images.count++;
      categories.images.bytes += size;
    } else if (
      mime.startsWith("application/pdf") ||
      mime.includes("document") ||
      mime.includes("spreadsheet") ||
      mime.includes("presentation") ||
      mime.startsWith("text/")
    ) {
      categories.documents.count++;
      categories.documents.bytes += size;
    } else if (mime.startsWith("video/")) {
      categories.videos.count++;
      categories.videos.bytes += size;
    } else if (mime.startsWith("audio/")) {
      categories.audio.count++;
      categories.audio.bytes += size;
    } else if (
      mime.includes("zip") ||
      mime.includes("tar") ||
      mime.includes("rar") ||
      mime.includes("7z") ||
      mime.includes("gzip") ||
      mime.includes("iso")
    ) {
      categories.archives.count++;
      categories.archives.bytes += size;
    } else {
      categories.other.count++;
      categories.other.bytes += size;
    }
  }

  const status = getStorageStatus(totalUsedBytes, storageCap);

  const categoryBreakdown = Object.entries(categories).map(([name, data]) => ({
    name,
    count: data.count,
    bytes: data.bytes,
    formatted: formatBytes(data.bytes),
    percent: totalUsedBytes > 0 ? Math.round((data.bytes / totalUsedBytes) * 100) : 0,
  }));

  const topFiles = (topFilesResult.data || []).map((f) => ({
    id: f.id,
    name: f.display_name || f.original_name || f.name,
    extension: f.extension,
    sizeBytes: f.size_bytes,
    sizeFormatted: formatBytes(f.size_bytes),
    mimeType: f.mime_type,
    createdAt: f.created_at,
  }));

  return NextResponse.json({
    usage: {
      usedBytes: totalUsedBytes,
      capBytes: storageCap,
      usedFormatted: formatBytes(totalUsedBytes),
      capFormatted: formatBytes(storageCap),
      percentUsed: storageCap > 0 ? Math.round((totalUsedBytes / storageCap) * 10000) / 100 : 0,
      remainingBytes: Math.max(0, storageCap - totalUsedBytes),
      remainingFormatted: formatBytes(Math.max(0, storageCap - totalUsedBytes)),
    },
    status,
    trash: {
      bytes: trashBytes,
      formatted: formatBytes(trashBytes),
      fileCount: trashedFiles.length,
    },
    categoryBreakdown,
    topFiles,
    activeFileCount: activeFiles.length,
  });
}
