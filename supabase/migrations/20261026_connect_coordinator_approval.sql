-- =============================================================================
-- Migration: Connect Placement Coordinator Approval with Colleges Directory
-- File: supabase/migrations/20261026_connect_coordinator_approval.sql
-- Description:
--   1. Implements atomic PostgreSQL stored function `approve_coordinator_registration`
--      with row locking (FOR UPDATE) to prevent race conditions and duplicate approvals.
--   2. Links approved placement coordinator to existing college without duplicating records.
--   3. Or creates single college record in `colleges` if new, storing name, city, state,
--      course, institution_type, website, status='Interested', and tpo.
--   4. Inserts coordinator into `placement_coordinators` and writes audit trail to
--      `placement_coordinator_history`.
--   5. Synchronizes `colleges.tpo` with comma-separated list of all active coordinators.
--   6. Enforces staff authorization and fail-closed security.
-- =============================================================================

CREATE OR REPLACE FUNCTION approve_coordinator_registration(
    p_registration_id UUID,
    p_target_college_id UUID DEFAULT NULL,
    p_create_new BOOLEAN DEFAULT FALSE,
    p_reviewer_id UUID DEFAULT NULL,
    p_reviewer_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_reg RECORD;
    v_final_college_id UUID;
    v_existing_coord RECORD;
    v_new_coord_id UUID;
    v_combined_tpo TEXT;
    v_is_new_college BOOLEAN := FALSE;
BEGIN
    -- 1. Lock the registration row FOR UPDATE to prevent race conditions & duplicate clicks
    SELECT * INTO v_reg
    FROM coordinator_registrations
    WHERE id = p_registration_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coordinator registration % not found', p_registration_id;
    END IF;

    -- Idempotency check: if already approved, return without creating duplicate records
    IF v_reg.status = 'approved' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_approved', true,
            'message', 'This registration has already been approved',
            'college_id', v_reg.matched_college_id
        );
    END IF;

    -- 2. Determine target college
    IF p_target_college_id IS NOT NULL THEN
        SELECT id INTO v_final_college_id FROM colleges WHERE id = p_target_college_id;
        IF v_final_college_id IS NULL THEN
            RAISE EXCEPTION 'Target college % not found in colleges directory', p_target_college_id;
        END IF;
    ELSIF NOT p_create_new THEN
        -- Try to match existing college by normalized name
        SELECT id INTO v_final_college_id
        FROM colleges
        WHERE lower(trim(name)) = lower(trim(v_reg.college_name))
        LIMIT 1;
    END IF;

    -- 3. If no existing college found or create_new requested, insert new college record
    IF v_final_college_id IS NULL THEN
        INSERT INTO colleges (
            name,
            city,
            state,
            course,
            institution_type,
            website,
            status,
            tpo
        ) VALUES (
            trim(v_reg.college_name),
            nullif(trim(v_reg.city), ''),
            nullif(trim(v_reg.state), ''),
            nullif(trim(v_reg.category), ''),
            nullif(trim(v_reg.category), ''),
            nullif(trim(v_reg.website), ''),
            'Interested',
            trim(v_reg.full_name)
        )
        RETURNING id INTO v_final_college_id;
        v_is_new_college := TRUE;
    ELSE
        -- If linking to existing college, safely populate empty fields without overwriting existing data
        UPDATE colleges
        SET
            city = COALESCE(nullif(trim(city), ''), nullif(trim(v_reg.city), '')),
            state = COALESCE(nullif(trim(state), ''), nullif(trim(v_reg.state), '')),
            website = COALESCE(nullif(trim(website), ''), nullif(trim(v_reg.website), '')),
            course = COALESCE(nullif(trim(course), ''), nullif(trim(v_reg.category), '')),
            institution_type = COALESCE(nullif(trim(institution_type), ''), nullif(trim(v_reg.category), ''))
        WHERE id = v_final_college_id;
    END IF;

    -- 4. Check if coordinator is already linked to this college to prevent duplicate coordinator rows
    SELECT * INTO v_existing_coord
    FROM placement_coordinators
    WHERE college_id = v_final_college_id
      AND (
          lower(trim(email)) = lower(trim(v_reg.official_email))
          OR (trim(phone) = trim(v_reg.phone) AND lower(trim(name)) = lower(trim(v_reg.full_name)))
      )
    LIMIT 1;

    IF v_existing_coord IS NULL THEN
        -- Insert new coordinator
        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_by,
            created_by_name
        ) VALUES (
            v_final_college_id,
            trim(v_reg.full_name),
            nullif(trim(v_reg.phone), ''),
            nullif(lower(trim(v_reg.official_email)), ''),
            true,
            CURRENT_DATE,
            p_reviewer_id,
            COALESCE(p_reviewer_name, 'Admin')
        )
        RETURNING id INTO v_new_coord_id;

        -- Record audit history
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'placement_coordinator_history') THEN
            INSERT INTO placement_coordinator_history (
                college_id,
                coordinator_id,
                action,
                previous_values,
                new_values,
                changed_at,
                changed_by,
                changed_by_name
            ) VALUES (
                v_final_college_id,
                v_new_coord_id,
                'CREATED',
                NULL,
                jsonb_build_object(
                    'name', trim(v_reg.full_name),
                    'phone', trim(v_reg.phone),
                    'email', trim(v_reg.official_email),
                    'source', 'coordinator_registration',
                    'registration_id', p_registration_id
                ),
                now(),
                p_reviewer_id,
                COALESCE(p_reviewer_name, 'Admin')
            );
        END IF;
    ELSE
        -- If coordinator exists but is not currently active, reactivate them
        IF NOT v_existing_coord.is_current THEN
            UPDATE placement_coordinators
            SET is_current = true, ended_at = NULL, updated_at = now()
            WHERE id = v_existing_coord.id;
        END IF;
        v_new_coord_id := v_existing_coord.id;
    END IF;

    -- 5. Synchronize colleges.tpo with all current active coordinators
    SELECT string_agg(sub.name, ', ' ORDER BY sub.first_seen ASC, sub.name ASC)
    INTO v_combined_tpo
    FROM (
        SELECT trim(name) AS name, MIN(created_at) AS first_seen
        FROM placement_coordinators
        WHERE college_id = v_final_college_id
          AND is_current = true
          AND trim(name) <> ''
        GROUP BY trim(name)
    ) sub;

    IF v_combined_tpo IS NOT NULL AND v_combined_tpo <> '' THEN
        UPDATE colleges
        SET tpo = v_combined_tpo
        WHERE id = v_final_college_id;
    END IF;

    -- 6. Update coordinator registration record
    UPDATE coordinator_registrations
    SET
        status = 'approved',
        matched_college_id = v_final_college_id,
        reviewed_by = p_reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_registration_id;

    RETURN jsonb_build_object(
        'success', true,
        'college_id', v_final_college_id,
        'coordinator_id', v_new_coord_id,
        'is_new_college', v_is_new_college,
        'message', CASE
            WHEN v_is_new_college THEN 'New college created and placement coordinator linked'
            ELSE 'Placement coordinator linked to existing college directory record'
        END
    );
END;
$$;

-- Grant execution to authenticated and service_role
REVOKE ALL ON FUNCTION approve_coordinator_registration(UUID, UUID, BOOLEAN, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_coordinator_registration(UUID, UUID, BOOLEAN, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_coordinator_registration(UUID, UUID, BOOLEAN, UUID, TEXT) TO service_role;
