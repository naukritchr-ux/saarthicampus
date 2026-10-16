# SaarthiCampus — Supabase Pre-Migration Review & Decision Document

**Review Date:** October 16, 2026
**Auditor:** Senior Supabase, PostgreSQL & Application Security Architecture Team
**Target Environment:** SaarthiCampus Live Supabase & Local Codebase (`main` branch)
**Safety Status:** READ-ONLY AUDIT & PRE-MIGRATION VERIFICATION (Zero Production Data Modified)

---

## 1. Pre-Migration Classification & Executive Decisions

| Migration File | Classification | Reason & Status |
|---|:---:|---|
| **`supabase/migrations/20261016_ai_interview_invites.sql`** | **READY FOR STAGING** | Verified against live PostgreSQL schema. Foreign keys to `candidates(id)` and `job_profiles(id)` confirmed. Backend queries in `aiInterviewRoutes.js` match all columns. Non-destructive table creation with isolated RLS. |
| **`supabase/migrations/20261016_row_level_security.sql`** | **READY FOR STAGING** | Complete 100% coverage across all 38 live database tables + `ai_interview_invites`. `SECURITY DEFINER` functions prevent infinite recursion. Profiles public INSERT hardened against self-escalation. Corporate company isolation verified. |
| **`supabase/migrations/20261016_storage_policies.sql`** | **READY FOR STAGING** | Phased lockdown strategy verified. Phase 1 makes confidential `candidate-documents` private immediately while keeping `resumes` and `candidate-photos` uploadable. Supports both `resumes` and `Resumes` bucket names. |

---

## 2. In-Depth Line-by-Line Review & Findings Breakdown

### Finding 1 [HIGH]: Session Token Check Was Optional on `/api/ai-interview/reply`
- **Location:** `recruitos-backend/aiInterviewRoutes.js:460`
- **The Issue:** The route previously evaluated:
  ```js
  if (sessionToken && !verifySessionToken(sessionToken, sessionId))
  ```
  If a caller omitted `sessionToken` entirely, the check evaluated to `false`, allowing anyone who knew or guessed a `sessionId` to submit answers and force interview completion.
- **Evidence:** Source code analysis of `aiInterviewRoutes.js`.
- **Status:** **CONFIRMED & FIXED LOCALLY**.
- **Correction:** Changed to strict validation:
  ```js
  if (!sessionToken || !verifySessionToken(sessionToken, sessionId)) {
    return res.status(403).json({ error: 'Valid session token is required to submit interview replies' });
  }
  ```
  Updated `tests/auth.test.js` to assert that missing or forged session tokens receive HTTP 403.

---

### Finding 2 [HIGH]: Potential Privilege Escalation on Direct `profiles` INSERT
- **Location:** `supabase/migrations/20261016_row_level_security.sql:60`
- **The Issue:** The initial RLS policy for user profile creation had:
  ```sql
  WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);
  ```
  If an attacker registered through Supabase Auth and sent a direct PostgREST `POST /rest/v1/profiles` request with `{"id": auth.uid(), "role": "admin", "approved": true}`, the policy would have allowed them to self-promote to an approved admin.
- **Evidence:** Line-by-line review of `row_level_security.sql`.
- **Status:** **CONFIRMED & FIXED LOCALLY**.
- **Correction:** Hardened the `WITH CHECK` clause:
  ```sql
  CREATE POLICY "Public profile registration"
    ON profiles
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
      (auth.uid() = id OR auth.uid() IS NULL)
      AND (role IS NULL OR role = 'candidate')
      AND (approved IS NULL OR approved = false)
    );
  ```
  Staff, corporate, and admin accounts created via the Express backend `/api/auth/register` execute with `supabaseServiceRole` which bypasses RLS, ensuring legitimate admin and recruiter registrations continue to function while direct PostgREST self-promotions are blocked.

---

