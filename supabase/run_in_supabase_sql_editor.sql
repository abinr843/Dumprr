-- ============================================================
-- DUMPR — ALL-IN-ONE CONSOLIDATED DATABASE SCHEMA & STORAGE
-- Run this script in the Supabase Dashboard -> SQL Editor
-- URL: https://supabase.com/dashboard/project/iekpmjpwkdvbaedltxis/sql/new
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('viewer', 'member', 'admin', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.post_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_status AS ENUM ('active', 'trash', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Utility Functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_file_extension()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name ~ '\.[a-zA-Z0-9]+$' THEN
    NEW.extension = lower(substring(NEW.name from '\.([a-zA-Z0-9]+)$'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

GRANT EXECUTE ON FUNCTION public.increment_file_downloads(UUID) TO anon, authenticated, service_role;

-- 4. Tables

-- 4.1 PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- 4.2 FOLDERS
CREATE TABLE IF NOT EXISTS public.folders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id   UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  path        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  status      public.content_status NOT NULL DEFAULT 'active',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.3 FILES
CREATE TABLE IF NOT EXISTS public.files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id       UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  display_name    TEXT,
  original_name   TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  extension       TEXT,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  storage_bucket  TEXT NOT NULL DEFAULT 'dump-files',
  storage_path    TEXT NOT NULL UNIQUE,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  download_count  BIGINT NOT NULL DEFAULT 0,
  status          public.content_status NOT NULL DEFAULT 'active',
  deleted_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for files
DROP TRIGGER IF EXISTS trg_files_set_extension ON public.files;
CREATE TRIGGER trg_files_set_extension
  BEFORE INSERT OR UPDATE OF name, extension ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_file_extension();

-- 4.4 POSTS
CREATE TABLE IF NOT EXISTS public.posts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  content            TEXT NOT NULL DEFAULT '',
  excerpt            TEXT NOT NULL DEFAULT '',
  status             public.post_status NOT NULL DEFAULT 'draft',
  featured_image_url TEXT NOT NULL DEFAULT '',
  tags               TEXT[] NOT NULL DEFAULT '{}',
  published_at       TIMESTAMPTZ,
  deleted_at         TIMESTAMPTZ,
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.5 AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.6 SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public   BOOLEAN NOT NULL DEFAULT false,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper Admin Predicate Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Files Policies: Public read-only on active; Admin full write
DROP POLICY IF EXISTS "files_public_read_active" ON public.files;
CREATE POLICY "files_public_read_active" ON public.files FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "files_admin_all" ON public.files;
CREATE POLICY "files_admin_all" ON public.files FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Folders Policies: Public read-only on active; Admin full write
DROP POLICY IF EXISTS "folders_public_read_active" ON public.folders;
CREATE POLICY "folders_public_read_active" ON public.folders FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "folders_admin_all" ON public.folders;
CREATE POLICY "folders_admin_all" ON public.folders FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Posts Policies: Public read published; Admin full write
DROP POLICY IF EXISTS "posts_public_read_published" ON public.posts;
CREATE POLICY "posts_public_read_published" ON public.posts FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "posts_admin_all" ON public.posts;
CREATE POLICY "posts_admin_all" ON public.posts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Audit Logs Policies: Read-only for admin; Insertable by service role/admin
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- System Settings Policies: Public settings visible, Admin can manage all
DROP POLICY IF EXISTS "settings_public_read" ON public.system_settings;
CREATE POLICY "settings_public_read" ON public.system_settings FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "settings_admin_all" ON public.system_settings;
CREATE POLICY "settings_admin_all" ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Storage Bucket & Policies for 'dump-files'
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dump-files', 'dump-files', false, 73400320)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "dump_files_admin_select" ON storage.objects;
CREATE POLICY "dump_files_admin_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dump-files' AND public.is_admin());

DROP POLICY IF EXISTS "dump_files_admin_insert" ON storage.objects;
CREATE POLICY "dump_files_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dump-files' AND public.is_admin());

DROP POLICY IF EXISTS "dump_files_admin_delete" ON storage.objects;
CREATE POLICY "dump_files_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dump-files' AND public.is_admin());

-- 7. Seed Admin Profile for abinrphilip34@gmail.com
INSERT INTO public.profiles (id, username, full_name, role)
SELECT id, 'admin', 'DUMPR Administrator', 'superadmin'::public.user_role
FROM auth.users
WHERE email = 'abinrphilip34@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'superadmin'::public.user_role,
  username = 'admin';
