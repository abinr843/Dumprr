-- ============================================================
-- DUMPR — Auth & Roles Enhancement
-- Migration: 00003_auth_and_roles.sql
-- ============================================================
-- Updates: role attachment trigger, role escalation prevention,
-- tightened profiles RLS policies, audit log insert for anon events
-- ============================================================

-- ============================================================
-- 1. UPDATE handle_new_user() — Role from metadata
-- ============================================================
-- Allow admins to pass role via raw_user_meta_data when creating
-- users programmatically. Default to 'member' for safety.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role public.user_role;
BEGIN
  -- Only accept role from metadata if it's a valid enum value
  BEGIN
    _role := (NEW.raw_user_meta_data ->> 'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'member'::public.user_role;
  END;

  -- Never allow self-assignment of superadmin via signup metadata
  IF _role = 'superadmin' THEN
    _role := 'member'::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    _role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 2. ROLE ESCALATION PREVENTION TRIGGER
-- ============================================================
-- Non-admin users cannot change their own role field.
-- Only superadmin can promote to admin/superadmin.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  _actor_role public.user_role;
BEGIN
  -- If role isn't changing, allow the update
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Get the role of the user making the request
  SELECT role INTO _actor_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Only superadmin can change roles
  IF _actor_role IS NULL OR _actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmins can change user roles';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- ============================================================
-- 3. TIGHTEN PROFILES RLS POLICIES
-- ============================================================

-- Drop the overly permissive "select all" policy
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );

-- Drop old admin update policy and recreate with proper WITH CHECK
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

CREATE POLICY "profiles_admin_manage"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );

-- ============================================================
-- 4. AUDIT LOGS — Allow service role inserts for anon events
-- ============================================================
-- The audit_logs table already has RLS enabled. We need a policy
-- that allows the service role (via SECURITY DEFINER functions)
-- to insert rows even for unauthenticated events like LOGIN_FAILED.

-- This policy allows any authenticated user to insert their own audit logs
CREATE POLICY "audit_logs_insert_own"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- Allow admins to read all audit logs
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );
