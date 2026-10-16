# SaarthiCampus — Supabase Schema & Architecture Differences Report

**Generated:** October 16, 2026
**Target Environment:** SaarthiCampus Live Supabase & Local Codebase (`main` branch)
**Status:** Audit Complete & Local Remediation Applied

---

## 1. Executive Summary

A comprehensive schema verification was conducted by introspecting the live Supabase instance and cross-referencing all 38 application tables against the backend (`recruitos-backend`), frontend (`recruitos-frontend`), and SQL migrations (`supabase/migrations/`).

Several discrepancies and silent runtime failure risks were uncovered and resolved:
1. **`saved_candidates` column discrepancy:** The live database table contains `(id, company_id, candidate_id, created_at)`. Code in `index.js` previously queried for `company_user_id` which does not exist, causing corporate candidate bookmarks to fail.
2. **`joining` relational join path:** The live database links `joining` records via `offer_id` (foreign key to `offers.id`), rather than a direct `job_id`. RLS policies were corrected to traverse through the `offers` table.
3. **`ai_interview_invites` table status:** The live database does not yet contain this table. A dedicated, non-destructive migration script has been prepared with full indexation and RLS.
4. **Storage Bucket Naming:** Both `resumes` and `Resumes` exist in live storage buckets alongside `candidate-photos` and `candidate-documents`. Storage policies were updated to support both case conventions.
5. **PostgreSQL RLS Recursive Loop Risk:** Writing subqueries directly against `profiles` inside a policy on the `profiles` table triggers infinite recursion in PostgreSQL. Three `SECURITY DEFINER` helper functions were introduced to eliminate this risk.

---

## 2. Live Database Inventory (38 Tables)

The following tables were cataloged directly from the live database:

