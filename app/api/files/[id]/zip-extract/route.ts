import { NextRequest, NextResponse } from "next/server";
import { notFound, badRequest, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseZipBuffer, extractZipEntry } from "@/lib/storage/zip";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { getPreviewMimeType } from "@/lib/storage/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_ZIP_BYTES = 70 * 1024 * 1024;
const MAX_ENTRY_BYTES = 10 * 1024 * 1024;

/**
 * GET /api/files/:id/zip-extract?entry=path/inside.zip — extract one inner file (Feature 6).
 * Returns raw bytes with best-effort content type, or JSON preview for text.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const url = new URL(req.url);
  const entryPath = url.searchParams.get("entry");
  if (!entryPath) {
    return badRequest("Please choose a file inside the archive first.");
  }
  const rlIdentifier = getRateLimitIdentifier(req);
  const rlResult = checkRateLimit("download", rlIdentifier);
  if (!rlResult.allowed) return rateLimitResponse("download", rlResult, req);

  const adminClient = createAdminClient();
  const { data: file } = await adminClient
    .from("files")
    .select("id, storage_path, extension, size_bytes")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();
  if (!file) return notFound("This file no longer exists.");
  const rec = file as unknown as { storage_path: string; size_bytes: number };
  if ((rec.size_bytes || 0) > MAX_ZIP_BYTES) {
    return fail(
      "FILE_TOO_LARGE",
      "This archive is too large to open in the browser. Please download it instead.",
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
    const entry = tree.entries.find((e) => e.path === entryPath && !e.isDir);
    if (!entry) return notFound("That file wasn't found inside the archive.");
    const out = await extractZipEntry(buf, entry, MAX_ENTRY_BYTES);
    const innerExt = (entry.name.split(".").pop() || "").toLowerCase();
    const mime = getPreviewMimeType(innerExt) || "application/octet-stream";
    const accept = req.headers.get("accept") || "";
    // JSON mode for text-ish previews
    if (accept.includes("application/json") && (mime.startsWith("text/") || mime.includes("json"))) {
      const text = new TextDecoder().decode(out.slice(0, 50000));
      return NextResponse.json({
        success: true,
        entry: entry.path,
        size: entry.size,
        mimeType: mime,
        text,
        truncated: entry.size > 50000,
      });
    }
    return new NextResponse(Buffer.from(out.buffer, out.byteOffset, out.byteLength) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(out.byteLength),
        "Content-Disposition": `inline; filename="${entry.name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return fail(
      "BAD_REQUEST",
      humanizeTechnicalError(err, "We couldn't open that file. It may be damaged or use an unsupported format."),
      422
    );
  }
}
