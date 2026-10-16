-- =====================================================================
-- Rollback Migration: 20261016_rollback_storage_policies.sql
-- Description: Revert storage policies and restore bucket visibility
-- =====================================================================

DROP POLICY IF EXISTS "Public student resume upload" ON storage.objects;
DROP POLICY IF EXISTS "Staff and owner read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Staff manage resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public candidate photo upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read candidate photos" ON storage.objects;
DROP POLICY IF EXISTS "Corporate and staff upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authorized read candidate documents" ON storage.objects;

-- Revert buckets to public if needed
UPDATE storage.buckets SET public = true WHERE id IN ('resumes', 'Resumes', 'candidate-photos', 'candidate-documents');
