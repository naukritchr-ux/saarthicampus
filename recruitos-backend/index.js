require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { analyzeResume } = require("./resumeAnalyzer");
const { scoreGDSession } = require("./gdScorer");
const { generateEmail } = require("./generateEmailRoute");
const {
  sendCollegeOutreachEmail,
  sendStudentSelectionEmail,
  sendCollegeSelectionEmail,
  sendCompanySelectionEmail,
  sendGDInviteEmail,
  sendGDShortlistEmail,
} = require("./emailService");

const aiInterviewRoutes = require("./aiInterviewRoutes");
const aptitudeRoutes = require("./aptitudeRoutes");
const { createGDRoom, createMeetingToken } = require("./dailyService");
const jdRoutes = require("./jdRoutes");
const { moveApplicationStage } = require("./pipelineSync");
const { parseStorageUrl, matchesStorageObject } = require("./storageHelpers");
const multer = require("multer");
const XLSX = require("xlsx");
// NOTE: pdf-parse is now lazy-loaded (required inside the routes that need it)
// instead of at the top of the file. Loading it eagerly crashes on Vercel's
// serverless runtime because pdf-parse tries to reference DOMMatrix (a
// browser-only API) at module-load time, which doesn't exist in Node.js.
// That crash was taking down the entire app, including unrelated routes.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/ai-interview", aiInterviewRoutes);
app.use("/api/aptitude", aptitudeRoutes);
app.use("/api/jd", jdRoutes);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const {
  getRequestProfile,
  createAuthMiddleware,
} = require("./authHelpers");

const {
  requireAuth,
  requireRole,
  requireAdmin,
  requireStaff,
  requireCorporate,
} = createAuthMiddleware(supabase);

