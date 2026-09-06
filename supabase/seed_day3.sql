-- ============================================================
-- DUMPR — Day 3 Development & Testing Seed Data
-- File: supabase/seed_day3.sql
-- ============================================================
-- Seeds:
-- 1. Admin Profile reference
-- 2. Hierarchical folder tree (active, trash, deleted)
-- 3. Diverse file catalog (.pdf, .png, .mp4, .zip, .csv, .iso)
--    with active downloadable files, trashed files, and soft-deleted files
-- 4. Sample posts (published active, draft, trashed)
-- 5. System settings
-- ============================================================

DO $$
DECLARE
  _admin_id UUID;
  _docs_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  _legal_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
  _media_id UUID := '33333333-3333-3333-3333-333333333333'::UUID;
  _software_id UUID := '44444444-4444-4444-4444-444444444444'::UUID;
  _trash_folder_id UUID := '55555555-5555-5555-5555-555555555555'::UUID;
  _del_folder_id UUID := '66666666-6666-6666-6666-666666666666'::UUID;
BEGIN
  -- Look for the admin user
  SELECT id INTO _admin_id
  FROM auth.users
  WHERE email = 'abinrphilip34@gmail.com'
  LIMIT 1;

  IF _admin_id IS NULL THEN
    SELECT id INTO _admin_id FROM auth.users LIMIT 1;
  END IF;

  IF _admin_id IS NULL THEN
    RAISE NOTICE 'No auth user found. Please run seed:admin first.';
    RETURN;
  END IF;

  -- Ensure admin profile is superadmin
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (_admin_id, 'admin', 'DUMPR Administrator', 'superadmin')
  ON CONFLICT (id) DO UPDATE SET role = 'superadmin';

  -- ----------------------------------------------------------
  -- 1. SEED FOLDERS
  -- ----------------------------------------------------------
  INSERT INTO public.folders (id, name, parent_id, owner_id, path, color, is_favorite, status, deleted_at)
  VALUES
    (_docs_id, 'Documents', NULL, _admin_id, '/Documents', '#6366f1', true, 'active', NULL),
    (_legal_id, 'Legal & Contracts', _docs_id, _admin_id, '/Documents/Legal & Contracts', '#6366f1', false, 'active', NULL),
    (_media_id, 'Media & Assets', NULL, _admin_id, '/Media & Assets', '#ec4899', true, 'active', NULL),
    (_software_id, 'Software & Tools', NULL, _admin_id, '/Software & Tools', '#10b981', false, 'active', NULL),
    (_trash_folder_id, 'Archived Reports 2025', _docs_id, _admin_id, '/Documents/Archived Reports 2025', '#94a3b8', false, 'trash', now() - interval '2 days'),
    (_del_folder_id, 'Old Backups', NULL, _admin_id, '/Old Backups', '#64748b', false, 'deleted', now() - interval '30 days')
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    deleted_at = EXCLUDED.deleted_at;

  -- ----------------------------------------------------------
  -- 2. SEED FILES
  -- ----------------------------------------------------------
  INSERT INTO public.files (id, folder_id, owner_id, name, original_name, mime_type, extension, size_bytes, storage_bucket, storage_path, is_public, download_count, status, deleted_at)
  VALUES
    -- Active files in Documents
    ('a0000001-0000-0000-0000-000000000001'::UUID, _docs_id, _admin_id, 'Platform_Overview.pdf', 'Platform_Overview.pdf', 'application/pdf', 'pdf', 2450000, 'files', 'docs/Platform_Overview.pdf', true, 42, 'active', NULL),
    ('a0000002-0000-0000-0000-000000000002'::UUID, _legal_id, _admin_id, 'Master_Service_Agreement_v3.pdf', 'Master_Service_Agreement_v3.pdf', 'application/pdf', 'pdf', 1200000, 'files', 'docs/Master_Service_Agreement_v3.pdf', true, 18, 'active', NULL),
    ('a0000003-0000-0000-0000-000000000003'::UUID, _docs_id, _admin_id, 'financial_projection_2026.csv', 'financial_projection_2026.csv', 'text/csv', 'csv', 85000, 'files', 'docs/financial_projection_2026.csv', true, 19, 'active', NULL),

    -- Active files in Media
    ('a0000004-0000-0000-0000-000000000004'::UUID, _media_id, _admin_id, 'brand_logo_master.png', 'brand_logo_master.png', 'image/png', 'png', 1048576, 'files', 'media/brand_logo_master.png', true, 128, 'active', NULL),
    ('a0000005-0000-0000-0000-000000000005'::UUID, _media_id, _admin_id, 'intro_walkthrough.mp4', 'intro_walkthrough.mp4', 'video/mp4', 'mp4', 25000000, 'files', 'media/intro_walkthrough.mp4', true, 75, 'active', NULL),

    -- Active files in Software
    ('a0000006-0000-0000-0000-000000000006'::UUID, _software_id, _admin_id, 'dumpr_toolkit.zip', 'dumpr_toolkit.zip', 'application/zip', 'zip', 12500000, 'files', 'tools/dumpr_toolkit.zip', true, 201, 'active', NULL),
    ('a0000007-0000-0000-0000-000000000007'::UUID, _software_id, _admin_id, 'system_firmware_v2.iso', 'system_firmware_v2.iso', 'application/x-iso9660-image', 'iso', 45000000, 'files', 'tools/system_firmware_v2.iso', true, 310, 'active', NULL),
    ('a0000008-0000-0000-0000-000000000008'::UUID, _software_id, _admin_id, 'api_specification.json', 'api_specification.json', 'application/json', 'json', 32000, 'files', 'tools/api_specification.json', true, 54, 'active', NULL),

    -- Trashed files (in Trash)
    ('a0000009-0000-0000-0000-000000000009'::UUID, _docs_id, _admin_id, 'outdated_contract_draft.docx', 'outdated_contract_draft.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 520000, 'files', 'trash/outdated_contract_draft.docx', false, 3, 'trash', now() - interval '1 day'),
    ('a0000010-0000-0000-0000-000000000010'::UUID, _media_id, _admin_id, 'corrupted_recording.mp4', 'corrupted_recording.mp4', 'video/mp4', 'mp4', 15000000, 'files', 'trash/corrupted_recording.mp4', false, 0, 'trash', now() - interval '3 days'),

    -- Soft-deleted files
    ('a0000011-0000-0000-0000-000000000011'::UUID, _del_folder_id, _admin_id, 'deprecated_api_key_dump.txt', 'deprecated_api_key_dump.txt', 'text/plain', 'txt', 1200, 'files', 'deleted/deprecated_api_key_dump.txt', false, 0, 'deleted', now() - interval '20 days')
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    extension = EXCLUDED.extension,
    download_count = EXCLUDED.download_count,
    deleted_at = EXCLUDED.deleted_at;

  -- ----------------------------------------------------------
  -- 3. SEED POSTS
  -- ----------------------------------------------------------
  INSERT INTO public.posts (id, author_id, title, slug, content, excerpt, status, featured_image_url, tags, published_at, deleted_at)
  VALUES
    ('b0000001-0000-0000-0000-000000000001'::UUID, _admin_id, 'Welcome to DUMPR', 'welcome-to-dumpr', '# Welcome to DUMPR\n\nYour centralized platform for accessing curated file archives, media toolkits, and software bundles.', 'Platform introduction and guide for visitors.', 'published', '', ARRAY['announcement', 'guide'], now() - interval '5 days', NULL),
    ('b0000002-0000-0000-0000-000000000002'::UUID, _admin_id, 'September 2026 File Catalog Released', 'september-2026-file-catalog-released', '# September 2026 Catalog\n\nAll tools, documents, and firmware bundles have been updated to latest versions.', 'Overview of latest files and toolkits.', 'published', '', ARRAY['updates', 'downloads'], now() - interval '1 day', NULL),
    ('b0000003-0000-0000-0000-000000000003'::UUID, _admin_id, 'Upcoming Network Firmware v3', 'upcoming-network-firmware-v3', '# Draft Notes\n\nUpcoming changes in firmware v3.', 'Draft notes on upcoming firmware.', 'draft', '', ARRAY['firmware', 'draft'], NULL, NULL),
    ('b0000004-0000-0000-0000-000000000004'::UUID, _admin_id, 'Old Legacy Service Discontinuation', 'old-legacy-service-discontinuation', '# Deprecated notice', 'Old announcement now in trash.', 'trash', '', ARRAY['archived'], now() - interval '60 days', now() - interval '2 days')
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    deleted_at = EXCLUDED.deleted_at;

  -- ----------------------------------------------------------
  -- 4. SYSTEM SETTINGS
  -- ----------------------------------------------------------
  INSERT INTO public.system_settings (key, value, description, is_public, updated_by)
  VALUES
    ('platform_name', '"DUMPR"', 'Application title', true, _admin_id),
    ('max_upload_size_mb', '100', 'Maximum file size allowed in megabytes', true, _admin_id),
    ('allow_public_downloads', 'true', 'Whether public visitors can download files', true, _admin_id),
    ('admin_contact', '"abinrphilip34@gmail.com"', 'Public administrator contact email', true, _admin_id)
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    is_public = EXCLUDED.is_public;

  RAISE NOTICE 'Day 3 seed data successfully applied.';
END $$;
