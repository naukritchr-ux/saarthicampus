-- =============================================================================
-- Rollback: Remove courses_available from coordinator_registrations
-- File: supabase/migrations/20261026_rollback_add_courses_available_to_coordinator_registrations.sql
-- =============================================================================

ALTER TABLE public.coordinator_registrations
DROP COLUMN IF EXISTS courses_available;