// ---- COLLEGES ----
app.get("/api/colleges", requireStaff, async (req, res) => {
  const { course, status, search } = req.query;
  let query = supabase.from("colleges").select("*");
  if (course) query = query.ilike("course", `%${course}%`);
  if (status && status !== "All Status") query = query.eq("status", status);
  if (search)
    query = query.or(
      `name.ilike.%${search}%,city.ilike.%${search}%,tpo.ilike.%${search}%`,
    );
  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.post("/api/colleges", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("colleges")
    .insert([req.body])
    .select();
  if (error) return res.status(500).json({ error });
  res.json(data[0]);
});

// ---- COMPANIES ----
app.get("/api/companies", requireAuth, async (req, res) => {
  const profile = req.userProfile;
  if (profile?.role === "candidate") {
    return res.status(403).json({ error: "Not authorized" });
  }
  let query = supabase.from("companies").select("*");

  if (profile?.role === "corporate" && profile.company_id) {
    query = query.eq("id", profile.company_id);
  } else if (profile?.role === "corporate" && !profile.company_id) {
    return res.json([]);
  }
  // admin, recruiter see all companies

  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.post("/api/companies", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("companies")
    .insert([req.body])
    .select();
  if (error) return res.status(500).json({ error });
  res.json(data[0]);
});

// ---- JOB PROFILES ----
app.get("/api/jobs", requireAuth, async (req, res) => {
  const profile = req.userProfile;
  let query = supabase.from("job_profiles").select("*");

  if (profile?.role === "corporate") {
    if (!profile.company_id) {
      return res.status(403).json({
        error: "Company association required. Please contact an admin to link your company.",
      });
    }
    query = query.eq("company_id", profile.company_id);
  } else if (profile?.role === "candidate") {
    return res.status(403).json({ error: "Not authorized" });
  } else {
    // Admin / recruiter can optionally filter by company_id
    if (req.query.company_id) {
      query = query.eq("company_id", req.query.company_id);
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message || error });
  res.json(data);
});

app.post("/api/jobs", requireRole("admin", "recruiter", "corporate"), async (req, res) => {
  try {
    const profile = req.userProfile;
    const {
      title, location, salary_range, experience, skills,
      job_summary, responsibilities, qualification, employment_type, reporting_to,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Job title is required" });
    }

    let targetCompanyId = null;
    let targetCompanyName = null;

    if (profile.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "Company association required" });
      }
      targetCompanyId = profile.company_id;
      const { data: comp } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", targetCompanyId)
        .maybeSingle();
      targetCompanyName = comp?.name || "Corporate";
    } else {
      if (req.body.company_id) {
        const { data: comp, error: compErr } = await supabase
          .from("companies")
          .select("id, name")
          .eq("id", req.body.company_id)
          .maybeSingle();
        if (compErr || !comp) {
          return res.status(400).json({ error: "Invalid company ID provided" });
        }
        targetCompanyId = comp.id;
        targetCompanyName = comp.name;
      } else {
        targetCompanyName = (req.body.company || "Talent Corner").trim();
      }
    }

    const skillsArray = Array.isArray(skills)
      ? skills
      : (skills || "").split(",").map((s) => s.trim()).filter(Boolean);

    const payload = {
      title: title.trim(),
      company: targetCompanyName,
      company_id: targetCompanyId,
      location: location || null,
      salary_range: salary_range || null,
      experience: experience || null,
      skills: skillsArray,
      job_summary: job_summary || null,
      responsibilities: responsibilities || null,
      qualification: qualification || null,
      employment_type: employment_type || null,
      reporting_to: reporting_to || null,
    };

    const { data, error } = await supabase
      .from("job_profiles")
      .insert([payload])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, job: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/jobs/:id", requireRole("admin", "recruiter", "corporate"), async (req, res) => {
  try {
    const profile = req.userProfile;
    const { id } = req.params;

    const { data: existingJob, error: fetchErr } = await supabase
      .from("job_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existingJob) {
      return res.status(404).json({ error: "Job profile not found" });
    }

    if (profile.role === "corporate") {
      if (!profile.company_id || existingJob.company_id !== profile.company_id) {
        return res.status(403).json({ error: "Access denied: cannot edit jobs belonging to another company" });
      }
    }

    const updates = {};
    const fields = [
      "title", "location", "salary_range", "experience", "job_summary",
      "responsibilities", "qualification", "employment_type", "reporting_to"
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (req.body.skills !== undefined) {
      updates.skills = Array.isArray(req.body.skills)
        ? req.body.skills
        : (req.body.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (profile.role === "admin" || profile.role === "recruiter") {
      if (req.body.company_id !== undefined) {
        if (req.body.company_id) {
          const { data: comp, error: compErr } = await supabase
            .from("companies")
            .select("id, name")
            .eq("id", req.body.company_id)
            .maybeSingle();
          if (compErr || !comp) {
            return res.status(400).json({ error: "Invalid company ID provided" });
          }
          updates.company_id = comp.id;
          updates.company = comp.name;
        } else {
          updates.company_id = null;
          if (req.body.company) updates.company = req.body.company.trim();
        }
      } else if (req.body.company) {
        updates.company = req.body.company.trim();
      }
    }

    const { data, error } = await supabase
      .from("job_profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, job: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/jobs/:id", requireRole("admin", "recruiter", "corporate"), async (req, res) => {
  try {
    const profile = req.userProfile;
    const { id } = req.params;

    const { data: existingJob, error: fetchErr } = await supabase
      .from("job_profiles")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existingJob) {
      return res.status(404).json({ error: "Job profile not found" });
    }

    if (profile.role === "corporate") {
      if (!profile.company_id || existingJob.company_id !== profile.company_id) {
        return res.status(403).json({ error: "Access denied: cannot delete jobs belonging to another company" });
      }
    }

    const { error } = await supabase
      .from("job_profiles")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/bulk-import", requireRole("admin", "recruiter", "corporate"), async (req, res) => {
  try {
    const profile = req.userProfile;
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "rows array is required" });
    }

    let corpCompanyId = null;
    let corpCompanyName = null;

    if (profile.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "Company association required" });
      }
      corpCompanyId = profile.company_id;
      const { data: comp } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", corpCompanyId)
        .maybeSingle();
      corpCompanyName = comp?.name || "Corporate";
    }

    const payload = [];
    for (const row of rows) {
      if (!row.title) continue;
      const skillsArray = Array.isArray(row.skills)
        ? row.skills
        : (row.skills || "").split(",").map((s) => s.trim()).filter(Boolean);

      payload.push({
        title: row.title,
        company: corpCompanyName || row.company || "Talent Corner",
        company_id: corpCompanyId || row.company_id || null,
        location: row.location || null,
        salary_range: row.salary_range || null,
        experience: row.experience || null,
        skills: skillsArray,
        job_summary: row.job_summary || null,
        responsibilities: row.responsibilities || null,
        qualification: row.qualification || null,
        employment_type: row.employment_type || null,
        reporting_to: row.reporting_to || null,
      });
    }

    if (payload.length === 0) {
      return res.status(400).json({ error: "No valid job rows to import" });
    }

    const { data, error } = await supabase
      .from("job_profiles")
      .insert(payload)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/my-applications", requireAuth, async (req, res) => {
  const profile = req.userProfile;
  if (!profile || profile.role !== "candidate" || !profile.candidate_id) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*, job_profiles(title, company, location, salary_range)")
    .eq("candidate_id", profile.candidate_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/my-company-jobs", requireCorporate, async (req, res) => {
  const profile = req.userProfile;
  if (!profile || !profile.company_id) {
    return res.status(403).json({ error: "Company association required" });
  }

  const { data: jobs, error } = await supabase
    .from("job_profiles")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(jobs);
});

app.get("/api/my-company-applications", requireCorporate, async (req, res) => {
  const profile = req.userProfile;
  if (!profile || !profile.company_id) {
    return res.status(403).json({ error: "Company association required" });
  }

  const { data: myJobs } = await supabase
    .from("job_profiles")
    .select("id")
    .eq("company_id", profile.company_id);

  const jobIds = (myJobs || []).map((j) => j.id);
  if (jobIds.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from("applications")
    .select(
      "*, candidates(name, email, phone, resume_url), job_profiles(title)",
    )
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/jobs/public", async (req, res) => {
  const { data, error } = await supabase
    .from("job_profiles")
    .select(
      "id, title, company, location, salary_range, experience, skills, qualification, job_summary, responsibilities, employment_type",
    )
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message || error });
  res.json(data);
});

// ---- TRIGGER AI ANALYSIS ----
app.post("/api/analyze", requireStaff, async (req, res) => {
  const { applicationId } = req.body;

  const { data: application, error } = await supabase
    .from("applications")
    .select("*, candidates(resume_url), job_profiles(skills)")
    .eq("id", applicationId)
    .single();

  if (error || !application) {
    return res.status(404).json({ error: "Application not found" });
  }

  const resumeUrl = application.candidates?.resume_url;
  const jobSkills = application.job_profiles?.skills || [];

  if (!resumeUrl) {
    return res
      .status(400)
      .json({ error: "No resume URL found for this candidate" });
  }

  // Respond immediately, AI runs in background
  res.json({ success: true, message: "AI analysis started" });

  analyzeResume(resumeUrl, jobSkills, applicationId);
});

// ---- GET ALL ANALYZED RESUMES (for Resume Analyzer page) ----
app.get("/api/resume/analyzed", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      *,
      candidates (name, email, phone, college, resume_url),
      job_profiles (title, company, skills)
    `,
    )
    .order("ai_score", { ascending: false, nullsFirst: false });

  if (error) return res.status(500).json({ error });

  const flat = data.map((app) => ({
    id: app.id,
    candidate_name: app.candidates?.name,
    email: app.candidates?.email,
    phone: app.candidates?.phone,
    college: app.candidates?.college,
    resume_url: app.candidates?.resume_url,
    job_title: app.job_profiles?.title,
    company: app.job_profiles?.company,
    stage: app.stage,
    ai_score: app.ai_score,
    matched_skills: app.matched_skills,
    missing_skills: app.missing_skills,
    match_label: app.match_label,
    ai_feedback: app.ai_feedback,
    ai_status: app.ai_status,
  }));

  res.json(flat);
});

// ---- SECURE DOCUMENTS & STORAGE ----
app.get("/api/documents/signed-url", requireAuth, async (req, res) => {
  try {
    const { bucket, path: rawPath, url } = req.query;

    const parsed = parseStorageUrl(url || rawPath, bucket);
    if (!parsed) {
      return res.status(400).json({ error: "Invalid, unsupported, or malformed storage URL or path" });
    }
    const { bucket: targetBucket, path: sanitizedPath } = parsed;

    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({ error: "User profile not found" });
    }

    // Admins and recruiters have full operational access to student documents
    if (profile.role === "admin" || profile.role === "recruiter") {
      const { data: signedData, error: signErr } = await supabase.storage
        .from(targetBucket)
        .createSignedUrl(sanitizedPath, 60 * 15);

      if (signErr || !signedData?.signedUrl) {
        return res.status(404).json({ error: "Document not found or could not generate signed URL" });
      }
      return res.json({ signedUrl: signedData.signedUrl });
    }

    // Corporate users can only view documents of candidates who applied to their jobs or are saved
    if (profile.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "No company associated with corporate account" });
      }

      let authorized = false;

      // 1. If candidate-documents, filename convention starts with `${applicationId}_`
      const appIdMatch = sanitizedPath.match(/^([0-9a-fA-F-]+)_/);
      if (appIdMatch && targetBucket.toLowerCase() === "candidate-documents") {
        const appId = appIdMatch[1];
        const { data: appRow } = await supabase
          .from("applications")
          .select("id, id_proof_url, marksheet_url, offer_letter_url, job_id, job_profiles!inner(company_id)")
          .eq("id", appId)
          .eq("job_profiles.company_id", profile.company_id)
          .maybeSingle();

        // Exact match check only — unsafe startsWith prefix wildcard is removed
        if (appRow) {
          if (
            matchesStorageObject(appRow.id_proof_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(appRow.marksheet_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(appRow.offer_letter_url, targetBucket, sanitizedPath)
          ) {
            authorized = true;
          }
        }
      }

      // 2. Targeted lookup for candidate resumes & photos (no full-table scans, safely handles duplicates & special chars)
      if (!authorized && targetBucket.toLowerCase() !== "candidate-documents") {
        const escapedPath = sanitizedPath.replace(/[%_]/g, "\\$&");

        // Find candidate records matching this filename/path in candidates table (handles duplicates safely)
        const { data: matchingCands } = await supabase
          .from("candidates")
          .select("id, resume_url, photo_url")
          .or(`resume_url.ilike.%${escapedPath}%,photo_url.ilike.%${escapedPath}%`);

        const candidateIds = (matchingCands || [])
          .filter((c) =>
            matchesStorageObject(c.resume_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(c.photo_url, targetBucket, sanitizedPath)
          )
          .map((c) => c.id);

        if (candidateIds.length > 0) {
          // Check if ANY matching candidate applied to company's jobs (indexed lookup)
          const { data: appMatches } = await supabase
            .from("applications")
            .select("id, job_profiles!inner(company_id)")
            .in("candidate_id", candidateIds)
            .eq("job_profiles.company_id", profile.company_id)
            .limit(1);

          if (appMatches && appMatches.length > 0) {
            authorized = true;
          } else {
            // Check if ANY matching candidate is saved by the company (indexed lookup)
            const { data: savedMatches } = await supabase
              .from("saved_candidates")
              .select("candidate_id")
              .in("candidate_id", candidateIds)
              .eq("company_id", profile.company_id)
              .limit(1);

            if (savedMatches && savedMatches.length > 0) {
              authorized = true;
            }
          }
        }
      }

      if (!authorized) {
        return res.status(403).json({ error: "Access denied to requested candidate document" });
      }

      const { data: signedData, error: signErr } = await supabase.storage
        .from(targetBucket)
        .createSignedUrl(sanitizedPath, 60 * 15);

      if (signErr || !signedData?.signedUrl) {
        return res.status(404).json({ error: "Document not found or could not generate signed URL" });
      }
      return res.json({ signedUrl: signedData.signedUrl });
    }

    // Candidate / Student role can only access their own files
    if (profile.role === "candidate" || profile.role === "student") {
      let authorized = false;

      // 1. Check candidate resume and photo (exact match)
      const { data: cand } = await supabase
        .from("candidates")
        .select("id, resume_url, photo_url")
        .eq("email", profile.email)
        .maybeSingle();

      if (
        matchesStorageObject(cand?.resume_url, targetBucket, sanitizedPath) ||
        matchesStorageObject(cand?.photo_url, targetBucket, sanitizedPath)
      ) {
        authorized = true;
      }

      // 2. Check candidate application documents (ID proof, marksheets, offer letters) (exact match)
      const candidateId = cand?.id || profile.candidate_id;
      if (!authorized && candidateId) {
        const { data: myApps } = await supabase
          .from("applications")
          .select("id_proof_url, marksheet_url, offer_letter_url")
          .eq("candidate_id", candidateId);

        const appMatch = (myApps || []).some((a) => {
          return (
            matchesStorageObject(a.id_proof_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(a.marksheet_url, targetBucket, sanitizedPath) ||
            matchesStorageObject(a.offer_letter_url, targetBucket, sanitizedPath)
          );
        });

        if (appMatch) authorized = true;
      }

      if (authorized) {
        const { data: signedData, error: signErr } = await supabase.storage
          .from(targetBucket)
          .createSignedUrl(sanitizedPath, 60 * 15);

        if (signErr || !signedData?.signedUrl) {
          return res.status(404).json({ error: "Document not found or could not generate signed URL" });
        }
        return res.json({ signedUrl: signedData.signedUrl });
      }

      return res.status(403).json({ error: "Access denied to document" });
    }

    return res.status(403).json({ error: "Role not authorized to access documents" });
  } catch (err) {
    console.error("Document signed-url error:", err);
    res.status(500).json({ error: "Failed to process document request" });
  }
});

// ---- UPDATE APPLICATION DOCUMENT (Secure Corporate / Staff upload) ----
app.patch("/api/applications/:id/document", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { docKey, fileUrl } = req.body;

    const ALLOWED_DOC_KEYS = ["id_proof", "marksheet", "offer_letter"];
    if (!ALLOWED_DOC_KEYS.includes(docKey)) {
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
    // Format: ${appId}_${docKey}_${timestamp}_${safeName}
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
    if (!profile) return res.status(401).json({ error: "User profile not found" });

    // Candidates cannot update application documents via this corporate endpoint
    if (profile.role === "candidate" || profile.role === "student") {
      return res.status(403).json({ error: "Candidate role not authorized to update application documents" });
    }

    // Staff has full access to update application documents
    if (profile.role === "admin" || profile.role === "recruiter") {
      const { data, error } = await supabase
        .from("applications")
        .update({
          [`${docKey}_url`]: fileUrl,
          [`${docKey}_status`]: "Submitted",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, application: data });
    }

    // Corporate users can only update applications for their company's jobs
    if (profile.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "No company associated with corporate account" });
      }

      const { data: appRow, error: appErr } = await supabase
        .from("applications")
        .select("id, job_id, job_profiles!inner(company_id)")
        .eq("id", id)
        .eq("job_profiles.company_id", profile.company_id)
        .maybeSingle();

      if (appErr || !appRow) {
        return res.status(403).json({ error: "Access denied to application" });
      }

      const { data, error } = await supabase
        .from("applications")
        .update({
          [`${docKey}_url`]: fileUrl,
          [`${docKey}_status`]: "Submitted",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, application: data });
    }

    return res.status(403).json({ error: "Role not authorized to update application documents" });
  } catch (err) {
    console.error("Update application document error:", err);
    res.status(500).json({ error: "Failed to update application document" });
  }
});

// ---- MARK CANDIDATE SELECTED → fires 3 emails automatically ----
app.post("/api/candidate/select", requireStaff, async (req, res) => {
  const { applicationId, ctc } = req.body;

  try {
    const { data: app } = await supabase
      .from("applications")
      .select(
        "*, candidates(name, email, phone, college), job_profiles(title, company)",
      )
      .eq("id", applicationId)
      .single();

    const { data: college } = await supabase
      .from("colleges")
      .select("name, tpo, tpo_email")
      .ilike("name", `%${app.candidates?.college}%`)
      .single();

    const { data: company } = await supabase
      .from("companies")
      .select("name, hr_name, hr_email")
      .eq("name", app.job_profiles?.company)
      .single();

    // Update stage in DB
    await supabase
      .from("applications")
      .update({ stage: "Selected" })
      .eq("id", applicationId);

    // Fire all 3 emails at once
    await Promise.all([
      sendStudentSelectionEmail({
        studentName: app.candidates?.name,
        studentEmail: app.candidates?.email,
        jobTitle: app.job_profiles?.title,
        company: app.job_profiles?.company,
        ctc: ctc || "As per company policy",
      }),
      college
        ? sendCollegeSelectionEmail({
            tpoName: college.tpo,
            tpoEmail: college.tpo_email,
            collegeName: college.name,
            studentName: app.candidates?.name,
            jobTitle: app.job_profiles?.title,
            company: app.job_profiles?.company,
          })
        : Promise.resolve(),
      company
        ? sendCompanySelectionEmail({
            hrName: company.hr_name,
            hrEmail: company.hr_email,
            company: company.name,
            studentName: app.candidates?.name,
            jobTitle: app.job_profiles?.title,
            studentEmail: app.candidates?.email,
            studentPhone: app.candidates?.phone,
          })
        : Promise.resolve(),
    ]);

    res.json({
      success: true,
      message: "Candidate selected. All 3 emails sent.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { sendStudentRejectionEmail } = require("./emailService"); // add to your existing require line for emailService instead of a new line — merge with existing import

app.post("/api/candidate/reject", requireStaff, async (req, res) => {
  const { applicationId } = req.body;
  try {
    const { data: app } = await supabase
      .from("applications")
      .select("*, candidates(name, email), job_profiles(title, company)")
      .eq("id", applicationId)
      .single();

    await supabase
      .from("applications")
      .update({ stage: "Rejected" })
      .eq("id", applicationId);

    await sendStudentRejectionEmail({
      studentName: app.candidates?.name,
      studentEmail: app.candidates?.email,
      jobTitle: app.job_profiles?.title,
      company: app.job_profiles?.company,
    });

    res.json({ success: true, message: "Candidate rejected. Email sent." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- COLLEGE OUTREACH EMAIL ----
app.post("/api/email/college-outreach", requireStaff, async (req, res) => {
  try {
    await sendCollegeOutreachEmail(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- OFFERS ----
app.get("/api/offers", requireAuth, async (req, res) => {
  const profile = req.userProfile;
  let query = supabase
    .from("offers")
    .select("*, candidates(name), job_profiles(title, company, company_id)");

  const { data, error } = await query;
  if (error) return res.status(500).json({ error });

  let filtered = data;
  if (profile?.role === "candidate" && profile.candidate_id) {
    filtered = data.filter((o) => o.candidate_id === profile.candidate_id);
  } else if (profile?.role === "corporate" && profile.company_id) {
    filtered = data.filter(
      (o) => o.job_profiles?.company_id === profile.company_id,
    );
  } else if (profile?.role !== "admin" && profile?.role !== "recruiter") {
    return res.status(403).json({ error: "Not authorized" });
  }

  res.json(filtered);
});

// ---- JOINING ----
app.get("/api/joining", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("joining")
    .select("*, candidates(name, college), offers(job_profiles(company))");
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// ---- COMMUNICATIONS ----
app.get("/api/communications", requireStaff, async (req, res) => {
  const { collegeId, companyId } = req.query;
  let query = supabase
    .from("communications")
    .select("*")
    .order("date", { ascending: true });
  if (collegeId) query = query.eq("college_id", collegeId);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.post("/api/communications", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("communications")
    .insert([req.body])
    .select();
  if (error) return res.status(500).json({ error });
  res.json(data[0]);
});

// ---- GENERATE EMAIL (Comm.jsx "Generate with AI" button) ----
app.post("/api/generate-email", requireStaff, generateEmail);

// Create GD Session
app.post("/api/gd/create", requireStaff, async (req, res) => {
  try {
    const { topic, duration_minutes, job_id, candidates } = req.body;

    const dailyRoom = await createGDRoom(`gd-${Date.now()}`, duration_minutes);

    const { data: session, error } = await supabase
      .from("gd_sessions")
      .insert([
        {
          topic,
          duration_minutes,
          job_id,
          daily_room_url: dailyRoom.url,
          daily_room_name: dailyRoom.name,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error });

    const participants = candidates.map((c) => ({
      session_id: session.id,
      candidate_id: c.id,
      candidate_name: c.name,
      candidate_email: c.email,
    }));

    const { data: parts, error: partsError } = await supabase
      .from("gd_participants")
      .insert(participants)
      .select();

    if (partsError) {
      console.error("GD participants insert error:", partsError);
      return res.status(500).json({ error: partsError.message || partsError });
    }

    for (const p of parts) {
      try {
        await sendGDInviteEmail({
          studentName: p.candidate_name,
          studentEmail: p.candidate_email,
          topic: session.topic,
          duration: duration_minutes,
          joinLink: `${process.env.FRONTEND_URL}/gd/${session.id}?token=${p.join_token}`,
        });
      } catch (emailErr) {
        console.error(
          `Failed to send GD invite email to ${p.candidate_email}:`,
          emailErr,
        );
      }
    }

    res.json({ success: true, session });
  } catch (err) {
    console.error("GD create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create an OFFLINE GD session — no video room, no emails, just a shell for manual ratings
app.post("/api/gd/create-offline", requireStaff, async (req, res) => {
  try {
    const { topic, candidates } = req.body;

    if (!topic || !candidates || candidates.length === 0) {
      return res
        .status(400)
        .json({ error: "Topic and at least one candidate are required" });
    }

    const { data: session, error } = await supabase
      .from("gd_sessions")
      .insert([
        { topic, duration_minutes: null, mode: "offline", status: "Ended" },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const participants = candidates.map((c) => ({
      session_id: session.id,
      candidate_id: c.id,
      candidate_name: c.name,
      candidate_email: c.email,
    }));

    const { error: partErr } = await supabase
      .from("gd_participants")
      .insert(participants);
    if (partErr) return res.status(500).json({ error: partErr.message });

    res.json({ success: true, session });
  } catch (err) {
    console.error("Offline GD create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Manually add a GD result (for offline/in-person GD sessions)
app.post("/api/gd/manual", requireStaff, async (req, res) => {
  try {
    const {
      candidate_name,
      candidate_email,
      topic,
      confidence,
      communication,
      leadership,
      participation,
      knowledge,
      teamwork,
      notes,
    } = req.body;

    if (!candidate_name || confidence == null || communication == null) {
      return res.status(400).json({
        error:
          "Candidate name and at least confidence/communication scores are required",
      });
    }

    const scores = [
      confidence,
      communication,
      leadership,
      participation,
      knowledge,
      teamwork,
    ].filter((s) => s != null);
    const overall = scores.length
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : null;

    const { data, error } = await supabase
      .from("gd_participants")
      .insert([
        {
          candidate_name,
          candidate_email: candidate_email || null,
          topic: topic || "Offline GD Round",
          confidence,
          communication,
          leadership,
          participation,
          knowledge,
          teamwork,
          overall,
          ai_feedback: notes || null,
          is_manual: true,
          joined_at: new Date(),
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, participant: data });
  } catch (err) {
    console.error("Manual GD entry error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start GD Session
app.post("/api/gd/:id/start", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("gd_sessions")
    .update({ status: "Active", started_at: new Date() })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error });
  res.json({ success: true, session: data });
});

// End GD + trigger AI scoring
app.post("/api/gd/:id/end", requireStaff, async (req, res) => {
  await supabase
    .from("gd_sessions")
    .update({ status: "Ended", ended_at: new Date() })
    .eq("id", req.params.id);

  res.json({ success: true, message: "GD ended. AI scoring started." });

  // AI scores in background
  scoreGDSession(req.params.id);
});

// Get session details + participants + messages
app.get("/api/gd/:id", requireStaff, async (req, res) => {
  const { data: session } = await supabase
    .from("gd_sessions")
    .select("*")
    .eq("id", req.params.id)
    .single();

  const { data: participants } = await supabase
    .from("gd_participants")
    .select("*")
    .eq("session_id", req.params.id)
    .order("ai_score", { ascending: false });

  const { data: messages } = await supabase
    .from("gd_messages")
    .select("*")
    .eq("session_id", req.params.id)
    .order("sent_at", { ascending: true });

  res.json({ session, participants, messages });
});

// Validate student token
app.get("/api/gd/:id/join", async (req, res) => {
  const { token } = req.query;
  const { data, error } = await supabase
    .from("gd_participants")
    .select("*")
    .eq("session_id", req.params.id)
    .eq("join_token", token)
    .single();

  if (error || !data) return res.status(404).json({ error: "Invalid link" });

  await supabase
    .from("gd_participants")
    .update({ joined_at: new Date() })
    .eq("id", data.id);

  res.json({ participant: data });
});

// Shortlist selected students
app.post("/api/gd/:id/shortlist", requireStaff, async (req, res) => {
  const { participantIds } = req.body;

  await supabase
    .from("gd_participants")
    .update({ shortlisted: true })
    .in("id", participantIds);

  // Get their details and send emails
  const { data: parts } = await supabase
    .from("gd_participants")
    .select("*")
    .in("id", participantIds);

  const { data: session } = await supabase
    .from("gd_sessions")
    .select("topic, job_id")
    .eq("id", req.params.id)
    .single();

  for (const p of parts) {
    await sendGDShortlistEmail({
      studentName: p.candidate_name,
      studentEmail: p.candidate_email,
      topic: session.topic,
    });

    // Pipeline sync: shortlisting from GD moves the candidate to Interview.
    if (p.candidate_id) {
      await moveApplicationStage(supabase, {
        candidateId: p.candidate_id,
        jobId: session?.job_id,
        fromStage: "GD",
        toStage: "Interview",
      });
    }
  }

  res.json({ success: true });
});

// Save/update Sir's manual rating for a GD participant
app.post(
  "/api/gd/participant/:participantId/manual-rating",
  requireStaff,
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const {
        confidence,
        communication,
        content_knowledge,
        leadership,
        teamwork,
        comment,
      } = req.body;

      const scoreFields = {
        confidence,
        communication,
        content_knowledge,
        leadership,
        teamwork,
      };

      // Validate each score is an integer between 1 and 5
      for (const [key, value] of Object.entries(scoreFields)) {
        if (value === undefined || value === null) continue; // allow partial updates
        const num = Number(value);
        if (!Number.isInteger(num) || num < 1 || num > 5) {
          return res
            .status(400)
            .json({ error: `${key} must be an integer between 1 and 5` });
        }
      }

      const updatePayload = {
        manual_confidence: confidence,
        manual_communication: communication,
        manual_content_knowledge: content_knowledge,
        manual_leadership: leadership,
        manual_teamwork: teamwork,
        manual_comment: comment || null,
        manual_rated_at: new Date(),
      };

      const { data, error } = await supabase
        .from("gd_participants")
        .update(updatePayload)
        .eq("id", participantId)
        .select()
        .single();

      if (error) {
        console.error("Manual rating update error:", error);
        return res.status(500).json({ error: error.message || error });
      }

      if (!data) {
        return res.status(404).json({ error: "Participant not found" });
      }

      // Pipeline sync: if the rated criteria average out to 3/5 or higher,
      // auto-move the candidate from GD to Interview on the pipeline board.
      const ratedValues = [
        confidence,
        communication,
        content_knowledge,
        leadership,
        teamwork,
      ]
        .filter((v) => v !== undefined && v !== null)
        .map(Number);

      if (ratedValues.length > 0 && data.candidate_id) {
        const avg = ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length;
        if (avg >= 3) {
          const { data: session } = await supabase
            .from("gd_sessions")
            .select("job_id")
            .eq("id", data.session_id)
            .single();

          await moveApplicationStage(supabase, {
            candidateId: data.candidate_id,
            jobId: session?.job_id,
            fromStage: "GD",
            toStage: "Interview",
          });
        }
      }

      res.json({ success: true, participant: data });
    } catch (err) {
      console.error("Manual rating error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

app.get("/api/gd/:id/token", async (req, res) => {
  try {
    const { token } = req.query;
    const { data: participant, error } = await supabase
      .from("gd_participants")
      .select("*, gd_sessions(daily_room_name, daily_room_url)")
      .eq("session_id", req.params.id)
      .eq("join_token", token)
      .single();

    if (error || !participant)
      return res.status(404).json({ error: "Invalid link" });

    const dailyToken = await createMeetingToken(
      participant.gd_sessions.daily_room_name,
      participant.candidate_name,
    );

    res.json({
      dailyToken,
      roomUrl: participant.gd_sessions.daily_room_url,
      candidateName: participant.candidate_name,
    });
  } catch (err) {
    console.error("GD token error:", err);
    res.status(500).json({ error: err.message });
  }
});

const { sendAdminApprovalNotification } = require("./emailService");

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, role, company_id } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    const finalRole = ["recruiter", "corporate", "candidate", "admin"].includes(
      role,
    )
      ? role
      : "candidate";
    const autoApprove = finalRole === "candidate";

    let targetCompanyId = null;
    if (finalRole === "corporate" && company_id) {
      const { data: comp } = await supabase
        .from("companies")
        .select("id")
        .eq("id", company_id)
        .maybeSingle();
      if (comp) {
        targetCompanyId = comp.id;
      }
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authError) return res.status(400).json({ error: authError.message });

    let candidateId = null;
    if (finalRole === "candidate") {
      // Check if a candidates row already exists with this email (e.g. they applied before registering)
      const { data: existingCandidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingCandidate) {
        candidateId = existingCandidate.id;
      } else {
        const { data: newCandidate, error: candErr } = await supabase
          .from("candidates")
          .insert([{ name, email }])
          .select()
          .single();
        if (candErr) return res.status(500).json({ error: candErr.message });
        candidateId = newCandidate.id;
      }
    }

    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: authData.user.id,
        email,
        name,
        role: finalRole,
        approved: autoApprove,
        candidate_id: candidateId,
        company_id: targetCompanyId,
      },
    ]);
    if (profileError)
      return res.status(500).json({ error: profileError.message });

    res.json({
      success: true,
      message: autoApprove
        ? "Account created."
        : "Registration submitted. Await admin approval.",
    });

    if (!autoApprove) {
      sendAdminApprovalNotification({ name, email, role: finalRole }).catch(
        (err) => console.error("Admin notification email failed:", err),
      );
    }
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message });
  }
});

// requireAdmin is cryptographically verified via createAuthMiddleware(supabase) above
// Admin: list all pending users
// Admin: list all pending users
app.get("/api/auth/pending", requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("approved", false)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Admin: approve a user
app.post("/api/auth/approve/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { company_id } = req.body || {};

  const updates = { approved: true };

  if (company_id) {
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .maybeSingle();
    if (comp) {
      updates.company_id = comp.id;
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, user: data });
});

// Admin: reject/delete a pending user
app.post("/api/auth/reject/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { error } = await supabase
    .from("profiles")
    .update({ approved: false, status: "denied" })
    .eq("id", userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Admin: list all users (for User Management page) — merges profile data
// with company details and Supabase Auth's last_sign_in_at.
app.get("/api/auth/users", requireAdmin, async (req, res) => {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*, companies!profiles_company_id_fkey(id, name)")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  let authById = {};
  try {
    const { data: authList } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    (authList?.users || []).forEach((u) => {
      authById[u.id] = u.last_sign_in_at;
    });
  } catch (err) {
    console.error("listUsers error:", err);
  }

  const merged = profiles.map((p) => ({
    ...p,
    company_name: p.companies?.name || null,
    last_sign_in_at: authById[p.id] || null,
  }));

  res.json(merged);
});

// Admin: directly create a new user (auto-approved, no sign-up flow needed)
app.post("/api/auth/users", requireAdmin, async (req, res) => {
  const { email, password, name, role, company_id } = req.body;
  if (!email || !password || !name || !role) {
    return res
      .status(400)
      .json({ error: "Name, email, password, and role are required" });
  }

  let finalCompanyId = null;
  if (role === "corporate") {
    if (!company_id) {
      return res
        .status(400)
        .json({ error: "Company is required for corporate accounts" });
    }
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", company_id)
      .maybeSingle();

    if (compErr || !company) {
      return res
        .status(400)
        .json({ error: "Selected company does not exist in the database" });
    }
    finalCompanyId = company.id;
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (authError) return res.status(400).json({ error: authError.message });

  const { data, error: profileError } = await supabase
    .from("profiles")
    .insert([
      {
        id: authData.user.id,
        email,
        name,
        role,
        approved: true,
        company_id: finalCompanyId,
      },
    ])
    .select("*, companies!profiles_company_id_fkey(id, name)")
    .single();

  if (profileError)
    return res.status(500).json({ error: profileError.message });

  res.json({
    success: true,
    user: {
      ...data,
      company_name: data.companies?.name || null,
    },
  });
});

// Admin: delete a user entirely (auth + profile)
app.delete("/api/auth/users/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;

  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileError)
    return res.status(500).json({ error: profileError.message });

  try {
    await supabase.auth.admin.deleteUser(userId);
  } catch (err) {
    console.error("Auth user delete error:", err);
  }

  res.json({ success: true });
});

// Admin: edit a user's name, email, role, and company association
app.patch("/api/auth/users/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { name, email, role, company_id } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const updates = { name, email };

  if (role) {
    const validRoles = ["admin", "recruiter", "candidate", "corporate"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    updates.role = role;
  }

  if (company_id !== undefined) {
    if (company_id) {
      const { data: company, error: compErr } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", company_id)
        .maybeSingle();

      if (compErr || !company) {
        return res
          .status(400)
          .json({ error: "Selected company does not exist in the database" });
      }
      updates.company_id = company.id;
    } else {
      updates.company_id = null;
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*, companies!profiles_company_id_fkey(id, name)")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  try {
    await supabase.auth.admin.updateUserById(userId, { email });
  } catch (err) {
    console.error("Auth user email update error:", err);
  }

  res.json({
    success: true,
    user: {
      ...data,
      company_name: data.companies?.name || null,
    },
  });
});

// Admin: change an existing user's role
app.post("/api/auth/users/:userId/role", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role, company_id } = req.body;

  const validRoles = ["admin", "recruiter", "candidate", "corporate"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const updates = { role };
  if (role === "corporate" && company_id) {
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .maybeSingle();
    if (comp) updates.company_id = comp.id;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Admin: safely and explicitly link a corporate user account to a company
app.post("/api/companies/:companyId/link-corporate-user", requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userId, email } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ error: "userId or email is required" });
    }

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name, hr_email")
      .eq("id", companyId)
      .maybeSingle();

    if (compErr || !company) {
      return res.status(404).json({ error: "Company not found" });
    }

    let userQuery = supabase.from("profiles").select("*");
    if (userId) userQuery = userQuery.eq("id", userId);
    else if (email) userQuery = userQuery.eq("email", email.trim().toLowerCase());

    const { data: targetProfile, error: profileErr } = await userQuery.maybeSingle();
    if (profileErr || !targetProfile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const { data: updatedUser, error: updateErr } = await supabase
      .from("profiles")
      .update({
        company_id: company.id,
        role: "corporate",
      })
      .eq("id", targetProfile.id)
      .select("*, companies!profiles_company_id_fkey(id, name)")
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    res.json({
      success: true,
      message: `User ${updatedUser.email} linked to ${company.name}`,
      user: {
        ...updatedUser,
        company_name: company.name,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Log a new call
app.post("/api/calls", requireStaff, async (req, res) => {
  try {
    const {
      recruiter_id,
      recruiter_name,
      college_id,
      college_name,
      call_date,
      duration_minutes,
      notes,
      outcome,
    } = req.body;
    const { data, error } = await supabase
      .from("call_logs")
      .insert([
        {
          recruiter_id,
          recruiter_name,
          college_id,
          college_name,
          call_date: call_date || new Date(),
          duration_minutes,
          notes,
          outcome,
        },
      ])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, call: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all call logs (for reports)
app.get("/api/calls", requireStaff, async (req, res) => {
  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .order("call_date", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get recruiter performance summary
app.get("/api/calls/performance", requireStaff, async (req, res) => {
  const { data: calls, error } = await supabase.from("call_logs").select("*");
  if (error) return res.status(500).json({ error: error.message });

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, college_id, assigned_recruiter_id");

  const byRecruiter = {};
  calls.forEach((c) => {
    if (!byRecruiter[c.recruiter_id]) {
      byRecruiter[c.recruiter_id] = {
        recruiter_id: c.recruiter_id,
        recruiter_name: c.recruiter_name,
        totalCalls: 0,
        totalMinutes: 0,
        collegesContacted: new Set(),
        calls: [],
      };
    }
    const r = byRecruiter[c.recruiter_id];
    r.totalCalls += 1;
    r.totalMinutes += c.duration_minutes || 0;
    if (c.college_name) r.collegesContacted.add(c.college_name);
    r.calls.push(c);
  });

  const result = Object.values(byRecruiter).map((r) => ({
    ...r,
    collegesContacted: r.collegesContacted.size,
    studentsUnder: candidates
      ? candidates.filter(
          (cand) => cand.assigned_recruiter_id === r.recruiter_id,
        ).length
      : 0,
  }));

  res.json(result);
});

app.post("/api/bid/suggest", requireStaff, async (req, res) => {
  const {
    candidateName,
    currentSalary,
    companyCost,
    performance,
    reason,
    history,
  } = req.body;

  try {
    const historyText = history?.length
      ? history
          .map(
            (h) =>
              `- ${new Date(h.created_at).toLocaleDateString()}: +${h.raise_percent}% raise (${h.performance})`,
          )
          .join("\n")
      : "No previous raises";

    const prompt = `
You are a compensation advisor for a campus recruitment company in India.

Candidate: ${candidateName}
Current Annual Salary: ₹${currentSalary}
Current Company Cost (CTC): ₹${companyCost || currentSalary * 1.2}
Performance Rating: ${performance}
Reason given: ${reason || "Not specified"}
Previous raise history:
${historyText}

Based on this information, recommend a salary raise percentage.
Respond ONLY in this exact JSON format:
{
  "raise_percent": <number between 0 and 40>,
  "new_salary": <calculated new salary>,
  "new_cost": <calculated new company cost>,
  "reasoning": "<2-3 sentences explaining why this raise is appropriate>"
}`;

    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    const suggestion = JSON.parse(clean);

    res.json({ suggestion });
  } catch (err) {
    console.error("Bid suggest error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/candidate/:id/passport", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const profile = req.userProfile;

    // Candidates can only view their own passport; staff can view any
    if (profile?.role === "candidate" && profile.candidate_id !== id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Corporate users can only view candidates legitimately associated with their company
    let corporateJobIds = null;
    if (profile?.role === "corporate") {
      if (!profile.company_id) {
        return res.status(403).json({ error: "Company association required" });
      }

      const { data: myJobs } = await supabase
        .from("job_profiles")
        .select("id")
        .eq("company_id", profile.company_id);

      corporateJobIds = (myJobs || []).map((j) => j.id);

      let isAssociated = false;
      if (corporateJobIds.length > 0) {
        const { data: candApp } = await supabase
          .from("applications")
          .select("id")
          .eq("candidate_id", id)
          .in("job_id", corporateJobIds)
          .limit(1);

        if (candApp && candApp.length > 0) {
          isAssociated = true;
        }
      }

      if (!isAssociated) {
        const { data: savedMatch } = await supabase
          .from("saved_candidates")
          .select("candidate_id")
          .eq("company_id", profile.company_id)
          .eq("candidate_id", id)
          .limit(1);

        if (savedMatch && savedMatch.length > 0) {
          isAssociated = true;
        }
      }

      if (!isAssociated) {
        return res.status(403).json({
          error: "Access denied: candidate is not associated with your company",
        });
      }
    }

    const { data: candidate, error: candErr } = await supabase
      .from("candidates")
      .select("*, colleges(name)")
      .eq("id", id)
      .single();
    if (candErr || !candidate)
      return res.status(404).json({ error: "Candidate not found" });

    let appQuery = supabase
      .from("applications")
      .select("*, job_profiles(title, company)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });

    if (profile?.role === "corporate") {
      if (corporateJobIds && corporateJobIds.length > 0) {
        appQuery = appQuery.in("job_id", corporateJobIds);
      } else {
        appQuery = null;
      }
    }

    const { data: applications } = appQuery ? await appQuery : { data: [] };

    const { data: aptitudeResults } = await supabase
      .from("aptitude_results")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: gdResults } = await supabase
      .from("gd_participants")
      .select("*")
      .eq("candidate_id", id)
      .order("joined_at", { ascending: false })
      .limit(1);

    let interviewQuery = supabase
      .from("interviews")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });

    if (profile?.role === "corporate") {
      if (corporateJobIds && corporateJobIds.length > 0) {
        interviewQuery = interviewQuery.or(`type.eq.Mock,job_id.in.(${corporateJobIds.join(",")})`);
      } else {
        interviewQuery = interviewQuery.eq("type", "Mock");
      }
    }

    const { data: interviews } = await interviewQuery.limit(1);

    res.json({
      candidate,
      applications: applications || [],
      aptitude: aptitudeResults?.[0] || null,
      gd: gdResults?.[0] || null,
      interview: interviews?.[0] || null,
    });
  } catch (err) {
    console.error("Passport error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- AI EXCEL/PDF IMPORT — CAMPUS DATABASE ----
app.post("/api/import/campus", requireStaff, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rawText = "";

    const ext = req.file.originalname.split(".").pop().toLowerCase();

    if (ext === "pdf") {
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(req.file.buffer);
      rawText = pdfData.text;
    } else {
      // Excel or CSV
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      rawText = JSON.stringify(json, null, 2);
    }

    // Send to Groq AI for formatting
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `
You are a data formatting AI for a campus recruitment platform called RecruitOS.

The user uploaded a file with college/campus data. The data may be in any format, with any column names, and may have typos or inconsistencies.

Here is the raw data:
---
${rawText.slice(0, 8000)}
---

Your job is to extract college information and format it into our standard format.

Our format for each college:
- name: full college name (string)
- city: city name (string)
- course: courses offered like "Engineering", "MBA", "BCA" etc. (string)
- tpo: Training and Placement Officer name (string)
- tpo_email: TPO email if available (string or null)
- strength: number of students (integer or null)
- last_contact: date in YYYY-MM-DD format if available (string or null)
- status: one of "Interested", "Follow-up Due", "Not Interested" — guess from context or default to "Interested"

Map whatever columns exist to our format. If a field is missing, use null.
Fix spelling mistakes and normalize data.

Respond ONLY with a valid JSON array, no other text:
[
  { "name": "...", "city": "...", "course": "...", "tpo": "...", "tpo_email": null, "strength": null, "last_contact": null, "status": "Interested" },
  ...
]`;

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const raw = completion.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    const colleges = JSON.parse(clean);

    res.json({ success: true, preview: colleges, count: colleges.length });
  } catch (err) {
    console.error("Campus import error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- SAVE IMPORTED CAMPUS DATA ----
app.post("/api/import/campus/save", requireStaff, async (req, res) => {
  try {
    const { colleges } = req.body;
    if (!colleges || colleges.length === 0) {
      return res.status(400).json({ error: "No data to save" });
    }

    const collegeRows = colleges
      .filter((c) => c && c.name && c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        city: c.city || null,
        course: c.course || null,
        tpo: c.tpo || null,
        strength: c.strength ? parseInt(c.strength, 10) : null,
        last_contact: c.last_contact || null,
        status: c.status || "Interested",
        website: c.website || null,
        institution_type: c.institution_type || null,
        courses_available: c.courses_available || null,
      }));

    const { data, error } = await supabase
      .from("colleges")
      .insert(collegeRows)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    if (data && data.length > 0) {
      for (const raw of colleges) {
        if (!raw || !raw.name) continue;
        const saved = data.find(
          (d) => d.name.toLowerCase() === raw.name.trim().toLowerCase()
        );
        if (saved && (raw.tpo || raw.tpo_email)) {
          const coordName = (raw.tpo || "Placement Officer").trim();
          const coordEmail = raw.tpo_email ? raw.tpo_email.trim() : null;

          const { data: existing } = await supabase
            .from("placement_coordinators")
            .select("id")
            .eq("college_id", saved.id)
            .ilike("name", coordName)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("placement_coordinators").insert([
              {
                college_id: saved.id,
                name: coordName,
                email: coordEmail,
                is_current: true,
              },
            ]);
          }
        }
      }
    }

    res.json({ success: true, saved: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- AI EXCEL/PDF IMPORT — CORPORATE DATABASE ----
app.post("/api/import/corporate", requireStaff, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rawText = "";
    const ext = req.file.originalname.split(".").pop().toLowerCase();

    if (ext === "pdf") {
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(req.file.buffer);
      rawText = pdfData.text;
    } else {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      rawText = JSON.stringify(json, null, 2);
    }

    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `
You are a data formatting AI for a campus recruitment platform called RecruitOS.

The user uploaded a file with company/corporate data. The data may be in any format with any column names.

Here is the raw data:
---
${rawText.slice(0, 8000)}
---

Extract company information and format it into our standard format.

Our format for each company:
- name: company name (string)
- sector: industry sector like "IT Services", "Consulting", "Finance", "Manufacturing" etc. (string)
- hr_name: HR contact person name (string or null)
- hr_email: HR email (string or null)
- hq_location: headquarters city (string or null)
- hiring_status: "Active" or "Paused" — guess from context or default to "Active"

Map whatever columns exist. Fix spelling. Normalize data.

Respond ONLY with a valid JSON array, no other text:
[
  { "name": "...", "sector": "...", "hr_name": null, "hr_email": null, "hq_location": null, "hiring_status": "Active" },
  ...
]`;

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const raw = completion.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    const companies = JSON.parse(clean);

    res.json({ success: true, preview: companies, count: companies.length });
  } catch (err) {
    console.error("Corporate import error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- SAVE IMPORTED CORPORATE DATA ----
app.post("/api/import/corporate/save", requireStaff, async (req, res) => {
  try {
    const { companies } = req.body;
    if (!companies || companies.length === 0) {
      return res.status(400).json({ error: "No data to save" });
    }

    const companyRows = companies
      .filter((c) => c && c.name && c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        sector: c.sector || null,
        hr_name: c.hr_name || null,
        hr_email: c.hr_email || null,
        hq_location: c.hq_location || null,
        hiring_status: c.hiring_status || null,
        city: c.city || null,
        hr_phone: c.hr_phone || null,
        website: c.website || null,
      }));

    const { data, error } = await supabase
      .from("companies")
      .insert(companyRows)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, saved: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Corporate: candidates who applied to this company's jobs
app.get("/api/corporate/candidates", requireCorporate, async (req, res) => {
  const profile = req.userProfile;
  if (!profile.company_id) return res.json([]);

  const { data: jobs } = await supabase
    .from("job_profiles")
    .select("id, title")
    .eq("company_id", profile.company_id);

  const jobIds = (jobs || []).map((j) => j.id);
  if (jobIds.length === 0) return res.json([]);

  const { data: apps, error } = await supabase
    .from("applications")
    .select(
      `
      id, stage, resume_score, created_at, job_id,
      candidates ( id, name, email, phone, colleges ( name ) ),
      job_profiles ( id, title )
    `,
    )
    .in("job_id", jobIds);

  if (error) return res.status(500).json({ error: error.message });

  const flat = apps.map((a) => ({
    id: a.id,
    name: a.candidates?.name || "Unknown",
    role: a.job_profiles?.title || "Unknown",
    match: a.resume_score ?? 0,
    resumeScore: a.resume_score ?? 0,
    experience: "—",
    experienceYears: null,
    skills: "",
    location: a.candidates?.colleges?.name || "—",
    stage: a.stage || "Applied",
    source: "Application",
    email: a.candidates?.email || "",
    phone: a.candidates?.phone || "",
  }));

  res.json(flat);
});

// Corporate: KPI summary
app.get("/api/corporate/kpis", requireCorporate, async (req, res) => {
  const profile = req.userProfile;
  if (!profile.company_id) {
    return res.json({
      availableCandidates: 0,
      matchingCandidates: 0,
      jobProfiles: 0,
      locations: 0,
    });
  }

  const { data: jobs } = await supabase
    .from("job_profiles")
    .select("id")
    .eq("company_id", profile.company_id);
  const jobIds = (jobs || []).map((j) => j.id);

  let availableCandidates = 0;
  let matchingCandidates = 0;
  const locationSet = new Set();

  if (jobIds.length > 0) {
    const { data: apps } = await supabase
      .from("applications")
      .select("resume_score, candidates(colleges(name))")
      .in("job_id", jobIds);

    availableCandidates = apps?.length || 0;
    matchingCandidates = (apps || []).filter(
      (a) => (a.resume_score ?? 0) >= 70,
    ).length;
    (apps || []).forEach((a) => {
      const loc = a.candidates?.colleges?.name;
      if (loc) locationSet.add(loc);
    });
  }

  res.json({
    availableCandidates,
    matchingCandidates,
    jobProfiles: jobIds.length,
    locations: locationSet.size,
  });
});


// ==============================================================
// CANDIDATE SEARCH (Corporate) — searches the FULL candidate pool,
// not just applicants to this company's jobs.
// ==============================================================

// Corporate: search the talent pool with filters
app.get("/api/corporate/candidates/search", requireCorporate, async (req, res) => {
  const profile = req.userProfile;

  const {
    name,
    college,
    degree,
    branch,
    skills,
    location,
    minCgpa,
    minExperience,
  } = req.query;

  let query = supabase
    .from("candidates")
    .select(
      `
      id, name, email, phone, resume_url, photo_url,
      degree, branch, cgpa, passing_year, skills, location,
      experience_years, linkedin_url, github_url,
      college_id, college_other, colleges ( name )
      `,
    )
    .order("created_at", { ascending: false });

  if (name) query = query.ilike("name", `%${name}%`);
  if (degree) query = query.ilike("degree", `%${degree}%`);
  if (branch) query = query.ilike("branch", `%${branch}%`);
  if (skills) query = query.ilike("skills", `%${skills}%`);
  if (location) {
    query = query.or(
      `location.ilike.%${location}%,college_other.ilike.%${location}%`,
    );
  }
  if (minCgpa) query = query.gte("cgpa", Number(minCgpa));
  if (minExperience) query = query.gte("experience_years", Number(minExperience));

  const { data: candidates, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let filtered = candidates || [];
  if (college) {
    const q = college.toLowerCase();
    filtered = filtered.filter((c) =>
      (c.colleges?.name || c.college_other || "").toLowerCase().includes(q),
    );
  }

  // Attach match score + application stage if this candidate has applied
  // to any of this company's jobs; also mark saved status.
  let matchByCandidate = {};
  let savedSet = new Set();

  if (profile.company_id && filtered.length > 0) {
    const { data: jobs } = await supabase
      .from("job_profiles")
      .select("id")
      .eq("company_id", profile.company_id);
    const jobIds = (jobs || []).map((j) => j.id);

    if (jobIds.length > 0) {
      const candidateIds = filtered.map((c) => c.id);
      const { data: apps } = await supabase
        .from("applications")
        .select("candidate_id, resume_score, stage")
        .in("job_id", jobIds)
        .in("candidate_id", candidateIds);

      (apps || []).forEach((a) => {
        matchByCandidate[a.candidate_id] = {
          match: a.resume_score ?? null,
          stage: a.stage,
        };
      });
    }

    const { data: saved } = await supabase
      .from("saved_candidates")
      .select("candidate_id")
      .eq("company_id", profile.company_id);
    savedSet = new Set((saved || []).map((s) => s.candidate_id));
  }

  const result = filtered.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    resume_url: c.resume_url,
    photo_url: c.photo_url,
    college: c.colleges?.name || c.college_other || "—",
    degree: c.degree || "—",
    branch: c.branch || "—",
    cgpa: c.cgpa ?? null,
    location: c.location || c.colleges?.name || "—",
    skills: c.skills || "",
    experience_years: c.experience_years ?? null,
    linkedin_url: c.linkedin_url || null,
    github_url: c.github_url || null,
    match: matchByCandidate[c.id]?.match ?? null,
    applicationStage: matchByCandidate[c.id]?.stage ?? null,
    saved: savedSet.has(c.id),
  }));

  res.json(result);
});

// Lightweight per-company promise lock to serialize concurrent save requests within this process
const companySaveLocks = new Map();

function withCompanySaveLock(companyId, fn) {
  const currentLock = companySaveLocks.get(companyId) || Promise.resolve();
  let release;
  const newLock = new Promise((resolve) => {
    release = resolve;
  });
  companySaveLocks.set(companyId, newLock);

  return currentLock
    .then(fn)
    .finally(() => {
      release();
      if (companySaveLocks.get(companyId) === newLock) {
        companySaveLocks.delete(companyId);
      }
    });
}

// Corporate: save a candidate for later
app.post("/api/corporate/candidates/:candidateId/save", requireCorporate, async (req, res) => {
  const profile = req.userProfile;
  if (!profile.company_id) {
    return res.status(403).json({ error: "Company association required" });
  }

  const { candidateId } = req.params;
  if (!candidateId || typeof candidateId !== "string") {
    return res.status(400).json({ error: "Candidate ID is required" });
  }

  // 1. Primary: Atomic PostgreSQL RPC function (multi-instance transaction locking via pg_advisory_xact_lock)
  let missingRpc = false;
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "save_candidate_with_quota",
      {
        p_company_id: profile.company_id,
        p_candidate_id: candidateId,
        p_limit: 50,
      }
    );

    if (rpcError) {
      // Check if function is genuinely missing (e.g. migration not yet executed in database)
      const isMissingRpc =
        rpcError.code === "PGRST202" ||
        (rpcError.message && /function.*save_candidate_with_quota.*does not exist/i.test(rpcError.message));

      if (isMissingRpc) {
        missingRpc = true;
      } else {
        // Fail closed for permission errors, timeouts, connection errors, and unexpected DB failures
        console.error("save_candidate_with_quota database error:", rpcError);
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
      // Malformed RPC response: fail closed
      console.error("Malformed save_candidate_with_quota response:", rpcResult);
      return res.status(500).json({ error: "Invalid response from candidate save service" });
    }
  } catch (err) {
    // Fail closed on network or unhandled invocation exceptions
    console.error("RPC invocation exception:", err.message);
    return res.status(500).json({ error: "Unexpected error during candidate save" });
  }

  // 2. In-process fallback: only activated when the RPC function is genuinely missing
  if (!missingRpc) {
    return res.status(500).json({ error: "Failed to save candidate" });
  }

  // 2. In-process fallback: candidate existence check, local mutex, and database count
  const { data: cand, error: candErr } = await supabase
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .maybeSingle();

  if (candErr || !cand) {
    return res.status(404).json({ error: "Candidate not found" });
  }

  // Check if already saved (idempotent; does not consume quota)
  const { data: existingSaved } = await supabase
    .from("saved_candidates")
    .select("candidate_id")
    .eq("company_id", profile.company_id)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (existingSaved) {
    return res.json({ success: true, alreadySaved: true });
  }

  // Serialize quota verification and insertion within this instance to prevent concurrency races
  return withCompanySaveLock(profile.company_id, async () => {
    // Re-check existing in case a concurrent request just saved this exact candidate
    const { data: doubleCheck } = await supabase
      .from("saved_candidates")
      .select("candidate_id")
      .eq("company_id", profile.company_id)
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (doubleCheck) {
      return res.json({ success: true, alreadySaved: true });
    }

    const DAILY_SAVE_LIMIT = 50;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count, error: countErr } = await supabase
      .from("saved_candidates")
      .select("candidate_id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .gte("created_at", since);

    if (countErr) {
      return res.status(500).json({ error: "Failed to verify daily save limit" });
    }

    if ((count ?? 0) >= DAILY_SAVE_LIMIT) {
      return res.status(429).json({
        error: `Daily candidate save limit of ${DAILY_SAVE_LIMIT} reached. Contact campus support to expand your shortlisting quota.`,
      });
    }

    // Save new candidate with current timestamp
    const { error: insertErr } = await supabase
      .from("saved_candidates")
      .upsert(
        [{
          company_id: profile.company_id,
          candidate_id: candidateId,
          created_at: new Date().toISOString(),
        }],
        { onConflict: "company_id,candidate_id" },
      );

    if (insertErr) return res.status(500).json({ error: insertErr.message });
    return res.json({ success: true });
  });
});

// Corporate: unsave a candidate
app.delete("/api/corporate/candidates/:candidateId/save", requireCorporate, async (req, res) => {
  const profile = req.userProfile;
  if (!profile.company_id) {
    return res.status(403).json({ error: "Company association required" });
  }

  const { error } = await supabase
    .from("saved_candidates")
    .delete()
    .eq("company_id", profile.company_id)
    .eq("candidate_id", req.params.candidateId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

if (require.main === module) {
  app.listen(5000, () =>
    console.log("✅ RecruitOS backend running on http://localhost:5000"),
  );
}

module.exports = app;