| # | Table Name | Key Schema Columns (Live Introspection) | RLS Status / Migration |
|---|------------|-----------------------------------------|------------------------|
| 1 | `profiles` | `id`, `email`, `role`, `company_id`, `approved`, `phone`, `name`, `created_at` | RLS Enabled by Migration |
| 2 | `candidates` | `id`, `name`, `email`, `phone`, `resume_url`, `photo_url`, `skills`, `current_salary`, `company_cost` | RLS Enabled by Migration |
| 3 | `companies` | `id`, `name`, `website`, `location`, `industry`, `tier`, `created_at` | RLS Enabled by Migration |
| 4 | `company_hr_contacts` | `id`, `company_id`, `name`, `email`, `phone`, `designation` | RLS Enabled by Migration |
| 5 | `job_profiles` | `id`, `title`, `company`, `company_id`, `location`, `salary_range`, `skills` | RLS Enabled by Migration |
| 6 | `applications` | `id`, `candidate_id`, `job_id`, `stage`, `id_proof_url`, `marksheet_url`, `offer_letter_url` | RLS Enabled by Migration |
| 7 | `saved_candidates` | `id`, `company_id`, `candidate_id`, `created_at` *(Verified: uses `company_id`)* | RLS Enabled by Migration |
| 8 | `offers` | `id`, `candidate_id`, `job_id`, `ctc`, `status`, `offer_letter_url`, `created_at` | RLS Enabled by Migration |
| 9 | `joining` | `id`, `candidate_id`, `offer_id`, `joining_date`, `status`, `created_at` *(Links via `offer_id`)* | RLS Enabled by Migration |
| 10 | `salary_history` | `id`, `candidate_id`, `previous_salary`, `new_salary`, `increment_pct`, `created_at` | RLS Enabled by Migration |
| 11 | `colleges` | `id`, `name`, `code`, `tier`, `location`, `tpo_name`, `tpo_email`, `created_at` | RLS Enabled by Migration |
| 12 | `placement_coordinators` | `id`, `college_id`, `name`, `email`, `phone`, `is_current`, `effective_from` | RLS Enabled by Migration |
| 13 | `placement_coordinator_history` | `id`, `college_id`, `coordinator_id`, `action`, `previous_values`, `new_values` | RLS Enabled by Migration |
| 14 | `interviews` | `id`, `candidate_id`, `job_id`, `interviewer_id`, `round`, `status`, `feedback` | RLS Enabled by Migration |
| 15 | `ai_interview_sessions` | `id`, `candidate_id`, `job_id`, `messages`, `status`, `created_at` | RLS Enabled by Migration |
| 16 | `aptitude_tests` | `id`, `candidate_id`, `job_id`, `token`, `score`, `status`, `created_at` | RLS Enabled by Migration |
| 17 | `aptitude_invites` | `id`, `candidate_id`, `job_id`, `token`, `status`, `expires_at` | RLS Enabled by Migration |
| 18 | `aptitude_results` | `id`, `test_id`, `candidate_id`, `score`, `total_questions`, `passed` | RLS Enabled by Migration |
| 19 | `gd_sessions` | `id`, `job_id`, `topic`, `scheduled_at`, `max_participants`, `status` | RLS Enabled by Migration |
| 20 | `gd_participants` | `id`, `gd_session_id`, `candidate_id`, `score`, `feedback`, `status` | RLS Enabled by Migration |
| 21 | `gd_messages` | `id`, `gd_session_id`, `candidate_id`, `message`, `sent_at` | RLS Enabled by Migration |
| 22 | `gd_ratings` | `id`, `gd_session_id`, `candidate_id`, `evaluator_id`, `rating`, `feedback` | RLS Enabled by Migration |
| 23 | `drives` | `id`, `college_id`, `company_id`, `drive_date`, `status`, `title` | RLS Enabled by Migration |
| 24 | `tasks` | `id`, `user_id`, `title`, `description`, `due_date`, `status` | RLS Enabled by Migration |
| 25 | `notifications` | `id`, `user_id`, `title`, `message`, `read`, `created_at` | RLS Enabled by Migration |
| 26 | `communications` | `id`, `sender_id`, `recipient_id`, `subject`, `message`, `created_at` | RLS Enabled by Migration |
| 27 | `call_records` | `id`, `candidate_id`, `recruiter_id`, `duration_seconds`, `notes`, `created_at` | RLS Enabled by Migration |
| 28 | `calendar_events` | `id`, `title`, `start_time`, `end_time`, `event_type`, `created_at` | RLS Enabled by Migration |
| 29 | `requirements` | `id`, `company_id`, `title`, `openings`, `skills`, `status` | RLS Enabled by Migration |
| 30 | `interactions` | `id`, `candidate_id`, `type`, `notes`, `created_at` | RLS Enabled by Migration |
| 31 | `monthly_recruitment` | `id`, `month`, `year`, `target_hires`, `actual_hires` | RLS Enabled by Migration |
| 32 | `campus` | *(Legacy table)* `id`, `name`, `location`, `created_at` | Sealed (Admin-only RLS) |
| 33 | `candidate` | *(Legacy table)* `id`, `name`, `email`, `created_at` | Sealed (Admin-only RLS) |
| 34 | `corporate` | *(Legacy table)* `id`, `name`, `industry`, `created_at` | Sealed (Admin-only RLS) |
| 35 | `corporate_candidates` | *(Legacy table)* `id`, `corporate_id`, `candidate_id` | Sealed (Admin-only RLS) |
| 36 | `corporate_positions` | *(Legacy table)* `id`, `corporate_id`, `title`, `status` | Sealed (Admin-only RLS) |
| 37 | `call_logs` | *(Legacy table)* `id`, `phone`, `call_time`, `notes` | Sealed (Admin-only RLS) |
| 38 | `resume_submissions` | *(Legacy table)* `id`, `candidate_name`, `resume_file`, `created_at` | Sealed (Admin-only RLS) |
| + | `ai_interview_invites` | *Pending migration `20261016_ai_interview_invites.sql`* | Protected by Table RLS |

---

## 3. Discrepancy Breakdown & Resolutions

