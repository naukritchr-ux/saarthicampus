-- =============================================================================
-- Rollback Migration: Placement Coordinator History & Audit Trail
-- File: supabase/migrations/20261014_rollback_placement_coordinators.sql
-- Description:
--   Safely reverts functions, triggers, policies, and indexes created
--   by 20261014_enhance_placement_coordinators.sql.
--   IMPORTANT: To prevent data loss, historical audit data is NOT destroyed;
--   placement_coordinator_history is renamed to placement_coordinator_history_archive.
-- =============================================================================

-- 1. Drop atomic functions
DROP FUNCTION IF EXISTS create_college_with_coordinators(JSONB, JSONB);
DROP FUNCTION IF EXISTS create_college_with_coordinator(JSONB, TEXT, TEXT, TEXT, DATE);
DROP FUNCTION IF EXISTS add_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE);
DROP FUNCTION IF EXISTS replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE);
DROP FUNCTION IF EXISTS update_placement_coordinator_details(TEXT, TEXT, TEXT, TEXT, DATE);
DROP FUNCTION IF EXISTS retire_placement_coordinator(TEXT);
DROP FUNCTION IF EXISTS get_saarthi_auth_user();

-- 2. Drop RLS policies on placement_coordinator_history and placement_coordinators
DROP POLICY IF EXISTS "coord_history_delete_deny" ON placement_coordinator_history;
DROP POLICY IF EXISTS "coord_history_update_deny" ON placement_coordinator_history;
DROP POLICY IF EXISTS "coord_history_insert_policy" ON placement_coordinator_history;
DROP POLICY IF EXISTS "coord_history_select_policy" ON placement_coordinator_history;

DROP POLICY IF EXISTS "placement_coordinators_delete_deny" ON placement_coordinators;
DROP POLICY IF EXISTS "placement_coordinators_write_policy" ON placement_coordinators;
DROP POLICY IF EXISTS "placement_coordinators_select_policy" ON placement_coordinators;

-- 3. Safely preserve historical audit data (DO NOT DROP)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'placement_coordinator_history'
    ) THEN
        -- If an archive table already exists from a prior rollback, append timestamp
        IF EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = 'placement_coordinator_history_archive'
        ) THEN
            EXECUTE format('ALTER TABLE placement_coordinator_history RENAME TO placement_coordinator_history_archive_%s', to_char(now(), 'YYYYMMDD_HH24MISS'));
        ELSE
            ALTER TABLE placement_coordinator_history RENAME TO placement_coordinator_history_archive;
        END IF;
        RAISE NOTICE 'Preserved placement_coordinator_history table as archive to prevent data loss.';
    END IF;
END $$;

-- 4. Drop unique constraint index
DROP INDEX IF EXISTS uq_placement_coordinators_active_college;
DROP INDEX IF EXISTS idx_placement_coordinators_college_id;

-- 5. Note on placement_coordinators columns:
-- Columns added (effective_from, updated_at, created_by, updated_by,
-- created_by_name, updated_by_name) are retained to prevent data loss.
-- If you explicitly wish to drop these columns, execute manually:
--
-- ALTER TABLE placement_coordinators
--     DROP COLUMN IF EXISTS effective_from,
--     DROP COLUMN IF EXISTS updated_at,
--     DROP COLUMN IF EXISTS created_by,
--     DROP COLUMN IF EXISTS updated_by,
--     DROP COLUMN IF EXISTS created_by_name,
--     DROP COLUMN IF EXISTS updated_by_name;
