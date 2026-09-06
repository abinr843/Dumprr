-- ============================================================
-- DUMPR — Storage Buckets & Policies
-- Migration: 00002_storage_setup.sql
-- ============================================================

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('files', 'files', false, 104857600, NULL),       -- 100 MB, private, all types
  ('avatars', 'avatars', true, 5242880, ARRAY[       -- 5 MB, public, images only
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
  ]);

-- ============================================================
-- 2. Storage RLS Policies — files bucket
-- ============================================================

-- Users can view their own files
CREATE POLICY "files_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can upload to their own folder
CREATE POLICY "files_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files
CREATE POLICY "files_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "files_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 3. Storage RLS Policies — avatars bucket
-- ============================================================

-- Anyone can view avatars (public bucket)
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
