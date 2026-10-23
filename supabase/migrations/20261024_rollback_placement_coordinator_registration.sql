-- =============================================================================
-- Rollback Migration: Public Placement Coordinator Registration & Admin Review
-- File: supabase/migrations/20261024_rollback_placement_coordinator_registration.sql
-- =============================================================================

DROP POLICY IF EXISTS "Public can submit coordinator registration" ON public.coordinator_registrations;
DROP POLICY IF EXISTS "Staff can read all coordinator registrations" ON public.coordinator_registrations;
DROP POLICY IF EXISTS "Staff can update coordinator registrations" ON public.coordinator_registrations;

DROP TABLE IF EXISTS public.coordinator_registrations CASCADE;
