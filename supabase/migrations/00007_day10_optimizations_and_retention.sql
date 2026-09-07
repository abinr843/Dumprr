-- ============================================================
-- DUMPR — Day 10: Optimization Indexes, Retention Support, Settings
-- Migration: 00007_day10_optimizations_and_retention.sql
-- ============================================================

-- ============================================================
-- 1. PERFORMANCE INDEXES FOR FEED & CLEANUP
-- ============================================================

-- Composite index for /api/feed/recent file query
CREATE INDEX IF NOT EXISTS idx_files_active_feed
  ON public.files (created_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Composite index for /api/feed/recent post query
CREATE INDEX IF NOT EXISTS idx_posts_active_feed
  ON public.posts (published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- Index for trash retention cleanup
CREATE INDEX IF NOT EXISTS idx_files_trash_cleanup
  ON public.files (deleted_at)
  WHERE status = 'trash';

CREATE INDEX IF NOT EXISTS idx_folders_trash_cleanup
  ON public.folders (deleted_at)
  WHERE status = 'trash';

CREATE INDEX IF NOT EXISTS idx_posts_trash_cleanup
  ON public.posts (deleted_at)
  WHERE status = 'trash';

-- ============================================================
-- 2. SEED DAY 10 SYSTEM SETTINGS
-- ============================================================

INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
  ('app.max_users', '20', 'Maximum number of registered users', false),
  ('storage.storage_cap_bytes', '8589934592', 'Total application storage limit in bytes (8 GB)', false),
  ('storage.max_file_size_bytes', '73400320', 'Maximum single file upload size in bytes (70 MB)', false),
  ('storage.retention_days', '7', 'Days to retain trashed items before permanent deletion', false)
ON CONFLICT (key) DO NOTHING;
