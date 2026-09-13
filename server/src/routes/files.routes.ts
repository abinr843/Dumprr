/**
 * File management routes.
 *
 * GET    /api/files           — List files (role-aware)
 * POST   /api/files/upload    — Upload file (admin, multer)
 * GET    /api/files/:id       — File detail (IDOR protected)
 * PATCH  /api/files/:id       — Rename/move file (admin)
 * DELETE /api/files/:id       — Soft delete to trash (admin)
 * POST   /api/files/:id/restore   — Restore from trash (admin)
 * DELETE /api/files/:id/permanent — Permanently delete (admin)
 * GET    /api/files/:id/preview   — Presigned preview URL
 * GET    /api/files/:id/download  — Download with counter increment
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "../config/supabase.js";
import { authenticateUser, requireAdmin, isAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limiter.js";
import { logAction } from "../services/audit.service.js";
import { validateFile, canAcceptFile } from "../services/storage.service.js";
import { sanitizeFilename } from "../services/security.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";

const router = Router();

// Multer: store in memory for binary inspection before S3 push
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 70 * 1024 * 1024 }, // 70 MB
});

// ─── GET /api/files ─────────────────────────────────────────────────

router.get(
  "/",
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;

    const status = (req.query.status as string) || "active";
    const folderId = req.query.folder_id as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 500);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const admin = createAdminClient();
    let query = admin.from("files").select("*", { count: "exact" });

    if (!userIsAdmin) {
      query = query.eq("status", "active").is("deleted_at", null);
    } else if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (folderId === "null" || folderId === "") {
      query = query.is("folder_id", null);
    } else if (folderId) {
      query = query.eq("folder_id", folderId);
    }

    if (search && search.trim()) {
      const q = search.trim();
      query = query.or(
        `display_name.ilike.%${q}%,original_name.ilike.%${q}%,extension.ilike.%${q}%`
      );
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: files, error, count } = await query;

    if (error) {
      await logAction({
        actor_user_id: req.user?.id ?? null,
        action: AUDIT_ACTIONS.API_ERROR,
        target_type: "file",
        result: "FAILED",
        ip_address: req.ipAddress || "127.0.0.1",
        user_agent: req.userAgent || "unknown",
        metadata: { error: error.message },
      });
      res.status(500).json({ error: `Failed to fetch files: ${error.message}` });
      return;
    }

    res.json({ files: files || [], total: count ?? 0, limit, offset });
  })
);

// ─── POST /api/files/upload ─────────────────────────────────────────

router.post(
  "/upload",
  authenticateUser,
  requireAdmin("POST /api/files/upload"),
  rateLimit("upload"),
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";
    const userId = req.user!.id;

    // Log upload start
    await logAction({
      actor_user_id: userId,
      action: AUDIT_ACTIONS.FILE_UPLOAD_STARTED,
      target_type: "file",
      target_name: file.originalname,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { sizeBytes: file.size, mimeType: file.mimetype },
    });

    // Validate file
    const validation = validateFile(file.buffer, file.originalname, file.size);
    if (!validation.valid) {
      const isSecurityReject = validation.code === "DISGUISED_EXECUTABLE";
      await logAction({
        actor_user_id: userId,
        action: isSecurityReject
          ? AUDIT_ACTIONS.SECURITY_UPLOAD_REJECTED
          : AUDIT_ACTIONS.FILE_UPLOAD_REJECTED,
        target_type: isSecurityReject ? "security" : "file",
        target_name: file.originalname,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: {
          error: validation.error,
          code: validation.code,
          sizeBytes: file.size,
        },
      });
      res.status(422).json({
        error: validation.error,
        code: validation.code,
      });
      return;
    }

    // Check storage quota
    const { allowed, quota } = await canAcceptFile(file.size);
    if (!allowed) {
      await logAction({
        actor_user_id: userId,
        action: AUDIT_ACTIONS.FILE_UPLOAD_REJECTED,
        target_type: "file",
        target_name: file.originalname,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: {
          reason: "Storage quota exceeded",
          usedBytes: quota.usedBytes,
          capBytes: quota.capBytes,
        },
      });
      res.status(507).json({
        error: "Storage quota exceeded",
        code: "QUOTA_EXCEEDED",
      });
      return;
    }

    // Generate storage key and upload
    const sanitizedName = sanitizeFilename(file.originalname);
    const ext = sanitizedName.split(".").pop()?.toLowerCase() || "bin";
    const storageKey = `${uuidv4()}.${ext}`;
    const folderId = (req.body.folder_id as string) || null;
    const displayName = (req.body.display_name as string) || sanitizedName;

    const admin = createAdminClient();

    // Push to Supabase Storage
    const { error: uploadError } = await admin.storage
      .from("dump-files")
      .upload(storageKey, file.buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      await logAction({
        actor_user_id: userId,
        action: AUDIT_ACTIONS.FILE_UPLOAD_FAILED,
        target_type: "file",
        target_name: sanitizedName,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: { error: uploadError.message },
      });
      res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
      return;
    }

    // Insert database record
    const { data: fileRecord, error: insertError } = await admin
      .from("files")
      .insert({
        name: storageKey,
        display_name: displayName,
        original_name: file.originalname,
        extension: ext,
        mime_type: validation.detectedMime || file.mimetype,
        size_bytes: file.size,
        storage_path: storageKey,
        folder_id: folderId,
        uploaded_by: userId,
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      // Cleanup storage on DB failure
      await admin.storage.from("dump-files").remove([storageKey]);
      await logAction({
        actor_user_id: userId,
        action: AUDIT_ACTIONS.FILE_UPLOAD_FAILED,
        target_type: "file",
        target_name: sanitizedName,
        result: "FAILED",
        ip_address: ip,
        user_agent: ua,
        metadata: { error: insertError.message, stage: "database_insert" },
      });
      res.status(500).json({ error: `Database insert failed: ${insertError.message}` });
      return;
    }

    await logAction({
      actor_user_id: userId,
      action: AUDIT_ACTIONS.FILE_UPLOAD_COMPLETED,
      target_type: "file",
      target_id: fileRecord.id,
      target_name: displayName,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: {
        sizeBytes: file.size,
        mimeType: validation.detectedMime,
        storageKey,
        folderId,
      },
    });

    res.status(201).json({ file: fileRecord });
  })
);

// ─── GET /api/files/:id ─────────────────────────────────────────────

router.get(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const admin = createAdminClient();

    let query = admin.from("files").select("*").eq("id", id);
    if (!userIsAdmin) {
      query = query.eq("status", "active").is("deleted_at", null);
    }

    const { data: file, error } = await query.single();
    if (error || !file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json({ file });
  })
);

// ─── PATCH /api/files/:id ───────────────────────────────────────────

router.patch(
  "/:id",
  authenticateUser,
  requireAdmin("PATCH /api/files/:id"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { display_name, folder_id } = req.body;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("files")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const auditEvents: { action: string; metadata: Record<string, unknown> }[] = [];

    if (display_name !== undefined && display_name !== existing.display_name) {
      updates.display_name = display_name;
      auditEvents.push({
        action: AUDIT_ACTIONS.FILE_RENAMED,
        metadata: { previousName: existing.display_name, newName: display_name },
      });
    }

    if (folder_id !== undefined && folder_id !== existing.folder_id) {
      if (folder_id !== null) {
        const { data: targetFolder } = await admin
          .from("folders")
          .select("id")
          .eq("id", folder_id)
          .eq("status", "active")
          .single();
        if (!targetFolder) {
          res.status(400).json({ error: "Target folder not found or is not active" });
          return;
        }
      }
      updates.folder_id = folder_id;
      auditEvents.push({
        action: AUDIT_ACTIONS.FILE_MOVED,
        metadata: { previousFolderId: existing.folder_id, newFolderId: folder_id },
      });
    }

    if (Object.keys(updates).length <= 1) {
      res.json({ file: existing, message: "No changes" });
      return;
    }

    const { data: updated, error: updateErr } = await admin
      .from("files")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: `Update failed: ${updateErr.message}` });
      return;
    }

    for (const evt of auditEvents) {
      await logAction({
        actor_user_id: req.user!.id,
        action: evt.action,
        target_type: "file",
        target_id: id,
        target_name: updated.display_name || updated.name,
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: evt.metadata,
      });
    }

    res.json({ file: updated });
  })
);

// ─── DELETE /api/files/:id (soft delete) ────────────────────────────

router.delete(
  "/:id",
  authenticateUser,
  requireAdmin("DELETE /api/files/:id"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("files")
      .select("id, display_name, name, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    if (existing.status === "trash") {
      res.status(409).json({ error: "File is already in trash" });
      return;
    }

    const { data: updated, error: updateErr } = await admin
      .from("files")
      .update({
        status: "trash",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: `Soft delete failed: ${updateErr.message}` });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FILE_DELETED,
      target_type: "file",
      target_id: id,
      target_name: existing.display_name || existing.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
    });

    res.json({ file: updated, message: "File moved to trash" });
  })
);

// ─── POST /api/files/:id/restore ────────────────────────────────────

router.post(
  "/:id/restore",
  authenticateUser,
  requireAdmin("POST /api/files/:id/restore"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("files")
      .select("id, display_name, name, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    if (existing.status !== "trash") {
      res.status(409).json({ error: "File is not in trash" });
      return;
    }

    const { data: restored, error: updateErr } = await admin
      .from("files")
      .update({
        status: "active",
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: `Restore failed: ${updateErr.message}` });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FILE_RESTORED,
      target_type: "file",
      target_id: id,
      target_name: existing.display_name || existing.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
    });

    res.json({ file: restored, message: "File restored" });
  })
);

// ─── DELETE /api/files/:id/permanent ────────────────────────────────

router.delete(
  "/:id/permanent",
  authenticateUser,
  requireAdmin("DELETE /api/files/:id/permanent"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: file, error: fetchErr } = await admin
      .from("files")
      .select("id, display_name, name, original_name, storage_path, size_bytes")
      .eq("id", id)
      .single();

    if (fetchErr || !file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    if (file.storage_path) {
      const { error: removeErr } = await admin.storage
        .from("dump-files")
        .remove([file.storage_path]);

      if (removeErr) {
        res.status(500).json({ error: `Storage removal failed: ${removeErr.message}` });
        return;
      }
    }

    const { error: deleteErr } = await admin.from("files").delete().eq("id", id);

    if (deleteErr) {
      res.status(500).json({ error: `Database deletion failed: ${deleteErr.message}` });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FILE_PERMANENTLY_DELETED,
      target_type: "file",
      target_id: id,
      target_name: file.display_name || file.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { sizeBytes: file.size_bytes },
    });

    res.json({ message: "File permanently deleted", deletedId: id });
  })
);

// ─── GET /api/files/:id/preview ─────────────────────────────────────

router.get(
  "/:id/preview",
  rateLimit("download"),
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const admin = createAdminClient();

    let query = admin
      .from("files")
      .select("id, display_name, name, storage_path, mime_type, status, deleted_at")
      .eq("id", id);

    if (!userIsAdmin) {
      query = query.eq("status", "active").is("deleted_at", null);
    }

    const { data: file, error } = await query.single();
    if (error || !file || !file.storage_path) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const { data: signedData, error: signErr } = await admin.storage
      .from("dump-files")
      .createSignedUrl(file.storage_path, 300); // 5 minutes

    if (signErr || !signedData?.signedUrl) {
      res.status(500).json({ error: "Failed to generate preview URL" });
      return;
    }

    await logAction({
      actor_user_id: req.user?.id ?? null,
      action: AUDIT_ACTIONS.FILE_PREVIEWED,
      target_type: "file",
      target_id: id,
      target_name: file.display_name || file.name,
      result: "SUCCESS",
      ip_address: req.ipAddress || "127.0.0.1",
      user_agent: req.userAgent || "unknown",
    });

    res.json({
      previewUrl: signedData.signedUrl,
      mimeType: file.mime_type,
      expiresIn: 300,
    });
  })
);

// ─── GET /api/files/:id/download ────────────────────────────────────

router.get(
  "/:id/download",
  rateLimit("download"),
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const admin = createAdminClient();

    let query = admin
      .from("files")
      .select("id, display_name, name, original_name, storage_path, status, deleted_at")
      .eq("id", id);

    if (!userIsAdmin) {
      query = query.eq("status", "active").is("deleted_at", null);
    }

    const { data: file, error } = await query.single();
    if (error || !file || !file.storage_path) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Increment download counter
    await admin.rpc("increment_download_count", { file_id: id });

    const { data: signedData, error: signErr } = await admin.storage
      .from("dump-files")
      .createSignedUrl(file.storage_path, 300, {
        download: file.original_name || file.display_name || file.name,
      });

    if (signErr || !signedData?.signedUrl) {
      res.status(500).json({ error: "Failed to generate download URL" });
      return;
    }

    await logAction({
      actor_user_id: req.user?.id ?? null,
      action: AUDIT_ACTIONS.FILE_DOWNLOADED,
      target_type: "file",
      target_id: id,
      target_name: file.display_name || file.name,
      result: "SUCCESS",
      ip_address: req.ipAddress || "127.0.0.1",
      user_agent: req.userAgent || "unknown",
    });

    res.redirect(signedData.signedUrl);
  })
);

export default router;
