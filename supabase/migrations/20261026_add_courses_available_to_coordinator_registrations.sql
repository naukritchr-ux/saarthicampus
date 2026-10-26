-- =============================================================================
-- Migration: Add courses_available to coordinator_registrations
-- File: supabase/migrations/20261026_add_courses_available_to_coordinator_registrations.sql
-- Description:
--   Adds `courses_available` (TEXT) to public.coordinator_registrations so
--   multi-selected degree/academic programs (MBA, B.Tech, MCA, etc.) submitted
--   by placement coordinators are stored and merged into colleges directory.
-- =============================================================================

ALTER TABLE public.coordinator_registrations
ADD COLUMN IF NOT EXISTS courses_available TEXT;
