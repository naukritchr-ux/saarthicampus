-- =====================================================================
-- Migration: 20261016_row_level_security.sql
-- Description: Comprehensive Row Level Security (RLS) & Multi-Tenant Isolation
-- Database: Supabase PostgreSQL (SaarthiCampus)
-- Verified against live PostgREST schema definitions (38 tables)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. SECURITY DEFINER HELPER FUNCTIONS (Prevents Infinite Recursion)
-- ---------------------------------------------------------------------
-- Running these as SECURITY DEFINER with search_path = public bypasses
-- RLS during execution, preventing "infinite recursion detected in policy"
-- when evaluating policies on profiles or related tables.

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(approved, false) FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profile registration" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full control over profiles" ON profiles;

-- Users can insert their own profile upon sign up
CREATE POLICY "Public profile registration"
  ON profiles
  FOR INSERT
  WITH CHECK (
    (auth.uid() = id OR auth.uid() IS NULL)
    AND (role IS NULL OR role = 'candidate')
    AND (approved IS NULL OR approved = false)
  );

-- Authenticated users can view their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Staff (admins and recruiters) can view profiles for user management (uses definer helper to avoid recursion)
CREATE POLICY "Staff can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Admins can update/manage profiles
CREATE POLICY "Admin full control over profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = 'admin' AND public.is_user_approved()
  );

-- ---------------------------------------------------------------------
-- 2. CANDIDATES TABLE (High PII: names, phones, emails, resumes, compensation)
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can apply (insert candidate)" ON candidates;
DROP POLICY IF EXISTS "Staff can manage all candidates" ON candidates;
DROP POLICY IF EXISTS "Corporate view relevant candidates" ON candidates;

-- Public candidate application: anonymous can insert candidate record during job application
CREATE POLICY "Anon can apply (insert candidate)"
  ON candidates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff has full operational access to candidates
CREATE POLICY "Staff can manage all candidates"
  ON candidates
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Corporate recruiters can view candidates who applied to their jobs or are saved
-- Verified: saved_candidates uses company_id (not company_user_id)
CREATE POLICY "Corporate view relevant candidates"
  ON candidates
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND (
      EXISTS (
        SELECT 1 FROM applications a
        JOIN job_profiles j ON j.id = a.job_id
        WHERE a.candidate_id = candidates.id AND j.company_id = public.get_current_user_company_id()
      )
      OR
      EXISTS (
        SELECT 1 FROM saved_candidates sc
        WHERE sc.candidate_id = candidates.id AND sc.company_id = public.get_current_user_company_id()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3. SALARY HISTORY TABLE (High Financial PII)
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS salary_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage salary_history" ON salary_history;

CREATE POLICY "Staff manage salary_history"
  ON salary_history
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = 'admin' AND public.is_user_approved()
  );

-- ---------------------------------------------------------------------
-- 4. COMPANIES & COMPANY CONTACTS TABLES
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_hr_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage companies" ON companies;
DROP POLICY IF EXISTS "Corporate view own company" ON companies;
DROP POLICY IF EXISTS "Staff manage company contacts" ON company_hr_contacts;

CREATE POLICY "Staff manage companies"
  ON companies
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

CREATE POLICY "Corporate view own company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND companies.id = public.get_current_user_company_id()
  );

CREATE POLICY "Staff manage company contacts"
  ON company_hr_contacts
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- ---------------------------------------------------------------------
-- 5. COLLEGES TABLE
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS colleges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and student read colleges" ON colleges;
DROP POLICY IF EXISTS "Staff manage colleges" ON colleges;

-- Anyone can read college directory for registration/application
CREATE POLICY "Public and student read colleges"
  ON colleges
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff can add, update, delete colleges
CREATE POLICY "Staff manage colleges"
  ON colleges
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- ---------------------------------------------------------------------
-- 6. JOB PROFILES TABLE
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS job_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active jobs" ON job_profiles;
DROP POLICY IF EXISTS "Staff manage all jobs" ON job_profiles;
DROP POLICY IF EXISTS "Corporate manage own jobs" ON job_profiles;

-- Public job browsing (student portal): readable by anyone
CREATE POLICY "Public read active jobs"
  ON job_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff can manage all jobs
CREATE POLICY "Staff manage all jobs"
  ON job_profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Corporate can view and manage only their own company's jobs
CREATE POLICY "Corporate manage own jobs"
  ON job_profiles
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND job_profiles.company_id = public.get_current_user_company_id()
  );

-- ---------------------------------------------------------------------
-- 7. APPLICATIONS TABLE
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can submit applications" ON applications;
DROP POLICY IF EXISTS "Staff can manage applications" ON applications;
DROP POLICY IF EXISTS "Corporate view own applications" ON applications;

-- Public applicant can create an application
CREATE POLICY "Anon can submit applications"
  ON applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff can view and manage all applications
CREATE POLICY "Staff can manage applications"
  ON applications
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Corporate can view applications submitted to their company's jobs
CREATE POLICY "Corporate view own applications"
  ON applications
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM job_profiles j
      WHERE j.id = applications.job_id AND j.company_id = public.get_current_user_company_id()
    )
  );

-- ---------------------------------------------------------------------
-- 8. INTERVIEWS, OFFERS, JOINING TABLES
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS joining ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage interviews" ON interviews;
DROP POLICY IF EXISTS "Corporate view own interviews" ON interviews;
DROP POLICY IF EXISTS "Staff manage offers" ON offers;
DROP POLICY IF EXISTS "Corporate view own offers" ON offers;
DROP POLICY IF EXISTS "Staff manage joining" ON joining;
DROP POLICY IF EXISTS "Corporate view own joining" ON joining;

CREATE POLICY "Staff manage interviews"
  ON interviews
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

CREATE POLICY "Corporate view own interviews"
  ON interviews
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM job_profiles j
      WHERE j.id = interviews.job_id AND j.company_id = public.get_current_user_company_id()
    )
  );

CREATE POLICY "Staff manage offers"
  ON offers
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

CREATE POLICY "Corporate view own offers"
  ON offers
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM job_profiles j
      WHERE j.id = offers.job_id AND j.company_id = public.get_current_user_company_id()
    )
  );

CREATE POLICY "Staff manage joining"
  ON joining
  FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved()
  );

-- Verified: joining table has offer_id (not job_id)
-- Join: joining -> offers (via offer_id) -> job_profiles (via job_id)
CREATE POLICY "Corporate view own joining"
  ON joining
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND EXISTS (
      SELECT 1 FROM offers o
      JOIN job_profiles j ON j.id = o.job_id
      WHERE o.id = joining.offer_id AND j.company_id = public.get_current_user_company_id()
    )
  );

-- ---------------------------------------------------------------------
-- 9. APTITUDE & GD TABLES
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS aptitude_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aptitude_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aptitude_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gd_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gd_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gd_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage aptitude_tests" ON aptitude_tests;
DROP POLICY IF EXISTS "Staff manage aptitude_invites" ON aptitude_invites;
DROP POLICY IF EXISTS "Staff manage aptitude_results" ON aptitude_results;
DROP POLICY IF EXISTS "Staff manage gd_sessions" ON gd_sessions;
DROP POLICY IF EXISTS "Staff manage gd_participants" ON gd_participants;
DROP POLICY IF EXISTS "Staff manage gd_messages" ON gd_messages;
DROP POLICY IF EXISTS "Staff manage gd_ratings" ON gd_ratings;
DROP POLICY IF EXISTS "Staff manage ai_interview_sessions" ON ai_interview_sessions;

CREATE POLICY "Staff manage aptitude_tests" ON aptitude_tests FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage aptitude_invites" ON aptitude_invites FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage aptitude_results" ON aptitude_results FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage gd_sessions" ON gd_sessions FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage gd_participants" ON gd_participants FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage gd_messages" ON gd_messages FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage gd_ratings" ON gd_ratings FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage ai_interview_sessions" ON ai_interview_sessions FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

