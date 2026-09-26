-- ============================================================
-- DUMPR — 10-Feature Evolution: posts, attachments, versions, bookmarks
-- Migration: 00008_ten_feature_evolution.sql
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ─── 1. Post feature columns (F2 code posts + F10 pins) ───
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'article';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_post_type_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_post_type_check CHECK (post_type IN ('article', 'code'));
  END IF;
END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS code_language TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS code_filename TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts (is_pinned, pinned_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_posts_type ON public.posts (post_type);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON public.posts USING GIN (tags);

-- ─── 2. Post attachments junction (F3 + F9) ───
CREATE TABLE IF NOT EXISTS public.post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(post_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_post_attachments_post ON public.post_attachments (post_id, display_order);
CREATE INDEX IF NOT EXISTS idx_post_attachments_file ON public.post_attachments (file_id);

-- ─── 3. Post version history (F10) ───
CREATE TABLE IF NOT EXISTS public.post_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  tags TEXT[],
  post_type TEXT DEFAULT 'article',
  code_language TEXT DEFAULT NULL,
  code_filename TEXT DEFAULT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_summary TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(post_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_post_versions_post ON public.post_versions (post_id, version_number DESC);

-- ─── 4. User bookmarks (F8) ───
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('file', 'post')),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON public.user_bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_item ON public.user_bookmarks (item_type, item_id);

-- ─── 5. Files metadata GIN index (F5 advanced search) ───
CREATE INDEX IF NOT EXISTS idx_files_metadata_gin ON public.files USING GIN (metadata);

-- ─── 6. RLS ───
ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;

-- Post attachments: public read for published posts, admin write
DROP POLICY IF EXISTS "post_attachments_select_public" ON public.post_attachments;
CREATE POLICY "post_attachments_select_public"
  ON public.post_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_attachments.post_id
        AND ((p.status = 'published' AND p.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin')))
    )
  );

DROP POLICY IF EXISTS "post_attachments_admin_write" ON public.post_attachments;
CREATE POLICY "post_attachments_admin_write"
  ON public.post_attachments FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin')));

-- Post versions: admin-only
DROP POLICY IF EXISTS "post_versions_admin_all" ON public.post_versions;
CREATE POLICY "post_versions_admin_all"
  ON public.post_versions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin')));

-- Bookmarks: owner-only
DROP POLICY IF EXISTS "user_bookmarks_owner_all" ON public.user_bookmarks;
CREATE POLICY "user_bookmarks_owner_all"
  ON public.user_bookmarks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
