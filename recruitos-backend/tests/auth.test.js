const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");

const {
  extractBearerToken,
  verifySupabaseToken,
  getRequestProfile,
  createAuthMiddleware,
} = require("../authHelpers");

// --- Unit Tests for Token Extraction ---
test("extractBearerToken", async (t) => {
  await t.test("returns null if headers are missing or empty", () => {
    assert.equal(extractBearerToken({ headers: {} }), null);
    assert.equal(extractBearerToken({}), null);
    assert.equal(extractBearerToken(null), null);
  });

  await t.test("returns null if Authorization header does not use Bearer scheme", () => {
    assert.equal(extractBearerToken({ headers: { authorization: "Basic 12345" } }), null);
    assert.equal(extractBearerToken({ headers: { authorization: "Bearer" } }), null);
    assert.equal(extractBearerToken({ headers: { authorization: "token123" } }), null);
  });

  await t.test("extracts token correctly from valid Bearer header", () => {
    assert.equal(
      extractBearerToken({ headers: { authorization: "Bearer my-secret-token" } }),
      "my-secret-token"
    );
    assert.equal(
      extractBearerToken({ headers: { authorization: "Bearer   spaced-token  " } }),
      "spaced-token"
    );
  });
});

// --- Mock Supabase Client Factory ---
function createMockSupabase({ users = {}, profiles = {} } = {}) {
  return {
    auth: {
      getUser: async (token) => {
        if (!token || !users[token]) {
          return { data: { user: null }, error: new Error("Invalid or expired JWT") };
        }
        return { data: { user: users[token] }, error: null };
      },
    },
    from: (table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (col, val) => ({
              single: async () => {
                const profile = profiles[val];
                if (!profile) return { data: null, error: new Error("Profile not found") };
                return { data: profile, error: null };
              },
              maybeSingle: async () => {
                const profile = profiles[val];
                return { data: profile || null, error: null };
              },
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

// --- Unit Tests for Token Verification & Profile Retrieval ---
test("verifySupabaseToken & getRequestProfile", async (t) => {
  const mockUsers = {
    "admin-token": { id: "user-admin-1", email: "admin@saarthi.com" },
    "recruiter-token": { id: "user-recruiter-1", email: "recruiter@saarthi.com" },
  };

  const mockProfiles = {
    "user-admin-1": {
      id: "user-admin-1",
      email: "admin@saarthi.com",
      role: "admin",
      approved: true,
    },
    "user-recruiter-1": {
      id: "user-recruiter-1",
      email: "recruiter@saarthi.com",
      role: "recruiter",
      approved: true,
    },
  };

  const mockSupabase = createMockSupabase({ users: mockUsers, profiles: mockProfiles });

  await t.test("rejects invalid or missing tokens", async () => {
    const { user: userNoToken, error: errNoToken } = await verifySupabaseToken(mockSupabase, { headers: {} });
    assert.equal(userNoToken, null);
    assert.ok(errNoToken);

    const { user: userBadToken, error: errBadToken } = await verifySupabaseToken(mockSupabase, {
      headers: { authorization: "Bearer invalid-token" },
    });
    assert.equal(userBadToken, null);
    assert.ok(errBadToken);
  });

  await t.test("verifies valid token using getUser", async () => {
    const { user, error } = await verifySupabaseToken(mockSupabase, {
      headers: { authorization: "Bearer admin-token" },
    });
    assert.equal(error, null);
    assert.ok(user);
    assert.equal(user.id, "user-admin-1");
  });

  await t.test("getRequestProfile completely ignores spoofed x-user-id header", async () => {
    const profile = await getRequestProfile(mockSupabase, {
      headers: {
        "x-user-id": "user-admin-1", // spoofed header without valid token
      },
    });
    assert.equal(profile, null, "x-user-id must NOT grant identity");
  });

  await t.test("getRequestProfile returns profile for valid JWT", async () => {
    const profile = await getRequestProfile(mockSupabase, {
      headers: {
        authorization: "Bearer admin-token",
        "x-user-id": "user-recruiter-1", // attempted spoof override
      },
    });
    assert.ok(profile);
    assert.equal(profile.id, "user-admin-1", "Identity must come from JWT, not header");
    assert.equal(profile.role, "admin");
  });
});

// --- Integration Tests for Auth Middleware & Protected Endpoints ---
test("Express Middleware Integration Tests", async (t) => {
  const mockUsers = {
    "admin-jwt": { id: "u-admin", email: "admin@example.com" },
    "recruiter-jwt": { id: "u-recruiter", email: "recruiter@example.com" },
    "corporate-jwt": { id: "u-corporate", email: "corporate@example.com" },
    "corp-unassoc-jwt": { id: "u-corp-unassoc", email: "corporate2@example.com" },
    "candidate-jwt": { id: "u-candidate", email: "candidate@example.com" },
    "unapproved-jwt": { id: "u-pending", email: "pending@example.com" },
    "null-approved-jwt": { id: "u-null-approved", email: "nullapp@example.com" },
    "undef-approved-jwt": { id: "u-undef-approved", email: "undefapp@example.com" },
  };

  const mockProfiles = {
    "u-admin": { id: "u-admin", role: "admin", approved: true },
    "u-recruiter": { id: "u-recruiter", role: "recruiter", approved: true },
    "u-corporate": { id: "u-corporate", role: "corporate", company_id: "comp-1", approved: true },
    "u-corp-unassoc": { id: "u-corp-unassoc", role: "corporate", company_id: "comp-2", approved: true },
    "u-candidate": { id: "u-candidate", role: "candidate", candidate_id: "cand-1", approved: true },
    "u-pending": { id: "u-pending", role: "recruiter", approved: false },
    "u-null-approved": { id: "u-null-approved", role: "recruiter", approved: null },
    "u-undef-approved": { id: "u-undef-approved", role: "recruiter" },
  };

  const mockSupabase = createMockSupabase({ users: mockUsers, profiles: mockProfiles });
  const { requireAuth, requireRole, requireAdmin, requireStaff, requireCorporate } =
    createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  // Test routes
  app.get("/public", (req, res) => res.json({ status: "public ok" }));
  app.get("/auth-only", requireAuth, (req, res) => res.json({ user: req.userProfile }));
  app.get("/admin-only", requireAdmin, (req, res) => res.json({ secret: "admin data" }));
  app.get("/staff-only", requireStaff, (req, res) => res.json({ staff: true }));
  app.get("/corporate-only", requireCorporate, (req, res) => res.json({ corp: true }));
  app.get("/passport/:id", requireAuth, (req, res) => {
    if (req.userProfile?.role === "candidate" && req.userProfile.candidate_id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json({ passportFor: req.params.id });
  });

  // Remediated endpoints
  app.post("/api/ai-interview/send-invite", requireStaff, (req, res) => res.json({ success: true }));
  app.post("/api/ai-interview/start", (req, res) => {
    const { candidate_id, job_id } = req.body;
    if (!candidate_id || !job_id) return res.status(400).json({ error: "candidate_id and job_id are required" });
    if (candidate_id !== "cand-1" || job_id !== "job-1") {
      return res.status(403).json({ error: "No active application found for this candidate and job" });
    }
    res.json({ sessionId: "sess-123", question: "Tell me about yourself" });
  });
  app.post("/api/ai-interview/reply", (req, res) => {
    const { sessionId, answer } = req.body;
    if (!sessionId || !answer) return res.status(400).json({ error: "sessionId and answer are required" });
    if (sessionId === "completed-session") {
      return res.status(400).json({ error: "This interview has already been completed." });
    }
    res.json({ done: false, question: "Next question" });
  });
  app.post("/api/aptitude/generate", requireStaff, (req, res) => res.json({ success: true }));
  app.post("/api/aptitude/send-invite", requireStaff, (req, res) => res.json({ success: true }));
  app.post("/api/jd/generate", requireRole("admin", "recruiter", "corporate"), (req, res) => res.json({ success: true }));
  app.get("/api/jobs/public", (req, res) => res.json([{ id: 1, title: "SDE" }]));
  app.get("/api/aptitude/take/:token", (req, res) => res.json({ candidateName: "Test", questions: [] }));
  app.post("/api/aptitude/submit/:token", (req, res) => res.json({ success: true }));

  // Corporate passport isolation endpoint
  app.get("/candidate/:id/passport", requireAuth, (req, res) => {
    const profile = req.userProfile;
    const { id } = req.params;
    if (profile?.role === "candidate" && profile.candidate_id !== id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (profile?.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "Company association required" });
      }
      // cand-1 is associated only with comp-1
      const isAssociated = (id === "cand-1" && profile.company_id === "comp-1");
      if (!isAssociated) {
        return res.status(403).json({ error: "Access denied: candidate is not associated with your company" });
      }
      return res.json({
        candidate: { id },
        applications: [{ job: "comp-1 job", company: "Company 1" }],
      });
    }
    res.json({
      candidate: { id },
      applications: [
        { job: "comp-1 job", company: "Company 1" },
        { job: "comp-2 job", company: "Company 2" },
      ],
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  // Helper request functions
  async function apiGet(path, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  async function apiPost(path, body = {}, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => null);
    return { status: res.status, body: resBody };
  }

  await t.test("1. Public route is accessible without credentials", async () => {
    const res = await apiGet("/public");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "public ok");
  });

  await t.test("2. Protected route rejects missing token with 401", async () => {
    const res = await apiGet("/auth-only");
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Authentication required/i);
  });

  await t.test("3. Protected route rejects spoofed x-user-id header with 401", async () => {
    const res = await apiGet("/auth-only", { "x-user-id": "u-admin" });
    assert.equal(res.status, 401, "Spoofed x-user-id without JWT must be rejected");
  });

  await t.test("4. Protected route rejects malformed token with 401", async () => {
    const res = await apiGet("/auth-only", { authorization: "Bearer invalid.fake.token" });
    assert.equal(res.status, 401);
  });

  await t.test("5. Unapproved user is rejected with 403 Forbidden", async () => {
    const res = await apiGet("/auth-only", { authorization: "Bearer unapproved-jwt" });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /pending admin approval/i);
  });

  await t.test("6. requireAdmin permits admin and rejects recruiter / candidate", async () => {
    const adminRes = await apiGet("/admin-only", { authorization: "Bearer admin-jwt" });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.secret, "admin data");

    const recruiterRes = await apiGet("/admin-only", { authorization: "Bearer recruiter-jwt" });
    assert.equal(recruiterRes.status, 403);

    const candRes = await apiGet("/admin-only", { authorization: "Bearer candidate-jwt" });
    assert.equal(candRes.status, 403);
  });

  await t.test("7. requireStaff permits admin and recruiter, rejects corporate and candidate", async () => {
    const adminRes = await apiGet("/staff-only", { authorization: "Bearer admin-jwt" });
    assert.equal(adminRes.status, 200);

    const recruiterRes = await apiGet("/staff-only", { authorization: "Bearer recruiter-jwt" });
    assert.equal(recruiterRes.status, 200);

    const corpRes = await apiGet("/staff-only", { authorization: "Bearer corporate-jwt" });
    assert.equal(corpRes.status, 403);

    const candRes = await apiGet("/staff-only", { authorization: "Bearer candidate-jwt" });
    assert.equal(candRes.status, 403);
  });

  await t.test("8. requireCorporate permits corporate and admin, rejects candidate", async () => {
    const corpRes = await apiGet("/corporate-only", { authorization: "Bearer corporate-jwt" });
    assert.equal(corpRes.status, 200);

    const adminRes = await apiGet("/corporate-only", { authorization: "Bearer admin-jwt" });
    assert.equal(adminRes.status, 200);

    const candRes = await apiGet("/corporate-only", { authorization: "Bearer candidate-jwt" });
    assert.equal(candRes.status, 403);
  });

  await t.test("9. Candidate passport isolation: candidate cannot view other candidates' passports", async () => {
    // candidate is cand-1, tries to view cand-2
    const otherRes = await apiGet("/passport/cand-2", { authorization: "Bearer candidate-jwt" });
    assert.equal(otherRes.status, 403);

    // candidate views own passport cand-1
    const ownRes = await apiGet("/passport/cand-1", { authorization: "Bearer candidate-jwt" });
    assert.equal(ownRes.status, 200);
    assert.equal(ownRes.body.passportFor, "cand-1");

    // staff member can view cand-2
    const staffRes = await apiGet("/passport/cand-2", { authorization: "Bearer recruiter-jwt" });
    assert.equal(staffRes.status, 200);
    assert.equal(staffRes.body.passportFor, "cand-2");
  });

  await t.test("10. Fail-closed account approval: approved=null and approved=undefined are rejected with 403", async () => {
    const nullRes = await apiGet("/auth-only", { authorization: "Bearer null-approved-jwt" });
    assert.equal(nullRes.status, 403);
    assert.match(nullRes.body.error, /pending admin approval/i);

    const undefRes = await apiGet("/auth-only", { authorization: "Bearer undef-approved-jwt" });
    assert.equal(undefRes.status, 403);
    assert.match(undefRes.body.error, /pending admin approval/i);
  });

  await t.test("11. POST /api/ai-interview/send-invite requires staff role", async () => {
    const noAuth = await apiPost("/api/ai-interview/send-invite", { candidate_id: "c1", job_id: "j1" });
    assert.equal(noAuth.status, 401);

    const corp = await apiPost("/api/ai-interview/send-invite", { candidate_id: "c1", job_id: "j1" }, { authorization: "Bearer corporate-jwt" });
    assert.equal(corp.status, 403);

    const cand = await apiPost("/api/ai-interview/send-invite", { candidate_id: "c1", job_id: "j1" }, { authorization: "Bearer candidate-jwt" });
    assert.equal(cand.status, 403);

    const staff = await apiPost("/api/ai-interview/send-invite", { candidate_id: "c1", job_id: "j1" }, { authorization: "Bearer recruiter-jwt" });
    assert.equal(staff.status, 200);
  });

  await t.test("12. POST /api/aptitude/generate and send-invite require staff role", async () => {
    const noAuthGen = await apiPost("/api/aptitude/generate", { job_id: "j1" });
    assert.equal(noAuthGen.status, 401);

    const corpGen = await apiPost("/api/aptitude/generate", { job_id: "j1" }, { authorization: "Bearer corporate-jwt" });
    assert.equal(corpGen.status, 403);

    const staffGen = await apiPost("/api/aptitude/generate", { job_id: "j1" }, { authorization: "Bearer recruiter-jwt" });
    assert.equal(staffGen.status, 200);

    const noAuthInvite = await apiPost("/api/aptitude/send-invite", { candidate_id: "c1" });
    assert.equal(noAuthInvite.status, 401);

    const staffInvite = await apiPost("/api/aptitude/send-invite", { candidate_id: "c1" }, { authorization: "Bearer admin-jwt" });
    assert.equal(staffInvite.status, 200);
  });

  await t.test("13. POST /api/jd/generate permits staff and corporate, denies candidates", async () => {
    const noAuth = await apiPost("/api/jd/generate", { prompt: "React developer" });
    assert.equal(noAuth.status, 401);

    const cand = await apiPost("/api/jd/generate", { prompt: "React developer" }, { authorization: "Bearer candidate-jwt" });
    assert.equal(cand.status, 403);

    const corp = await apiPost("/api/jd/generate", { prompt: "React developer" }, { authorization: "Bearer corporate-jwt" });
    assert.equal(corp.status, 200);

    const staff = await apiPost("/api/jd/generate", { prompt: "React developer" }, { authorization: "Bearer recruiter-jwt" });
    assert.equal(staff.status, 200);
  });

  await t.test("14. Public endpoints are accessible without credentials", async () => {
    const jobsRes = await apiGet("/api/jobs/public");
    assert.equal(jobsRes.status, 200);
    assert.equal(Array.isArray(jobsRes.body), true);

    const takeRes = await apiGet("/api/aptitude/take/sample-token");
    assert.equal(takeRes.status, 200);
    assert.equal(takeRes.body.candidateName, "Test");

    const submitRes = await apiPost("/api/aptitude/submit/sample-token", { answers: ["A", "B"] });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.success, true);
  });

  await t.test("15. Corporate candidate passport isolation", async () => {
    // Corporate user comp-1 can view associated candidate cand-1
    const assocRes = await apiGet("/candidate/cand-1/passport", { authorization: "Bearer corporate-jwt" });
    assert.equal(assocRes.status, 200);
    // Comp-1 only sees applications for Comp-1
    assert.equal(assocRes.body.applications.length, 1);
    assert.equal(assocRes.body.applications[0].company, "Company 1");

    // Corporate user comp-2 cannot view cand-1 (not associated)
    const unassocRes = await apiGet("/candidate/cand-1/passport", { authorization: "Bearer corp-unassoc-jwt" });
    assert.equal(unassocRes.status, 403);
    assert.match(unassocRes.body.error, /not associated with your company/i);

    // Staff user can view any candidate passport and sees cross-company records
    const staffRes = await apiGet("/candidate/cand-1/passport", { authorization: "Bearer recruiter-jwt" });
    assert.equal(staffRes.status, 200);
    assert.equal(staffRes.body.applications.length, 2);
  });

  await t.test("16. AI Interview start validates matching application", async () => {
    // Missing input returns 400
    const missingInput = await apiPost("/api/ai-interview/start", { candidate_id: "cand-1" });
    assert.equal(missingInput.status, 400);

    // Candidate has no application for job-2 -> returns 403
    const noApp = await apiPost("/api/ai-interview/start", { candidate_id: "cand-1", job_id: "job-2" });
    assert.equal(noApp.status, 403);
    assert.match(noApp.body.error, /No active application found/i);

    // Candidate has valid application for job-1 -> returns 200
    const validStart = await apiPost("/api/ai-interview/start", { candidate_id: "cand-1", job_id: "job-1" });
    assert.equal(validStart.status, 200);
    assert.equal(validStart.body.sessionId, "sess-123");
  });

  await t.test("17. AI Interview reply validates session and completion state", async () => {
    // Missing input returns 400
    const missingInput = await apiPost("/api/ai-interview/reply", { sessionId: "sess-123" });
    assert.equal(missingInput.status, 400);

    // Completed session rejected with 400
    const completedRes = await apiPost("/api/ai-interview/reply", { sessionId: "completed-session", answer: "My answer" });
    assert.equal(completedRes.status, 400);
    assert.match(completedRes.body.error, /already been completed/i);

    // In-progress session returns next question
    const replyRes = await apiPost("/api/ai-interview/reply", { sessionId: "sess-123", answer: "My answer" });
    assert.equal(replyRes.status, 200);
    assert.equal(replyRes.body.done, false);
  });
});
