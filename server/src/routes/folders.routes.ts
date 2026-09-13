/**
 * Folder management routes.
 *
 * GET    /api/folders           — List folders (role-aware, enriched with child counts)
 * POST   /api/folders           — Create folder (admin)
 * GET    /api/folders/:id       — Folder detail + breadcrumbs (IDOR protected)
 * PATCH  /api/folders/:id       — Rename/recolor/move with cycle detection (admin)
 * DELETE /api/folders/:id       — Soft delete with cascade (admin)
 * POST   /api/folders/:id/restore   — Restore folder tree from trash (admin)
 * DELETE /api/folders/:id/permanent — Permanently delete folder tree (admin)
 */

import { Router, Request, Response } from "express";
import { createAdminClient } from "../config/supabase.js";
import { authenticateUser, requireAdmin, isAdmin } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../types/index.js";
import type { BreadcrumbItem } from "../types/index.js";
import { asyncHandler } from "../middleware/error-handler.js";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────

async function buildBreadcrumbs(
  adminClient: any,
  folderId: string
): Promise<BreadcrumbItem[]> {
  const crumbs: BreadcrumbItem[] = [];
  let currentId: string | null = folderId;

  for (let depth = 0; depth < 20 && currentId; depth++) {
    const { data }: { data: any } = await adminClient
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .single();

    if (!data) break;
    crumbs.unshift({ id: data.id, name: data.name });
    currentId = data.parent_id;
  }

  crumbs.unshift({ id: null, name: "Home" });
  return crumbs;
}

async function isDescendantOf(
  adminClient: any,
  targetId: string,
  ancestorId: string
): Promise<boolean> {
  let currentId: string | null = targetId;

  for (let depth = 0; depth < 50 && currentId; depth++) {
    if (currentId === ancestorId) return true;
    const { data }: { data: any } = await adminClient
      .from("folders")
      .select("parent_id")
      .eq("id", currentId)
      .single();
    if (!data) break;
    currentId = data.parent_id;
  }

  return false;
}

async function collectDescendantIds(
  adminClient: any,
  parentId: string,
  statusFilter?: string
): Promise<string[]> {
  let query = adminClient
    .from("folders")
    .select("id")
    .eq("parent_id", parentId);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else {
    query = query.neq("status", "trash");
  }

  const { data: children } = await query;
  if (!children || children.length === 0) return [];

  const ids: string[] = children.map((c: any) => c.id);
  for (const child of children) {
    const grandchildren = await collectDescendantIds(
      adminClient,
      child.id,
      statusFilter
    );
    ids.push(...grandchildren);
  }
  return ids;
}

// ─── GET /api/folders ───────────────────────────────────────────────

router.get(
  "/",
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const parentId = req.query.parent_id as string | undefined;
    const status = (req.query.status as string) || "active";

    const admin = createAdminClient();
    let query = admin.from("folders").select("*");

    if (!userIsAdmin) {
      query = query.eq("status", "active").is("deleted_at", null);
    } else if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (!parentId || parentId === "null" || parentId === "") {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", parentId);
    }

    query = query.order("name", { ascending: true });
    const { data: folders, error } = await query;

    if (error) {
      res.status(500).json({ error: `Failed to fetch folders: ${error.message}` });
      return;
    }

    // Batch-enrich with child counts
    const folderIds = (folders || []).map((f: any) => f.id);
    let childFolderCounts: Record<string, number> = {};
    let childFileCounts: Record<string, number> = {};

    if (folderIds.length > 0) {
      const [childFoldersResult, childFilesResult] = await Promise.all([
        admin
          .from("folders")
          .select("parent_id")
          .in("parent_id", folderIds)
          .eq("status", "active"),
        admin
          .from("files")
          .select("folder_id")
          .in("folder_id", folderIds)
          .eq("status", "active"),
      ]);

      if (childFoldersResult.data) {
        for (const row of childFoldersResult.data) {
          if (row.parent_id) {
            childFolderCounts[row.parent_id] =
              (childFolderCounts[row.parent_id] || 0) + 1;
          }
        }
      }

      if (childFilesResult.data) {
        for (const row of childFilesResult.data) {
          if (row.folder_id) {
            childFileCounts[row.folder_id] =
              (childFileCounts[row.folder_id] || 0) + 1;
          }
        }
      }
    }

    const enriched = (folders || []).map((folder: any) => ({
      ...folder,
      childFolderCount: childFolderCounts[folder.id] || 0,
      childFileCount: childFileCounts[folder.id] || 0,
    }));

    res.json({ folders: enriched });
  })
);

// ─── POST /api/folders ──────────────────────────────────────────────

