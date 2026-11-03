-- =====================================================================
-- Migration: 20261102_corporate_gd_isolation.sql
-- Description: Multi-tenant Corporate isolation for Group Discussion (GD)
-- Database: Supabase PostgreSQL (SaarthiCampus)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SCHEMA ENHANCEMENT: ADD company_id AND mode TO gd_sessions
-- ---------------------------------------------------------------------
ALTER TABLE public.gd_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.gd_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'online';

CREATE INDEX IF NOT EXISTS idx_gd_sessions_company_id 
  ON public.gd_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_gd_sessions_company_created 
  ON public.gd_sessions(company_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 2. DATA BACKFILL FROM job_profiles
-- ---------------------------------------------------------------------
-- Backfill only where a valid job_id exists.
-- Sessions with NULL job_id remain company_id = NULL (Admin platform sessions).
UPDATE public.gd_sessions s
SET company_id = j.company_id
FROM public.job_profiles j
WHERE s.job_id = j.id
  AND s.company_id IS NULL
  AND j.company_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. ENSURE ROW LEVEL SECURITY IS ACTIVE
-- ---------------------------------------------------------------------
ALTER TABLE public.gd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_ratings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4. COMMAND-SPECIFIC RLS POLICIES FOR gd_sessions
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Corporate view own gd_sessions" ON public.gd_sessions;
CREATE POLICY "Corporate view own gd_sessions"
  ON public.gd_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND company_id IS NOT NULL
    AND company_id = public.get_current_user_company_id()
  );

DROP POLICY IF EXISTS "Corporate insert own gd_sessions" ON public.gd_sessions;
CREATE POLICY "Corporate insert own gd_sessions"
  ON public.gd_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND company_id IS NOT NULL
    AND company_id = public.get_current_user_company_id()
    AND job_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.job_profiles j
      WHERE j.id = gd_sessions.job_id
        AND j.company_id = public.get_current_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Corporate update own gd_sessions" ON public.gd_sessions;
CREATE POLICY "Corporate update own gd_sessions"
  ON public.gd_sessions
  FOR UPDATE
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND company_id IS NOT NULL
    AND company_id = public.get_current_user_company_id()
  )
  WITH CHECK (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND company_id IS NOT NULL
    AND company_id = public.get_current_user_company_id()
    AND job_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.job_profiles j
      WHERE j.id = gd_sessions.job_id
        AND j.company_id = public.get_current_user_company_id()
    )
  );

-- ---------------------------------------------------------------------
-- 5. COMMAND-SPECIFIC RLS POLICIES FOR gd_participants
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Corporate view own gd_participants" ON public.gd_participants;
CREATE POLICY "Corporate view own gd_participants"
  ON public.gd_participants
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM public.gd_sessions s
      WHERE s.id = gd_participants.session_id
        AND s.company_id IS NOT NULL
        AND s.company_id = public.get_current_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Corporate insert own gd_participants" ON public.gd_participants;
CREATE POLICY "Corporate insert own gd_participants"
  ON public.gd_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM public.gd_sessions s
      WHERE s.id = gd_participants.session_id
        AND s.company_id IS NOT NULL
        AND s.company_id = public.get_current_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Corporate update own gd_participants" ON public.gd_participants;
CREATE POLICY "Corporate update own gd_participants"
  ON public.gd_participants
  FOR UPDATE
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM public.gd_sessions s
      WHERE s.id = gd_participants.session_id
        AND s.company_id IS NOT NULL
        AND s.company_id = public.get_current_user_company_id()
    )
  )
  WITH CHECK (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM public.gd_sessions s
      WHERE s.id = gd_participants.session_id
        AND s.company_id IS NOT NULL
        AND s.company_id = public.get_current_user_company_id()
    )
  );

-- ---------------------------------------------------------------------
-- 6. COMMAND-SPECIFIC RLS POLICIES FOR gd_messages
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Corporate view own gd_messages" ON public.gd_messages;
CREATE POLICY "Corporate view own gd_messages"
  ON public.gd_messages
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM public.gd_sessions s
      WHERE s.id = gd_messages.session_id
        AND s.company_id IS NOT NULL
        AND s.company_id = public.get_current_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Corporate insert own gd_messages" ON public.gd_messages;
CREATE POLICY "Corporate insert own gd_messages"
  ON public.gd_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_user_role() = 'corporate'
    AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM public.gd_sessions s
      WHERE s.id = gd_messages.session_id
        AND s.company_id IS NOT NULL
        AND s.company_id = public.get_current_user_company_id()
    )
  );
