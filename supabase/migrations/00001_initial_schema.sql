-- ============================================================
-- DUMPR — Initial Database Schema
-- Migration: 00001_initial_schema.sql
-- ============================================================
-- Tables: profiles, folders, files, posts, audit_logs, system_settings
-- All tables have Row Level Security (RLS) enabled.
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUMS
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('superadmin', 'admin', 'member', 'viewer');
CREATE TYPE public.post_status AS ENUM ('draft', 'published', 'archived');

-- ============================================================
-- 2. UTILITY FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    'member'::public.user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. TABLES
-- ============================================================

-- 3.1 PROFILES
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  role          public.user_role NOT NULL DEFAULT 'member',
  storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120, -- 5 GB
  storage_used_bytes  BIGINT NOT NULL DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profile extending auth.users';

-- 3.2 FOLDERS
CREATE TABLE public.folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path        TEXT NOT NULL DEFAULT '/',
  color       TEXT DEFAULT '#6366f1',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.folders IS 'Hierarchical folder structure for file organisation';

-- 3.3 FILES
CREATE TABLE public.files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id       UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  storage_bucket  TEXT NOT NULL DEFAULT 'files',
  storage_path    TEXT NOT NULL,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.files IS 'File metadata linked to Supabase Storage objects';

-- 3.4 POSTS
CREATE TABLE public.posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  content             TEXT NOT NULL DEFAULT '',
  excerpt             TEXT DEFAULT '',
  status              public.post_status NOT NULL DEFAULT 'draft',
  featured_image_url  TEXT DEFAULT '',
  tags                TEXT[] DEFAULT '{}',
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.posts IS 'Posts and announcements content';

-- 3.5 AUDIT LOGS
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at: audit logs are immutable
);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for security and compliance';

-- 3.6 SYSTEM SETTINGS
CREATE TABLE public.system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT DEFAULT '',
  is_public   BOOLEAN NOT NULL DEFAULT false,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'Global application configuration key-value store';

-- ============================================================
-- 4. INDEXES
-- ============================================================

-- Profiles
CREATE INDEX idx_profiles_username ON public.profiles (username);
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- Folders
CREATE INDEX idx_folders_owner_id ON public.folders (owner_id);
CREATE INDEX idx_folders_parent_id ON public.folders (parent_id);
CREATE INDEX idx_folders_path ON public.folders (path);

-- Files
CREATE INDEX idx_files_owner_id ON public.files (owner_id);
CREATE INDEX idx_files_folder_id ON public.files (folder_id);
CREATE INDEX idx_files_mime_type ON public.files (mime_type);
CREATE INDEX idx_files_is_public ON public.files (is_public);

-- Posts
CREATE INDEX idx_posts_author_id ON public.posts (author_id);
CREATE INDEX idx_posts_slug ON public.posts (slug);
CREATE INDEX idx_posts_status ON public.posts (status);
CREATE INDEX idx_posts_published_at ON public.posts (published_at DESC);

-- Audit Logs
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- System Settings
CREATE INDEX idx_system_settings_is_public ON public.system_settings (is_public);

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ----- PROFILES -----
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- ----- FOLDERS -----
CREATE POLICY "folders_select_own"
  ON public.folders FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "folders_insert_own"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "folders_update_own"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "folders_delete_own"
  ON public.folders FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ----- FILES -----
CREATE POLICY "files_select_own_or_public"
  ON public.files FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR is_public = true);

CREATE POLICY "files_insert_own"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "files_update_own"
  ON public.files FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "files_delete_own"
  ON public.files FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ----- POSTS -----
CREATE POLICY "posts_select_published"
  ON public.posts FOR SELECT
  TO authenticated
  USING (status = 'published' OR author_id = auth.uid());

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_admin_manage"
  ON public.posts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ----- AUDIT LOGS -----
CREATE POLICY "audit_logs_select_own"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "audit_logs_admin_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies — audit logs are immutable

-- ----- SYSTEM SETTINGS -----
CREATE POLICY "system_settings_select_public"
  ON public.system_settings FOR SELECT
  USING (is_public = true);

CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "system_settings_update_admin"
  ON public.system_settings FOR UPDATE
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
