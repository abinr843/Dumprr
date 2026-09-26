/**
 * DUMPR Express Backend — Server Entry Point
 *
 * Standalone Node.js/Express server that handles all /api/* routes.
 * Next.js rewrites proxy traffic here so the frontend is unaffected.
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { validateEnv, getEnvConfig } from "./config/env.js";
import { injectContext, authenticateUser, requireAdmin } from "./middleware/auth.js";
import { createAdminClient } from "./config/supabase.js";
import { maintenanceGuard } from "./middleware/maintenance.js";
import { globalErrorHandler } from "./middleware/error-handler.js";
import { standardizeEnvelope, humanizeTechnicalError } from "./utils/api-response.js";

// Route modules
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import searchRoutes from "./routes/search.routes.js";
import filesRoutes from "./routes/files.routes.js";
import foldersRoutes from "./routes/folders.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import trashRoutes from "./routes/trash.routes.js";
import adminOverviewRoutes from "./routes/admin/overview.routes.js";
import adminStorageRoutes from "./routes/admin/storage.routes.js";
import adminSettingsRoutes from "./routes/admin/settings.routes.js";
import adminUsersRoutes from "./routes/admin/users.routes.js";

// ─── Bootstrap ──────────────────────────────────────────────────────

validateEnv();

const app = express();
const config = getEnvConfig();

// ─── Global Middleware ──────────────────────────────────────────────

// CORS — allow frontend origin in dev
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Parse JSON bodies (limit 100mb for large post content)
app.use(express.json({ limit: "100mb" }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Parse cookies (needed for Supabase session tokens)
app.use(cookieParser());

// Inject IP and User-Agent onto every request
app.use(injectContext);

// Standardize every API response into the { success, ... } envelope
// (legacy { error } shapes are normalized automatically)
app.use("/api", standardizeEnvelope);

// Maintenance mode guard (blocks non-exempt routes during maintenance)
app.use("/api", maintenanceGuard);

// ─── Route Registration ─────────────────────────────────────────────

// Public / lightly authenticated routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/search", searchRoutes);

// Resource routes (auth-aware, admin-required for mutations)
app.use("/api/files", filesRoutes);
app.use("/api/folders", foldersRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/trash", trashRoutes);

// Admin routes (all require admin authentication)
app.use("/api/admin/overview", adminOverviewRoutes);
app.use("/api/admin/storage", adminStorageRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/users", adminUsersRoutes);

// Admin cleanup (reuse trash cleanup logic)
app.post("/api/admin/cleanup", async (req: express.Request, res: express.Response) => {
  // Redirect to trash cleanup handler
  req.url = "/cleanup";
  trashRoutes(req, res, () => {
    res.status(404).json({ error: "Not found" });
  });
});

// Maintenance status endpoint
app.get("/api/maintenance/status", async (_req: express.Request, res: express.Response) => {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "app.maintenance_mode")
      .maybeSingle();

    const maintenance = data?.value === "true" || data?.value === true;
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ maintenance });
  } catch {
    res.json({ maintenance: false });
  }
});

// Batch storage operations (batch move, batch delete)
app.post("/api/storage/batch", authenticateUser, requireAdmin("POST /api/storage/batch"), async (req: express.Request, res: express.Response) => {
  const { action, fileIds, folderIds, destinationFolderId } = req.body as {
    action?: string;
    fileIds?: string[];
    folderIds?: string[];
    destinationFolderId?: string | null;
  };

  if (!action || !["move", "delete"].includes(action)) {
    res.status(400).json({ error: "Please choose whether to move or delete these items." });
    return;
  }

  const safeFileIds = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
  const safeFolderIds = Array.isArray(folderIds) ? folderIds.filter(Boolean) : [];

  if (safeFileIds.length === 0 && safeFolderIds.length === 0) {
    res.status(400).json({ error: "Please select at least one item to perform this action." });
    return;
  }

  const admin = createAdminClient();
  const results = { filesUpdated: 0, foldersUpdated: 0, errors: [] as string[] };

  try {
    if (action === "move") {
      if (safeFileIds.length > 0) {
        const { error: fileErr, count } = await admin
          .from("files")
          .update({
            folder_id: destinationFolderId ?? null,
            updated_at: new Date().toISOString(),
          })
          .in("id", safeFileIds)
          .is("deleted_at", null);

        if (fileErr) results.errors.push(humanizeTechnicalError(fileErr, "Couldn't move some files. Please try again."));
        else results.filesUpdated = count ?? safeFileIds.length;
      }

      if (safeFolderIds.length > 0) {
        const validFolderIds = safeFolderIds.filter((id) => id !== destinationFolderId);
        if (validFolderIds.length > 0) {
          const { error: folderErr, count } = await admin
            .from("folders")
            .update({
              parent_id: destinationFolderId ?? null,
              updated_at: new Date().toISOString(),
            })
            .in("id", validFolderIds)
            .is("deleted_at", null);

          if (folderErr) results.errors.push(humanizeTechnicalError(folderErr, "Couldn't move some folders. Please try again."));
          else results.foldersUpdated = count ?? validFolderIds.length;
        }
      }
    } else if (action === "delete") {
      const now = new Date().toISOString();
      if (safeFileIds.length > 0) {
        const { error: fileErr, count } = await admin
          .from("files")
          .update({ status: "trash", deleted_at: now, updated_at: now })
          .in("id", safeFileIds)
          .is("deleted_at", null);

        if (fileErr) results.errors.push(humanizeTechnicalError(fileErr, "Couldn't delete some files. Please try again."));
        else results.filesUpdated = count ?? safeFileIds.length;
      }

      if (safeFolderIds.length > 0) {
        const { error: folderErr, count } = await admin
          .from("folders")
          .update({ deleted_at: now, updated_at: now })
          .in("id", safeFolderIds)
          .is("deleted_at", null);

        if (folderErr) results.errors.push(humanizeTechnicalError(folderErr, "Couldn't delete some folders. Please try again."));
        else results.foldersUpdated = count ?? safeFolderIds.length;
      }
    }

    res.json({ success: results.errors.length === 0, ...results });
  } catch (err) {
    res.status(500).json({ error: humanizeTechnicalError(err, "Something went wrong. Please try again.") });
  }
});

// ─── 404 Handler ────────────────────────────────────────────────────

app.use("/api/{*path}", (_req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested API endpoint does not exist",
  });
});

// ─── Global Error Handler (must be last) ────────────────────────────

app.use(globalErrorHandler);

// ─── Start Server ───────────────────────────────────────────────────

app.listen(config.PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║        DUMPR Express Backend             ║
║──────────────────────────────────────────║
║  Port:  ${String(config.PORT).padEnd(32)}║
║  Env:   ${String(config.NODE_ENV).padEnd(32)}║
║  Time:  ${new Date().toISOString().padEnd(32)}║
╚══════════════════════════════════════════╝
  `);
});

export default app;
