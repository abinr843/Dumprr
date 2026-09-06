import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";
import {
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from "@/lib/storage/file-validation";
import {
  logFileUploadStarted,
  logFileUploadCompleted,
  logFileUploadFailed,
  logFileUploadRejected,
  logSecurityUploadRejected,
} from "@/lib/logging/file-audit";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

// Next.js Route Segment Config
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Helper to get client IP and User-Agent from incoming NextRequest
 */
function getRequestContext(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

/**
 * Authenticates user and checks for admin privileges via session cookies
 * or Authorization Bearer token header.
 */
async function authenticateAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const adminClient = createAdminClient();

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: tokenError,
    } = await adminClient.auth.getUser(token);

    if (tokenError || !user) {
      return { user: null, profile: null, error: "Invalid authorization token" };
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === (process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com").toLowerCase() ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    const effectiveProfile = profile || (isAdminUser ? {
      id: user.id,
      username: "admin",
      full_name: "DUMPR Administrator",
      avatar_url: "",
      role: "superadmin" as UserRole,
      storage_quota_bytes: 5368709120,
      storage_used_bytes: 0,
      metadata: {},
      created_at: user.created_at,
      updated_at: user.created_at,
    } : null);

    return { user, profile: effectiveProfile, error: null };
  }

  // Cookie-based session
  const serverSupabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await serverSupabase.auth.getUser();

  if (sessionError || !user) {
    return { user: null, profile: null, error: "No active session" };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdminUser =
    user.email?.toLowerCase() === (process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com").toLowerCase() ||
    user.user_metadata?.role === "superadmin" ||
    user.user_metadata?.role === "admin";

  const effectiveProfile = profile || (isAdminUser ? {
    id: user.id,
    username: "admin",
    full_name: "DUMPR Administrator",
    avatar_url: "",
    role: "superadmin" as UserRole,
    storage_quota_bytes: 5368709120,
    storage_used_bytes: 0,
    metadata: {},
    created_at: user.created_at,
    updated_at: user.created_at,
  } : null);

  return { user, profile: effectiveProfile, error: null };
}

/**
 * POST /api/files/upload
 *
 * Secure upload pipeline:
 * 1. Authenticate user & verify admin role
 * 2. Parse multipart/form-data
 * 3. Validate file size (<= 70MB), whitelist extension, and binary magic bytes
 * 4. Generate opaque UUID storage path
 * 5. Upload to private 'dump-files' bucket
 * 6. Insert metadata record into public.files
 * 7. Audit log lifecycle events & security rejections
 */
export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestContext(req);

  // Rate limiting
  const rlIdentifier = getRateLimitIdentifier(req);
  const rlResult = checkRateLimit("upload", rlIdentifier);
  if (!rlResult.allowed) {
    return rateLimitResponse("upload", rlResult, req);
  }

  // 1. Authentication & Admin Authorization Check
  const { user, profile, error: authErr } = await authenticateAdmin(req);

  if (authErr || !user) {
    await logSecurityUploadRejected({
      userId: null,
      ipAddress,
      userAgent,
      securityReason: "UNAUTHENTICATED_ACCESS_ATTEMPT",
      error: "Authentication required for upload",
    });

    return NextResponse.json(
      { error: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  const role = (profile?.role as UserRole) || "viewer";
  if (!isAdmin(role)) {
    await logSecurityUploadRejected({
      userId: user.id,
      ipAddress,
      userAgent,
      securityReason: "UNAUTHORIZED_NON_ADMIN_UPLOAD",
      error: `User ${user.email} with role '${role}' attempted file upload`,
    });

    return NextResponse.json(
      { error: "Forbidden: Admin privileges required to upload files" },
      { status: 403 }
    );
  }

  // 2. Parse Multipart Form Data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid form data: Failed to parse multipart payload" },
      { status: 400 }
    );
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return NextResponse.json(
      { error: "Bad Request: No file provided in 'file' form field" },
      { status: 400 }
    );
  }

  const rawFilename = (fileEntry as File).name || "unnamed_file";
  const customDisplayName = formData.get("display_name")?.toString()?.trim() || null;
  const folderId = formData.get("folder_id")?.toString()?.trim() || null;

  // Convert file blob to Uint8Array for binary validation
  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // 3. Server-Side Binary Magic Bytes & Extension Validation
  const validation = validateUploadedFile(rawFilename, buffer, fileEntry.type);

  if (!validation.isValid) {
    const isSecurityThreat =
      validation.securityReason === "DISGUISED_EXECUTABLE" ||
      validation.securityReason === "MAGIC_BYTES_MISMATCH" ||
      validation.securityReason === "INVALID_TEXT_ENCODING";

    if (isSecurityThreat) {
      await logSecurityUploadRejected({
        userId: user.id,
        fileName: rawFilename,
        sizeBytes: buffer.length,
        mimeType: fileEntry.type,
        ipAddress,
        userAgent,
        securityReason: validation.securityReason,
        error: validation.error,
      });
    } else {
      await logFileUploadRejected({
        userId: user.id,
        fileName: rawFilename,
        sizeBytes: buffer.length,
        mimeType: fileEntry.type,
        ipAddress,
        userAgent,
        securityReason: validation.securityReason,
        error: validation.error,
      });
    }

    return NextResponse.json(
      {
        error: validation.error,
        securityReason: validation.securityReason,
        maxSizeBytes: MAX_FILE_SIZE_BYTES,
        allowedExtensions: ALLOWED_EXTENSIONS,
      },
      { status: 422 }
    );
  }

  const storagePath = validation.storagePath!;
  const adminClient = createAdminClient();

  // 4. Log upload started
  await logFileUploadStarted({
    userId: user.id,
    fileName: validation.originalName,
    sizeBytes: validation.sizeBytes,
    mimeType: validation.mimeType,
    storagePath,
    ipAddress,
    userAgent,
  });

  // 5. Upload to private 'dump-files' Supabase Storage bucket
  const { error: storageError } = await adminClient.storage
    .from("dump-files")
    .upload(storagePath, buffer, {
      contentType: validation.mimeType,
      upsert: false,
    });

  if (storageError) {
    await logFileUploadFailed({
      userId: user.id,
      fileName: validation.originalName,
      sizeBytes: validation.sizeBytes,
      storagePath,
      ipAddress,
      userAgent,
      error: `Storage upload error: ${storageError.message}`,
    });

    return NextResponse.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 }
    );
  }

  // 6. Insert metadata row into public.files
  const displayName = customDisplayName || validation.sanitizedName;

  const { data: fileRecord, error: dbError } = await adminClient
    .from("files")
    .insert({
      name: validation.sanitizedName,
      display_name: displayName,
      original_name: validation.originalName,
      storage_bucket: "dump-files",
      storage_path: storagePath,
      mime_type: validation.mimeType,
      extension: validation.extension,
      size_bytes: validation.sizeBytes,
      owner_id: user.id,
      uploaded_by: user.id,
      folder_id: folderId,
      status: "active",
      is_public: true, // Downloadable by visitors
      download_count: 0,
      metadata: {
        clientDeclaredType: fileEntry.type,
        uploadedAt: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (dbError || !fileRecord) {
    // Roll back storage object on database insertion failure
    await adminClient.storage.from("dump-files").remove([storagePath]);

    const isMissingTable =
      dbError?.message?.includes("schema cache") ||
      (dbError as any)?.code === "PGRST205";

    const userFriendlyError = isMissingTable
      ? "Database table 'public.files' not found. Please execute the SQL migration in your Supabase SQL Editor (supabase/run_in_supabase_sql_editor.sql)."
      : `Database record creation failed: ${dbError?.message ?? "Unknown database error"}`;

    await logFileUploadFailed({
      userId: user.id,
      fileName: validation.originalName,
      sizeBytes: validation.sizeBytes,
      storagePath,
      ipAddress,
      userAgent,
      error: userFriendlyError,
    });

    return NextResponse.json(
      { error: userFriendlyError },
      { status: 500 }
    );
  }

  // 7. Log upload completed
  await logFileUploadCompleted({
    userId: user.id,
    fileId: fileRecord.id,
    fileName: validation.originalName,
    sizeBytes: validation.sizeBytes,
    mimeType: validation.mimeType,
    storagePath,
    ipAddress,
    userAgent,
  });

  return NextResponse.json(
    {
      success: true,
      file: {
        id: fileRecord.id,
        name: fileRecord.name,
        displayName: fileRecord.display_name,
        originalName: fileRecord.original_name,
        extension: fileRecord.extension,
        sizeBytes: fileRecord.size_bytes,
        storagePath: fileRecord.storage_path,
        mimeType: fileRecord.mime_type,
        status: fileRecord.status,
        createdAt: fileRecord.created_at,
      },
    },
    { status: 201 }
  );
}
