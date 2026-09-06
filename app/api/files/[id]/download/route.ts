import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUDIT_ACTIONS } from "@/types/audit";
import { logAction } from "@/lib/logging/log-action";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  // Rate limiting
  const rlIdentifier = getRateLimitIdentifier(req);
  const rlResult = checkRateLimit("download", rlIdentifier);
  if (!rlResult.allowed) {
    return rateLimitResponse("download", rlResult, req);
  }

  const adminClient = createAdminClient();

  // 1. Fetch active file record (IDOR: only active, non-deleted)
  const { data: file, error: dbError } = await adminClient
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (dbError || !file) {
    // Log rejected download attempt
    await logAction({
      actor_user_id: null,
      action: AUDIT_ACTIONS.DOWNLOAD_REJECTED,
      target_type: "file",
      target_id: id,
      result: "FAILED",
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason: "File not found, inactive, or deleted" },
    });
    return NextResponse.json(
      { error: "File not found or no longer available" },
      { status: 404 }
    );
  }

  // 2. Increment download counter
  try {
    await adminClient.rpc("increment_file_downloads", { target_file_id: file.id });
  } catch {
    // Non-fatal if counter increment fails
  }

  // 3. Log successful download audit event
  await logAction({
    actor_user_id: null,
    action: AUDIT_ACTIONS.FILE_DOWNLOADED,
    target_type: "file",
    target_id: file.id,
    target_name: file.original_name || file.name,
    result: "SUCCESS",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      sizeBytes: file.size_bytes,
      mimeType: file.mime_type,
      extension: file.extension,
    },
  });

  // 4. Generate signed download URL from 'dump-files' bucket
  // download option sets Content-Disposition to original user filename
  const { data: signedUrlData, error: signError } = await adminClient.storage
    .from("dump-files")
    .createSignedUrl(file.storage_path, 300, {
      download: file.original_name || file.name,
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
      metadata: { reason: "Failed to generate signed download URL" },
    });
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }

  // Check if client expects JSON
  const acceptHeader = req.headers.get("accept") || "";
  if (acceptHeader.includes("application/json")) {
    return NextResponse.json({
      downloadUrl: signedUrlData.signedUrl,
      fileName: file.original_name || file.name,
      sizeBytes: file.size_bytes,
    });
  }

  // Otherwise 307 redirect to the signed download URL
  return NextResponse.redirect(new URL(signedUrlData.signedUrl));
}