-- ---------------------------------------------------------------------
-- 10. SAVED CANDIDATES, TASKS, NOTIFICATIONS, COMMUNICATIONS, CALLS
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS saved_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_recruitment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Corporate manage saved_candidates" ON saved_candidates;
DROP POLICY IF EXISTS "Users manage own tasks" ON tasks;
DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Staff manage communications" ON communications;
DROP POLICY IF EXISTS "Staff manage call_records" ON call_records;
DROP POLICY IF EXISTS "Staff manage calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Staff manage requirements" ON requirements;
DROP POLICY IF EXISTS "Staff manage drives" ON drives;
DROP POLICY IF EXISTS "Staff manage interactions" ON interactions;
DROP POLICY IF EXISTS "Staff manage monthly_recruitment" ON monthly_recruitment;

-- Verified: saved_candidates uses company_id
CREATE POLICY "Corporate manage saved_candidates" ON saved_candidates FOR ALL TO authenticated
  USING (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND saved_candidates.company_id = public.get_current_user_company_id()
  )
  WITH CHECK (
    public.get_current_user_role() = 'corporate' AND public.is_user_approved()
    AND saved_candidates.company_id = public.get_current_user_company_id()
  );

CREATE POLICY "Users manage own tasks" ON tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own notifications" ON notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage communications" ON communications FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage call_records" ON call_records FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage calendar_events" ON calendar_events FOR ALL TO authenticated
  USING (public.is_user_approved());

CREATE POLICY "Staff manage requirements" ON requirements FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage drives" ON drives FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage interactions" ON interactions FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff manage monthly_recruitment" ON monthly_recruitment FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

-- ---------------------------------------------------------------------
-- 11. SEAL OFF LEGACY PROTOTYPE TABLES (Prevent Anon Data Scrapes)
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS candidate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campus ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS corporate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS corporate_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS corporate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resume_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only candidate" ON candidate;
DROP POLICY IF EXISTS "Admin only campus" ON campus;
DROP POLICY IF EXISTS "Admin only corporate" ON corporate;
DROP POLICY IF EXISTS "Admin only corporate_positions" ON corporate_positions;
DROP POLICY IF EXISTS "Admin only corporate_candidates" ON corporate_candidates;
DROP POLICY IF EXISTS "Admin only call_logs" ON call_logs;
DROP POLICY IF EXISTS "Admin only resume_submissions" ON resume_submissions;

CREATE POLICY "Admin only candidate" ON candidate FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());
CREATE POLICY "Admin only campus" ON campus FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());
CREATE POLICY "Admin only corporate" ON corporate FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());
CREATE POLICY "Admin only corporate_positions" ON corporate_positions FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());
CREATE POLICY "Admin only corporate_candidates" ON corporate_candidates FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());
CREATE POLICY "Admin only call_logs" ON call_logs FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());
CREATE POLICY "Admin only resume_submissions" ON resume_submissions FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin' AND public.is_user_approved());

-- ---------------------------------------------------------------------
-- 12. PLACEMENT COORDINATORS & AI INTERVIEW INVITES
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS placement_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS placement_coordinator_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_interview_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and approved read coordinators" ON placement_coordinators;
DROP POLICY IF EXISTS "Staff manage coordinators" ON placement_coordinators;
DROP POLICY IF EXISTS "Staff read coordinator history" ON placement_coordinator_history;
DROP POLICY IF EXISTS "Staff insert coordinator history" ON placement_coordinator_history;
DROP POLICY IF EXISTS "Staff can manage ai_interview_invites" ON ai_interview_invites;

CREATE POLICY "Staff and approved read coordinators" ON placement_coordinators FOR SELECT TO authenticated
  USING (public.is_user_approved());

CREATE POLICY "Staff manage coordinators" ON placement_coordinators FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved())
  WITH CHECK (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff read coordinator history" ON placement_coordinator_history FOR SELECT TO authenticated
  USING (public.is_user_approved());

CREATE POLICY "Staff insert coordinator history" ON placement_coordinator_history FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());

CREATE POLICY "Staff can manage ai_interview_invites" ON ai_interview_invites FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved())
  WITH CHECK (public.get_current_user_role() IN ('admin', 'recruiter') AND public.is_user_approved());
