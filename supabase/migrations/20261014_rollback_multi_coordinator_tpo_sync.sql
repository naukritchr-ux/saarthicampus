-- =============================================================================
-- Rollback Migration: Multi-Coordinator Support & Full colleges.tpo Synchronization
-- File: supabase/migrations/20261014_rollback_multi_coordinator_tpo_sync.sql
-- =============================================================================

-- NOTE: All history records in placement_coordinator_history are deliberately PRESERVED
-- and NEVER dropped or deleted.

-- Drop the sync_college_tpo helper function
DROP FUNCTION IF EXISTS sync_college_tpo(TEXT);

-- Drop the calendar date validator helper function
DROP FUNCTION IF EXISTS is_valid_calendar_date(TEXT);

-- The application functions can fallback safely if this migration is rolled back.