router.post(
  "/",
  authenticateUser,
  requireAdmin("POST /api/folders"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, parent_id, color } = req.body;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    let path = `/${name}`;
    if (parent_id) {
      const { data: parentFolder } = await admin
        .from("folders")
        .select("path")
        .eq("id", parent_id)
        .eq("status", "active")
        .single();

      if (!parentFolder) {
        res.status(400).json({ error: "Parent folder not found or is not active" });
        return;
      }
      path = `${parentFolder.path}/${name}`;
    }

    const { data: folder, error: insertErr } = await admin
      .from("folders")
      .insert({
        name,
        parent_id: parent_id || null,
        owner_id: req.user!.id,
        path,
        color: color || "#6366f1",
        status: "active",
      })
      .select()
      .single();

    if (insertErr) {
      res.status(500).json({ error: `Folder creation failed: ${insertErr.message}` });
      return;
    }

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FOLDER_CREATED,
      target_type: "folder",
      target_id: folder.id,
      target_name: folder.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { path: folder.path, parentId: parent_id },
    });

    res.status(201).json({ folder });
  })
);

// ─── GET /api/folders/:id ───────────────────────────────────────────

router.get(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userIsAdmin = req.user ? isAdmin(req.user.role) : false;
    const admin = createAdminClient();

    let query = admin.from("folders").select("*").eq("id", id);
    if (!userIsAdmin) {
      query = query.eq("status", "active").is("deleted_at", null);
    }

    const { data: folder, error } = await query.single();
    if (error || !folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const [breadcrumbs, { count: childFolderCount }, { count: childFileCount }] =
      await Promise.all([
        buildBreadcrumbs(admin, id),
        admin
          .from("folders")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", id)
          .eq("status", "active"),
        admin
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("folder_id", id)
          .eq("status", "active"),
      ]);

    res.json({
      folder: {
        ...folder,
        breadcrumbs,
        childFolderCount: childFolderCount ?? 0,
        childFileCount: childFileCount ?? 0,
      },
    });
  })
);

// ─── PATCH /api/folders/:id ─────────────────────────────────────────

router.patch(
  "/:id",
  authenticateUser,
  requireAdmin("PATCH /api/folders/:id"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("folders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const auditEvents: { action: string; metadata: Record<string, unknown> }[] = [];
    const { name, parent_id, color, is_favorite } = req.body;

    if (name !== undefined && name !== existing.name) {
      updates.name = name;
      auditEvents.push({
        action: AUDIT_ACTIONS.FOLDER_RENAMED,
        metadata: { previousName: existing.name, newName: name },
      });
    }

    if (color !== undefined) updates.color = color;
    if (is_favorite !== undefined) updates.is_favorite = is_favorite;

    if (parent_id !== undefined && parent_id !== existing.parent_id) {
      if (parent_id !== null) {
        if (parent_id === id) {
          res.status(400).json({ error: "Cannot move a folder into itself" });
          return;
        }
        const isCycle = await isDescendantOf(admin, parent_id, id);
        if (isCycle) {
          res.status(400).json({ error: "Cannot move a folder into one of its own descendants" });
          return;
        }
        const { data: targetParent } = await admin
          .from("folders")
          .select("id, path")
          .eq("id", parent_id)
          .eq("status", "active")
          .single();
        if (!targetParent) {
          res.status(400).json({ error: "Target parent folder not found" });
          return;
        }
      }
      updates.parent_id = parent_id;
      auditEvents.push({
        action: AUDIT_ACTIONS.FOLDER_MOVED,
        metadata: { previousParentId: existing.parent_id, newParentId: parent_id },
      });
    }

    // Rebuild path if name or parent changed
    if (updates.name || updates.parent_id !== undefined) {
      const folderName = (updates.name as string) || existing.name;
      if (updates.parent_id === null || (updates.parent_id === undefined && !existing.parent_id)) {
        updates.path = `/${folderName}`;
      } else {
        const pid = (updates.parent_id as string) || existing.parent_id;
        if (pid) {
          const { data: parentFolder } = await admin
            .from("folders")
            .select("path")
            .eq("id", pid)
            .single();
          updates.path = parentFolder ? `${parentFolder.path}/${folderName}` : `/${folderName}`;
        }
      }
    }

    if (Object.keys(updates).length <= 1) {
      res.json({ folder: existing, message: "No changes" });
      return;
    }

    const { data: updated, error: updateErr } = await admin
      .from("folders")
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
        target_type: "folder",
        target_id: id,
        target_name: updated.name,
        result: "SUCCESS",
        ip_address: ip,
        user_agent: ua,
        metadata: evt.metadata,
      });
    }

    res.json({ folder: updated });
  })
);

