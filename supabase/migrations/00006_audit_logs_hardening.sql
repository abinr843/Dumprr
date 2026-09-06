-- Migration 00006: Audit Logs Hardening (Day 7)
--
-- Adds `target_name` and `result` columns to the existing audit_logs table
-- to support the Day 7 centralised logging engine, and creates a composite
-- index for efficient filtering by action + result.
--
-- Safe to run on Supabase SQL Editor.
-- These columns are optional (nullable/defaulted) so existing insert
-- patterns from Days 2-6 continue to work without modification.

-- 1. Add new columns (IF NOT EXISTS is not supported for ALTER TABLE ADD COLUMN
--    in all PG versions, so we use a DO block for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'target_name'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN target_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'result'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN result TEXT DEFAULT 'SUCCESS';
  END IF;
END
$$;

-- 2. Add composite index for efficient audit log queries by action + result
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_result
  ON public.audit_logs (action, result, created_at DESC);

-- 3. Add composite index for security event filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_result_created
  ON public.audit_logs (result, created_at DESC);

-- 4. Add comment
COMMENT ON COLUMN public.audit_logs.target_name IS 'Human-readable name of the target entity (filename, post title, etc.)';
COMMENT ON COLUMN public.audit_logs.result IS 'Outcome of the action: SUCCESS or FAILED';
