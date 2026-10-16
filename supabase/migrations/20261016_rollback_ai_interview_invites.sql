-- =====================================================================
-- Rollback Migration: 20261016_rollback_ai_interview_invites.sql
-- Description: Drops ai_interview_invites table and associated policies
-- =====================================================================

DROP POLICY IF EXISTS "Staff can manage ai_interview_invites" ON ai_interview_invites;
DROP TABLE IF EXISTS ai_interview_invites CASCADE;
