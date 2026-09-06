-- ============================================================
-- DUMPR — Private 'dump-files' Storage Bucket & Schema Updates
-- Migration: 00005_dump_files_bucket.sql
-- ============================================================

-- 1. Create or update private 'dump-files' bucket with 70MB (73400320 bytes) limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dump-files',
  'dump-files',
  false,
  73400320, -- 70 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 73400320,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2. Storage RLS Policies for 'dump-files'
-- ============================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "dump_files_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "dump_files_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "dump_files_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "dump_files_admin_delete" ON storage.objects;

-- Admin can view all objects in dump-files
CREATE POLICY "dump_files_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dump-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Admin can upload objects to dump-files
CREATE POLICY "dump_files_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dump-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Admin can update objects in dump-files
CREATE POLICY "dump_files_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dump-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Admin can delete objects in dump-files
CREATE POLICY "dump_files_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dump-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================
-- 3. Update public.files schema with display_name & uploaded_by
-- ============================================================

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill display_name from name if null
UPDATE public.files
SET display_name = name
WHERE display_name IS NULL;

-- Backfill uploaded_by from owner_id if null
UPDATE public.files
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL;

-- Ensure storage_bucket default is 'dump-files'
ALTER TABLE public.files
  ALTER COLUMN storage_bucket SET DEFAULT 'dump-files';