### Discrepancy 1: `saved_candidates`
* **Live DB Definition:**
  ```sql
  CREATE TABLE saved_candidates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
* **Discrepancy:** The backend `recruitos-backend/index.js` route `/api/corporate/candidates/:id/save` previously executed:
  ```js
  .eq("candidate_id", candidateId)
  .eq("company_user_id", profile.id) // FAILS: column does not exist!
  ```
* **Resolution:**
  - Updated backend query to filter by `company_id`:
    ```js
    .eq("candidate_id", candidateId)
    .eq("company_id", profile.company_id)
    ```
  - Updated frontend `recruitos-frontend/src/lib/api.js`:
    - `saveCandidate` now sends request to the secure backend endpoint `/api/corporate/candidates/:id/save`.
    - `searchCandidates` queries `saved_candidates` filtering by `company_id: profile.company_id`.

---

### Discrepancy 2: `joining` Table Foreign Key Relationship
* **Live DB Definition:**
  ```sql
  CREATE TABLE joining (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
      offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
      joining_date DATE,
      status VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
* **Discrepancy:** Initial RLS draft attempted to match `joining.job_id`, which produced a PostgreSQL syntax/column not found error.
* **Resolution:**
  - Corrected RLS policy join path in `20261016_row_level_security.sql`:
    ```sql
    CREATE POLICY "Corporate view company joinings"
      ON joining
      FOR SELECT
      TO authenticated
      USING (
        public.get_current_user_role() = 'corporate' AND
        public.is_user_approved() AND
        EXISTS (
          SELECT 1 FROM offers o
          JOIN job_profiles j ON j.id = o.job_id
          WHERE o.id = joining.offer_id
            AND j.company_id = public.get_current_user_company_id()
        )
      );
    ```

---

### Discrepancy 3: Missing Table `ai_interview_invites`
* **Live DB Definition:** Missing in live schema.
* **Impact:** Sending AI interview invitations from `aiInterviewRoutes.js` failed at runtime when attempting to query or insert into this table.
* **Resolution:**
  - Migration script created: `supabase/migrations/20261016_ai_interview_invites.sql`.
  - Added indexes on `token`, `(candidate_id, job_id)`, and `status`.
  - Configured RLS restricting write access to authenticated staff (`admin`, `recruiter`) and the backend service role.

---

### Discrepancy 4: Storage Bucket Dual Naming (`resumes` vs `Resumes`)
* **Live DB Configuration:**
  - `storage.buckets` contains both `'resumes'` and `'Resumes'` (likely created during manual testing and migration).
  - Both buckets, along with `candidate-photos` and `candidate-documents`, were configured with `public = true`.
* **Resolution:**
  - Updated `20261016_storage_policies.sql` to apply policies across `bucket_id IN ('resumes', 'Resumes')`.
  - Immediately set `candidate-documents` (sensitive identity/marksheet documents) to `public = false`.
  - Resumes and photos policies allow public INSERT (for student self-registration) and restricted SELECT (for authenticated staff/corporate users).

---

### Discrepancy 5: PostgreSQL Infinite Recursion on `profiles` RLS
* **Root Cause:** A policy on `profiles` that queries `FROM profiles` causes PostgreSQL to recursively invoke the same policy repeatedly until it exceeds `max_stack_depth` and crashes.
* **Resolution:**
  - Added PostgreSQL helper functions with `SECURITY DEFINER` and `SET search_path = public`:
    ```sql
    CREATE OR REPLACE FUNCTION public.get_current_user_role()
    RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT role FROM profiles WHERE id = auth.uid();
    $$;

    CREATE OR REPLACE FUNCTION public.is_user_approved()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT COALESCE(approved, false) FROM profiles WHERE id = auth.uid();
    $$;

    CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
    RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT company_id FROM profiles WHERE id = auth.uid();
    $$;
    ```
  - All RLS policies in `20261016_row_level_security.sql` now call these functions, avoiding recursive policy queries.
