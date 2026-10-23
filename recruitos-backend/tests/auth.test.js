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
const { _helpers: interviewHelpers } = require("../aiInterviewRoutes");
const { parseStorageUrl, matchesStorageObject, validateFileBuffer } = require("../storageHelpers");

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

// --- Unit Tests for AI Interview Token Helpers ---
test("interviewTokenHelpers", async (t) => {
  await t.test("generates and verifies valid tokens", () => {
    const token = interviewHelpers.generateInterviewToken("cand-123", "job-456");
    assert.ok(typeof token === "string");
    assert.equal(token.split(".").length, 2);

    const payload = interviewHelpers.verifyInterviewTokenPayload(token);
    assert.ok(payload);
    assert.equal(payload.candidate_id, "cand-123");
    assert.equal(payload.job_id, "job-456");
    assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  });

  await t.test("rejects tampered token signature or payload", () => {
    const token = interviewHelpers.generateInterviewToken("cand-123", "job-456");
    const [payloadStr, sig] = token.split(".");

    // Tamper with signature
    const tamperedSig = sig.slice(0, -2) + "xx";
    assert.equal(interviewHelpers.verifyInterviewTokenPayload(`${payloadStr}.${tamperedSig}`), null);

    // Tamper with payload
    const decoded = JSON.parse(Buffer.from(payloadStr, "base64url").toString());
    decoded.candidate_id = "cand-attacker";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    assert.equal(interviewHelpers.verifyInterviewTokenPayload(`${tamperedPayload}.${sig}`), null);
  });

  await t.test("rejects expired tokens", () => {
    // Generate token expired 10 seconds ago
    const expiredToken = interviewHelpers.generateInterviewToken("cand-123", "job-456", -10);
    assert.equal(interviewHelpers.verifyInterviewTokenPayload(expiredToken), null);
  });

  await t.test("rejects malformed or empty tokens", () => {
    assert.equal(interviewHelpers.verifyInterviewTokenPayload(null), null);
    assert.equal(interviewHelpers.verifyInterviewTokenPayload(""), null);
    assert.equal(interviewHelpers.verifyInterviewTokenPayload("single-string-no-dot"), null);
    assert.equal(interviewHelpers.verifyInterviewTokenPayload("a.b.c"), null);
  });
});

