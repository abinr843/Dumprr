import { NextRequest } from "next/server";
import { ok, notFound, badRequest, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseZipBuffer, buildZipTree } from "@/lib/storage/zip";
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

const MAX_ZIP_BYTES = 70 * 1024 * 1024;

/**
 * GET /api/files/:id/zip-tree — list archive contents (Feature 6).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const rlIdentifier = getRateLimitIdentifier(req);
  const rlResult = checkRateLimit("download", rlIdentifier);
  if (!rlResult.allowed) return rateLimitResponse("download", rlResult, req);

  const adminClient = createAdminClient();
  const { data: file } = await adminClient
    .from("files")
    .select("id, storage_path, extension, size_bytes, display_name, original_name, name")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();
  if (!file) return notFound("This file no longer exists.");
  const rec = file as unknown as {
    storage_path: string;
    extension: string | null;
    size_bytes: number;
  };
  if ((rec.extension || "").toLowerCase() !== "zip") {
    return badRequest("Only ZIP archives can be inspected this way.");
  }
  if ((rec.size_bytes || 0) > MAX_ZIP_BYTES) {
    return fail(
      "FILE_TOO_LARGE",
      "This archive is too large to inspect in the browser. Please download it instead.",
      413
    );
  }

  try {
    const { data: blob, error } = await adminClient.storage
      .from("dump-files")
      .download(rec.storage_path);
    if (error || !blob) throw new Error("Failed to fetch archive");
    const buf = new Uint8Array(await blob.arrayBuffer());
    const tree = parseZipBuffer(buf);
    return ok({
      fileId: id,
      entries: tree.entries,
      tree: buildZipTree(tree.entries),
      totalFiles: tree.totalFiles,
      totalDirs: tree.totalDirs,
      totalUncompressed: tree.totalUncompressed,
      truncated: tree.truncated,
    });
  } catch (err) {
    return fail(
      "BAD_REQUEST",
      humanizeTechnicalError(err, "We couldn't read this archive. It may be damaged or use an unsupported format."),
      422
    );
  }
}
