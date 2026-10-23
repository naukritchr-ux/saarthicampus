-- =====================================================================
-- Rollback Migration: 20261023_rollback_fix_corporate_job_isolation.sql
-- Description: Rollback corporate job isolation RLS policies
-- Database: Supabase PostgreSQL (SaarthiCampus)
-- =====================================================================

DROP POLICY IF EXISTS "Public read active jobs" ON public.job_profiles;
DROP POLICY IF EXISTS "Staff manage all jobs" ON public.job_profiles;
DROP POLICY IF EXISTS "Corporate manage own jobs" ON public.job_profiles;

-- Restore previous permissive public read policy if needed
CREATE POLICY "Public read active jobs"
  ON public.job_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Staff manage all jobs"
  ON public.job_profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

CREATE POLICY "Corporate manage own jobs"
  ON public.job_profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND job_profiles.company_id = public.get_current_user_company_id()
  );
