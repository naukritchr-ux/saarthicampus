-- =====================================================================
-- SaarthiCampus — Supabase Read-Only Security & Schema Inspection Queries
-- =====================================================================
-- INSTRUCTIONS:
-- Run these queries in the Supabase Dashboard SQL Editor.
-- Every query in this file is strictly READ-ONLY (SELECT only).
-- No data, tables, or policies will be modified by running these queries.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table Inventory & Row Level Security (RLS) Status
-- ---------------------------------------------------------------------
-- Lists all public tables, showing whether RLS is enabled and replica identity.
SELECT
    schemaname,
    tablename,
    tableowner,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename ASC;

-- ---------------------------------------------------------------------
-- 2. Complete RLS Policies Inventory
-- ---------------------------------------------------------------------
-- Lists every active Row Level Security policy in the public and storage schemas.
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command_type,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname ASC, tablename ASC, policyname ASC;

-- ---------------------------------------------------------------------
-- 3. High-Risk Tables: RLS Disabled
-- ---------------------------------------------------------------------
-- Lists any public table that currently does NOT have RLS enabled.
-- (CRITICAL: Tables returned here are accessible by anyone with the anon key if exposed).
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename ASC;

-- ---------------------------------------------------------------------
-- 4. Storage Buckets Configuration & Visibility
-- ---------------------------------------------------------------------
-- Checks whether buckets are configured as public or private.
-- (Public = true means anyone with the URL can view/download files without auth).
SELECT
    id AS bucket_id,
    name AS bucket_name,
    public AS is_public,
    created_at,
    updated_at,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
ORDER BY id ASC;

-- ---------------------------------------------------------------------
-- 5. Storage Policies on storage.objects
-- ---------------------------------------------------------------------
-- Shows what policies govern file uploads, downloads, and deletions in Storage.
SELECT
    policyname,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname ASC;

-- ---------------------------------------------------------------------
-- 6. Verify Foreign Key Constraints for Disputed Tables
-- ---------------------------------------------------------------------
-- Checks exact foreign keys for saved_candidates, joining, offers, and job_profiles.
SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('saved_candidates', 'joining', 'offers', 'job_profiles', 'applications', 'ai_interview_invites')
ORDER BY tc.table_name ASC;

-- ---------------------------------------------------------------------
-- 7. Anonymous & Role Distribution (Zero PII Exposed)
-- ---------------------------------------------------------------------
-- Counts users across role and approval status without revealing names or emails.
SELECT
    role,
    approved,
    COUNT(*) AS total_profiles
FROM profiles
GROUP BY role, approved
ORDER BY total_profiles DESC;

-- ---------------------------------------------------------------------
-- 8. Verify Presence of Security Helper Functions
-- ---------------------------------------------------------------------
-- Checks if the non-recursive RLS helper functions exist in public schema.
SELECT
    routine_name,
    routine_type,
    security_type,
    data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_current_user_role', 'is_user_approved', 'get_current_user_company_id');

-- ---------------------------------------------------------------------
-- 9. Check AI Interview Invites Table Status
-- ---------------------------------------------------------------------
-- Confirms if the ai_interview_invites table has been created.
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ai_interview_invites'
ORDER BY ordinal_position ASC;
