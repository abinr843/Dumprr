/**
 * Centralized System Settings Service
 *
 * Provides high-performance, strongly-typed access to all system_settings
 * with a TTL-based in-memory cache (15-second default). All subsystems
 * should use these accessors instead of direct DB queries.
 *
 * Cache is invalidated on-demand when settings are updated via the admin API.
 */

import { createClient } from "@supabase/supabase-js";
import { normalizeAllowedExtensions } from "@/lib/storage/file-validation";

// ─── Types ──────────────────────────────────────────────────────────

export interface SystemSettingRow {
  key: string;
  value: unknown;
  description: string | null;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
}

// ─── Cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15_000; // 15 seconds

interface CacheEntry {
  settings: Map<string, unknown>;
  expiresAt: number;
}

let settingsCache: CacheEntry | null = null;

/**
 * Invalidate the entire settings cache, or a single key.
 * Called by admin settings API routes after updates.
 */
export function invalidateSettingsCache(_key?: string): void {
  // Always invalidate the whole cache since settings are fetched in bulk
  settingsCache = null;
}

// ─── Internal Loader ────────────────────────────────────────────────

function createSettingsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for settings service."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadAllSettings(): Promise<Map<string, unknown>> {
  const now = Date.now();

  // Return from cache if fresh
  if (settingsCache && settingsCache.expiresAt > now) {
    return settingsCache.settings;
  }

  // Fetch from database
  const client = createSettingsClient();
  const { data, error } = await client
    .from("system_settings")
    .select("key, value")
    .order("key", { ascending: true });

  if (error) {
    console.error("[SystemSettings] Failed to load settings:", error.message);
    // Return stale cache if available, otherwise empty
    return settingsCache?.settings ?? new Map();
  }

  const map = new Map<string, unknown>();
  for (const row of data || []) {
    // JSONB values from Supabase come as parsed primitives.
    // Some older seeds stored stringified JSON (e.g., '"DUMPR"' or '"true"').
    // Unwrap those here so consumers always get clean primitives.
    let val = row.value;
    if (typeof val === "string") {
      try {
        val = JSON.parse(val);
      } catch {
        // Not valid JSON — keep as-is (plain string)
      }
    }
    map.set(row.key, val);
  }

  settingsCache = { settings: map, expiresAt: now + CACHE_TTL_MS };
  return map;
}

// ─── Generic Getter ─────────────────────────────────────────────────

/**
 * Get a single setting value by key, with a typed fallback default.
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const settings = await loadAllSettings();
  const val = settings.get(key);
  if (val === undefined || val === null) return defaultValue;

  // Type coercion for common mismatches (e.g., "20" → 20 for numbers)
  if (typeof defaultValue === "number" && typeof val === "string") {
    const parsed = Number(val);
    return (isNaN(parsed) ? defaultValue : parsed) as T;
  }
  if (typeof defaultValue === "boolean" && typeof val === "string") {
    return (val === "true") as unknown as T;
  }

  return val as T;
}

// ─── Strongly-Typed Accessors ───────────────────────────────────────

// ── General & Branding ──

export async function getSiteName(): Promise<string> {
  return getSetting("app.site_name", "DUMPR");
}

export async function getSiteDescription(): Promise<string> {
  return getSetting(
    "app.site_description",
    "Secure File Sharing & Announcement Workspace"
  );
}

export async function getSiteBranding(): Promise<{
  name: string;
  description: string;
}> {
  const [name, description] = await Promise.all([
    getSiteName(),
    getSiteDescription(),
  ]);
  return { name, description };
}

export async function getMaintenanceMode(): Promise<boolean> {
  return getSetting("app.maintenance_mode", false);
}

// ── Auth & Access ──

export async function getMaxUsers(): Promise<number> {
  return getSetting("app.max_users", 20);
}

export async function getAllowRegistration(): Promise<boolean> {
  return getSetting("auth.allow_registration", false);
}

export async function getDefaultUserRole(): Promise<"viewer" | "member"> {
  const role = await getSetting("auth.default_role", "member");
  return role === "viewer" ? "viewer" : "member";
}

export async function getRegistrationConfig(): Promise<{
  allowed: boolean;
  defaultRole: "viewer" | "member";
  maxUsers: number;
}> {
  const [allowed, defaultRole, maxUsers] = await Promise.all([
    getAllowRegistration(),
    getDefaultUserRole(),
    getMaxUsers(),
  ]);
  return { allowed, defaultRole, maxUsers };
}

// ── Storage & Limits ──

export async function getStorageCapBytes(): Promise<number> {
  return getSetting("storage.storage_cap_bytes", 8 * 1024 * 1024 * 1024);
}

export async function getMaxFileSizeBytes(): Promise<number> {
  return getSetting("storage.max_file_size_bytes", 70 * 1024 * 1024);
}

export async function getDefaultQuotaBytes(): Promise<number> {
  return getSetting("storage.default_quota_bytes", 5 * 1024 * 1024 * 1024);
}

export async function getRetentionDays(): Promise<number> {
  return getSetting("storage.retention_days", 7);
}

export async function getAllowedFileTypes(): Promise<string[] | "*"> {
  const val = await getSetting("storage.allowed_file_types", "*");
  return normalizeAllowedExtensions(val);
}

// ── Security & Privacy ──

export async function getPublicBrowsingAllowed(): Promise<boolean> {
  return getSetting("security.public_browsing", true);
}

export async function getSessionTimeoutHours(): Promise<number> {
  return getSetting("security.session_timeout_hours", 72);
}

// ── UI ──

export async function getDefaultTheme(): Promise<
  "system" | "light" | "dark"
> {
  const theme = await getSetting("ui.default_theme", "system");
  if (theme === "light" || theme === "dark") return theme;
  return "system";
}

// ── Posts ──

export async function getAllowPublicComments(): Promise<boolean> {
  return getSetting("posts.allow_public_comments", true);
}
