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
  "app.name": z.string(),
  "app.version": z.string(),
  "app.maintenance_mode": z.boolean(),
  "storage.max_file_size_bytes": z.number().positive(),
  "storage.default_quota_bytes": z.number().positive(),
  "posts.allow_public_comments": z.boolean(),
  "ui.default_theme": z.enum(["system", "light", "dark"]),
} as const;

export type SettingKey = keyof typeof KNOWN_SETTINGS;
