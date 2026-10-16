-- =====================================================================
-- Rollback Migration: 20261016_rollback_save_candidate_quota.sql
-- Description: Revert save_candidate_with_quota function and indexes
-- =====================================================================

DROP FUNCTION IF EXISTS public.save_candidate_with_quota(UUID, UUID, INT);
DROP INDEX IF EXISTS public.idx_saved_candidates_company_candidate;
DROP INDEX IF EXISTS public.idx_saved_candidates_company_created_at;
