-- =====================================================================
-- Migration: 20261016_ai_interview_invites.sql
-- Description: AI Interview token invitation tracking table with RLS
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_interview_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_ai_interview_invites_token ON ai_interview_invites(token);
CREATE INDEX IF NOT EXISTS idx_ai_interview_invites_cand_job ON ai_interview_invites(candidate_id, job_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_invites_status ON ai_interview_invites(status);

-- Enable Row Level Security
ALTER TABLE ai_interview_invites ENABLE ROW LEVEL SECURITY;

-- Staff (admin and recruiter) full access policy
CREATE POLICY "Staff can manage ai_interview_invites"
  ON ai_interview_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recruiter')
        AND profiles.approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recruiter')
        AND profiles.approved = true
    )
  );

-- Backend service role bypasses RLS automatically.
