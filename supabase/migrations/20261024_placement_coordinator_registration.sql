-- =============================================================================
-- Migration: Public Placement Coordinator Registration & Admin Review
-- File: supabase/migrations/20261024_placement_coordinator_registration.sql
-- Description:
--   1. Creates coordinator_registrations table for public coordinator onboarding.
--   2. Enforces pending default status and check constraints.
--   3. Adds foreign keys to colleges(id) and auth.users(id).
--   4. Creates performant indexes on status, email, college_name, and created_at.
--   5. Configures fail-closed Row Level Security (RLS) policies:
--      - Public/anon can INSERT pending registrations.
--      - Public/anon CANNOT read any coordinator registrations.
--      - Authorized staff (admin & recruiter) can SELECT and UPDATE (approve/reject).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coordinator_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    college_name TEXT NOT NULL,
    official_email TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    category TEXT NOT NULL,
    website TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    matched_college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient filtering and searching
CREATE INDEX IF NOT EXISTS idx_coord_reg_status ON public.coordinator_registrations(status);
CREATE INDEX IF NOT EXISTS idx_coord_reg_email ON public.coordinator_registrations(official_email);
CREATE INDEX IF NOT EXISTS idx_coord_reg_college ON public.coordinator_registrations(college_name);
CREATE INDEX IF NOT EXISTS idx_coord_reg_created ON public.coordinator_registrations(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.coordinator_registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can submit coordinator registration" ON public.coordinator_registrations;
DROP POLICY IF EXISTS "Staff can read all coordinator registrations" ON public.coordinator_registrations;
DROP POLICY IF EXISTS "Staff can update coordinator registrations" ON public.coordinator_registrations;

-- Policy 1: Public / Anonymous can insert new registrations, restricted to status = 'pending'
CREATE POLICY "Public can submit coordinator registration"
  ON public.coordinator_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL
  );

-- Policy 2: Only authorized staff (admin, recruiter) can view registrations
CREATE POLICY "Staff can read all coordinator registrations"
  ON public.coordinator_registrations
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Policy 3: Only authorized staff can update (approve / reject)
CREATE POLICY "Staff can update coordinator registrations"
  ON public.coordinator_registrations
  FOR UPDATE
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  )
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );
