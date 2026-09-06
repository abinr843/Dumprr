import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  PREVIEWABLE_EXTENSIONS,
  INLINE_MIME_TYPES,
} from "@/lib/storage/preview";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/files/:id/preview
 * Returns a preview URL for previewable formats, or a download fallback.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "File ID is required" }, { status: 400 });
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Rate limiting (shares download tier)
  const rlIdentifier = getRateLimitIdentifier(req);
  const rlResult = checkRateLimit("download", rlIdentifier);
  if (!rlResult.allowed) {
    return rateLimitResponse("download", rlResult, req);
  }

  const adminClient = createAdminClient();

  // IDOR: Only active, non-deleted files
  const { data: file, error: dbError } = await adminClient
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (dbError || !file) {
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.DOWNLOAD_REJECTED,
      target_type: "file",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "File not found, inactive, or deleted (preview)" },
    });
    return NextResponse.json(
      { error: "File not found or no longer available" },
      { status: 404 }
    );
  }

  const ext = (file.extension || "").toLowerCase();
  const isPreviewable = PREVIEWABLE_EXTENSIONS.has(ext);

  if (isPreviewable) {
    // Generate signed URL with inline disposition for browser preview
    const contentType = INLINE_MIME_TYPES[ext] || file.mime_type;

    const { data: signedUrlData, error: signError } = await adminClient.storage
      .from("dump-files")
      .createSignedUrl(file.storage_path, 300, {
        download: false,
      });

    if (signError || !signedUrlData?.signedUrl) {
      await logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.API_ERROR,
        target_type: "file",
        target_id: file.id,
        target_name: file.original_name || file.name,
        result: "FAILED",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: "Failed to generate preview URL" },
      });
      return NextResponse.json(
        { error: "Failed to generate preview URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      previewable: true,
      previewUrl: signedUrlData.signedUrl,
      mimeType: contentType,
      fileName: file.display_name || file.original_name || file.name,
      originalName: file.original_name,
      sizeBytes: file.size_bytes,
      extension: ext,
    });
  }

  // Non-previewable: return download fallback info
  return NextResponse.json({
    previewable: false,
    downloadUrl: `/api/files/${file.id}/download`,
    fileName: file.display_name || file.original_name || file.name,
    originalName: file.original_name,
    sizeBytes: file.size_bytes,
    extension: ext,
    mimeType: file.mime_type,
    reason: "This file format requires download to view",
  });
}
