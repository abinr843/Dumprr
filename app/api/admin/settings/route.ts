import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateAdminApi,
  getRequestContext,
} from "@/lib/permissions/api-guard";
import { logAction } from "@/lib/logging/log-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Allowed setting keys and their validators */
const EDITABLE_SETTINGS: Record<string, (v: unknown) => boolean> = {
  // General & Branding
  "app.site_name": (v) => typeof v === "string" && v.length >= 1 && v.length <= 50,
  "app.site_description": (v) => typeof v === "string" && v.length <= 250,
  "app.max_users": (v) => typeof v === "number" && v >= 1 && v <= 100,
  "app.maintenance_mode": (v) => typeof v === "boolean",

  // Auth & Access
  "auth.allow_registration": (v) => typeof v === "boolean",
  "auth.default_role": (v) => v === "viewer" || v === "member",

  // Storage & Limits
  "storage.storage_cap_bytes": (v) => typeof v === "number" && v > 0,
  "storage.max_file_size_bytes": (v) => typeof v === "number" && v > 0,
  "storage.retention_days": (v) => typeof v === "number" && v >= 1 && v <= 365,
  "storage.allowed_file_types": (v) => typeof v === "string" && v.length >= 1 && v.length <= 500,

  // Security & Privacy
  "security.public_browsing": (v) => typeof v === "boolean",
  "security.session_timeout_hours": (v) => typeof v === "number" && v >= 1 && v <= 720,
};

/**
 * GET /api/admin/settings
 * Returns all system settings.
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
    return NextResponse.json(
      { error: `Failed to fetch settings: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: settings || [] });
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
    return NextResponse.json(
      { error: "No settings provided. Expected: { settings: { key: value } }" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const results: Array<{ key: string; success: boolean; error?: string }> = [];

  for (const [key, value] of Object.entries(updates)) {
    // Validate key is editable
    const validator = EDITABLE_SETTINGS[key];
    if (!validator) {
      results.push({ key, success: false, error: `Unknown or non-editable setting key` });
      continue;
    }

    // Validate value type
    if (!validator(value)) {
      results.push({ key, success: false, error: `Invalid value for setting` });
      continue;
    }

    // Upsert the setting
    const { error: upsertError } = await admin
      .from("system_settings")
      .upsert({
        key,
        value: JSON.stringify(value),
        updated_by: guard.auth.user.id,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      results.push({ key, success: false, error: upsertError.message });
    } else {
      results.push({ key, success: true });
    }
  }

  await logAction({
    actor_user_id: guard.auth.user.id,
    action: "settings.updated",
    target_type: "system_settings",
    result: results.every((r) => r.success) ? "SUCCESS" : "FAILED",
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { updates: Object.keys(updates), results },
  });

  const allSucceeded = results.every((r) => r.success);
  return NextResponse.json({
    message: allSucceeded ? "All settings updated successfully" : "Some settings failed to update",
    results,
  }, { status: allSucceeded ? 200 : 207 });
}
