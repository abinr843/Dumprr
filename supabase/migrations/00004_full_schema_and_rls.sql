-- ============================================================
-- DUMPR — Full Database Schema & Row Level Security Finalization
-- Migration: 00004_full_schema_and_rls.sql
-- ============================================================
-- Architecture: Single-Admin Publishing & Public File Sharing
-- - Content statuses: active, trash, deleted
-- - Soft delete tracking (deleted_at TIMESTAMPTZ)
-- - Public / Visitor read & download access for active content
-- - Admin-only write permissions (upload, create, update, delete)
-- - Server-only audit logging (immutable, no regular client access)
-- - Full search indexing (Trigram GIN & Full-Text Search)
-- ============================================================

-- ============================================================
-- 1. ENUMS & EXTENSIONS
-- ============================================================

-- Enable trigram extension for fuzzy/substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Content lifecycle status enum
DO $$ BEGIN
  CREATE TYPE public.content_status AS ENUM ('active', 'trash', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Expand post_status if not already present
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'trash';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'deleted';

-- ============================================================
-- 2. ALTER TABLES: STATUS, SOFT-DELETE, EXTENSION, DOWNLOADS
-- ============================================================

-- 2.1 FOLDERS: status, deleted_at
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS status public.content_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2.2 FILES: status, extension, download_count, deleted_at
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS status public.content_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS extension TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS download_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2.3 POSTS: deleted_at
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 3. HELPER FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-extract and populate file extension on file insert/update
CREATE OR REPLACE FUNCTION public.set_file_extension()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.extension IS NULL OR NEW.extension = '' THEN
    NEW.extension := LOWER(substring(NEW.name from '\.([^\.]+)$'));
  ELSE
    NEW.extension := LOWER(NEW.extension);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_files_set_extension ON public.files;
CREATE TRIGGER trg_files_set_extension
  BEFORE INSERT OR UPDATE OF name, extension ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_file_extension();

-- Secure function to increment download counter for public downloads
CREATE OR REPLACE FUNCTION public.increment_file_downloads(target_file_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.files
  SET download_count = download_count + 1
  WHERE id = target_file_id
    AND status = 'active'
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_file_downloads(UUID) TO anon, authenticated;

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Ensure RLS is active on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4.1 FOLDERS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "folders_select_own" ON public.folders;
DROP POLICY IF EXISTS "folders_insert_own" ON public.folders;
DROP POLICY IF EXISTS "folders_update_own" ON public.folders;
DROP POLICY IF EXISTS "folders_delete_own" ON public.folders;
DROP POLICY IF EXISTS "folders_select_public_active" ON public.folders;
DROP POLICY IF EXISTS "folders_admin_manage" ON public.folders;
DROP POLICY IF EXISTS "folders_admin_insert" ON public.folders;
DROP POLICY IF EXISTS "folders_admin_update" ON public.folders;
DROP POLICY IF EXISTS "folders_admin_delete" ON public.folders;

-- Visitors (anon & authenticated) can browse active folders; Admins see all
CREATE POLICY "folders_select_public_active"
  ON public.folders FOR SELECT
  USING (
    (status = 'active' AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- Admin-only write policies
CREATE POLICY "folders_admin_insert"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "folders_admin_update"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "folders_admin_delete"
  ON public.folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- ------------------------------------------------------------
-- 4.2 FILES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "files_select_own_or_public" ON public.files;
DROP POLICY IF EXISTS "files_insert_own" ON public.files;
DROP POLICY IF EXISTS "files_update_own" ON public.files;
DROP POLICY IF EXISTS "files_delete_own" ON public.files;
DROP POLICY IF EXISTS "files_select_public_active" ON public.files;
DROP POLICY IF EXISTS "files_admin_manage" ON public.files;
DROP POLICY IF EXISTS "files_admin_insert" ON public.files;
DROP POLICY IF EXISTS "files_admin_update" ON public.files;
DROP POLICY IF EXISTS "files_admin_delete" ON public.files;

-- Visitors (anon & authenticated) can browse & download active files; Admins see all
CREATE POLICY "files_select_public_active"
  ON public.files FOR SELECT
  USING (
    (status = 'active' AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- Admin-only write policies
CREATE POLICY "files_admin_insert"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "files_admin_update"
  ON public.files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "files_admin_delete"
  ON public.files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- ------------------------------------------------------------
-- 4.3 POSTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "posts_select_published" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
DROP POLICY IF EXISTS "posts_admin_manage" ON public.posts;
DROP POLICY IF EXISTS "posts_select_public_published" ON public.posts;
DROP POLICY IF EXISTS "posts_admin_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_admin_update" ON public.posts;
DROP POLICY IF EXISTS "posts_admin_delete" ON public.posts;

-- Visitors can read published posts; Admins see all posts
CREATE POLICY "posts_select_public_published"
  ON public.posts FOR SELECT
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- Admin-only write policies
CREATE POLICY "posts_admin_insert"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "posts_admin_update"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "posts_admin_delete"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- ------------------------------------------------------------
-- 4.4 AUDIT LOGS — Locked down from regular clients
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_own" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;

-- Strictly admin-only SELECT
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- No INSERT/UPDATE/DELETE policies for client roles.
-- Writes are performed exclusively server-side using the service role key.

-- ------------------------------------------------------------
-- 4.5 SYSTEM SETTINGS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "system_settings_select_public" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_authenticated" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update_admin" ON public.system_settings;

CREATE POLICY "system_settings_select_public"
  ON public.system_settings FOR SELECT
  USING (is_public = true);

CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "system_settings_admin_manage"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- 5. PERFORMANCE & SEARCH INDEXES
-- ============================================================

-- Files indexes
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON public.files USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_orig_name_trgm ON public.files USING gin (original_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_extension ON public.files (extension);
CREATE INDEX IF NOT EXISTS idx_files_folder_status ON public.files (folder_id, status) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_status_deleted ON public.files (status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_downloads ON public.files (download_count DESC);

-- Folders indexes
CREATE INDEX IF NOT EXISTS idx_folders_name_trgm ON public.folders USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_folders_parent_status ON public.folders (parent_id, status) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_status_deleted ON public.folders (status, deleted_at);

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON public.posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_fts ON public.posts USING gin (to_tsvector('english', title || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON public.posts (status, published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status_deleted ON public.posts (status, deleted_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.audit_logs (action, created_at DESC);
