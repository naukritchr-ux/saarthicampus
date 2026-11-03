-- =====================================================================
-- Rollback Migration: 20261102_rollback_corporate_gd_isolation.sql
-- Description: Revert Corporate GD RLS policies safely
-- =====================================================================

-- ---------------------------------------------------------------------
-- TIER 1: NON-DESTRUCTIVE ROLLBACK (RECOMMENDED — PRESERVES ALL DATA)
-- ---------------------------------------------------------------------
-- Drops corporate policies while preserving session data and Admin policies
DROP POLICY IF EXISTS "Corporate view own gd_sessions" ON public.gd_sessions;
DROP POLICY IF EXISTS "Corporate insert own gd_sessions" ON public.gd_sessions;
DROP POLICY IF EXISTS "Corporate update own gd_sessions" ON public.gd_sessions;

DROP POLICY IF EXISTS "Corporate view own gd_participants" ON public.gd_participants;
DROP POLICY IF EXISTS "Corporate insert own gd_participants" ON public.gd_participants;
DROP POLICY IF EXISTS "Corporate update own gd_participants" ON public.gd_participants;

DROP POLICY IF EXISTS "Corporate view own gd_messages" ON public.gd_messages;
DROP POLICY IF EXISTS "Corporate insert own gd_messages" ON public.gd_messages;

DROP INDEX IF EXISTS public.idx_gd_sessions_company_created;
DROP INDEX IF EXISTS public.idx_gd_sessions_company_id;

-- ---------------------------------------------------------------------
-- TIER 2: FULL REVERSION (ONLY IF PERMANENT SCHEMA REMOVAL IS REQUIRED)
-- ---------------------------------------------------------------------
-- WARNING: Un-commenting drops column and destroys historical company links.
-- ALTER TABLE public.gd_sessions DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.gd_sessions DROP COLUMN IF EXISTS mode;
