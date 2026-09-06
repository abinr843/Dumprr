-- ============================================================
-- DUMPR — Seed Data
-- ============================================================

-- Default system settings
INSERT INTO public.system_settings (key, value, description, is_public) VALUES
  ('app.name', '"DUMPR"', 'Application display name', true),
  ('app.version', '"0.1.0"', 'Current application version', true),
  ('app.maintenance_mode', 'false', 'Enable maintenance mode to block non-admin access', false),
  ('storage.max_file_size_bytes', '104857600', 'Maximum single file upload size in bytes (100 MB)', false),
  ('storage.default_quota_bytes', '5368709120', 'Default storage quota per user in bytes (5 GB)', false),
  ('posts.allow_public_comments', 'true', 'Allow comments on published posts', true),
  ('ui.default_theme', '"system"', 'Default theme: system, light, or dark', true)
ON CONFLICT (key) DO NOTHING;