// ─── DELETE /api/folders/:id (soft delete with cascade) ─────────────

router.delete(
  "/:id",
  authenticateUser,
  requireAdmin("DELETE /api/folders/:id"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("folders")
      .select("id, name, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    if (existing.status === "trash") {
      res.status(409).json({ error: "Folder is already in trash" });
      return;
    }

    const now = new Date().toISOString();
    const descendantFolderIds = await collectDescendantIds(admin, id);
    const allFolderIds = [id, ...descendantFolderIds];

    await admin
      .from("folders")
      .update({ status: "trash", deleted_at: now, updated_at: now })
      .in("id", allFolderIds);

    await admin
      .from("files")
      .update({ status: "trash", deleted_at: now, updated_at: now })
      .in("folder_id", allFolderIds)
      .eq("status", "active");

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FOLDER_DELETED,
      target_type: "folder",
      target_id: id,
      target_name: existing.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: {
        cascadedFolders: descendantFolderIds.length,
        totalFoldersAffected: allFolderIds.length,
      },
    });

    res.json({
      message: "Folder and contents moved to trash",
      foldersAffected: allFolderIds.length,
    });
  })
);

// ─── POST /api/folders/:id/restore ──────────────────────────────────

router.post(
  "/:id/restore",
  authenticateUser,
  requireAdmin("POST /api/folders/:id/restore"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("folders")
      .select("id, name, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    if (existing.status !== "trash") {
      res.status(409).json({ error: "Folder is not in trash" });
      return;
    }

    const now = new Date().toISOString();
    const descendantFolderIds = await collectDescendantIds(admin, id, "trash");
    const allFolderIds = [id, ...descendantFolderIds];

    await admin
      .from("folders")
      .update({ status: "active", deleted_at: null, updated_at: now })
      .in("id", allFolderIds);

    await admin
      .from("files")
      .update({ status: "active", deleted_at: null, updated_at: now })
      .in("folder_id", allFolderIds)
      .eq("status", "trash");

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FOLDER_RESTORED,
      target_type: "folder",
      target_id: id,
      target_name: existing.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: { restoredFolders: allFolderIds.length },
    });

    res.json({
      message: "Folder and contents restored",
      foldersRestored: allFolderIds.length,
    });
  })
);

// ─── DELETE /api/folders/:id/permanent ──────────────────────────────

router.delete(
  "/:id/permanent",
  authenticateUser,
  requireAdmin("DELETE /api/folders/:id/permanent"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const admin = createAdminClient();
    const ip = req.ipAddress || "127.0.0.1";
    const ua = req.userAgent || "unknown";

    const { data: existing, error: fetchErr } = await admin
      .from("folders")
      .select("id, name")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    // Collect ALL descendants (regardless of status)
    async function collectAll(parentId: string): Promise<string[]> {
      const { data: children } = await admin
        .from("folders")
        .select("id")
        .eq("parent_id", parentId);

      if (!children || children.length === 0) return [];
      const ids: string[] = children.map((c: any) => c.id);
      for (const child of children) {
        const grandchildren = await collectAll(child.id);
        ids.push(...grandchildren);
      }
      return ids;
    }

    const descendantFolderIds = await collectAll(id);
    const allFolderIds = [id, ...descendantFolderIds];

    const { data: filesToDelete } = await admin
      .from("files")
      .select("id, storage_path")
      .in("folder_id", allFolderIds);

    if (filesToDelete && filesToDelete.length > 0) {
      const storagePaths = filesToDelete
        .map((f: any) => f.storage_path)
        .filter(Boolean);
      if (storagePaths.length > 0) {
        await admin.storage.from("dump-files").remove(storagePaths);
      }
      const fileIds = filesToDelete.map((f: any) => f.id);
      await admin.from("files").delete().in("id", fileIds);
    }

    await admin.from("folders").delete().in("id", allFolderIds);

    await logAction({
      actor_user_id: req.user!.id,
      action: AUDIT_ACTIONS.FOLDER_PERMANENTLY_DELETED,
      target_type: "folder",
      target_id: id,
      target_name: existing.name,
      result: "SUCCESS",
      ip_address: ip,
      user_agent: ua,
      metadata: {
        foldersDeleted: allFolderIds.length,
        filesDeleted: filesToDelete?.length ?? 0,
      },
    });

    res.json({
      message: "Folder and all contents permanently deleted",
      foldersDeleted: allFolderIds.length,
      filesDeleted: filesToDelete?.length ?? 0,
    });
  })
);

export default router;
