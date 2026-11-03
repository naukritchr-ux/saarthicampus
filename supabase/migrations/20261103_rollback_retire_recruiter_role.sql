-- ============================================================================
-- Rollback Migration: 20261103_rollback_retire_recruiter_role.sql
-- Description: Rollback recruiter role retirement migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(approved, false) FROM public.profiles WHERE id = auth.uid();
$$;