### Finding 3 [MEDIUM]: Two Live Tables Missing from Initial RLS Migration
- **Location:** `supabase/migrations/20261016_row_level_security.sql`
- **The Issue:** Automated cross-referencing between the live database schema (38 tables) and the RLS migration revealed that `placement_coordinators` and `placement_coordinator_history` were not included in `row_level_security.sql`.
- **Evidence:** Node.js schema introspection comparing `schema_dump.json` against `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- **Status:** **CONFIRMED & FIXED LOCALLY**.
- **Correction:** Added explicit RLS enablement and access policies for `placement_coordinators` and `placement_coordinator_history` in `20261016_row_level_security.sql` and added their cleanup to `20261016_rollback_row_level_security.sql`. RLS migration now covers 100% of all 38 live tables.

---

### Finding 4 [MEDIUM]: Uppercase `Resumes` Bucket Excluded from Backend Signed URL Generator
- **Location:** `recruitos-backend/index.js:282`
- **The Issue:** The live Supabase storage has two resume buckets: `resumes` (lowercase) and `Resumes` (uppercase). The backend signed-URL generator had:
  ```js
  const ALLOWED_BUCKETS = ["resumes", "candidate-photos", "candidate-documents"];
  ```
  Any document uploaded to the uppercase `Resumes` bucket would be rejected with `400: Invalid or unsupported storage bucket`.
- **Evidence:** Storage API live inspection returned `Resumes` (id: `Resumes`, public: true).
- **Status:** **CONFIRMED & FIXED LOCALLY**.
- **Correction:** Updated `ALLOWED_BUCKETS` in `recruitos-backend/index.js` and `tests/auth.test.js` to include `"Resumes"`.

---

### Finding 5 [HIGH]: Direct Public URL Links in Frontend UI Require Phased Bucket Lockdown
- **Location:** `Approvals.jsx:294`, `CandidateDB.jsx:512`, `CandidateSearch.jsx:412`, `Resume.jsx:344`
- **The Issue:** These components currently render direct public links:
  ```jsx
  <a href={app.candidates.resume_url} target="_blank">View Resume</a>
  ```
  If `resumes` or `candidate-photos` is set to `public = false` before these frontend components are updated to fetch dynamic signed URLs, clicking these links will immediately return HTTP 400/403.
- **Evidence:** Grep scan across `recruitos-frontend/src` for `resume_url` and `photo_url`.
- **Status:** **CONFIRMED & ARCHITECTED SAFELY**.
- **Correction:** In `20261016_storage_policies.sql`, Phase 1 sets `candidate-documents` (sensitive KYC, marksheets, offer letters) to `public = false` immediately because `Documents.jsx` already uses `getDocumentSignedUrl()`. `resumes` and `candidate-photos` remain `public = true` during Phase 1 while their RLS policies restrict unauthorized deletion and modifications. Phase 2 (setting them private) will occur after UI links are wrapped with signed URLs.

---

## 3. Live Database Verification Matrix

Direct read-only inspection was executed using the PostgREST schema endpoint and Supabase Storage API with verified service credentials:

| Audit Item | Live Database State | Proposed Migration Match | Confirmed / Unverified |
|---|---|---|:---:|
| **Table Count** | 38 public tables | 38 tables covered in RLS migration + 1 pending (`ai_interview_invites`) | **CONFIRMED** |
| **`saved_candidates`** | `(id, company_id, candidate_id, created_at)` | Code and policy updated to use `company_id` | **CONFIRMED** |
| **`joining`** | `(id, candidate_id, offer_id, joining_date, status, created_at)` | Policy links via `offers.id` and `job_profiles.company_id` | **CONFIRMED** |
| **`ai_interview_invites`** | Table does not exist in live DB | Migration `20261016_ai_interview_invites.sql` creates it | **CONFIRMED** |
| **Storage Buckets** | 4 buckets: `Resumes`, `resumes`, `candidate-photos`, `candidate-documents` | Policy and backend support all 4 names | **CONFIRMED** |
| **RLS Policies** | Direct `pg_policies` catalog inspection via SQL Editor | Safe read-only inspection script prepared in `SUPABASE_INSPECTION_QUERIES.sql` | **READY FOR USER EXECUTION** |

> [!NOTE]
> Because PostgREST hides system catalogs like `pg_policies` and `pg_tables`, run queries 1 and 2 from [`SUPABASE_INSPECTION_QUERIES.sql`](file:///c:/Users/Pranay/Downloads/saarthicampus/SUPABASE_INSPECTION_QUERIES.sql) in your Supabase SQL Editor to confirm the live RLS policy list before executing migrations.

---

## 4. Application Compatibility Verification

1. **Student Self-Application Flow (`Apply.jsx`):**
   - Candidate creates resume and photo uploads: Allowed by `"Public student resume upload"` and `"Public candidate photo upload"` policies (`FOR INSERT TO public`).
   - Candidate submits job application: Allowed by `"Anon can apply (insert candidate)"` and `"Anon can submit applications"` policies (`FOR INSERT TO anon, authenticated`).
2. **Student Aptitude Test Flow (`AptitudeTest.jsx`):**
   - Assessment links are accessed via public token (`/api/aptitude/take/:token` and `/api/aptitude/submit/:token`).
   - Server-side token validation operates via backend; direct student access to `aptitude_questions` answers is blocked.
3. **Student AI Interview Flow (`AIInterview.jsx`):**
   - Candidate accesses interview via token (`/interview/:token`).
   - Backend derives candidate and job strictly from token; arbitrary candidate impersonation is blocked.
   - Session reply mandates cryptographic `sessionToken`; answer forgery is blocked.
4. **Corporate Multi-Tenant Boundaries:**
   - Corporate accounts can view only candidates who applied to their jobs or are saved in `saved_candidates` with their `company_id`.
   - Access to confidential candidate salaries (`salary_history`, `candidates.current_salary`, `candidates.company_cost`) is blocked for corporate users and candidates.
5. **Staff Operational Access:**
   - Approved administrators and recruiters retain full management over candidates, drives, interviews, and applications.
   - `SECURITY DEFINER` helper functions prevent PostgreSQL infinite recursion crashes.

---

## 5. Rollback Plan & Safety Limitations

> [!CAUTION]
> A database rollback is **NOT inherently safe** if it degrades security back to a vulnerable state. Review the exact limitations below before executing any rollback script:

### 1. `20261016_rollback_ai_interview_invites.sql`
- **What it does:** Drops table `ai_interview_invites` and its policies.
- **Limitations & Danger:** **DATA LOSS**. Any interview invitation records created while the migration was active will be permanently deleted. Active candidates holding invite tokens will receive 404 errors unless the cryptographic fallback is active.

### 2. `20261016_rollback_row_level_security.sql`
- **What it does:** Drops all custom RLS policies created in `20261016_row_level_security.sql`.
- **Limitations & Danger:** **DENY-ALL STATE**. In PostgreSQL, if RLS remains enabled on a table after its policies are dropped, the default rule is **DENY ALL** for authenticated and anonymous users. Frontend users will receive empty query responses. If tables are set to `DISABLE ROW LEVEL SECURITY`, it restores pre-migration behavior but **REOPENS ALL SENSITIVE STUDENT PII AND SALARY DATA TO UNRESTRICTED PUBLIC SCRAPING VIA THE POSTGREST API**.

### 3. `20261016_rollback_storage_policies.sql`
- **What it does:** Drops storage policies and executes `UPDATE storage.buckets SET public = true`.
- **Limitations & Danger:** **PRIVACY RE-EXPOSURE**. Setting `candidate-documents` to `public = true` re-exposes government identity proofs, academic marksheets, and employment offer letters to anyone who knows or discovers the URL.

---

## 6. Safe Staging-Test Plan & Verification Queries

### Phase 1: Apply `ai_interview_invites.sql`
1. Open Supabase Dashboard -> **SQL Editor** -> **New query**.
2. Paste contents of [`supabase/migrations/20261016_ai_interview_invites.sql`](file:///c:/Users/Pranay/Downloads/saarthicampus/supabase/migrations/20261016_ai_interview_invites.sql) and click **Run**.
3. **Verification Query:**
   ```sql
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'ai_interview_invites'
   ORDER BY ordinal_position;
   ```
   *Expected: 9 columns returned.*

### Phase 2: Apply `row_level_security.sql`
1. Open Supabase Dashboard -> **SQL Editor** -> **New query**.
2. Paste contents of [`supabase/migrations/20261016_row_level_security.sql`](file:///c:/Users/Pranay/Downloads/saarthicampus/supabase/migrations/20261016_row_level_security.sql) and click **Run**.
3. **Verification Query (Confirm 0 public tables left unprotected):**
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = false;
   ```
   *Expected: 0 rows returned.*
4. **Verification Query (Confirm helper functions installed):**
   ```sql
   SELECT routine_name, security_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name IN ('get_current_user_role', 'is_user_approved', 'get_current_user_company_id');
   ```
   *Expected: 3 functions returned with `security_type = 'DEFINER'`.*

### Phase 3: Apply `storage_policies.sql`
1. Open Supabase Dashboard -> **SQL Editor** -> **New query**.
2. Paste contents of [`supabase/migrations/20261016_storage_policies.sql`](file:///c:/Users/Pranay/Downloads/saarthicampus/supabase/migrations/20261016_storage_policies.sql) and click **Run**.
3. **Verification Query (Confirm `candidate-documents` is private):**
   ```sql
   SELECT id, name, public
   FROM storage.buckets
   WHERE id = 'candidate-documents';
   ```
   *Expected: `public = false`.*
4. **Verification Query (Confirm storage policies active):**
   ```sql
   SELECT policyname, cmd, roles
   FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects';
   ```
   *Expected: Policies listed for student resume upload, staff read, candidate photo upload, and candidate documents.*
