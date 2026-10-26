-- =============================================================================
-- Migration Rollback: Connect Placement Coordinator Approval with Colleges Directory
-- File: supabase/migrations/20261026_rollback_connect_coordinator_approval.sql
-- Description:
--   Safely drops approve_coordinator_registration function.
--   Preserves all historical college and coordinator records.
-- =============================================================================

DROP FUNCTION IF EXISTS approve_coordinator_registration(UUID, UUID, BOOLEAN, UUID, TEXT);
