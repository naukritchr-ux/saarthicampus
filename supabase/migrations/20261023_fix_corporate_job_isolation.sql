-- =====================================================================
-- Migration: 20261023_fix_corporate_job_isolation.sql
-- Description: Fix corporate company linking and job-visibility isolation
-- Database: Supabase PostgreSQL (SaarthiCampus)
-- Safety: Non-destructive, idempotent, preserves all existing tables and data
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FOREIGN KEY & INDEXING FOR JOB PROFILES
-- ---------------------------------------------------------------------
-- Ensure job_profiles.company_id is a foreign key to public.companies(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_profiles_company_id_fkey'
  ) THEN
    ALTER TABLE public.job_profiles
      ADD CONSTRAINT job_profiles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index company_id on job_profiles for performant tenant lookups and joins
CREATE INDEX IF NOT EXISTS idx_job_profiles_company_id ON public.job_profiles(company_id);

-- Ensure profiles.company_id has an index as well
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- ---------------------------------------------------------------------
-- 2. SAFE BACKFILL FOR EXISTING JOB PROFILES
-- ---------------------------------------------------------------------
-- Backfill Talent Corner jobs that currently have company_id IS NULL
UPDATE public.job_profiles
SET company_id = '2e5e7a94-2b4d-4258-b761-8439f0d8b592'
WHERE company_id IS NULL AND company ILIKE '%Talent Corner%';

-- Backfill Demo Chemical Traders jobs that currently have company_id IS NULL
UPDATE public.job_profiles
SET company_id = '1a50f750-a2bc-4a9b-9b32-ee91c748fef9'
WHERE company_id IS NULL AND company ILIKE '%Demo Chemical Traders%';

-- General backfill for any other existing jobs matching companies table by name
UPDATE public.job_profiles j
SET company_id = c.id
FROM public.companies c
WHERE j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(c.name));

-- ---------------------------------------------------------------------
-- 3. SECURE ROW LEVEL SECURITY POLICIES FOR JOB PROFILES
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.job_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on job_profiles to apply updated tenant boundary
DROP POLICY IF EXISTS "Public read active jobs" ON public.job_profiles;
DROP POLICY IF EXISTS "Staff manage all jobs" ON public.job_profiles;
DROP POLICY IF EXISTS "Corporate manage own jobs" ON public.job_profiles;

-- Public / student browsing: anonymous users and student candidates can read jobs.
-- Staff (admins and recruiters) can also read all jobs.
-- Corporate accounts are strictly excluded from this universal read policy.
CREATE POLICY "Public read active jobs"
  ON public.job_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    public.get_current_user_role() IS NULL
    OR public.get_current_user_role() = 'candidate'
    OR public.get_current_user_role() IN ('admin', 'recruiter')
  );

-- Staff (admin and recruiter) can manage all jobs across all companies
CREATE POLICY "Staff manage all jobs"
  ON public.job_profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  )
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Corporate users can ONLY view, insert, update, or delete jobs belonging to their own company
CREATE POLICY "Corporate manage own jobs"
  ON public.job_profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND job_profiles.company_id IS NOT NULL
    AND job_profiles.company_id = public.get_current_user_company_id()
  )
  WITH CHECK (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND job_profiles.company_id IS NOT NULL
    AND job_profiles.company_id = public.get_current_user_company_id()
  );