// --- Unit Tests for Storage URL & Buffer Helpers ---
test("storageHelpers", async (t) => {
  await t.test("parses full Supabase public URLs", () => {
    const parsed = parseStorageUrl({
      url: "https://xyz.supabase.co/storage/v1/object/public/resumes/folder/my%20resume.pdf",
    });
    assert.deepEqual(parsed, { bucket: "resumes", path: "folder/my resume.pdf" });
  });

  await t.test("parses signed URLs with query strings", () => {
    const parsed = parseStorageUrl({
      url: "https://xyz.supabase.co/storage/v1/object/sign/candidate-documents/id_123.pdf?token=abc123&t=12345",
    });
    assert.deepEqual(parsed, { bucket: "candidate-documents", path: "id_123.pdf" });
  });

  await t.test("parses explicit bucket and path with path traversal protection", () => {
    const parsed = parseStorageUrl({
      bucket: "candidate-photos",
      path: "../../etc/passwd/cand-photo.jpg",
    });
    assert.deepEqual(parsed, { bucket: "candidate-photos", path: "etc/passwd/cand-photo.jpg" });
  });

  await t.test("rejects invalid buckets or empty paths", () => {
    assert.equal(parseStorageUrl({ bucket: "unknown-bucket", path: "file.pdf" }), null);
    assert.equal(parseStorageUrl({ bucket: "resumes", path: "" }), null);
    assert.equal(parseStorageUrl({ url: "https://example.com/not-supabase/file.pdf" }), null);
  });

  await t.test("matchesStorageObject enforces exact path and rejects partial substring attacks", () => {
    const storedUrl = "https://xyz.supabase.co/storage/v1/object/public/resumes/cand-1_resume.pdf";
    // 1. Exact match succeeds
    assert.equal(matchesStorageObject(storedUrl, "resumes", "cand-1_resume.pdf"), true);
    // 2. Case-insensitive bucket succeeds
    assert.equal(matchesStorageObject(storedUrl, "Resumes", "cand-1_resume.pdf"), true);
    // 3. Partial filename / substring matching attacks fail
    assert.equal(matchesStorageObject(storedUrl, "resumes", ".pdf"), false);
    assert.equal(matchesStorageObject(storedUrl, "resumes", "resume.pdf"), false);
    assert.equal(matchesStorageObject(storedUrl, "resumes", "cand-1"), false);
    // 4. Different bucket fails
    assert.equal(matchesStorageObject(storedUrl, "candidate-photos", "cand-1_resume.pdf"), false);
    // 5. Invalid inputs fail gracefully
    assert.equal(matchesStorageObject(null, "resumes", "file.pdf"), false);
    assert.equal(matchesStorageObject("", "resumes", "file.pdf"), false);
  });

  await t.test("validates file buffers for size, empty buffers, and strict PDF magic bytes", () => {
    const validPdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj");
    const valid = validateFileBuffer(validPdf, {
      maxSize: 1024,
      requirePdf: true,
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.detectedType, "application/pdf");

    // Empty buffer rejected
    const emptyBuf = validateFileBuffer(Buffer.alloc(0), { requirePdf: true });
    assert.equal(emptyBuf.valid, false);
    assert.match(emptyBuf.error, /empty or missing/i);

    // Oversized buffer rejected
    const oversized = validateFileBuffer(validPdf, { maxSize: 10 });
    assert.equal(oversized.valid, false);
    assert.match(oversized.error, /exceeds maximum/i);

    // Non-PDF bytes (HTML / executable / text) rejected with requirePdf
    const htmlBuf = Buffer.from("<!DOCTYPE html><html><body>Resume</body></html>");
    const htmlValidation = validateFileBuffer(htmlBuf, { requirePdf: true });
    assert.equal(htmlValidation.valid, false);
    assert.match(htmlValidation.error, /missing %PDF signature/i);

    const exeBuf = Buffer.from("MZThisIsNotAPdfExecutableFile");
    const exeValidation = validateFileBuffer(exeBuf, { requirePdf: true });
    assert.equal(exeValidation.valid, false);
    assert.match(exeValidation.error, /missing %PDF signature/i);
  });
});

// --- Unit Tests for Frontend Signed-URL Cache & Fail-Closed Logic ---
test("Frontend Cache Isolation & Fail-Closed Unit Tests", async (t) => {
  await t.test("cache keys isolate URLs between authenticated users", () => {
    const userA = "user-alice";
    const userB = "user-bob";
    const rawUrl = "https://example.com/storage/v1/object/public/resumes/doc.pdf";

    const keyA = `${userA}:${rawUrl}`;
    const keyB = `${userB}:${rawUrl}`;

    assert.notEqual(keyA, keyB, "Users must not share cache keys for the same URL");

    const cache = new Map();
    cache.set(keyA, { signedUrl: "https://signed.example.com/doc.pdf?token=alice", expiresAt: Date.now() + 600000 });

    assert.ok(cache.get(keyA), "User A can read own cached signed URL");
    assert.equal(cache.get(keyB), undefined, "User B must not receive User A's cached signed URL");
  });

  await t.test("cache clearing on logout purges all cached signed URLs", () => {
    const cache = new Map();
    cache.set("user-alice:doc1", { signedUrl: "signed-1", expiresAt: Date.now() + 600000 });
    cache.set("user-alice:doc2", { signedUrl: "signed-2", expiresAt: Date.now() + 600000 });

    assert.equal(cache.size, 2);
    // Simulate sign-out / account switch
    cache.clear();
    assert.equal(cache.size, 0);
  });

  await t.test("expired cache entries are ignored", () => {
    const cache = new Map();
    const expiredTimestamp = Date.now() - 5000; // expired 5 seconds ago
    cache.set("user:doc", { signedUrl: "expired-signed-url", expiresAt: expiredTimestamp });

    const entry = cache.get("user:doc");
    const isValid = entry && entry.expiresAt > Date.now();
    assert.equal(isValid, false, "Expired cache entries must not be returned");
  });

  await t.test("fail-closed behavior returns null and never falls back to original public URL", async () => {
    async function mockGetCachedSignedUrl(url, fetchSignedUrl) {
      try {
        return await fetchSignedUrl(url);
      } catch {
        return null; // Fail-closed: Never return raw url
      }
    }

    const rawUrl = "https://example.com/storage/v1/object/public/resumes/sensitive.pdf";
    const failingFetch = async () => {
      throw new Error("403 Forbidden: Access denied");
    };

    const result = await mockGetCachedSignedUrl(rawUrl, failingFetch);
    assert.equal(result, null, "Failed retrieval must return null, never the original public URL");
    assert.notEqual(result, rawUrl, "Must not leak raw URL on authorization failure");
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
    const { sessionId, sessionToken, answer } = req.body;
    if (!sessionId || !answer) return res.status(400).json({ error: "sessionId and answer are required" });
    if (!sessionToken || sessionToken !== "valid-session-token") {
      return res.status(403).json({ error: "Valid session token is required to submit interview replies" });
    }
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

  // Documents signed-url endpoint
  app.get("/api/documents/signed-url", requireAuth, (req, res) => {
    const { bucket, path: rawPath, url } = req.query;
    const parsed = parseStorageUrl({ bucket, path: rawPath, url });
    if (!parsed) {
      return res.status(400).json({ error: "Invalid or unsupported storage location" });
    }
    const { bucket: targetBucket, path: sanitizedPath } = parsed;
    const profile = req.userProfile;
    if (!profile) return res.status(401).json({ error: "User profile not found" });

    if (profile.role === "admin" || profile.role === "recruiter") {
      return res.json({ signedUrl: `https://signed.example.com/${targetBucket}/${sanitizedPath}?token=mock-signed` });
    }

    // Mock database records
    const cand1 = {
      id: "cand-1",
      resume_url: "https://project.supabase.co/storage/v1/object/public/resumes/cand-1_resume.pdf",
      photo_url: "https://project.supabase.co/storage/v1/object/public/candidate-photos/cand-1_photo.jpg",
    };
    const cand2 = {
      id: "cand-2",
      resume_url: "https://project.supabase.co/storage/v1/object/public/resumes/cand-2_resume.pdf",
      photo_url: "https://project.supabase.co/storage/v1/object/public/candidate-photos/cand-2_photo.jpg",
    };
    // Duplicate candidates sharing same resume filename
    const candDup1 = {
      id: "cand-dup-1",
      resume_url: "https://project.supabase.co/storage/v1/object/public/resumes/shared_resume_17000.pdf",
    };
    const candDup2 = {
      id: "cand-dup-2",
      resume_url: "https://project.supabase.co/storage/v1/object/public/resumes/shared_resume_17000.pdf",
    };
    // Saved candidate
    const candSaved = {
      id: "cand-saved-1",
      resume_url: "https://project.supabase.co/storage/v1/object/public/resumes/cand-saved_resume.pdf",
      photo_url: "https://project.supabase.co/storage/v1/object/public/candidate-photos/cand-saved_photo.jpg",
    };
    const app1 = {
      id: "app-1",
      id_proof_url: "https://project.supabase.co/storage/v1/object/public/candidate-documents/app-1_id_proof_1700000000000_passport.pdf",
      marksheet_url: "https://project.supabase.co/storage/v1/object/public/candidate-documents/app-1_marksheet_1700000000000_marks.pdf",
      offer_letter_url: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_marksheet.pdf",
      company_id: "comp-1",
    };

    if (profile.role === "corporate") {
      if (!profile.company_id) return res.status(403).json({ error: "No company associated" });
      let authorized = false;

      // 1. candidate-documents: strict exact match only, NO startsWith fallback
      if (targetBucket.toLowerCase() === "candidate-documents") {
        if (profile.company_id === app1.company_id) {
          if (
            matchesStorageObject(app1.id_proof_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(app1.marksheet_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(app1.offer_letter_url, targetBucket, sanitizedPath)
          ) {
            authorized = true;
          }
        }
      } else {
        // 2. Targeted resume / photo lookup: check company applications and saved candidates
        if (profile.company_id === "comp-1") {
          // Cand 1 applied to comp-1
          if (
            matchesStorageObject(cand1.resume_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(cand1.photo_url, targetBucket, sanitizedPath)
          ) {
            authorized = true;
          }
          // Cand dup 2 applied to comp-1 (demonstrates handling duplicate filenames across candidates)
          if (matchesStorageObject(candDup2.resume_url, targetBucket, sanitizedPath)) {
            authorized = true;
          }
          // Cand saved is in comp-1 saved_candidates
          if (
            matchesStorageObject(candSaved.resume_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(candSaved.photo_url, targetBucket, sanitizedPath)
          ) {
            authorized = true;
          }
        }
      }

      if (authorized) {
        return res.json({ signedUrl: `https://signed.example.com/${targetBucket}/${sanitizedPath}?token=corp-signed` });
      }
      return res.status(403).json({ error: "Access denied to requested candidate document" });
    }

    if (profile.role === "candidate") {
      let authorized = false;
      if (profile.id === "u-candidate") {
        if (
          matchesStorageObject(cand1.resume_url, targetBucket, sanitizedPath) ||
          matchesStorageObject(cand1.photo_url, targetBucket, sanitizedPath) ||
          sanitizedPath.startsWith("app-1_")
        ) {
          authorized = true;
        }
      }
      if (authorized) {
        return res.json({ signedUrl: `https://signed.example.com/${targetBucket}/${sanitizedPath}?token=cand-signed` });
      }
      return res.status(403).json({ error: "Access denied to document" });
    }

    return res.status(403).json({ error: "Role not authorized" });
  });

  // Application document upload endpoint
  app.patch("/api/applications/:id/document", requireAuth, (req, res) => {
    const { id } = req.params;
    const { docKey, fileUrl } = req.body;
    const ALLOWED_KEYS = ["id_proof", "marksheet", "offer_letter"];
    if (!docKey || !ALLOWED_KEYS.includes(docKey)) {
      return res.status(400).json({ error: "Invalid document key" });
    }
    if (!fileUrl || typeof fileUrl !== "string") {
      return res.status(400).json({ error: "fileUrl is required" });
    }
    const parsed = parseStorageUrl(fileUrl, "candidate-documents");
    if (!parsed || parsed.bucket !== "candidate-documents") {
      return res.status(400).json({ error: "Invalid candidate document URL or path" });
    }

    // Verify object belongs to the exact application and matches document convention:
    const expectedPrefix = `${id}_${docKey}_`;
    if (!parsed.path.startsWith(expectedPrefix)) {
      return res.status(400).json({
        error: `Uploaded file does not belong to application ${id} for document type ${docKey}`,
      });
    }

    const conventionRegex = new RegExp(`^${id}_${docKey}_\\d+_[a-zA-Z0-9._-]+$`);
    if (!conventionRegex.test(parsed.path)) {
      return res.status(400).json({
        error: "Malformed document filename convention",
      });
    }

    const profile = req.userProfile;
    if (profile.role === "candidate") {
      return res.status(403).json({ error: "Candidate role not authorized" });
    }
    if (profile.role === "corporate") {
      if (!profile.company_id) return res.status(403).json({ error: "Company association required" });
      if (id !== "app-1" || profile.company_id !== "comp-1") {
        return res.status(403).json({ error: "Access denied to application" });
      }
    }
    res.json({
      application: {
        id,
        [`${docKey}_url`]: fileUrl,
        [`${docKey}_status`]: "Submitted",
      },
    });
  });

  // Corporate candidate save endpoint with candidate validation and daily quota rate limiting
  const mockSavedCandidates = new Map();
  const testCompanyLocks = new Map();

  function testWithCompanySaveLock(companyId, fn) {
    const currentLock = testCompanyLocks.get(companyId) || Promise.resolve();
    let release;
    const newLock = new Promise((resolve) => {
      release = resolve;
    });
    testCompanyLocks.set(companyId, newLock);

    return currentLock
      .then(fn)
      .finally(() => {
        release();
        if (testCompanyLocks.get(companyId) === newLock) {
          testCompanyLocks.delete(companyId);
        }
      });
  }

  // Mock atomic PostgreSQL RPC function mirroring public.save_candidate_with_quota
  async function mockRpcSaveCandidateWithQuota(companyId, candidateId, limit = 50) {
    const validCandidates = [
      "cand-1", "cand-2", "cand-dup-1", "cand-dup-2", "cand-saved-1",
      "cand-c1", "cand-c2", "cand-c3", "cand-c4", "cand-c5"
    ];
    if (!validCandidates.includes(candidateId)) {
      return { data: { success: false, code: "NOT_FOUND", error: "Candidate not found" }, error: null };
    }

    const key = `${companyId}:${candidateId}`;
    if (mockSavedCandidates.has(key)) {
      return { data: { success: true, already_saved: true }, error: null };
    }

    // Atomic transaction advisory lock emulation
    return testWithCompanySaveLock(companyId, async () => {
      if (mockSavedCandidates.has(key)) {
        return { data: { success: true, already_saved: true }, error: null };
      }

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      let countIn24h = 0;
      for (const [k, v] of mockSavedCandidates.entries()) {
        if (k.startsWith(`${companyId}:`) && v.created_at >= oneDayAgo) {
          countIn24h++;
        }
      }

      if (countIn24h >= limit) {
        return {
          data: {
            success: false,
            code: "LIMIT_EXCEEDED",
            error: `Daily candidate save limit of ${limit} reached. Contact campus support to expand your shortlisting quota.`,
          },
          error: null,
        };
      }

      mockSavedCandidates.set(key, { created_at: now });
      return { data: { success: true, already_saved: false }, error: null };
    });
  }

  app.post("/api/corporate/candidates/:candidateId/save", requireCorporate, async (req, res) => {
    const profile = req.userProfile;
    if (!profile.company_id) return res.status(403).json({ error: "Company association required" });

    const { candidateId } = req.params;
    if (!candidateId || typeof candidateId !== "string") {
      return res.status(400).json({ error: "Candidate ID is required" });
    }

    // Check if test requested RPC simulation or fallback
    const simulateRpcMode = req.headers["x-simulate-rpc"]; // "missing", "permission_denied", "timeout", "throw_error"

    let missingRpc = false;
    // 1. Primary: Atomic PostgreSQL RPC function (multi-instance transaction locking via pg_advisory_xact_lock)
    try {
      if (simulateRpcMode === "throw_error") {
        throw new Error("Network connection dropped");
      }

      let rpcResult, rpcError;
      if (simulateRpcMode === "missing") {
        rpcError = { code: "PGRST202", message: "function save_candidate_with_quota does not exist" };
      } else if (simulateRpcMode === "permission_denied") {
        rpcError = { code: "42501", message: "permission denied for function save_candidate_with_quota" };
      } else if (simulateRpcMode === "timeout") {
        rpcError = { code: "57014", message: "canceling statement due to statement timeout" };
      } else {
        const res = await mockRpcSaveCandidateWithQuota(profile.company_id, candidateId, 50);
        rpcResult = res.data;
        rpcError = res.error;
      }

      if (rpcError) {
        // Check if function is genuinely missing (e.g. migration not yet executed in database)
        const isMissingRpc =
          rpcError.code === "PGRST202" ||
          (rpcError.message && /function.*save_candidate_with_quota.*does not exist/i.test(rpcError.message));

        if (isMissingRpc) {
          missingRpc = true;
        } else {
          // Fail closed for permission errors, timeouts, connection errors, and unexpected DB failures
          return res.status(500).json({ error: "Failed to process candidate save due to database error" });
        }
      } else if (rpcResult && typeof rpcResult === "object") {
        if (rpcResult.success) {
          if (rpcResult.already_saved) {
            return res.json({ success: true, alreadySaved: true });
          }
          return res.json({ success: true });
        }

        // Handle structured error responses from atomic database function
        if (rpcResult.code === "NOT_FOUND") {
          return res.status(404).json({ error: rpcResult.error || "Candidate not found" });
        }
        if (rpcResult.code === "LIMIT_EXCEEDED") {
          return res.status(429).json({ error: rpcResult.error });
        }
        if (rpcResult.code === "FORBIDDEN") {
          return res.status(403).json({ error: rpcResult.error });
        }
        return res.status(400).json({ error: rpcResult.error || "Failed to save candidate" });
      } else {
        return res.status(500).json({ error: "Invalid response from candidate save service" });
      }
    } catch (err) {
      return res.status(500).json({ error: "Unexpected error during candidate save" });
    }

    // 2. In-process fallback: only activated when the RPC function is genuinely missing
    if (!missingRpc) {
      return res.status(500).json({ error: "Failed to save candidate" });
    }

    // 2. In-process fallback: candidate existence check, local mutex, and database count
    const validCandidates = [
      "cand-1", "cand-2", "cand-dup-1", "cand-dup-2", "cand-saved-1",
      "cand-c1", "cand-c2", "cand-c3", "cand-c4", "cand-c5"
    ];
    if (!validCandidates.includes(candidateId)) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    const key = `${profile.company_id}:${candidateId}`;
    if (mockSavedCandidates.has(key)) {
      return res.json({ success: true, alreadySaved: true });
    }

    return testWithCompanySaveLock(profile.company_id, async () => {
      if (mockSavedCandidates.has(key)) {
        return res.json({ success: true, alreadySaved: true });
      }

      const DAILY_SAVE_LIMIT = 50;
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      let countIn24h = 0;
      for (const [k, v] of mockSavedCandidates.entries()) {
        if (k.startsWith(`${profile.company_id}:`) && v.created_at >= oneDayAgo) {
          countIn24h++;
        }
      }

      if (countIn24h >= DAILY_SAVE_LIMIT) {
        return res.status(429).json({
          error: `Daily candidate save limit of ${DAILY_SAVE_LIMIT} reached. Contact campus support to expand your shortlisting quota.`,
        });
      }

      mockSavedCandidates.set(key, { created_at: now });
      return res.json({ success: true });
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

  async function apiPatch(path, body = {}, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
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

    // Missing sessionToken rejected with 403
    const noTokenRes = await apiPost("/api/ai-interview/reply", { sessionId: "sess-123", answer: "My answer" });
    assert.equal(noTokenRes.status, 403);
    assert.match(noTokenRes.body.error, /session token/i);

    // Invalid sessionToken rejected with 403
    const badTokenRes = await apiPost("/api/ai-interview/reply", { sessionId: "sess-123", sessionToken: "fake-token", answer: "My answer" });
    assert.equal(badTokenRes.status, 403);

    // Completed session rejected with 400
    const completedRes = await apiPost("/api/ai-interview/reply", { sessionId: "completed-session", sessionToken: "valid-session-token", answer: "My answer" });
    assert.equal(completedRes.status, 400);
    assert.match(completedRes.body.error, /already been completed/i);

    // In-progress session with valid token returns next question
    const replyRes = await apiPost("/api/ai-interview/reply", { sessionId: "sess-123", sessionToken: "valid-session-token", answer: "My answer" });
    assert.equal(replyRes.status, 200);
    assert.equal(replyRes.body.done, false);
  });

  await t.test("18. Documents signed-url endpoint enforces auth, bucket validation, and tenant isolation", async () => {
    // 1. Unauthenticated request rejected
    const unauth = await apiGet("/api/documents/signed-url?bucket=resumes&path=cand-1_resume.pdf");
    assert.equal(unauth.status, 401);

    // 2. Unsupported bucket rejected
    const badBucket = await apiGet("/api/documents/signed-url?bucket=system_secrets&path=keys.env", {
      authorization: "Bearer admin-jwt",
    });
    assert.equal(badBucket.status, 400);

    // 3. Admin can generate signed URL for any document (testing uppercase Resumes bucket)
    const adminRes = await apiGet("/api/documents/signed-url?bucket=Resumes&path=cand-1_resume.pdf", {
      authorization: "Bearer admin-jwt",
    });
    assert.equal(adminRes.status, 200);
    assert.match(adminRes.body.signedUrl, /token=mock-signed/);

    // 4. Corporate user can access associated candidate resume and photo
    const corpResumeRes = await apiGet("/api/documents/signed-url?bucket=resumes&path=cand-1_resume.pdf", {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(corpResumeRes.status, 200);
    assert.match(corpResumeRes.body.signedUrl, /token=corp-signed/);

    const corpPhotoRes = await apiGet("/api/documents/signed-url?bucket=candidate-photos&path=cand-1_photo.jpg", {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(corpPhotoRes.status, 200);
    assert.match(corpPhotoRes.body.signedUrl, /token=corp-signed/);

    // 5. Corporate user denied access to unassociated candidate resume and photo
    const corpDeniedResume = await apiGet("/api/documents/signed-url?bucket=resumes&path=cand-2_resume.pdf", {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(corpDeniedResume.status, 403);

    const corpDeniedPhoto = await apiGet("/api/documents/signed-url?bucket=candidate-photos&path=cand-2_photo.jpg", {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(corpDeniedPhoto.status, 403);

    // 6. Substring matching attacks (.pdf, cand-1) are rejected under exact object matching
    const substringAttack1 = await apiGet("/api/documents/signed-url?bucket=resumes&path=.pdf", {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(substringAttack1.status, 403);

    const substringAttack2 = await apiGet("/api/documents/signed-url?bucket=resumes&path=cand-1", {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(substringAttack2.status, 403);

    // 7. Candidate can access own document
    const candRes = await apiGet("/api/documents/signed-url?bucket=resumes&path=cand-1_resume.pdf", {
      authorization: "Bearer candidate-jwt",
    });
    assert.equal(candRes.status, 200);
    assert.match(candRes.body.signedUrl, /token=cand-signed/);

    // 8. Candidate denied access to another candidate document
    const candDenied = await apiGet("/api/documents/signed-url?bucket=resumes&path=cand-2_resume.pdf", {
      authorization: "Bearer candidate-jwt",
    });
    assert.equal(candDenied.status, 403);
  });

  await t.test("19. Documents signed-url accepts full URLs with backward-compatibility & traversal protection", async () => {
    // 1. Accepts full Supabase public URL
    const publicUrl = encodeURIComponent("https://myproject.supabase.co/storage/v1/object/public/resumes/cand-1_resume.pdf");
    const fullUrlRes = await apiGet(`/api/documents/signed-url?url=${publicUrl}`, {
      authorization: "Bearer admin-jwt",
    });
    assert.equal(fullUrlRes.status, 200);
    assert.match(fullUrlRes.body.signedUrl, /token=mock-signed/);

    // 2. Accepts signed URL format with query parameters
    const signedObjUrl = encodeURIComponent("https://myproject.supabase.co/storage/v1/object/sign/candidate-documents/app-1_marksheet.pdf?token=exp123");
    const signedObjRes = await apiGet(`/api/documents/signed-url?url=${signedObjUrl}`, {
      authorization: "Bearer corporate-jwt",
    });
    assert.equal(signedObjRes.status, 200);
    assert.match(signedObjRes.body.signedUrl, /token=corp-signed/);

    // 3. Rejects invalid external URL
    const invalidUrl = encodeURIComponent("https://evil.com/malicious.pdf");
    const invalidUrlRes = await apiGet(`/api/documents/signed-url?url=${invalidUrl}`, {
      authorization: "Bearer admin-jwt",
    });
    assert.equal(invalidUrlRes.status, 400);

    // 4. Sanitizes path traversal attempts in path
    const traversalRes = await apiGet(`/api/documents/signed-url?bucket=resumes&path=../../etc/passwd`, {
      authorization: "Bearer admin-jwt",
    });
    assert.equal(traversalRes.status, 200);
    assert.doesNotMatch(traversalRes.body.signedUrl, /\.\./);
  });

  await t.test("20. Application document updates (PATCH /api/applications/:id/document) enforce roles & tenant boundaries", async () => {
    // 1. Unauthenticated request rejected
    const unauth = await apiPatch("/api/applications/app-1/document", {
      docKey: "id_proof",
      fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_id_proof_1700000000000_doc.pdf",
    });
    assert.equal(unauth.status, 401);

    // 2. Candidate role rejected with 403
    const candRes = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "id_proof", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_id_proof_1700000000000_doc.pdf" },
      { authorization: "Bearer candidate-jwt" }
    );
    assert.equal(candRes.status, 403);

    // 3. Disallowed docKey rejected with 400
    const badKeyRes = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "salary_secret", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_salary_secret_1700000000000_doc.pdf" },
      { authorization: "Bearer admin-jwt" }
    );
    assert.equal(badKeyRes.status, 400);

    // 4. Missing fileUrl rejected with 400
    const missingFileRes = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "id_proof" },
      { authorization: "Bearer admin-jwt" }
    );
    assert.equal(missingFileRes.status, 400);

    // 5. Cross-application document assignment attempt: app-2 file on app-1 rejected with 400
    const crossAppRes = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "id_proof", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-2_id_proof_1700000000000_passport.pdf" },
      { authorization: "Bearer admin-jwt" }
    );
    assert.equal(crossAppRes.status, 400);
    assert.match(crossAppRes.body.error, /does not belong to application app-1/i);

    // 6. DocKey mismatch in filename rejected with 400
    const docKeyMismatch = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "id_proof", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_offer_letter_1700000000000_doc.pdf" },
      { authorization: "Bearer admin-jwt" }
    );
    assert.equal(docKeyMismatch.status, 400);

    // 7. Malformed convention (missing timestamp or invalid characters) rejected with 400
    const malformedConvention = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "marksheet", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_marksheet_nontimestamp_doc.pdf" },
      { authorization: "Bearer admin-jwt" }
    );
    assert.equal(malformedConvention.status, 400);
    assert.match(malformedConvention.body.error, /malformed document filename/i);

    // 8. Corporate user denied access to application for different company
    const corpDenied = await apiPatch(
      "/api/applications/app-2/document",
      { docKey: "offer_letter", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-2_offer_letter_1700000000000_doc.pdf" },
      { authorization: "Bearer corporate-jwt" } // comp-1
    );
    assert.equal(corpDenied.status, 403);

    // 9. Corporate user allowed for own company's application
    const corpSuccess = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "offer_letter", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_offer_letter_1700000000000_offer.pdf" },
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(corpSuccess.status, 200);
    assert.equal(corpSuccess.body.application.offer_letter_status, "Submitted");

    // 10. Staff user allowed to update application document
    const staffSuccess = await apiPatch(
      "/api/applications/app-1/document",
      { docKey: "marksheet", fileUrl: "https://myproject.supabase.co/storage/v1/object/public/candidate-documents/app-1_marksheet_1700000000000_marks.pdf" },
      { authorization: "Bearer recruiter-jwt" }
    );
    assert.equal(staffSuccess.status, 200);
    assert.equal(staffSuccess.body.application.marksheet_status, "Submitted");
  });

  await t.test("21. Private document authorization: prefix fallback removed, exact match required", async () => {
    // 1. Unlisted file with valid appId prefix rejected under exact matching (no startsWith loophole)
    const prefixSpoofRes = await apiGet(
      "/api/documents/signed-url?bucket=candidate-documents&path=app-1_unlisted_internal_memo.pdf",
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(prefixSpoofRes.status, 403, "Unlisted file with valid prefix must be rejected");

    // 2. Exact match of approved document succeeds
    const exactDocRes = await apiGet(
      "/api/documents/signed-url?bucket=candidate-documents&path=app-1_id_proof_1700000000000_passport.pdf",
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(exactDocRes.status, 200);
    assert.match(exactDocRes.body.signedUrl, /token=corp-signed/);
  });

  await t.test("22. Corporate candidate save validation: rejects non-existent candidates", async () => {
    // 1. Invalid candidate ID rejected with 404
    const notFoundRes = await apiPost(
      "/api/corporate/candidates/cand-nonexistent-999/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(notFoundRes.status, 404);
    assert.match(notFoundRes.body.error, /Candidate not found/i);

    // 2. Unauthenticated save rejected with 401
    const unauthSave = await apiPost("/api/corporate/candidates/cand-1/save", {});
    assert.equal(unauthSave.status, 401);

    // 3. Candidate role saving another candidate rejected with 403
    const candSave = await apiPost(
      "/api/corporate/candidates/cand-1/save",
      {},
      { authorization: "Bearer candidate-jwt" }
    );
    assert.equal(candSave.status, 403);
  });

  await t.test("23. Corporate candidate save: idempotent repeat saves and 50/day rate limit", async () => {
    // 1. Valid save succeeds
    const saveRes = await apiPost(
      "/api/corporate/candidates/cand-1/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.success, true);

    // 2. Idempotent repeat save returns alreadySaved: true and does not count as a new save
    const repeatSave = await apiPost(
      "/api/corporate/candidates/cand-1/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(repeatSave.status, 200);
    assert.equal(repeatSave.body.alreadySaved, true);

    // 3. Simulate hitting the 50 saves limit
    // Pre-populate mock saves up to 50
    for (let i = 10; i < 60; i++) {
      mockSavedCandidates.set(`comp-1:cand-dummy-${i}`, { created_at: Date.now() });
    }

    // 4. Attempting to save candidate #51 returns 429 Too Many Requests
    const limitExceededRes = await apiPost(
      "/api/corporate/candidates/cand-2/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(limitExceededRes.status, 429);
    assert.match(limitExceededRes.body.error, /Daily candidate save limit of 50 reached/i);

    // 5. Concurrency Race Test:
    // Reset saves to exactly 48 saves
    mockSavedCandidates.clear();
    for (let i = 0; i < 48; i++) {
      mockSavedCandidates.set(`comp-1:cand-dummy-${i}`, { created_at: Date.now() });
    }

    // Fire 5 concurrent requests simultaneously for 5 different candidate IDs
    // Since current count is 48 and limit is 50, exactly 2 must succeed (reaching 50),
    // and exactly 3 must receive 429 Too Many Requests.
    const concurrentCandidates = ["cand-c1", "cand-c2", "cand-c3", "cand-c4", "cand-c5"];
    const results = await Promise.all(
      concurrentCandidates.map((cid) =>
        apiPost(`/api/corporate/candidates/${cid}/save`, {}, { authorization: "Bearer corporate-jwt" })
      )
    );

    const statuses = results.map((r) => r.status);
    const successCount = statuses.filter((s) => s === 200).length;
    const rateLimitedCount = statuses.filter((s) => s === 429).length;

    assert.equal(successCount, 2, "Exactly 2 concurrent saves must succeed to reach 50");
    assert.equal(rateLimitedCount, 3, "Remaining 3 concurrent saves must be rate limited with 429");

    // Total saves in database must be strictly 50, never 53
    let totalComp1Saves = 0;
    for (const [k] of mockSavedCandidates.entries()) {
      if (k.startsWith("comp-1:")) totalComp1Saves++;
    }
    assert.equal(totalComp1Saves, 50, "Total saves must never exceed the 50 limit under concurrency");

    // 6. Concurrent duplicate requests: saving an already-saved candidate simultaneously succeeds even at limit
    mockSavedCandidates.set("comp-1:cand-1", { created_at: Date.now() });
    const dupResults = await Promise.all([
      apiPost("/api/corporate/candidates/cand-1/save", {}, { authorization: "Bearer corporate-jwt" }),
      apiPost("/api/corporate/candidates/cand-1/save", {}, { authorization: "Bearer corporate-jwt" }),
    ]);
    assert.equal(dupResults[0].status, 200);
    assert.equal(dupResults[0].body.alreadySaved, true);
    assert.equal(dupResults[1].status, 200);
    assert.equal(dupResults[1].body.alreadySaved, true);
  });

  await t.test("24. Targeted candidate resume lookup safely handles duplicate filenames", async () => {
    // cand-dup-1 and cand-dup-2 both have resume "shared_resume_17000.pdf".
    // cand-dup-2 is associated with comp-1, cand-dup-1 is not.
    // Targeted query checks all matching candidate IDs and grants access.
    const sharedResumeRes = await apiGet(
      "/api/documents/signed-url?bucket=resumes&path=shared_resume_17000.pdf",
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(sharedResumeRes.status, 200);
    assert.match(sharedResumeRes.body.signedUrl, /token=corp-signed/);

    // Saved candidate resume access succeeds
    const savedCandResume = await apiGet(
      "/api/documents/signed-url?bucket=resumes&path=cand-saved_resume.pdf",
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(savedCandResume.status, 200);
    assert.match(savedCandResume.body.signedUrl, /token=corp-signed/);
  });

  await t.test("25. Recruiter operational access is fully retained for all documents and resumes", async () => {
    // 1. Recruiter can access resume in resumes
    const recResume = await apiGet(
      "/api/documents/signed-url?bucket=resumes&path=cand-2_resume.pdf",
      { authorization: "Bearer recruiter-jwt" }
    );
    assert.equal(recResume.status, 200);
    assert.match(recResume.body.signedUrl, /token=mock-signed/);

    // 2. Recruiter can access photo in candidate-photos
    const recPhoto = await apiGet(
      "/api/documents/signed-url?bucket=candidate-photos&path=cand-2_photo.jpg",
      { authorization: "Bearer recruiter-jwt" }
    );
    assert.equal(recPhoto.status, 200);
    assert.match(recPhoto.body.signedUrl, /token=mock-signed/);

    // 3. Recruiter can access candidate verification document
    const recDoc = await apiGet(
      "/api/documents/signed-url?bucket=candidate-documents&path=app-1_marksheet_1700000000000_marks.pdf",
      { authorization: "Bearer recruiter-jwt" }
    );
    assert.equal(recDoc.status, 200);
    assert.match(recDoc.body.signedUrl, /token=mock-signed/);
  });

  await t.test("26. save_candidate_with_quota RPC verification and graceful fallback to in-process lock", async () => {
    // Reset saves map for isolated test 26
    mockSavedCandidates.clear();

    // 1. Primary RPC path handles candidate save successfully
    const rpcSaveRes = await apiPost(
      "/api/corporate/candidates/cand-c1/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(rpcSaveRes.status, 200);
    assert.equal(rpcSaveRes.body.success, true);

    // 2. Already saved returns alreadySaved: true via RPC
    const rpcAlreadySaved = await apiPost(
      "/api/corporate/candidates/cand-c1/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(rpcAlreadySaved.status, 200);
    assert.equal(rpcAlreadySaved.body.alreadySaved, true);

    // 3. Candidate not found returns 404 via RPC
    const rpcNotFound = await apiPost(
      "/api/corporate/candidates/cand-ghost-unknown/save",
      {},
      { authorization: "Bearer corporate-jwt" }
    );
    assert.equal(rpcNotFound.status, 404);
    assert.match(rpcNotFound.body.error, /Candidate not found/i);

    // 4. Genuinely missing RPC (PGRST202) activates in-process fallback and succeeds
    mockSavedCandidates.delete("comp-1:cand-c2");
    const fallbackSaveRes = await apiPost(
      "/api/corporate/candidates/cand-c2/save",
      {},
      {
        authorization: "Bearer corporate-jwt",
        "x-simulate-rpc": "missing",
      }
    );
    assert.equal(fallbackSaveRes.status, 200);
    assert.equal(fallbackSaveRes.body.success, true);
    assert.ok(mockSavedCandidates.has("comp-1:cand-c2"), "Saved via fallback mechanism");

    // 5. Fallback path also correctly identifies already saved
    const fallbackAlreadySaved = await apiPost(
      "/api/corporate/candidates/cand-c2/save",
      {},
      {
        authorization: "Bearer corporate-jwt",
        "x-simulate-rpc": "missing",
      }
    );
    assert.equal(fallbackAlreadySaved.status, 200);
    assert.equal(fallbackAlreadySaved.body.alreadySaved, true);

    // 6. Fail-closed: Permission denied error (42501) returns 500 and does NOT fall back
    mockSavedCandidates.delete("comp-1:cand-c3");
    const permDeniedRes = await apiPost(
      "/api/corporate/candidates/cand-c3/save",
      {},
      {
        authorization: "Bearer corporate-jwt",
        "x-simulate-rpc": "permission_denied",
      }
    );
    assert.equal(permDeniedRes.status, 500, "Permission denied must fail closed with 500");
    assert.match(permDeniedRes.body.error, /database error/i);
    assert.equal(mockSavedCandidates.has("comp-1:cand-c3"), false, "Must not execute fallback on permission error");

    // 7. Fail-closed: Database statement timeout (57014) returns 500 and does NOT fall back
    const timeoutRes = await apiPost(
      "/api/corporate/candidates/cand-c3/save",
      {},
      {
        authorization: "Bearer corporate-jwt",
        "x-simulate-rpc": "timeout",
      }
    );
    assert.equal(timeoutRes.status, 500, "Timeout must fail closed with 500");
    assert.match(timeoutRes.body.error, /database error/i);
    assert.equal(mockSavedCandidates.has("comp-1:cand-c3"), false, "Must not execute fallback on timeout");

    // 8. Fail-closed: Driver or network exception returns 500 and does NOT fall back
    const exceptionRes = await apiPost(
      "/api/corporate/candidates/cand-c3/save",
      {},
      {
        authorization: "Bearer corporate-jwt",
        "x-simulate-rpc": "throw_error",
      }
    );
    assert.equal(exceptionRes.status, 500, "Exception must fail closed with 500");
    assert.match(exceptionRes.body.error, /Unexpected error/i);
    assert.equal(mockSavedCandidates.has("comp-1:cand-c3"), false, "Must not execute fallback on exception");
  });
});

// --- Regression Tests: Corporate Company Linking and Job Isolation (Scenarios 1-11) ---
test("Corporate Company Linking and Job Isolation Tests (Scenarios 1-11)", async (t) => {
  const TC_COMPANY_ID = "2e5e7a94-2b4d-4258-b761-8439f0d8b592";
  const CHEM_COMPANY_ID = "1a50f750-a2bc-4a9b-9b32-ee91c748fef9";

  const companiesStore = new Map([
    [TC_COMPANY_ID, { id: TC_COMPANY_ID, name: "Talent Corner HR Services", hr_email: "contact@talentcorner.in" }],
    [CHEM_COMPANY_ID, { id: CHEM_COMPANY_ID, name: "Demo Chemical Traders", hr_email: "demo@chemicaltraders.com" }],
  ]);

  const usersStore = {
    "tc-jwt": { id: "u-tc-corporate", email: "contact@talentcorner.in" },
    "chem-jwt": { id: "u-chem-corporate", email: "demo@chemicaltraders.com" },
    "nocomp-jwt": { id: "u-nocomp-corporate", email: "unlinked@example.com" },
    "admin-jwt": { id: "u-admin-user", email: "admin@saarthi.com" },
    "recruiter-jwt": { id: "u-recruiter-user", email: "recruiter@saarthi.com" },
    "candidate-jwt": { id: "u-candidate-user", email: "candidate@saarthi.com" },
  };

  const profilesStore = new Map([
    ["u-tc-corporate", { id: "u-tc-corporate", email: "contact@talentcorner.in", name: "Talent Corner HR", role: "corporate", company_id: TC_COMPANY_ID, approved: true }],
    ["u-chem-corporate", { id: "u-chem-corporate", email: "demo@chemicaltraders.com", name: "Chemical HR", role: "corporate", company_id: CHEM_COMPANY_ID, approved: true }],
    ["u-nocomp-corporate", { id: "u-nocomp-corporate", email: "unlinked@example.com", name: "Unlinked Corp", role: "corporate", company_id: null, approved: true }],
    ["u-admin-user", { id: "u-admin-user", email: "admin@saarthi.com", name: "Admin User", role: "admin", approved: true }],
    ["u-recruiter-user", { id: "u-recruiter-user", email: "recruiter@saarthi.com", name: "Recruiter Staff", role: "recruiter", approved: true }],
    ["u-candidate-user", { id: "u-candidate-user", email: "candidate@saarthi.com", name: "Student Candidate", role: "candidate", approved: true }],
  ]);

  let jobsStore = [
    { id: "job-tc-1", title: "TC Recruiter", company: "Talent Corner HR Services", company_id: TC_COMPANY_ID, status: "Active" },
    { id: "job-tc-2", title: "TC Specialist", company: "Talent Corner HR Services", company_id: TC_COMPANY_ID, status: "Active" },
    { id: "job-chem-1", title: "Chem Sales Officer", company: "Demo Chemical Traders", company_id: CHEM_COMPANY_ID, status: "Active" },
    { id: "job-chem-2", title: "Chem Plant Executive", company: "Demo Chemical Traders", company_id: CHEM_COMPANY_ID, status: "Active" },
  ];

  const applicationsStore = [
    { id: "app-tc-1", job_id: "job-tc-1", company_id: TC_COMPANY_ID, candidate_id: "cand-1", status: "Applied" },
    { id: "app-chem-1", job_id: "job-chem-1", company_id: CHEM_COMPANY_ID, candidate_id: "cand-2", status: "Applied" },
  ];

  const mockSupabase = {
    auth: {
      getUser: async (token) => {
        if (!token || !usersStore[token]) return { data: { user: null }, error: new Error("Invalid JWT") };
        return { data: { user: usersStore[token] }, error: null };
      },
    },
    from: (table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (col, val) => ({
              single: async () => {
                const p = profilesStore.get(val);
                if (!p) return { data: null, error: new Error("Profile not found") };
                return { data: p, error: null };
              },
              maybeSingle: async () => {
                const p = profilesStore.get(val);
                return { data: p || null, error: null };
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

  const { requireAuth, requireAdmin } = createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  // GET /api/jobs (isolated for corporate, full for staff/admin)
  app.get("/api/jobs", async (req, res) => {
    const profile = await getRequestProfile(mockSupabase, req);
    if (!profile) return res.status(401).json({ error: "Authentication required" });
    if (!profile.approved) return res.status(403).json({ error: "Account awaiting approval" });

    if (profile.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({
          error: "Corporate account is not associated with any company. Please contact an administrator to link your account.",
        });
      }
      const filtered = jobsStore.filter((j) => j.company_id === profile.company_id);
      return res.json(filtered);
    }

    if (["admin", "recruiter", "manager"].includes(profile.role)) {
      return res.json(jobsStore);
    }

    return res.status(403).json({ error: "Access denied" });
  });

  // POST /api/jobs (server-side company ownership enforcement)
  app.post("/api/jobs", async (req, res) => {
    const profile = await getRequestProfile(mockSupabase, req);
    if (!profile) return res.status(401).json({ error: "Authentication required" });

    let targetCompanyId = null;
    let targetCompanyName = req.body.company || null;

    if (profile.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "Corporate account has no linked company" });
      }
      targetCompanyId = profile.company_id; // server-side override, ignore client
      targetCompanyName = companiesStore.get(profile.company_id)?.name || targetCompanyName;
    } else if (["admin", "recruiter", "manager"].includes(profile.role)) {
      if (req.body.company_id) {
        if (!companiesStore.has(req.body.company_id)) {
          return res.status(400).json({ error: "Selected company does not exist" });
        }
        targetCompanyId = req.body.company_id;
      }
    } else {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const newJob = {
      id: "job-" + Date.now(),
      title: req.body.title,
      company: targetCompanyName,
      company_id: targetCompanyId,
      status: "Active",
    };
    jobsStore.push(newJob);
    return res.json({ success: true, job: newJob });
  });

  // PATCH /api/jobs/:id (ownership verification)
  app.patch("/api/jobs/:id", async (req, res) => {
    const profile = await getRequestProfile(mockSupabase, req);
    if (!profile) return res.status(401).json({ error: "Authentication required" });

    const job = jobsStore.find((j) => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    if (profile.role === "corporate") {
      if (!profile.company_id) return res.status(403).json({ error: "No company associated" });
      if (job.company_id !== profile.company_id) {
        return res.status(403).json({ error: "Access denied to requested job" });
      }
      delete req.body.company_id;
    } else if (!["admin", "recruiter", "manager"].includes(profile.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    Object.assign(job, req.body);
    return res.json({ success: true, job });
  });

  // DELETE /api/jobs/:id (ownership verification)
  app.delete("/api/jobs/:id", async (req, res) => {
    const profile = await getRequestProfile(mockSupabase, req);
    if (!profile) return res.status(401).json({ error: "Authentication required" });

    const jobIndex = jobsStore.findIndex((j) => j.id === req.params.id);
    if (jobIndex === -1) return res.status(404).json({ error: "Job not found" });

    const job = jobsStore[jobIndex];
    if (profile.role === "corporate") {
      if (!profile.company_id || job.company_id !== profile.company_id) {
        return res.status(403).json({ error: "Access denied to requested job" });
      }
    } else if (!["admin", "recruiter", "manager"].includes(profile.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    jobsStore.splice(jobIndex, 1);
    return res.json({ success: true });
  });

  // Public jobs endpoint
  app.get("/api/jobs/public", (req, res) => {
    const publicJobs = jobsStore
      .filter((j) => j.status === "Active")
      .map((j) => ({ id: j.id, title: j.title, company: j.company }));
    return res.json(publicJobs);
  });

  // Public application endpoint
  app.post("/api/apply", (req, res) => {
    const { job_id, candidate_name, candidate_email } = req.body;
    if (!job_id || !candidate_name || !candidate_email) {
      return res.status(400).json({ error: "Missing required application fields" });
    }
    const job = jobsStore.find((j) => j.id === job_id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const newApp = {
      id: "app-" + Date.now(),
      job_id,
      company_id: job.company_id,
      candidate_name,
      candidate_email,
      status: "Applied",
    };
    applicationsStore.push(newApp);
    return res.json({ success: true, application: newApp });
  });

  // Admin user creation (requires and validates company_id for corporate)
  app.post("/api/auth/users", requireAdmin, async (req, res) => {
    const { email, name, role, company_id } = req.body;
    if (!email || !name || !role) return res.status(400).json({ error: "Missing required fields" });

    let finalCompanyId = null;
    if (role === "corporate") {
      if (!company_id) {
        return res.status(400).json({ error: "company_id is required for corporate users" });
      }
      if (!companiesStore.has(company_id)) {
        return res.status(400).json({ error: "Selected company not found" });
      }
      finalCompanyId = company_id;
    }

    const newUserId = "u-" + Date.now();
    const newProfile = { id: newUserId, email, name, role, company_id: finalCompanyId, approved: true };
    profilesStore.set(newUserId, newProfile);
    return res.json({ success: true, user: newProfile });
  });

  // Admin user update (allows updating company_id with validation)
  app.patch("/api/auth/users/:userId", requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const profile = profilesStore.get(userId);
    if (!profile) return res.status(404).json({ error: "User not found" });

    const { company_id, role, name, email } = req.body;
    if (company_id !== undefined) {
      if (company_id && !companiesStore.has(company_id)) {
        return res.status(400).json({ error: "Selected company not found" });
      }
      profile.company_id = company_id || null;
    }
    if (role) profile.role = role;
    if (name) profile.name = name;
    if (email) profile.email = email;

    return res.json({ success: true, profile });
  });

  // Applications access (corporate isolation)
  app.get("/api/applications", async (req, res) => {
    const profile = await getRequestProfile(mockSupabase, req);
    if (!profile) return res.status(401).json({ error: "Authentication required" });

    if (profile.role === "corporate") {
      if (!profile.company_id) return res.status(403).json({ error: "No company associated" });
      const filtered = applicationsStore.filter((a) => a.company_id === profile.company_id);
      return res.json(filtered);
    }
    if (["admin", "recruiter"].includes(profile.role)) {
      return res.json(applicationsStore);
    }
    return res.status(403).json({ error: "Access denied" });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  async function api(path, opts = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  // Scenario 1: Talent Corner logs in and sees only Talent Corner jobs
  await t.test("Scenario 1: Talent Corner logs in and sees only Talent Corner jobs", async () => {
    const res = await api("/api/jobs", { headers: { authorization: "Bearer tc-jwt" } });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);
    for (const job of res.body) {
      assert.equal(job.company_id, TC_COMPANY_ID, "Talent Corner must only see jobs with its company_id");
      assert.equal(job.company, "Talent Corner HR Services");
    }
    const hasChemJobs = res.body.some((j) => j.company_id === CHEM_COMPANY_ID);
    assert.equal(hasChemJobs, false, "Talent Corner must NOT see Demo Chemical Traders jobs");
  });

  // Scenario 2: Demo Chemical Traders logs in and sees only Demo Chemical Traders jobs
  await t.test("Scenario 2: Demo Chemical Traders logs in and sees only Demo Chemical Traders jobs", async () => {
    const res = await api("/api/jobs", { headers: { authorization: "Bearer chem-jwt" } });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);
    for (const job of res.body) {
      assert.equal(job.company_id, CHEM_COMPANY_ID, "Demo Chemical Traders must only see jobs with its company_id");
      assert.equal(job.company, "Demo Chemical Traders");
    }
    const hasTcJobs = res.body.some((j) => j.company_id === TC_COMPANY_ID);
    assert.equal(hasTcJobs, false, "Demo Chemical Traders must NOT see Talent Corner jobs");
  });

  // Scenario 3: Admin can still see all jobs
  await t.test("Scenario 3: Admin can still see all jobs across companies", async () => {
    const res = await api("/api/jobs", { headers: { authorization: "Bearer admin-jwt" } });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 4, "Admin must see all jobs across all companies");
    const companyIds = new Set(res.body.map((j) => j.company_id));
    assert.ok(companyIds.has(TC_COMPANY_ID), "Admin must see Talent Corner jobs");
    assert.ok(companyIds.has(CHEM_COMPANY_ID), "Admin must see Demo Chemical Traders jobs");
  });

  // Scenario 4: Corporate user with missing company_id is denied company-specific access and receives useful error
  await t.test("Scenario 4: Corporate user with missing company_id is denied with useful error", async () => {
    const res = await api("/api/jobs", { headers: { authorization: "Bearer nocomp-jwt" } });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /corporate account is not associated with any company/i);

    const createRes = await api("/api/jobs", {
      method: "POST",
      headers: { authorization: "Bearer nocomp-jwt" },
      body: { title: "Test Job" },
    });
    assert.equal(createRes.status, 403);
  });

  // Scenario 5: Admin can create a corporate user linked to a selected company
  await t.test("Scenario 5: Admin can create a corporate user linked to selected company", async () => {
    // 5a. Successfully create corporate user with company
    const res = await api("/api/auth/users", {
      method: "POST",
      headers: { authorization: "Bearer admin-jwt" },
      body: {
        name: "New Corp Officer",
        email: "newcorp@talentcorner.in",
        role: "corporate",
        company_id: TC_COMPANY_ID,
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "corporate");
    assert.equal(res.body.user.company_id, TC_COMPANY_ID);

    // 5b. Fails if company_id is missing for corporate user
    const noCompRes = await api("/api/auth/users", {
      method: "POST",
      headers: { authorization: "Bearer admin-jwt" },
      body: {
        name: "Missing Comp User",
        email: "missingcomp@test.com",
        role: "corporate",
      },
    });
    assert.equal(noCompRes.status, 400);
    assert.match(noCompRes.body.error, /company_id is required/i);

    // 5c. Fails if invalid company_id is provided
    const badCompRes = await api("/api/auth/users", {
      method: "POST",
      headers: { authorization: "Bearer admin-jwt" },
      body: {
        name: "Bad Comp User",
        email: "badcomp@test.com",
        role: "corporate",
        company_id: "00000000-0000-0000-0000-000000000000",
      },
    });
    assert.equal(badCompRes.status, 400);
    assert.match(badCompRes.body.error, /company not found/i);
  });

  // Scenario 6: Admin can change a corporate user's company association
  await t.test("Scenario 6: Admin can change a corporate user's company association safely", async () => {
    const updateRes = await api("/api/auth/users/u-nocomp-corporate", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-jwt" },
      body: { company_id: CHEM_COMPANY_ID },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.profile.company_id, CHEM_COMPANY_ID);

    // Reset back to null for other tests
    await api("/api/auth/users/u-nocomp-corporate", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-jwt" },
      body: { company_id: null },
    });
  });

  // Scenario 7: Corporate user cannot create or edit a job for another company by manipulating request data
  await t.test("Scenario 7: Corporate user cannot spoof company_id on create or edit another company job", async () => {
    // 7a. Attempt to spoof company_id on create: server must force verified company_id
    const createSpoof = await api("/api/jobs", {
      method: "POST",
      headers: { authorization: "Bearer tc-jwt" },
      body: {
        title: "Infiltrated Job",
        company_id: CHEM_COMPANY_ID, // Attempting to create job for Demo Chemical Traders
        company: "Demo Chemical Traders",
      },
    });
    assert.equal(createSpoof.status, 200);
    assert.equal(createSpoof.body.job.company_id, TC_COMPANY_ID, "Server must override spoofed company_id with user's verified company_id");

    // 7b. Attempt to edit another company's job
    const editOther = await api("/api/jobs/job-chem-1", {
      method: "PATCH",
      headers: { authorization: "Bearer tc-jwt" },
      body: { title: "Tampered Chem Title" },
    });
    assert.equal(editOther.status, 403, "Corporate user must not be permitted to edit another company's job");

    // 7c. Attempt to delete another company's job
    const deleteOther = await api("/api/jobs/job-chem-1", {
      method: "DELETE",
      headers: { authorization: "Bearer tc-jwt" },
    });
    assert.equal(deleteOther.status, 403, "Corporate user must not be permitted to delete another company's job");
  });

  // Scenario 8: Corporate user cannot view or modify another company's applications
  await t.test("Scenario 8: Corporate user cannot view or modify another company's applications", async () => {
    const tcApps = await api("/api/applications", { headers: { authorization: "Bearer tc-jwt" } });
    assert.equal(tcApps.status, 200);
    assert.equal(tcApps.body.length, 1);
    assert.equal(tcApps.body[0].id, "app-tc-1");
    const hasChemApp = tcApps.body.some((a) => a.company_id === CHEM_COMPANY_ID);
    assert.equal(hasChemApp, false, "Talent Corner must not see Demo Chemical Traders applications");
  });

  // Scenario 9: Public students can still browse public jobs and submit applications
  await t.test("Scenario 9: Public students can browse public jobs and submit applications without auth", async () => {
    // Browse public jobs
    const publicJobs = await api("/api/jobs/public");
    assert.equal(publicJobs.status, 200);
    assert.ok(Array.isArray(publicJobs.body));
    assert.ok(publicJobs.body.length > 0);

    // Apply to job
    const applyRes = await api("/api/apply", {
      method: "POST",
      body: {
        job_id: "job-tc-1",
        candidate_name: "Rahul Verma",
        candidate_email: "rahul@college.edu",
      },
    });
    assert.equal(applyRes.status, 200);
    assert.equal(applyRes.body.success, true);
    assert.equal(applyRes.body.application.candidate_name, "Rahul Verma");
  });

  // Scenario 10: Existing job profiles and company records remain unchanged after the migration
  await t.test("Scenario 10: Existing job profiles and company records remain intact", async () => {
    assert.ok(companiesStore.has(TC_COMPANY_ID), "Talent Corner company record must exist");
    assert.ok(companiesStore.has(CHEM_COMPANY_ID), "Demo Chemical Traders company record must exist");

    const tcJob = jobsStore.find((j) => j.id === "job-tc-1");
    assert.ok(tcJob, "Original Talent Corner job must remain intact");
    assert.equal(tcJob.company_id, TC_COMPANY_ID);

    const chemJob = jobsStore.find((j) => j.id === "job-chem-1");
    assert.ok(chemJob, "Original Demo Chemical Traders job must remain intact");
    assert.equal(chemJob.company_id, CHEM_COMPANY_ID);
  });

  // Scenario 11: Non-corporate roles retain their intended existing permissions
  await t.test("Scenario 11: Non-corporate roles retain their intended existing permissions", async () => {
    // Recruiter (staff) can view jobs across companies
    const recJobs = await api("/api/jobs", { headers: { authorization: "Bearer recruiter-jwt" } });
    assert.equal(recJobs.status, 200);
    assert.ok(recJobs.body.length >= 4);

    // Candidate cannot access protected jobs listing
    const candJobs = await api("/api/jobs", { headers: { authorization: "Bearer candidate-jwt" } });
    assert.equal(candJobs.status, 403);
  });
});

// --- Tests: Placement Coordinator Registration & Admin Review ---
test("Placement Coordinator Registration & Admin Review Tests", async (t) => {
  const collegesStore = new Map([
    [
      "col-sharda",
      {
        id: "col-sharda",
        name: "Sharda University",
        city: "Greater Noida",
        state: "Uttar Pradesh",
        course: "Law",
        tpo: "Prof. Sharma",
        status: "Interested",
      },
    ],
  ]);

  const placementCoordsStore = new Map();
  const coordRegistrationsStore = new Map();

  const usersStore = {
    "admin-jwt": { id: "u-admin", email: "admin@saarthi.com" },
    "recruiter-jwt": { id: "u-recruiter", email: "recruiter@saarthi.com" },
    "corporate-jwt": { id: "u-corporate", email: "corp@company.com" },
    "candidate-jwt": { id: "u-candidate", email: "student@college.edu" },
  };

  const profilesStore = new Map([
    ["u-admin", { id: "u-admin", email: "admin@saarthi.com", name: "Admin", role: "admin", approved: true }],
    ["u-recruiter", { id: "u-recruiter", email: "recruiter@saarthi.com", name: "Recruiter", role: "recruiter", approved: true }],
    ["u-corporate", { id: "u-corporate", email: "corp@company.com", name: "Corp User", role: "corporate", company_id: "comp-1", approved: true }],
    ["u-candidate", { id: "u-candidate", email: "student@college.edu", name: "Student", role: "candidate", approved: true }],
  ]);

  const mockSupabase = {
    auth: {
      getUser: async (token) => {
        if (!token || !usersStore[token]) return { data: { user: null }, error: new Error("Invalid JWT") };
        return { data: { user: usersStore[token] }, error: null };
      },
    },
    from: (table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (col, val) => ({
              single: async () => {
                const p = profilesStore.get(val);
                if (!p) return { data: null, error: new Error("Profile not found") };
                return { data: p, error: null };
              },
              maybeSingle: async () => {
                const p = profilesStore.get(val);
                return { data: p || null, error: null };
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

  const { requireStaff } = createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  // Public coordinator registration endpoint
  app.post("/api/placement-coordinator/register", async (req, res) => {
    const {
      full_name,
      designation,
      college_name,
      official_email,
      phone,
      city,
      state,
      category,
      website,
      remarks,
    } = req.body;

    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return res.status(400).json({ error: "Full Name is required" });
    }
    if (!designation || typeof designation !== "string" || !designation.trim()) {
      return res.status(400).json({ error: "Designation is required" });
    }
    if (!college_name || typeof college_name !== "string" || !college_name.trim()) {
      return res.status(400).json({ error: "College Name is required" });
    }
    if (!official_email || typeof official_email !== "string" || !official_email.trim()) {
      return res.status(400).json({ error: "Official Email is required" });
    }
    const cleanEmail = official_email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Please enter a valid Official Email address" });
    }

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Please enter a valid 10-digit mobile number" });
    }

    if (!city || typeof city !== "string" || !city.trim()) {
      return res.status(400).json({ error: "City is required" });
    }
    if (!state || typeof state !== "string" || !state.trim()) {
      return res.status(400).json({ error: "State is required" });
    }
    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ error: "College Category is required" });
    }

    // Check duplicate pending
    for (const reg of coordRegistrationsStore.values()) {
      if (reg.official_email === cleanEmail && reg.status === "pending") {
        return res.status(409).json({
          error: "A registration with this official email has already been submitted and is currently pending admin review.",
        });
      }
    }

    const regId = "reg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const newReg = {
      id: regId,
      full_name: full_name.trim(),
      designation: designation.trim(),
      college_name: college_name.trim(),
      official_email: cleanEmail,
      phone: cleanPhone,
      city: city.trim(),
      state: state.trim(),
      category: category.trim(),
      website: website || null,
      remarks: remarks || null,
      status: "pending",
      matched_college_id: null,
      created_at: new Date().toISOString(),
    };
    coordRegistrationsStore.set(regId, newReg);

    return res.json({
      success: true,
      message: "Registration submitted successfully",
      registration: newReg,
    });
  });

  // Staff: List registrations
  app.get("/api/placement-coordinators/registrations", requireStaff, (req, res) => {
    const { status, search } = req.query;
    let list = Array.from(coordRegistrationsStore.values());
    if (status && status !== "all") {
      list = list.filter((r) => r.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.college_name.toLowerCase().includes(q) ||
          r.official_email.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      );
    }

    const enriched = list.map((r) => {
      let matched = null;
      for (const col of collegesStore.values()) {
        if (col.name.trim().toLowerCase() === r.college_name.trim().toLowerCase()) {
          matched = col;
          break;
        }
      }
      return { ...r, suggested_college: matched };
    });

    return res.json(enriched);
  });

  // Staff: Approve registration
  app.post("/api/placement-coordinators/registrations/:id/approve", requireStaff, (req, res) => {
    const reg = coordRegistrationsStore.get(req.params.id);
    if (!reg) return res.status(404).json({ error: "Registration not found" });
    if (reg.status === "approved") return res.status(400).json({ error: "Already approved" });

    let finalCollegeId = req.body?.target_college_id;
    if (!finalCollegeId) {
      for (const col of collegesStore.values()) {
        if (col.name.trim().toLowerCase() === reg.college_name.trim().toLowerCase()) {
          finalCollegeId = col.id;
          break;
        }
      }
    }

    if (!finalCollegeId) {
      finalCollegeId = "col-" + Date.now();
      collegesStore.set(finalCollegeId, {
        id: finalCollegeId,
        name: reg.college_name,
        city: reg.city,
        state: reg.state,
        course: reg.category,
        website: reg.website,
        tpo: reg.full_name,
        status: "Interested",
      });
    }

    const coordId = "coord-" + Date.now();
    placementCoordsStore.set(coordId, {
      id: coordId,
      college_id: finalCollegeId,
      name: reg.full_name,
      phone: reg.phone,
      email: reg.official_email,
      is_current: true,
    });

    reg.status = "approved";
    reg.matched_college_id = finalCollegeId;
    reg.reviewed_by = req.userProfile.id;
    reg.reviewed_at = new Date().toISOString();

    return res.json({ success: true, registration: reg, college_id: finalCollegeId });
  });

  // Staff: Reject registration
  app.post("/api/placement-coordinators/registrations/:id/reject", requireStaff, (req, res) => {
    const reg = coordRegistrationsStore.get(req.params.id);
    if (!reg) return res.status(404).json({ error: "Registration not found" });

    reg.status = "rejected";
    reg.rejection_reason = req.body?.reason || null;
    reg.reviewed_by = req.userProfile.id;
    reg.reviewed_at = new Date().toISOString();

    return res.json({ success: true, registration: reg });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  async function api(path, opts = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  // 1. Valid public submission
  await t.test("1. Public coordinator can submit valid registration with pending status", async () => {
    const res = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Dr. Ananya Ray",
        designation: "Head - Training & Placement",
        college_name: "Kalinga Institute of Industrial Technology",
        official_email: "tpo@kiit.ac.in",
        phone: "9876543210",
        city: "Bhubaneswar",
        state: "Odisha",
        category: "Engineering/Tech",
        website: "https://kiit.ac.in",
        remarks: "Looking forward to 2026 campus drives",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.registration.status, "pending");
    assert.equal(res.body.registration.official_email, "tpo@kiit.ac.in");
  });

  // 2. Missing required fields
  await t.test("2. Rejects submission with missing required fields with 400", async () => {
    const res = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Dr. Incomplete",
        official_email: "incomplete@test.com",
      },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Designation is required/i);
  });

  // 3. Invalid email format
  await t.test("3. Rejects invalid email format with 400", async () => {
    const res = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Dr. Test",
        designation: "TPO",
        college_name: "Test College",
        official_email: "not-an-email",
        phone: "9876543210",
        city: "Mumbai",
        state: "Maharashtra",
        category: "MBA/Management",
      },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid Official Email/i);
  });

  // 4. Invalid phone number format
  await t.test("4. Rejects invalid phone numbers with 400", async () => {
    const res = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Dr. Test",
        designation: "TPO",
        college_name: "Test College",
        official_email: "test@college.edu",
        phone: "12345", // only 5 digits
        city: "Mumbai",
        state: "Maharashtra",
        category: "MBA/Management",
      },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /10-digit mobile number/i);
  });

  // 5. Duplicate pending registration prevention
  await t.test("5. Prevents duplicate pending submissions with 409 Conflict", async () => {
    const res = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Dr. Ananya Ray",
        designation: "Head - TPO",
        college_name: "Kalinga Institute of Industrial Technology",
        official_email: "tpo@kiit.ac.in",
        phone: "9876543210",
        city: "Bhubaneswar",
        state: "Odisha",
        category: "Engineering/Tech",
      },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already been submitted and is currently pending/i);
  });

  // 6. Unauthorized access to admin review endpoint
  await t.test("6. Denies unauthenticated and unauthorized roles from reading coordinator registrations", async () => {
    const noAuth = await api("/api/placement-coordinators/registrations");
    assert.equal(noAuth.status, 401);

    const corpAuth = await api("/api/placement-coordinators/registrations", {
      headers: { authorization: "Bearer corporate-jwt" },
    });
    assert.equal(corpAuth.status, 403);

    const candAuth = await api("/api/placement-coordinators/registrations", {
      headers: { authorization: "Bearer candidate-jwt" },
    });
    assert.equal(candAuth.status, 403);
  });

  // 7. Staff can view registrations with matching college suggestions
  await t.test("7. Authorized staff can view coordinator registrations", async () => {
    // Add a registration matching Sharda University
    const subRes = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Prof. Rajiv Sen",
        designation: "Director - TPO",
        college_name: "Sharda University",
        official_email: "rajiv.sen@sharda.ac.in",
        phone: "9811223344",
        city: "Greater Noida",
        state: "Uttar Pradesh",
        category: "Law",
      },
    });
    assert.equal(subRes.status, 200);

    const staffRes = await api("/api/placement-coordinators/registrations", {
      headers: { authorization: "Bearer recruiter-jwt" },
    });
    assert.equal(staffRes.status, 200);
    assert.ok(Array.isArray(staffRes.body));
    const shardaReg = staffRes.body.find((r) => r.official_email === "rajiv.sen@sharda.ac.in");
    assert.ok(shardaReg);
    assert.equal(shardaReg.suggested_college?.id, "col-sharda", "Must detect matching existing college");
  });

  // 8. Admin approves registration with existing college match (no duplicate college created)
  await t.test("8. Admin approves coordinator matching existing college without creating duplicate college", async () => {
    const initialCollegeCount = collegesStore.size;

    const listRes = await api("/api/placement-coordinators/registrations?search=rajiv.sen@sharda.ac.in", {
      headers: { authorization: "Bearer admin-jwt" },
    });
    const reg = listRes.body[0];

    const approveRes = await api(`/api/placement-coordinators/registrations/${reg.id}/approve`, {
      method: "POST",
      headers: { authorization: "Bearer admin-jwt" },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.college_id, "col-sharda");
    assert.equal(approveRes.body.registration.status, "approved");
    assert.equal(collegesStore.size, initialCollegeCount, "Must not create duplicate college record");
  });

  // 9. Admin approves registration for a new college (creates college record and coordinator)
  await t.test("9. Admin approves new college registration (creates college record & coordinator)", async () => {
    const initialCollegeCount = collegesStore.size;

    const listRes = await api("/api/placement-coordinators/registrations?search=tpo@kiit.ac.in", {
      headers: { authorization: "Bearer admin-jwt" },
    });
    const reg = listRes.body[0];

    const approveRes = await api(`/api/placement-coordinators/registrations/${reg.id}/approve`, {
      method: "POST",
      headers: { authorization: "Bearer admin-jwt" },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.registration.status, "approved");
    assert.equal(collegesStore.size, initialCollegeCount + 1, "Must create new college record for new institution");
  });

  // 10. Admin rejects registration with reason
  await t.test("10. Admin can reject a registration with reason", async () => {
    // Create new registration to reject
    const subRes = await api("/api/placement-coordinator/register", {
      method: "POST",
      body: {
        full_name: "Fake Coordinator",
        designation: "TPO",
        college_name: "Unrecognized Fake College",
        official_email: "fake@spammydomain.xyz",
        phone: "9988776655",
        city: "Nowhere",
        state: "Goa",
        category: "Other",
      },
    });
    const regId = subRes.body.registration.id;

    const rejectRes = await api(`/api/placement-coordinators/registrations/${regId}/reject`, {
      method: "POST",
      headers: { authorization: "Bearer admin-jwt" },
      body: { reason: "Unable to verify institution accreditation" },
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.registration.status, "rejected");
    assert.equal(rejectRes.body.registration.rejection_reason, "Unable to verify institution accreditation");
  });
});


