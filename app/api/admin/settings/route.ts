import { NextRequest } from "next/server";
import { ok, badRequest, fail } from "@/lib/api/response";
import { humanizeTechnicalError } from "@/lib/api/human-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";
import { invalidateMaintenanceCache } from "@/proxy";
import { invalidateSettingsCache } from "@/lib/settings/system-settings";
import { normalizeAllowedExtensions } from "@/lib/storage/file-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Allowed setting keys and their validators */
const EDITABLE_SETTINGS: Record<string, (v: unknown) => boolean> = {
  // General & Branding
  "app.site_name": (v) => typeof v === "string" && v.length >= 1 && v.length <= 50,
  "app.site_description": (v) => typeof v === "string" && v.length <= 250,
  "app.max_users": (v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100,
  "app.maintenance_mode": (v) => typeof v === "boolean",

  // Auth & Access
  "auth.allow_registration": (v) => typeof v === "boolean",
  "auth.default_role": (v) => v === "viewer" || v === "member",

  // Storage & Limits
  "storage.storage_cap_bytes": (v) => typeof v === "number" && v > 0,
  "storage.max_file_size_bytes": (v) => typeof v === "number" && v > 0,
  "storage.default_quota_bytes": (v) => typeof v === "number" && v > 0,
  "storage.retention_days": (v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 365,
  "storage.allowed_file_types": (v) => typeof v === "string" && v.length >= 1 && v.length <= 500,

  // Security & Privacy
  "security.public_browsing": (v) => typeof v === "boolean",
  "security.session_timeout_hours": (v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 720,

  // Posts
  "posts.allow_public_comments": (v) => typeof v === "boolean",

  // UI
  "ui.default_theme": (v) => v === "system" || v === "light" || v === "dark",
};

/**
 * Normalize a JSONB value from Supabase.
 * Older seeds stored stringified JSON (e.g. '"DUMPR"', '"true"', '"20"').
 * This unwraps them into clean primitives.
 */
function normalizeValue(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * GET /api/admin/settings
 * Returns all system settings with normalized values.
 */
export async function GET(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "GET /api/admin/settings");
  if (guard.error) return guard.error;

  const admin = createAdminClient();
  const { data: settings, error } = await admin
    .from("system_settings")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    return fail(
      "INTERNAL_ERROR",
      humanizeTechnicalError(error, "Couldn't load settings. Please try again."),
      500
    );
  }

  // Normalize values so frontend always receives clean primitives
  const normalized = (settings || []).map((s) => ({
    ...s,
    value: normalizeValue(s.value),
  }));

  return ok({ settings: normalized });
}

/**
 * PATCH /api/admin/settings
 * Update one or more system settings.
 * Body: { settings: { key: value, ... } }
 */
export async function PATCH(req: NextRequest) {
  const guard = await authenticateAdminApi(req, "PATCH /api/admin/settings");
  if (guard.error) return guard.error;

  const { ipAddress, userAgent } = getRequestContext(req);
  const body = await req.json();
  const updates = body.settings as Record<string, unknown> | undefined;

  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    return badRequest("Nothing to save — please change at least one setting first.");
  }

  const admin = createAdminClient();
  const results: Array<{ key: string; success: boolean; error?: string }> = [];

  // Fetch current values for audit trail (old → new)
  const { data: currentRows } = await admin
    .from("system_settings")
    .select("key, value")
    .in("key", Object.keys(updates));
  const currentValues = new Map(
    (currentRows || []).map((r) => [r.key, normalizeValue(r.value)])
  );

  for (const [key, value] of Object.entries(updates)) {
    // Validate key is editable
    const validator = EDITABLE_SETTINGS[key];
    if (!validator) {
      results.push({ key, success: false, error: `This setting can't be changed here.` });
      continue;
    }

    // Validate value type
    if (!validator(value)) {
      results.push({ key, success: false, error: `That value isn't valid for this setting. Please check the expected format.` });
      continue;
    }

    // Upsert the setting — store the value directly as JSONB.
    let valueToStore = value;
    if (key === "storage.allowed_file_types" && typeof value === "string") {
      const normalized = normalizeAllowedExtensions(value);
      valueToStore = normalized === "*" ? "*" : normalized.join(", ");
    }

    const { error: upsertError } = await admin
      .from("system_settings")
      .upsert({
        key,
        value: JSON.stringify(valueToStore),
        updated_by: guard.auth.user.id,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      results.push({
        key,
        success: false,
        error: humanizeTechnicalError(upsertError, "Couldn't save this setting. Please try again."),
      });
    } else {
      results.push({ key, success: true });

      // Immediately invalidate maintenance cache when toggled
      if (key === "app.maintenance_mode") {
        invalidateMaintenanceCache();
      }
    }
  }

  // Invalidate the centralized settings cache so all subsystems pick up changes
  invalidateSettingsCache();

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: "settings.updated",
    target_type: "system_settings",
    result: results.every((r) => r.success) ? "SUCCESS" : "FAILED",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      updates: Object.entries(updates).map(([key, newValue]) => ({
        key,
        oldValue: currentValues.get(key) ?? null,
        newValue,
      })),
      results,
    },
  });

  const allSucceeded = results.every((r) => r.success);
  const failed = results.filter((r) => !r.success);
  if (!allSucceeded) {
    return fail(
      "BAD_REQUEST",
      failed.length === 1
        ? failed[0].error || "One setting couldn't be saved."
        : `${failed.length} settings couldn't be saved. Please review them and try again.`,
      207,
      {
        message: "Some settings failed to update",
        results,
      }
    );
  }
  return ok({
    message: "All settings updated successfully",
    results,
  });
}
