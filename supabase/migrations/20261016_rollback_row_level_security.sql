-- =====================================================================
-- Rollback Migration: 20261016_rollback_row_level_security.sql
-- Description: Safely drops custom RLS policies and resets table security
-- =====================================================================

-- 1. Profiles
DROP POLICY IF EXISTS "Public profile registration" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full control over profiles" ON profiles;

-- 2. Candidates
DROP POLICY IF EXISTS "Anon can apply (insert candidate)" ON candidates;
DROP POLICY IF EXISTS "Staff can manage all candidates" ON candidates;
DROP POLICY IF EXISTS "Corporate view relevant candidates" ON candidates;

-- 3. Salary History
DROP POLICY IF EXISTS "Staff manage salary_history" ON salary_history;

-- 4. Companies & Contacts
DROP POLICY IF EXISTS "Staff manage companies" ON companies;
DROP POLICY IF EXISTS "Corporate view own company" ON companies;
DROP POLICY IF EXISTS "Staff manage company contacts" ON company_hr_contacts;

-- 5. Colleges
DROP POLICY IF EXISTS "Public and student read colleges" ON colleges;
DROP POLICY IF EXISTS "Staff manage colleges" ON colleges;

-- 6. Job Profiles
DROP POLICY IF EXISTS "Public read active jobs" ON job_profiles;
DROP POLICY IF EXISTS "Staff manage all jobs" ON job_profiles;
DROP POLICY IF EXISTS "Corporate manage own jobs" ON job_profiles;

-- 7. Applications
DROP POLICY IF EXISTS "Anon can submit applications" ON applications;
DROP POLICY IF EXISTS "Staff can manage applications" ON applications;
DROP POLICY IF EXISTS "Corporate view own applications" ON applications;

-- 8. Interviews, Offers, Joining
DROP POLICY IF EXISTS "Staff manage interviews" ON interviews;
DROP POLICY IF EXISTS "Corporate view own interviews" ON interviews;
DROP POLICY IF EXISTS "Staff manage offers" ON offers;
DROP POLICY IF EXISTS "Corporate view own offers" ON offers;
DROP POLICY IF EXISTS "Staff manage joining" ON joining;
DROP POLICY IF EXISTS "Corporate view own joining" ON joining;

-- 9. Aptitude & GD
DROP POLICY IF EXISTS "Staff manage aptitude_tests" ON aptitude_tests;
DROP POLICY IF EXISTS "Staff manage aptitude_invites" ON aptitude_invites;
DROP POLICY IF EXISTS "Staff manage aptitude_results" ON aptitude_results;
DROP POLICY IF EXISTS "Staff manage gd_sessions" ON gd_sessions;
DROP POLICY IF EXISTS "Staff manage gd_participants" ON gd_participants;
DROP POLICY IF EXISTS "Staff manage gd_messages" ON gd_messages;
DROP POLICY IF EXISTS "Staff manage gd_ratings" ON gd_ratings;
DROP POLICY IF EXISTS "Staff manage ai_interview_sessions" ON ai_interview_sessions;

-- 10. Saved Candidates, Tasks, Notifications, Communications, Calls
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

-- 11. Legacy tables
DROP POLICY IF EXISTS "Admin only candidate" ON candidate;
DROP POLICY IF EXISTS "Admin only campus" ON campus;
DROP POLICY IF EXISTS "Admin only corporate" ON corporate;
DROP POLICY IF EXISTS "Admin only corporate_positions" ON corporate_positions;
DROP POLICY IF EXISTS "Admin only corporate_candidates" ON corporate_candidates;
DROP POLICY IF EXISTS "Admin only call_logs" ON call_logs;
DROP POLICY IF EXISTS "Admin only resume_submissions" ON resume_submissions;

-- 12. Placement Coordinators & AI Interview Invites
DROP POLICY IF EXISTS "Staff and approved read coordinators" ON placement_coordinators;
DROP POLICY IF EXISTS "Staff manage coordinators" ON placement_coordinators;
DROP POLICY IF EXISTS "Staff read coordinator history" ON placement_coordinator_history;
DROP POLICY IF EXISTS "Staff insert coordinator history" ON placement_coordinator_history;
DROP POLICY IF EXISTS "Staff can manage ai_interview_invites" ON ai_interview_invites;
