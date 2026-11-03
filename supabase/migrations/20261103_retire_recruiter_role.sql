-- ============================================================================
-- Migration: 20261103_retire_recruiter_role.sql
-- Description: Permanently retire the Recruiter role from database access.
-- Preserves all historical records, foreign keys, and profiles untouched.
-- Ensures that any existing recruiter account cannot access data via RLS.
-- ============================================================================

-- 1. Update get_current_user_role() to return 'recruiter_retired' for recruiter accounts
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN role = 'recruiter' THEN 'recruiter_retired'
    ELSE role
  END
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- 2. Update is_user_approved() to return false for recruiter accounts
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN role = 'recruiter' THEN false
    ELSE COALESCE(approved, false)
  END
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- 3. Update direct profiles.role checks on legacy tables

-- candidate table
DROP POLICY IF EXISTS "Admin and Recruiter can view candidates" ON public.candidate;
CREATE POLICY "Admin can view candidates" ON public.candidate
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admin and Recruiter can update candidates" ON public.candidate;
CREATE POLICY "Admin can update candidates" ON public.candidate
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- corporate table
DROP POLICY IF EXISTS "Admin and Recruiter can view corporate" ON public.corporate;
CREATE POLICY "Admin can view corporate" ON public.corporate
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- campus table
DROP POLICY IF EXISTS "Admin and Recruiter can view campus" ON public.campus;
CREATE POLICY "Admin can view campus" ON public.campus
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- placement_coordinators table
DROP POLICY IF EXISTS "placement_coordinators_write_policy" ON public.placement_coordinators;
CREATE POLICY "placement_coordinators_write_policy" ON public.placement_coordinators
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.approved = true));

-- placement_coordinator_history table
DROP POLICY IF EXISTS "coord_history_insert_policy" ON public.placement_coordinator_history;
CREATE POLICY "coord_history_insert_policy" ON public.placement_coordinator_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.approved = true));

-- requirements table
DROP POLICY IF EXISTS "Recruiters can insert requirements" ON public.requirements;
CREATE POLICY "Admin can insert requirements" ON public.requirements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
