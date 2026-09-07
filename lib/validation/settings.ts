import { z } from "zod";

/**
 * Zod schema for validating system_settings values.
 */

export const systemSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  description: z.string().max(500).optional(),
  is_public: z.boolean().optional(),
});

/** Known settings keys with their expected value types */
export const KNOWN_SETTINGS = {
  // ── General & Branding ──
  "app.name": z.string(),
  "app.version": z.string(),
  "app.site_name": z.string().min(1).max(50),
  "app.site_description": z.string().max(250),
  "app.maintenance_mode": z.boolean(),
  "app.max_users": z.number().int().min(1).max(100),

  // ── Auth & Access ──
  "auth.allow_registration": z.boolean(),
  "auth.default_role": z.enum(["viewer", "member"]),

  // ── Storage & Limits ──
  "storage.storage_cap_bytes": z.number().positive(),
  "storage.max_file_size_bytes": z.number().positive(),
  "storage.default_quota_bytes": z.number().positive(),
  "storage.retention_days": z.number().int().min(1).max(365),
  "storage.allowed_file_types": z.string().min(1).max(500),

  // ── Security & Privacy ──
  "security.public_browsing": z.boolean(),
  "security.session_timeout_hours": z.number().int().min(1).max(720),

  // ── UI ──
  "posts.allow_public_comments": z.boolean(),
  "ui.default_theme": z.enum(["system", "light", "dark"]),
} as const;

export type SettingKey = keyof typeof KNOWN_SETTINGS;

