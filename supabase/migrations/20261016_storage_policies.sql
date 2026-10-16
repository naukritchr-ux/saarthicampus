-- =====================================================================
-- Migration: 20261016_storage_policies.sql
-- Description: Secure Row Level Security policies for Supabase Storage
-- Buckets: resumes, candidate-photos, candidate-documents
-- =====================================================================

-- 1. Ensure candidate-documents (confidential KYC/marksheets) is private immediately.
-- NOTE: 'resumes' and 'candidate-photos' should be made private only after verifying all UI links use signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'candidate-documents';

-- Optional Phase 2 hardening (uncomment when ready for strict signed-URL only mode):
-- UPDATE storage.buckets SET public = false WHERE id IN ('resumes', 'Resumes', 'candidate-photos');

-- 2. Drop existing conflicting policies if re-running
DROP POLICY IF EXISTS "Public student resume upload" ON storage.objects;
DROP POLICY IF EXISTS "Staff and owner read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Staff manage resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public candidate photo upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read candidate photos" ON storage.objects;
DROP POLICY IF EXISTS "Corporate and staff upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authorized read candidate documents" ON storage.objects;

-- 3. Resumes Bucket Policies
-- Allow anyone (including anonymous students applying online) to upload a resume
CREATE POLICY "Public student resume upload"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id IN ('resumes', 'Resumes'));

-- Staff and approved corporate can view/read resumes
CREATE POLICY "Staff and owner read resumes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('resumes', 'Resumes') AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'recruiter')
          AND profiles.approved = true
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'corporate'
          AND profiles.approved = true
      )
    )
  );

-- Staff can delete/update resumes
CREATE POLICY "Staff manage resumes"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id IN ('resumes', 'Resumes') AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recruiter')
        AND profiles.approved = true
    )
  );

-- 4. Candidate Photos Bucket Policies
-- Allow public student photo upload during application
CREATE POLICY "Public candidate photo upload"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'candidate-photos');

-- Authenticated staff and corporate can view photos
CREATE POLICY "Authenticated read candidate photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'candidate-photos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.approved = true
    )
  );

-- 5. Candidate Documents Bucket Policies (KYC, marksheets, offer letters)
-- Only authenticated corporate and staff can upload candidate documents
CREATE POLICY "Corporate and staff upload documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-documents' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recruiter', 'corporate')
        AND profiles.approved = true
    )
  );

-- Only authorized staff and corporate can view candidate documents
CREATE POLICY "Authorized read candidate documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'candidate-documents' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recruiter', 'corporate')
        AND profiles.approved = true
    )
  );
