-- =============================================================================
-- Migration: Multi-Coordinator Support & Full colleges.tpo Synchronization
-- File: supabase/migrations/20261014_multi_coordinator_tpo_sync.sql
-- Description:
--   1. Implements is_valid_calendar_date() helper to validate real calendar dates.
--   2. Hardens get_saarthi_auth_user() against SECURITY DEFINER authentication
--      bypasses by checking session_user and service_role JWT rather than current_user.
--      Strictly verifies approval against profiles.approved = true; rejects NULL/unapproved.
--   3. Implements sync_college_tpo(p_college_id) as an internal helper with
--      REVOKED direct execution from PUBLIC, authenticated, and anon.
--   4. Synchronizes colleges.tpo to a deterministic, comma-separated list of all
--      active coordinator names (MIN(created_at) ASC, name ASC).
--   5. Preserves legacy colleges.tpo for colleges with zero coordinator records.
--   6. Enforces strict server-side validation in create_college_with_coordinators:
--      requires a JSON array and validates non-blank name, 10-digit phone,
--      valid email format, and valid calendar YYYY-MM-DD date for every coordinator.
--   7. Enforces mandatory name, 10-digit phone, valid email, and effective date in
--      update_placement_coordinator_details, consistent with create and add.
--   8. Drops legacy 5-parameter replace_placement_coordinator overload and requires
--      explicit p_target_coordinator_id when multiple active coordinators exist.
--   9. Rejects already-retired coordinators in retire_placement_coordinator with full
--      previous values logged to audit history.
--   10. Dynamically verifies ID data types (UUID, BIGINT/INTEGER, TEXT) from information_schema.
--   11. Revokes PUBLIC execution from all SECURITY DEFINER functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 0A: Internal Calendar Date Validation Helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_valid_calendar_date(p_date_str TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_d DATE;
BEGIN
    IF p_date_str IS NULL OR trim(p_date_str) = '' THEN
        RETURN FALSE;
    END IF;
    -- Must match standard YYYY-MM-DD format
    IF trim(p_date_str) !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN FALSE;
    END IF;
    -- Validate real calendar date (rejects out-of-range days like Feb 31, Apr 31, leap-year errors)
    BEGIN
        v_d := trim(p_date_str)::DATE;
        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$$;

REVOKE ALL ON FUNCTION is_valid_calendar_date(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_valid_calendar_date(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_calendar_date(TEXT) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 0B: Trusted get_saarthi_auth_user Function
-- Hardened against SECURITY DEFINER session elevation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_saarthi_auth_user()
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_name TEXT;
    v_email TEXT;
    v_role TEXT;
    v_approved BOOLEAN := false;
BEGIN
    IF v_uid IS NULL THEN
        -- Allow Postgres superuser, service role, or supabase admin for internal maintenance/scripts ONLY.
        -- Note: Never use current_user here because inside SECURITY DEFINER, current_user evaluates to postgres.
        -- session_user preserves the connected database user.
        IF (session_user IN ('postgres', 'supabase_admin') AND auth.jwt() IS NULL)
           OR (COALESCE(auth.role(), auth.jwt()->>'role') = 'service_role') THEN
            RETURN QUERY SELECT NULL::UUID, 'System Admin'::TEXT, 'admin@saarthicampus'::TEXT, 'admin'::TEXT;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        END IF;
        RETURN;
    END IF;

    -- Lookup directly from profiles table (the application's trusted authorization source)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        SELECT p.name, p.email, p.role, COALESCE(p.approved, false)
        INTO v_name, v_email, v_role, v_approved
        FROM profiles p
        WHERE p.id = v_uid;
    END IF;

    -- Strict authorization: if profile is missing, not approved, or role is null, reject role
    IF NOT v_approved THEN
        v_role := NULL;
    END IF;

    -- Fallback for name/email from JWT metadata for audit trail attribution only
    IF v_name IS NULL OR v_name = '' THEN
        v_name := COALESCE(
            auth.jwt()->'user_metadata'->>'name',
            auth.jwt()->'user_metadata'->>'full_name',
            auth.jwt()->>'email',
            'Authorized User'
        );
    END IF;

    IF v_email IS NULL OR v_email = '' THEN
        v_email := auth.jwt()->>'email';
    END IF;

    RETURN QUERY SELECT v_uid, v_name, v_email, v_role;
END;
$$;

REVOKE ALL ON FUNCTION get_saarthi_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_saarthi_auth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION get_saarthi_auth_user() TO service_role;


-- -----------------------------------------------------------------------------
-- Step 1: Internal sync_college_tpo Function
-- (Restricted execution: only callable internally by SECURITY DEFINER RPCs)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_college_tpo(p_college_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_college_id_type TEXT;
    v_has_coordinators BOOLEAN := false;
    v_combined_tpo TEXT := NULL;
BEGIN
    IF p_college_id IS NULL OR trim(p_college_id) = '' THEN
        RETURN NULL;
    END IF;

    SELECT data_type INTO v_college_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colleges' AND column_name = 'id';

    IF v_college_id_type IS NULL THEN
        RAISE EXCEPTION 'Table colleges or column id not found in public schema';
    END IF;

    IF v_college_id_type = 'uuid' THEN
        IF trim(p_college_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Invalid UUID format for college ID: %', p_college_id;
        END IF;

        -- Check if any coordinator records exist for this college
        SELECT EXISTS(
            SELECT 1 FROM placement_coordinators WHERE college_id = trim(p_college_id)::UUID
        ) INTO v_has_coordinators;

        -- If zero coordinator records exist, preserve legacy colleges.tpo value
        IF NOT v_has_coordinators THEN
            SELECT tpo INTO v_combined_tpo FROM colleges WHERE id = trim(p_college_id)::UUID;
            RETURN v_combined_tpo;
        END IF;

        -- Aggregate all active coordinator names in stable deterministic order
        SELECT string_agg(sub.name, ', ' ORDER BY sub.first_seen ASC, sub.name ASC)
        INTO v_combined_tpo
        FROM (
            SELECT trim(name) AS name, MIN(created_at) AS first_seen
            FROM placement_coordinators
            WHERE college_id = trim(p_college_id)::UUID
              AND is_current = true
              AND trim(name) <> ''
            GROUP BY trim(name)
        ) sub;

        UPDATE colleges
        SET tpo = v_combined_tpo
        WHERE id = trim(p_college_id)::UUID;

    ELSIF v_college_id_type IN ('bigint', 'integer', 'smallint') THEN
        IF trim(p_college_id) !~ '^-?[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid integer format for college ID: %', p_college_id;
        END IF;

        SELECT EXISTS(
            SELECT 1 FROM placement_coordinators WHERE college_id = trim(p_college_id)::BIGINT
        ) INTO v_has_coordinators;

        IF NOT v_has_coordinators THEN
            SELECT tpo INTO v_combined_tpo FROM colleges WHERE id = trim(p_college_id)::BIGINT;
            RETURN v_combined_tpo;
        END IF;

        SELECT string_agg(sub.name, ', ' ORDER BY sub.first_seen ASC, sub.name ASC)
        INTO v_combined_tpo
        FROM (
            SELECT trim(name) AS name, MIN(created_at) AS first_seen
            FROM placement_coordinators
            WHERE college_id = trim(p_college_id)::BIGINT
              AND is_current = true
              AND trim(name) <> ''
            GROUP BY trim(name)
        ) sub;

        UPDATE colleges
        SET tpo = v_combined_tpo
        WHERE id = trim(p_college_id)::BIGINT;

    ELSIF v_college_id_type IN ('text', 'character varying', 'character') THEN
        SELECT EXISTS(
            SELECT 1 FROM placement_coordinators WHERE college_id::TEXT = trim(p_college_id)
        ) INTO v_has_coordinators;

        IF NOT v_has_coordinators THEN
            SELECT tpo INTO v_combined_tpo FROM colleges WHERE id::TEXT = trim(p_college_id);
            RETURN v_combined_tpo;
        END IF;

        SELECT string_agg(sub.name, ', ' ORDER BY sub.first_seen ASC, sub.name ASC)
        INTO v_combined_tpo
        FROM (
            SELECT trim(name) AS name, MIN(created_at) AS first_seen
            FROM placement_coordinators
            WHERE college_id::TEXT = trim(p_college_id)
              AND is_current = true
              AND trim(name) <> ''
            GROUP BY trim(name)
        ) sub;

        UPDATE colleges
        SET tpo = v_combined_tpo
        WHERE id::TEXT = trim(p_college_id);

    ELSE
        RAISE EXCEPTION 'Unsupported college ID data type: %', v_college_id_type;
    END IF;

    RETURN v_combined_tpo;
END;
$$;

-- Restrict direct execution from PUBLIC, authenticated, and anon
REVOKE ALL ON FUNCTION sync_college_tpo(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_college_tpo(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION sync_college_tpo(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION sync_college_tpo(TEXT) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 2: Atomic create_college_with_coordinators with Multi-TPO Sync & Server Validation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_college_with_coordinators(
    p_college JSONB,
    p_coordinators JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_u RECORD;
    v_college RECORD;
    v_college_name TEXT;
    v_coord_item JSONB;
    v_coord RECORD;
    v_coord_name TEXT;
    v_coord_phone TEXT;
    v_coord_email TEXT;
    v_coord_effective_from TEXT;
    v_created_coords JSONB := '[]'::JSONB;
    v_final_tpo TEXT;
BEGIN
    SELECT * INTO v_u FROM get_saarthi_auth_user();
    IF v_u.user_role IS NULL OR v_u.user_role NOT IN ('admin', 'recruiter') THEN
        RAISE EXCEPTION 'Unauthorized: only approved recruiters and admins can create colleges and placement coordinators';
    END IF;

    v_college_name := trim(p_college->>'name');
    IF v_college_name IS NULL OR v_college_name = '' THEN
        RAISE EXCEPTION 'College name is required';
    END IF;

    -- Validate coordinators payload must be a JSON array
    IF p_coordinators IS NULL OR jsonb_typeof(p_coordinators) <> 'array' THEN
        RAISE EXCEPTION 'Coordinators payload must be a JSON array';
    END IF;

    -- Server-side validation: every coordinator in the payload must have valid required fields
    FOR v_coord_item IN SELECT * FROM jsonb_array_elements(p_coordinators)
    LOOP
        v_coord_name := trim(COALESCE(v_coord_item->>'name', ''));
        IF v_coord_name = '' THEN
            RAISE EXCEPTION 'Placement Coordinator Name is required for every coordinator';
        END IF;

        v_coord_phone := trim(COALESCE(v_coord_item->>'phone', ''));
        IF v_coord_phone = '' THEN
            RAISE EXCEPTION 'Contact Number is required for coordinator %', v_coord_name;
        END IF;
        IF v_coord_phone !~ '^[0-9]{10}$' THEN
            RAISE EXCEPTION 'Contact Number for coordinator % must be exactly 10 digits', v_coord_name;
        END IF;

        v_coord_email := trim(COALESCE(v_coord_item->>'email', ''));
        IF v_coord_email = '' THEN
            RAISE EXCEPTION 'Email Address is required for coordinator %', v_coord_name;
        END IF;
        IF v_coord_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'Invalid Email Address format for coordinator %', v_coord_name;
        END IF;

        v_coord_effective_from := trim(COALESCE(v_coord_item->>'effective_from', ''));
        IF v_coord_effective_from = '' THEN
            RAISE EXCEPTION 'Effective From Date is required for coordinator %', v_coord_name;
        END IF;
        IF NOT is_valid_calendar_date(v_coord_effective_from) THEN
            RAISE EXCEPTION 'Invalid Effective From Date "%" for coordinator % (must be a valid calendar date in YYYY-MM-DD format)', v_coord_effective_from, v_coord_name;
        END IF;
    END LOOP;

    -- Validate last_contact date if provided
    IF (p_college->>'last_contact') IS NOT NULL AND trim(p_college->>'last_contact') <> '' THEN
        IF NOT is_valid_calendar_date(trim(p_college->>'last_contact')) THEN
            RAISE EXCEPTION 'Invalid last contact date: % (must be a valid calendar date in YYYY-MM-DD format)', p_college->>'last_contact';
        END IF;
    END IF;

    -- 1. Insert College
    INSERT INTO colleges (
        name,
        city,
        course,
        tpo,
        website,
        strength,
        last_contact,
        status,
        institution_type,
        courses_available
    ) VALUES (
        v_college_name,
        nullif(trim(p_college->>'city'), ''),
        nullif(trim(p_college->>'course'), ''),
        nullif(trim(p_college->>'tpo'), ''),
        nullif(trim(p_college->>'website'), ''),
        CASE WHEN (p_college->>'strength') IS NOT NULL AND (p_college->>'strength') ~ '^-?[0-9]+$' THEN (p_college->>'strength')::INTEGER ELSE NULL END,
        CASE WHEN (p_college->>'last_contact') IS NOT NULL AND trim(p_college->>'last_contact') <> '' THEN trim(p_college->>'last_contact')::DATE ELSE NULL END,
        COALESCE(nullif(trim(p_college->>'status'), ''), 'Interested'),
        nullif(trim(p_college->>'institution_type'), ''),
        nullif(trim(p_college->>'courses_available'), '')
    )
    RETURNING * INTO v_college;

    -- 2. Insert each coordinator and audit history
    FOR v_coord_item IN SELECT * FROM jsonb_array_elements(p_coordinators)
    LOOP
        v_coord_name := trim(v_coord_item->>'name');
        v_coord_phone := trim(v_coord_item->>'phone');
        v_coord_email := trim(v_coord_item->>'email');
        v_coord_effective_from := trim(v_coord_item->>'effective_from');

        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            v_college.id,
            v_coord_name,
            v_coord_phone,
            v_coord_email,
            true,
            v_coord_effective_from::DATE,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            v_college.id,
            v_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_coord.name,
                'phone', v_coord.phone,
                'email', v_coord.email,
                'is_current', true,
                'effective_from', v_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );

        v_created_coords := v_created_coords || jsonb_build_array(row_to_json(v_coord));
    END LOOP;

    -- 3. Synchronize colleges.tpo with ALL active coordinator names
    v_final_tpo := sync_college_tpo(v_college.id::TEXT);

    -- 4. Re-fetch the updated college row
    SELECT * INTO v_college FROM colleges WHERE id = v_college.id;

    RETURN jsonb_build_object(
        'college', row_to_json(v_college),
        'coordinators', v_created_coords
    );
END;
$$;

REVOKE ALL ON FUNCTION create_college_with_coordinators(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_college_with_coordinators(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_college_with_coordinators(JSONB, JSONB) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 3: Atomic add_placement_coordinator with Multi-TPO Sync & Validation
-- (Never retires or deactivates any existing coordinator)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_placement_coordinator(
    p_college_id TEXT,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_effective_from DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_u RECORD;
    v_new_coord RECORD;
    v_college_id_type TEXT;
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_clean_email TEXT;
    v_effective_date DATE;
BEGIN
    SELECT * INTO v_u FROM get_saarthi_auth_user();
    IF v_u.user_role IS NULL OR v_u.user_role NOT IN ('admin', 'recruiter') THEN
        RAISE EXCEPTION 'Unauthorized: only approved recruiters and admins can manage placement coordinators';
    END IF;

    v_clean_name := trim(COALESCE(p_name, ''));
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Placement Coordinator Name is required';
    END IF;

    v_clean_phone := trim(COALESCE(p_phone, ''));
    IF v_clean_phone = '' THEN
        RAISE EXCEPTION 'Contact Number is required';
    END IF;
    IF v_clean_phone !~ '^[0-9]{10}$' THEN
        RAISE EXCEPTION 'Contact Number must be exactly 10 digits';
    END IF;

    v_clean_email := trim(COALESCE(p_email, ''));
    IF v_clean_email = '' THEN
        RAISE EXCEPTION 'Email Address is required';
    END IF;
    IF v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid Email Address format';
    END IF;

    v_effective_date := COALESCE(p_effective_from, CURRENT_DATE);

    IF p_college_id IS NULL OR trim(p_college_id) = '' THEN
        RAISE EXCEPTION 'College ID is required';
    END IF;

    SELECT data_type INTO v_college_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colleges' AND column_name = 'id';

    IF v_college_id_type IS NULL THEN
        RAISE EXCEPTION 'Table colleges or column id not found in public schema';
    END IF;

    IF v_college_id_type = 'uuid' THEN
        IF trim(p_college_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Invalid UUID format for college ID: %', p_college_id;
        END IF;

        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            trim(p_college_id)::UUID,
            v_clean_name,
            v_clean_phone,
            v_clean_email,
            true,
            v_effective_date,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_new_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            trim(p_college_id)::UUID,
            v_new_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_new_coord.name,
                'phone', v_new_coord.phone,
                'email', v_new_coord.email,
                'is_current', true,
                'effective_from', v_new_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );
    ELSIF v_college_id_type IN ('bigint', 'integer', 'smallint') THEN
        IF trim(p_college_id) !~ '^-?[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid integer format for college ID: %', p_college_id;
        END IF;

        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            trim(p_college_id)::BIGINT,
            v_clean_name,
            v_clean_phone,
            v_clean_email,
            true,
            v_effective_date,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_new_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            trim(p_college_id)::BIGINT,
            v_new_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_new_coord.name,
                'phone', v_new_coord.phone,
                'email', v_new_coord.email,
                'is_current', true,
                'effective_from', v_new_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );
    ELSIF v_college_id_type IN ('text', 'character varying', 'character') THEN
        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            trim(p_college_id),
            v_clean_name,
            v_clean_phone,
            v_clean_email,
            true,
            v_effective_date,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_new_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            trim(p_college_id),
            v_new_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_new_coord.name,
                'phone', v_new_coord.phone,
                'email', v_new_coord.email,
                'is_current', true,
                'effective_from', v_new_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );
    ELSE
        RAISE EXCEPTION 'Unsupported college ID data type: %', v_college_id_type;
    END IF;

    -- Synchronize colleges.tpo with ALL active coordinator names
    PERFORM sync_college_tpo(p_college_id);

    RETURN to_jsonb(v_new_coord);
END;
$$;

REVOKE ALL ON FUNCTION add_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION add_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 4: Atomic update_placement_coordinator_details with Multi-TPO Sync
-- (Enforces mandatory name, 10-digit phone, valid email, and effective date)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_placement_coordinator_details(
    p_coordinator_id TEXT,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_effective_from DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_u RECORD;
    v_prev RECORD;
    v_updated RECORD;
    v_prev_vals JSONB;
    v_new_vals JSONB;
    v_coord_id_type TEXT;
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_clean_email TEXT;
BEGIN
    SELECT * INTO v_u FROM get_saarthi_auth_user();
    IF v_u.user_role IS NULL OR v_u.user_role NOT IN ('admin', 'recruiter') THEN
        RAISE EXCEPTION 'Unauthorized: only approved recruiters and admins can manage placement coordinators';
    END IF;

    v_clean_name := trim(COALESCE(p_name, ''));
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Placement Coordinator Name is required';
    END IF;

    v_clean_phone := trim(COALESCE(p_phone, ''));
    IF v_clean_phone = '' THEN
        RAISE EXCEPTION 'Contact Number is required';
    END IF;
    IF v_clean_phone !~ '^[0-9]{10}$' THEN
        RAISE EXCEPTION 'Contact Number must be exactly 10 digits';
    END IF;

    v_clean_email := trim(COALESCE(p_email, ''));
    IF v_clean_email = '' THEN
        RAISE EXCEPTION 'Email Address is required';
    END IF;
    IF v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid Email Address format';
    END IF;

    IF p_effective_from IS NULL THEN
        RAISE EXCEPTION 'Effective From Date is required';
    END IF;

    IF p_coordinator_id IS NULL OR trim(p_coordinator_id) = '' THEN
        RAISE EXCEPTION 'Coordinator ID is required';
    END IF;

    SELECT data_type INTO v_coord_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'placement_coordinators' AND column_name = 'id';

    IF v_coord_id_type IS NULL THEN
        RAISE EXCEPTION 'Table placement_coordinators or column id not found in public schema';
    END IF;

    IF v_coord_id_type = 'uuid' THEN
        IF trim(p_coordinator_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Invalid UUID format for coordinator ID: %', p_coordinator_id;
        END IF;

        SELECT * INTO v_prev
        FROM placement_coordinators
        WHERE id = trim(p_coordinator_id)::UUID;
    ELSIF v_coord_id_type IN ('bigint', 'integer', 'smallint') THEN
        IF trim(p_coordinator_id) !~ '^-?[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid integer format for coordinator ID: %', p_coordinator_id;
        END IF;

        SELECT * INTO v_prev
        FROM placement_coordinators
        WHERE id = trim(p_coordinator_id)::BIGINT;
    ELSIF v_coord_id_type IN ('text', 'character varying', 'character') THEN
        SELECT * INTO v_prev
        FROM placement_coordinators
        WHERE id::TEXT = trim(p_coordinator_id);
    ELSE
        RAISE EXCEPTION 'Unsupported coordinator ID data type: %', v_coord_id_type;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coordinator record % not found', p_coordinator_id;
    END IF;

    v_prev_vals := jsonb_build_object(
        'name', v_prev.name,
        'phone', v_prev.phone,
        'email', v_prev.email,
        'effective_from', v_prev.effective_from
    );

    v_new_vals := jsonb_build_object(
        'name', v_clean_name,
        'phone', v_clean_phone,
        'email', v_clean_email,
        'effective_from', p_effective_from
    );

    IF v_prev_vals = v_new_vals THEN
        RETURN to_jsonb(v_prev);
    END IF;

    IF v_coord_id_type = 'uuid' THEN
        UPDATE placement_coordinators
        SET name = v_clean_name,
            phone = v_clean_phone,
            email = v_clean_email,
            effective_from = p_effective_from,
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id = trim(p_coordinator_id)::UUID
        RETURNING * INTO v_updated;
    ELSIF v_coord_id_type IN ('bigint', 'integer', 'smallint') THEN
        UPDATE placement_coordinators
        SET name = v_clean_name,
            phone = v_clean_phone,
            email = v_clean_email,
            effective_from = p_effective_from,
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id = trim(p_coordinator_id)::BIGINT
        RETURNING * INTO v_updated;
    ELSE
        UPDATE placement_coordinators
        SET name = v_clean_name,
            phone = v_clean_phone,
            email = v_clean_email,
            effective_from = p_effective_from,
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id::TEXT = trim(p_coordinator_id)
        RETURNING * INTO v_updated;
    END IF;

    INSERT INTO placement_coordinator_history (
        college_id,
        coordinator_id,
        action,
        previous_values,
        new_values,
        changed_at,
        changed_by,
        changed_by_name,
        changed_by_email
    ) VALUES (
        v_updated.college_id,
        v_updated.id,
        'UPDATED',
        v_prev_vals,
        v_new_vals,
        now(),
        v_u.user_id,
        v_u.user_name,
        v_u.user_email
    );

    -- If this coordinator is active, synchronize colleges.tpo with all active coordinators
    IF v_updated.is_current THEN
        PERFORM sync_college_tpo(v_updated.college_id::TEXT);
    END IF;

    RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION update_placement_coordinator_details(TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_placement_coordinator_details(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION update_placement_coordinator_details(TEXT, TEXT, TEXT, TEXT, DATE) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 5: Atomic retire_placement_coordinator with Multi-TPO Sync & Validation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION retire_placement_coordinator(
    p_coordinator_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_u RECORD;
    v_prev RECORD;
    v_updated RECORD;
    v_coord_id_type TEXT;
BEGIN
    SELECT * INTO v_u FROM get_saarthi_auth_user();
    IF v_u.user_role IS NULL OR v_u.user_role NOT IN ('admin', 'recruiter') THEN
        RAISE EXCEPTION 'Unauthorized: only approved recruiters and admins can manage placement coordinators';
    END IF;

    IF p_coordinator_id IS NULL OR trim(p_coordinator_id) = '' THEN
        RAISE EXCEPTION 'Coordinator ID is required';
    END IF;

    SELECT data_type INTO v_coord_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'placement_coordinators' AND column_name = 'id';

    IF v_coord_id_type IS NULL THEN
        RAISE EXCEPTION 'Table placement_coordinators or column id not found in public schema';
    END IF;

    IF v_coord_id_type = 'uuid' THEN
        IF trim(p_coordinator_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Invalid UUID format for coordinator ID: %', p_coordinator_id;
        END IF;

        SELECT * INTO v_prev FROM placement_coordinators WHERE id = trim(p_coordinator_id)::UUID;
    ELSIF v_coord_id_type IN ('bigint', 'integer', 'smallint') THEN
        IF trim(p_coordinator_id) !~ '^-?[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid integer format for coordinator ID: %', p_coordinator_id;
        END IF;

        SELECT * INTO v_prev FROM placement_coordinators WHERE id = trim(p_coordinator_id)::BIGINT;
    ELSIF v_coord_id_type IN ('text', 'character varying', 'character') THEN
        SELECT * INTO v_prev FROM placement_coordinators WHERE id::TEXT = trim(p_coordinator_id);
    ELSE
        RAISE EXCEPTION 'Unsupported coordinator ID data type: %', v_coord_id_type;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coordinator record % not found', p_coordinator_id;
    END IF;

    -- Reject already-retired coordinators
    IF NOT v_prev.is_current THEN
        RAISE EXCEPTION 'Coordinator % (%) is already retired', p_coordinator_id, v_prev.name;
    END IF;

    IF v_coord_id_type = 'uuid' THEN
        UPDATE placement_coordinators
        SET is_current = false,
            ended_at = now(),
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id = trim(p_coordinator_id)::UUID
        RETURNING * INTO v_updated;
    ELSIF v_coord_id_type IN ('bigint', 'integer', 'smallint') THEN
        UPDATE placement_coordinators
        SET is_current = false,
            ended_at = now(),
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id = trim(p_coordinator_id)::BIGINT
        RETURNING * INTO v_updated;
    ELSE
        UPDATE placement_coordinators
        SET is_current = false,
            ended_at = now(),
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id::TEXT = trim(p_coordinator_id)
        RETURNING * INTO v_updated;
    END IF;

    -- Record accurate full previous values in audit history
    INSERT INTO placement_coordinator_history (
        college_id,
        coordinator_id,
        action,
        previous_values,
        new_values,
        changed_at,
        changed_by,
        changed_by_name,
        changed_by_email
    ) VALUES (
        v_updated.college_id,
        v_updated.id,
        'RETIRED',
        jsonb_build_object(
            'name', v_prev.name,
            'phone', v_prev.phone,
            'email', v_prev.email,
            'effective_from', v_prev.effective_from,
            'is_current', true,
            'ended_at', v_prev.ended_at
        ),
        jsonb_build_object(
            'is_current', false,
            'ended_at', v_updated.ended_at
        ),
        now(),
        v_u.user_id,
        v_u.user_name,
        v_u.user_email
    );

    -- Recalculate colleges.tpo to contain only the REMAINING active coordinators
    PERFORM sync_college_tpo(v_updated.college_id::TEXT);

    RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION retire_placement_coordinator(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retire_placement_coordinator(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION retire_placement_coordinator(TEXT) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 6: Atomic replace_placement_coordinator with Target Validation & Multi-TPO Sync
-- (Retires only the targeted active coordinator belonging to this college.
--  Explicitly drops legacy 5-parameter overload first to avoid signature ambiguity.)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION replace_placement_coordinator(
    p_college_id TEXT,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_effective_from DATE DEFAULT CURRENT_DATE,
    p_target_coordinator_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_u RECORD;
    v_prev RECORD;
    v_new_coord RECORD;
    v_college_id_type TEXT;
    v_coord_id_type TEXT;
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_clean_email TEXT;
    v_effective_date DATE;
    v_active_count INTEGER := 0;
BEGIN
    SELECT * INTO v_u FROM get_saarthi_auth_user();
    IF v_u.user_role IS NULL OR v_u.user_role NOT IN ('admin', 'recruiter') THEN
        RAISE EXCEPTION 'Unauthorized: only approved recruiters and admins can manage placement coordinators';
    END IF;

    v_clean_name := trim(COALESCE(p_name, ''));
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Placement Coordinator Name is required';
    END IF;

    v_clean_phone := trim(COALESCE(p_phone, ''));
    IF v_clean_phone = '' THEN
        RAISE EXCEPTION 'Contact Number is required';
    END IF;
    IF v_clean_phone !~ '^[0-9]{10}$' THEN
        RAISE EXCEPTION 'Contact Number must be exactly 10 digits';
    END IF;

    v_clean_email := trim(COALESCE(p_email, ''));
    IF v_clean_email = '' THEN
        RAISE EXCEPTION 'Email Address is required';
    END IF;
    IF v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid Email Address format';
    END IF;

    v_effective_date := COALESCE(p_effective_from, CURRENT_DATE);

    IF p_college_id IS NULL OR trim(p_college_id) = '' THEN
        RAISE EXCEPTION 'College ID is required';
    END IF;

    SELECT data_type INTO v_college_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colleges' AND column_name = 'id';

    SELECT data_type INTO v_coord_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'placement_coordinators' AND column_name = 'id';

    IF v_college_id_type IS NULL OR v_coord_id_type IS NULL THEN
        RAISE EXCEPTION 'Table schema verification failed for colleges or placement_coordinators';
    END IF;

    -- Check how many active coordinators currently exist for this college
    IF v_college_id_type = 'uuid' THEN
        IF trim(p_college_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Invalid UUID format for college ID: %', p_college_id;
        END IF;

        SELECT COUNT(*) INTO v_active_count
        FROM placement_coordinators
        WHERE college_id = trim(p_college_id)::UUID AND is_current = true;
    ELSIF v_college_id_type IN ('bigint', 'integer', 'smallint') THEN
        IF trim(p_college_id) !~ '^-?[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid integer format for college ID: %', p_college_id;
        END IF;

        SELECT COUNT(*) INTO v_active_count
        FROM placement_coordinators
        WHERE college_id = trim(p_college_id)::BIGINT AND is_current = true;
    ELSE
        SELECT COUNT(*) INTO v_active_count
        FROM placement_coordinators
        WHERE college_id::TEXT = trim(p_college_id) AND is_current = true;
    END IF;

    IF v_active_count = 0 THEN
        RAISE EXCEPTION 'No active coordinator found to replace for college %. Use add_placement_coordinator instead.', p_college_id;
    END IF;

    -- 1. Validate and locate the targeted coordinator to retire
    IF p_target_coordinator_id IS NOT NULL AND trim(p_target_coordinator_id) <> '' THEN
        IF v_coord_id_type = 'uuid' THEN
            IF trim(p_target_coordinator_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                RAISE EXCEPTION 'Invalid UUID format for target coordinator ID: %', p_target_coordinator_id;
            END IF;

            SELECT * INTO v_prev
            FROM placement_coordinators
            WHERE id = trim(p_target_coordinator_id)::UUID;
        ELSIF v_coord_id_type IN ('bigint', 'integer', 'smallint') THEN
            IF trim(p_target_coordinator_id) !~ '^-?[0-9]+$' THEN
                RAISE EXCEPTION 'Invalid integer format for target coordinator ID: %', p_target_coordinator_id;
            END IF;

            SELECT * INTO v_prev
            FROM placement_coordinators
            WHERE id = trim(p_target_coordinator_id)::BIGINT;
        ELSE
            SELECT * INTO v_prev
            FROM placement_coordinators
            WHERE id::TEXT = trim(p_target_coordinator_id);
        END IF;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target coordinator % not found', p_target_coordinator_id;
        END IF;

        IF v_prev.college_id::TEXT <> trim(p_college_id) THEN
            RAISE EXCEPTION 'Target coordinator % belongs to college %, not college %', p_target_coordinator_id, v_prev.college_id, p_college_id;
        END IF;

        IF NOT v_prev.is_current THEN
            RAISE EXCEPTION 'Target coordinator % is already retired and cannot be replaced', p_target_coordinator_id;
        END IF;
    ELSE
        -- If multiple coordinators exist, demand an explicit target ID
        IF v_active_count > 1 THEN
            RAISE EXCEPTION 'College % has % active coordinators. Please specify p_target_coordinator_id to choose which coordinator to replace.', p_college_id, v_active_count;
        END IF;

        -- Exactly 1 active coordinator: safely select it
        IF v_college_id_type = 'uuid' THEN
            SELECT * INTO v_prev
            FROM placement_coordinators
            WHERE college_id = trim(p_college_id)::UUID AND is_current = true;
        ELSIF v_college_id_type IN ('bigint', 'integer', 'smallint') THEN
            SELECT * INTO v_prev
            FROM placement_coordinators
            WHERE college_id = trim(p_college_id)::BIGINT AND is_current = true;
        ELSE
            SELECT * INTO v_prev
            FROM placement_coordinators
            WHERE college_id::TEXT = trim(p_college_id) AND is_current = true;
        END IF;
    END IF;

    -- Deactivate only the targeted coordinator
    IF v_coord_id_type = 'uuid' THEN
        UPDATE placement_coordinators
        SET is_current = false,
            ended_at = now(),
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id = v_prev.id;
    ELSIF v_coord_id_type IN ('bigint', 'integer', 'smallint') THEN
        UPDATE placement_coordinators
        SET is_current = false,
            ended_at = now(),
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id = v_prev.id;
    ELSE
        UPDATE placement_coordinators
        SET is_current = false,
            ended_at = now(),
            updated_at = now(),
            updated_by = v_u.user_id,
            updated_by_name = v_u.user_name
        WHERE id::TEXT = v_prev.id::TEXT;
    END IF;

    INSERT INTO placement_coordinator_history (
        college_id,
        coordinator_id,
        action,
        previous_values,
        new_values,
        changed_at,
        changed_by,
        changed_by_name,
        changed_by_email
    ) VALUES (
        v_prev.college_id,
        v_prev.id,
        'REPLACED',
        jsonb_build_object(
            'name', v_prev.name,
            'phone', v_prev.phone,
            'email', v_prev.email,
            'is_current', true,
            'effective_from', v_prev.effective_from,
            'ended_at', v_prev.ended_at
        ),
        jsonb_build_object(
            'is_current', false,
            'ended_at', now(),
            'replaced_by', v_clean_name
        ),
        now(),
        v_u.user_id,
        v_u.user_name,
        v_u.user_email
    );

    -- 2. Insert the replacement coordinator
    IF v_college_id_type = 'uuid' THEN
        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            trim(p_college_id)::UUID,
            v_clean_name,
            v_clean_phone,
            v_clean_email,
            true,
            v_effective_date,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_new_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            trim(p_college_id)::UUID,
            v_new_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_new_coord.name,
                'phone', v_new_coord.phone,
                'email', v_new_coord.email,
                'is_current', true,
                'effective_from', v_new_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );
    ELSIF v_college_id_type IN ('bigint', 'integer', 'smallint') THEN
        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            trim(p_college_id)::BIGINT,
            v_clean_name,
            v_clean_phone,
            v_clean_email,
            true,
            v_effective_date,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_new_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            trim(p_college_id)::BIGINT,
            v_new_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_new_coord.name,
                'phone', v_new_coord.phone,
                'email', v_new_coord.email,
                'is_current', true,
                'effective_from', v_new_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );
    ELSE
        INSERT INTO placement_coordinators (
            college_id,
            name,
            phone,
            email,
            is_current,
            effective_from,
            created_at,
            updated_at,
            created_by,
            updated_by,
            created_by_name,
            updated_by_name
        ) VALUES (
            trim(p_college_id),
            v_clean_name,
            v_clean_phone,
            v_clean_email,
            true,
            v_effective_date,
            now(),
            now(),
            v_u.user_id,
            v_u.user_id,
            v_u.user_name,
            v_u.user_name
        )
        RETURNING * INTO v_new_coord;

        INSERT INTO placement_coordinator_history (
            college_id,
            coordinator_id,
            action,
            previous_values,
            new_values,
            changed_at,
            changed_by,
            changed_by_name,
            changed_by_email
        ) VALUES (
            trim(p_college_id),
            v_new_coord.id,
            'CREATED',
            NULL,
            jsonb_build_object(
                'name', v_new_coord.name,
                'phone', v_new_coord.phone,
                'email', v_new_coord.email,
                'is_current', true,
                'effective_from', v_new_coord.effective_from
            ),
            now(),
            v_u.user_id,
            v_u.user_name,
            v_u.user_email
        );
    END IF;

    -- Synchronize colleges.tpo with all active coordinator names
    PERFORM sync_college_tpo(p_college_id);

    RETURN to_jsonb(v_new_coord);
END;
$$;

REVOKE ALL ON FUNCTION replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO service_role;


-- -----------------------------------------------------------------------------
-- Step 7: Safe One-Time Backfill of colleges.tpo
-- (Strictly limited to colleges that have coordinator records; legacy-only colleges untouched)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_c RECORD;
BEGIN
    FOR v_c IN 
        SELECT DISTINCT college_id 
        FROM placement_coordinators 
        WHERE college_id IS NOT NULL 
    LOOP
        BEGIN
            PERFORM sync_college_tpo(v_c.college_id::TEXT);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not backfill tpo for college %: %', v_c.college_id, SQLERRM;
        END;
    END LOOP;
END $$;
