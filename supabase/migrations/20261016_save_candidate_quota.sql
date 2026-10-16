-- =====================================================================
-- Migration: 20261016_save_candidate_quota.sql
-- Description: Multi-instance-safe corporate candidate save quota
-- Function: public.save_candidate_with_quota
-- Enforces: 50 new candidate saves per company in rolling 24-hour period
-- =====================================================================

-- Pre-migration read-only verification query:
-- SELECT company_id, candidate_id, COUNT(*)
-- FROM public.saved_candidates
-- GROUP BY company_id, candidate_id
-- HAVING COUNT(*) > 1;

-- 1. Precondition: Ensure no duplicate records exist in saved_candidates.
-- If duplicates exist, fail the migration with a clear, actionable explanation
-- without altering or deleting any existing production data.
DO $$
DECLARE
    v_dup_count INT;
BEGIN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT company_id, candidate_id
        FROM public.saved_candidates
        GROUP BY company_id, candidate_id
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'Migration pre-condition failed: Found % duplicate (company_id, candidate_id) groupings in public.saved_candidates. Please inspect with "SELECT company_id, candidate_id, COUNT(*) FROM public.saved_candidates GROUP BY 1, 2 HAVING COUNT(*) > 1;" and resolve duplicates before running this migration.', v_dup_count;
    END IF;
END $$;

-- 2. Ensure unique constraint on (company_id, candidate_id) to eliminate duplicate records
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_candidates_company_candidate
ON public.saved_candidates (company_id, candidate_id);

-- 3. Ensure index on (company_id, created_at) for fast rolling 24-hour quota counting
CREATE INDEX IF NOT EXISTS idx_saved_candidates_company_created_at
ON public.saved_candidates (company_id, created_at DESC);

-- 4. Atomic Candidate Save Function with Transaction Advisory Lock
CREATE OR REPLACE FUNCTION public.save_candidate_with_quota(
    p_company_id UUID,
    p_candidate_id UUID,
    p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_count INT;
    v_lock_key BIGINT;
    v_already_saved BOOLEAN;
BEGIN
    -- Authorization check: Ensure only service_role (backend API) can execute this function.
    -- Block any caller operating under anon or authenticated roles directly.
    IF auth.role() IS NOT NULL AND auth.role() != 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: service_role authorization required', 'code', 'FORBIDDEN');
    END IF;

    -- Step 1: Validate candidate exists
    IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = p_candidate_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Candidate not found', 'code', 'NOT_FOUND');
    END IF;

    -- Step 2: Idempotent fast check (no lock needed if already saved)
    SELECT EXISTS (
        SELECT 1 FROM public.saved_candidates
        WHERE company_id = p_company_id AND candidate_id = p_candidate_id
    ) INTO v_already_saved;

    IF v_already_saved THEN
        RETURN jsonb_build_object('success', true, 'already_saved', true);
    END IF;

    -- Step 3: Acquire exclusive advisory lock for this company to serialize quota check & insert
    -- Hash company UUID into a 64-bit integer lock key to isolate concurrency per company
    v_lock_key := ('x' || substr(md5(p_company_id::text), 1, 16))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Step 4: Re-check if saved by an immediate concurrent transaction while waiting for lock
    IF EXISTS (
        SELECT 1 FROM public.saved_candidates
        WHERE company_id = p_company_id AND candidate_id = p_candidate_id
    ) THEN
        RETURN jsonb_build_object('success', true, 'already_saved', true);
    END IF;

    -- Step 5: Count saves in the rolling 24-hour window
    SELECT COUNT(*) INTO v_recent_count
    FROM public.saved_candidates
    WHERE company_id = p_company_id
      AND created_at >= (NOW() - INTERVAL '24 hours');

    -- Step 6: Enforce quota limit
    IF v_recent_count >= p_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Daily candidate save limit of %s reached. Contact campus support to expand your shortlisting quota.', p_limit),
            'code', 'LIMIT_EXCEEDED',
            'count', v_recent_count,
            'limit', p_limit
        );
    END IF;

    -- Step 7: Insert new candidate save atomically with NOW()
    INSERT INTO public.saved_candidates (company_id, candidate_id, created_at)
    VALUES (p_company_id, p_candidate_id, NOW())
    ON CONFLICT (company_id, candidate_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'already_saved', false, 'count', v_recent_count + 1);
END;
$$;

-- 5. Restrict execution privileges strictly to service_role
REVOKE ALL ON FUNCTION public.save_candidate_with_quota(UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_candidate_with_quota(UUID, UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.save_candidate_with_quota(UUID, UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_candidate_with_quota(UUID, UUID, INT) TO service_role;
