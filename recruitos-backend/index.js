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
const { getRequestProfile } = require("./authHelpers");
const multer = require("multer");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");
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

// ---- COLLEGES ----
app.get("/api/colleges", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (
    profile &&
    (profile.role === "candidate" || profile.role === "corporate")
  ) {
    return res.status(403).json({ error: "Not authorized" });
  }

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

app.post("/api/colleges", async (req, res) => {
  const { data, error } = await supabase
    .from("colleges")
    .insert([req.body])
    .select();
  if (error) return res.status(500).json({ error });
  res.json(data[0]);
});

// ---- COMPANIES ----
app.get("/api/companies", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  let query = supabase.from("companies").select("*");

  if (profile?.role === "corporate" && profile.company_id) {
    query = query.eq("id", profile.company_id);
  }
  // admin, recruiter see all companies

  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.post("/api/companies", async (req, res) => {
  const { data, error } = await supabase
    .from("companies")
    .insert([req.body])
    .select();
  if (error) return res.status(500).json({ error });
  res.json(data[0]);
});

// ---- JOB PROFILES ----
app.get("/api/jobs", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  let query = supabase.from("job_profiles").select("*");

  if (profile?.role === "corporate") {
    if (!profile.company_id) return res.json([]);
    query = query.eq("company_id", profile.company_id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.get("/api/my-applications", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
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

app.get("/api/my-company-jobs", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (!profile || profile.role !== "corporate" || !profile.company_id) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { data: jobs, error } = await supabase
    .from("job_profiles")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(jobs);
});

app.get("/api/my-company-applications", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (!profile || profile.role !== "corporate" || !profile.company_id) {
    return res.status(403).json({ error: "Not authorized" });
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
    .select("id, title, company, skills");
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// ---- TRIGGER AI ANALYSIS ----
app.post("/api/analyze", async (req, res) => {
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
app.get("/api/resume/analyzed", async (req, res) => {
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

// ---- MARK CANDIDATE SELECTED → fires 3 emails automatically ----
app.post("/api/candidate/select", async (req, res) => {
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

app.post("/api/candidate/reject", async (req, res) => {
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
app.post("/api/email/college-outreach", async (req, res) => {
  try {
    await sendCollegeOutreachEmail(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- OFFERS ----
app.get("/api/offers", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
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
  }
  // admin, recruiter see everything

  res.json(filtered);
});

// ---- JOINING ----
app.get("/api/joining", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (
    profile &&
    (profile.role === "candidate" || profile.role === "corporate")
  ) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { data, error } = await supabase
    .from("joining")
    .select("*, candidates(name, college), offers(job_profiles(company))");
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// ---- COMMUNICATIONS ----
app.get("/api/communications", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (
    profile &&
    (profile.role === "candidate" || profile.role === "corporate")
  ) {
    return res.status(403).json({ error: "Not authorized" });
  }

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

app.post("/api/communications", async (req, res) => {
  const { data, error } = await supabase
    .from("communications")
    .insert([req.body])
    .select();
  if (error) return res.status(500).json({ error });
  res.json(data[0]);
});

// ---- GENERATE EMAIL (Comm.jsx "Generate with AI" button) ----
app.post("/api/generate-email", generateEmail);

if (require.main === module) {
  app.listen(5000, () =>
    console.log("✅ RecruitOS backend running on http://localhost:5000"),
  );
}

module.exports = app;

// Create GD Session
app.post("/api/gd/create", async (req, res) => {
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
app.post("/api/gd/create-offline", async (req, res) => {
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
app.post("/api/gd/manual", async (req, res) => {
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
app.post("/api/gd/:id/start", async (req, res) => {
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
app.post("/api/gd/:id/end", async (req, res) => {
  await supabase
    .from("gd_sessions")
    .update({ status: "Ended", ended_at: new Date() })
    .eq("id", req.params.id);

  res.json({ success: true, message: "GD ended. AI scoring started." });

  // AI scores in background
  scoreGDSession(req.params.id);
});

// Get session details + participants + messages
app.get("/api/gd/:id", async (req, res) => {
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
app.post("/api/gd/:id/shortlist", async (req, res) => {
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
    const { email, password, name, role } = req.body;
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

async function requireAdmin(req, res, next) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !profile || profile.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
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
// Admin: approve a user
app.post("/api/auth/approve/:userId", requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from("profiles")
    .update({ approved: true })
    .eq("id", req.params.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Admin: reject/delete a pending user
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
// with Supabase Auth's last_sign_in_at so the UI can show real activity.
app.get("/api/auth/users", requireAdmin, async (req, res) => {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
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
    last_sign_in_at: authById[p.id] || null,
  }));

  res.json(merged);
});

// Admin: directly create a new user (auto-approved, no sign-up flow needed)
app.post("/api/auth/users", requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res
      .status(400)
      .json({ error: "Name, email, password, and role are required" });
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
    .insert([{ id: authData.user.id, email, name, role, approved: true }])
    .select()
    .single();
  if (profileError)
    return res.status(500).json({ error: profileError.message });

  res.json({ success: true, user: data });
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

// Admin: edit a user's name/email
app.patch("/api/auth/users/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ name, email })
    .eq("id", userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  try {
    await supabase.auth.admin.updateUserById(userId, { email });
  } catch (err) {
    console.error("Auth user email update error:", err);
  }

  res.json({ success: true, user: data });
});

// Admin: change an existing user's role
app.post("/api/auth/users/:userId/role", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const validRoles = ["admin", "recruiter", "candidate", "corporate"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
// Log a new call
app.post("/api/calls", async (req, res) => {
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
app.get("/api/calls", async (req, res) => {
  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .order("call_date", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get recruiter performance summary
app.get("/api/calls/performance", async (req, res) => {
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

app.post("/api/bid/suggest", async (req, res) => {
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
      model: "llama-3.1-8b-instant",
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
app.get("/api/candidate/:id/passport", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: candidate, error: candErr } = await supabase
      .from("candidates")
      .select("*, colleges(name)")
      .eq("id", id)
      .single();
    if (candErr || !candidate)
      return res.status(404).json({ error: "Candidate not found" });

    const { data: applications } = await supabase
      .from("applications")
      .select("*, job_profiles(title, company)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });

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

    const { data: interviews } = await supabase
      .from("interviews")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

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
app.post("/api/import/campus", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rawText = "";

    const ext = req.file.originalname.split(".").pop().toLowerCase();

    if (ext === "pdf") {
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
      model: "llama-3.1-8b-instant",
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
app.post("/api/import/campus/save", async (req, res) => {
  try {
    const { colleges } = req.body;
    if (!colleges || colleges.length === 0) {
      return res.status(400).json({ error: "No data to save" });
    }

    const { data, error } = await supabase
      .from("colleges")
      .upsert(colleges, { onConflict: "name" })
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, saved: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- AI EXCEL/PDF IMPORT — CORPORATE DATABASE ----
app.post("/api/import/corporate", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rawText = "";
    const ext = req.file.originalname.split(".").pop().toLowerCase();

    if (ext === "pdf") {
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
      model: "llama-3.1-8b-instant",
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
app.post("/api/import/corporate/save", async (req, res) => {
  try {
    const { companies } = req.body;
    if (!companies || companies.length === 0) {
      return res.status(400).json({ error: "No data to save" });
    }

    const { data, error } = await supabase
      .from("companies")
      .upsert(companies, { onConflict: "name" })
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, saved: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Corporate: candidates who applied to this company's jobs
app.get("/api/corporate/candidates", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (!profile || profile.role !== "corporate") {
    return res.status(403).json({ error: "Corporate access required" });
  }
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
app.get("/api/corporate/kpis", async (req, res) => {
  const profile = await getRequestProfile(supabase, req);
  if (!profile || profile.role !== "corporate") {
    return res.status(403).json({ error: "Corporate access required" });
  }
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
