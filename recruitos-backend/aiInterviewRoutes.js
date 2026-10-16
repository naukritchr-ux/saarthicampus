const express = require('express');
const crypto = require('crypto');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const { sendAIInterviewInviteEmail } = require('./emailService');
const { createAuthMiddleware } = require('./authHelpers');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
const { requireStaff } = createAuthMiddleware(supabase);

const MODEL = 'llama-3.3-70b-versatile';
const TOTAL_QUESTIONS = 5;
const DEFAULT_EXPIRY_SECONDS = 48 * 60 * 60; // 48 hours

function getInterviewSecret() {
  const secret =
    process.env.INTERVIEW_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('FATAL: Server security configuration missing. INTERVIEW_TOKEN_SECRET must be configured.');
  }
  return secret;
}

function generateInterviewToken(candidateId, jobId, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payloadObj = {
    candidate_id: candidateId,
    job_id: jobId,
    exp,
    nonce,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getInterviewSecret()).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

function verifyInterviewTokenPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  const expectedHmac = crypto.createHmac('sha256', getInterviewSecret()).update(payloadStr).digest('base64url');
  if (signature.length !== expectedHmac.length) return null;
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedHmac);
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.candidate_id || !payload.job_id || !payload.exp) return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateSessionToken(sessionId, candidateId) {
  const payload = Buffer.from(JSON.stringify({ sessionId, candidateId, t: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', getInterviewSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token, expectedSessionId) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getInterviewSecret()).update(payloadStr).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.sessionId || payload.sessionId !== expectedSessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

function buildJobContext(job) {
  return `Job Title: ${job.title}
Job Summary: ${job.job_summary || 'N/A'}
Responsibilities: ${job.responsibilities || 'N/A'}
Required Qualification: ${job.qualification || 'N/A'}
Key Skills: ${Array.isArray(job.skills) ? job.skills.join(', ') : job.skills || 'N/A'}`;
}

// Send or generate an AI interview link with a cryptographically secure token (staff only)
router.post('/send-invite', requireStaff, async (req, res) => {
  try {
    const { candidate_id, job_id, sendEmail } = req.body;
    if (!candidate_id || !job_id) {
      return res.status(400).json({ error: 'candidate_id and job_id are required' });
    }

    const { data: candidate, error: candErr } = await supabase
      .from('candidates').select('name, email').eq('id', candidate_id).single();
    if (candErr || !candidate) throw candErr || new Error('Candidate not found');

    const { data: job, error: jobErr } = await supabase
      .from('job_profiles').select('title, company').eq('id', job_id).single();
    if (jobErr || !job) throw jobErr || new Error('Job not found');

    // Confirm candidate has an application for this job
    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id, stage')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .maybeSingle();
    if (appErr || !app) {
      return res.status(400).json({ error: 'No application found for this candidate and job' });
    }

    // Generate secure token with 48h expiry
    const token = generateInterviewToken(candidate_id, job_id);
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_SECONDS * 1000).toISOString();

    // Persist to ai_interview_invites if table exists
    try {
      await supabase.from('ai_interview_invites').insert([{
        candidate_id,
        job_id,
        token,
        status: 'pending',
        expires_at: expiresAt,
      }]);
    } catch (dbErr) {
      // Table may not have been migrated yet in production
    }

    const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
    const interviewLink = `${baseUrl}/interview/${token}`;

    if (sendEmail !== false) {
      await sendAIInterviewInviteEmail({
        studentName: candidate.name,
        studentEmail: candidate.email,
        jobTitle: job.title,
        company: job.company,
        interviewLink,
      });
    }

    res.json({ success: true, token, interviewLink });
  } catch (err) {
    console.error('Send interview invite error:', err);
    res.status(500).json({ error: 'Failed to generate interview invitation' });
  }
});

// Candidate opens interview link with token — validate and return job & candidate info (public student flow)
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    let candidateId = null;
    let jobId = null;

    // 1. Try DB lookup if ai_interview_invites exists
    try {
      const { data: invite, error: invErr } = await supabase
        .from('ai_interview_invites')
        .select('*, candidates(name), job_profiles(title, company)')
        .eq('token', token)
        .maybeSingle();

      if (!invErr && invite) {
        if (invite.status === 'completed') {
          return res.status(400).json({ error: 'This interview has already been completed.' });
        }
        if (new Date(invite.expires_at) < new Date()) {
          return res.status(400).json({ error: 'This interview link has expired. Please contact the recruiter.' });
        }
        return res.json({
          valid: true,
          candidateName: invite.candidates?.name || 'Candidate',
          jobTitle: invite.job_profiles?.title || 'Job Interview',
          company: invite.job_profiles?.company || '',
          token,
        });
      }
    } catch {
      // Table may not exist yet
    }

    // 2. Cryptographic token fallback
    const payload = verifyInterviewTokenPayload(token);
    if (!payload) {
      return res.status(404).json({ error: 'Invalid or expired interview link' });
    }
    candidateId = payload.candidate_id;
    jobId = payload.job_id;

    // Load candidate and job details
    const [{ data: candidate, error: candErr }, { data: job, error: jobErr }] = await Promise.all([
      supabase.from('candidates').select('name').eq('id', candidateId).single(),
      supabase.from('job_profiles').select('title, company').eq('id', jobId).single(),
    ]);

    if (candErr || !candidate || jobErr || !job) {
      return res.status(404).json({ error: 'Interview details could not be found' });
    }

    // Check if there is already a completed session
    const { data: existingSession } = await supabase
      .from('ai_interview_sessions')
      .select('status')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingSession) {
      return res.status(400).json({ error: 'This interview has already been completed.' });
    }

    res.json({
      valid: true,
      candidateName: candidate.name,
      jobTitle: job.title,
      company: job.company || '',
      token,
    });
  } catch (err) {
    console.error('Verify interview invite error:', err);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

router.post('/score-resume', async (req, res) => {
  try {
    const { resumeText, jobSkills, jobTitle } = req.body;
    if (!resumeText || !jobTitle || typeof resumeText !== 'string' || typeof jobTitle !== 'string') {
      return res.status(400).json({ error: 'Valid resumeText and jobTitle are required' });
    }

    if (resumeText.length > 25000) {
      return res.status(400).json({ error: 'Resume text exceeds maximum allowed size' });
    }

    const sanitizedJobTitle = jobTitle.slice(0, 200).replace(/[<>{}]/g, '');
    const prompt = `You are a resume screening assistant for a job titled "${sanitizedJobTitle}".
Required skills for this job: ${Array.isArray(jobSkills) ? jobSkills.slice(0, 50).join(', ') : 'not specified'}.

Resume text:
---
${resumeText.slice(0, 6000)}
---

Respond with ONLY valid JSON, no markdown, no code fences, no explanation, in exactly this shape:
{"score": <integer 0-100>, "matched_skills": [<strings>], "missing_skills": [<strings>]}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);

    res.json({
      score: Math.max(0, Math.min(100, Math.round(result.score))),
      matched_skills: result.matched_skills || [],
      missing_skills: result.missing_skills || [],
    });
  } catch (err) {
    console.error('Resume scoring error:', err);
    res.status(500).json({ error: 'Failed to process resume analysis' });
  }
});

router.post('/start', async (req, res) => {
  try {
    const { token } = req.body;

    // Token is strictly required for public interview candidates
    if (!token || typeof token !== 'string') {
      return res.status(401).json({ error: 'A valid interview invitation token is required.' });
    }

    let candidate_id = null;
    let job_id = null;
    let inviteId = null;

    // 1. Try DB lookup if ai_interview_invites exists
    try {
      const { data: dbInvite } = await supabase
        .from('ai_interview_invites')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (dbInvite) {
        if (dbInvite.status === 'completed') {
          return res.status(400).json({ error: 'This interview has already been completed.' });
        }
        if (new Date(dbInvite.expires_at) < new Date()) {
          return res.status(400).json({ error: 'This interview link has expired. Please contact the recruiter.' });
        }
        candidate_id = dbInvite.candidate_id;
        job_id = dbInvite.job_id;
        inviteId = dbInvite.id;
      }
    } catch {
      // Table may not exist yet
    }

    // 2. Cryptographic token payload verification
    if (!candidate_id || !job_id) {
      const payload = verifyInterviewTokenPayload(token);
      if (!payload) {
        return res.status(403).json({ error: 'Invalid or expired interview token.' });
      }
      candidate_id = payload.candidate_id;
      job_id = payload.job_id;
    }

    // Check if session is already completed
    const { data: completedSession } = await supabase
      .from('ai_interview_sessions')
      .select('id, status')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .eq('status', 'completed')
      .maybeSingle();

    if (completedSession) {
      return res.status(400).json({ error: 'This interview has already been completed.' });
    }

    // Check candidate and job records
    const [{ data: candidate, error: candErr }, { data: job, error: jobErr }] = await Promise.all([
      supabase.from('candidates').select('name').eq('id', candidate_id).single(),
      supabase.from('job_profiles').select('*').eq('id', job_id).single(),
    ]);

    if (candErr || !candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    if (jobErr || !job) {
      return res.status(404).json({ error: 'Job profile not found' });
    }

    // Verify candidate and job match an existing application
    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id, stage')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .maybeSingle();

    if (appErr || !app) {
      return res.status(403).json({ error: 'No active application found for this candidate and job' });
    }

    // Check for an existing in-progress session (resume flow to prevent duplicates and LLM waste)
    const { data: existingInProgress } = await supabase
      .from('ai_interview_sessions')
      .select('id, messages, status')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInProgress) {
      const lastQuestion = (existingInProgress.messages || [])
        .filter((m) => m.role === 'assistant')
        .slice(-1)[0]?.content || 'Please continue your response.';
      const sessionToken = generateSessionToken(existingInProgress.id, candidate_id);
      return res.json({
        sessionId: existingInProgress.id,
        sessionToken,
        question: lastQuestion,
        candidateName: candidate.name,
        jobTitle: job.title,
      });
    }

    // If an invite record exists, mark status in_progress
    if (inviteId) {
      try {
        await supabase
          .from('ai_interview_invites')
          .update({ status: 'in_progress', started_at: new Date() })
          .eq('id', inviteId);
      } catch {
        // Ignore if table error
      }
    }

    const jobContext = buildJobContext(job);
    const systemPrompt = `You are a friendly, professional AI interviewer conducting a screening interview for the role below.

${jobContext}

Candidate name: ${candidate.name}

Ask exactly one interview question at a time. Questions should probe relevant skills, experience, and role fit — mix behavioral and role-specific technical questions. Keep each question concise (1-3 sentences), warm in tone, and do not repeat earlier questions. Do not include any preamble like "Sure" or "Question 1" — just ask the question directly. This is question 1 of ${TOTAL_QUESTIONS}.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    const firstQuestion = completion.choices[0].message.content.trim();

    const { data: session, error: sessErr } = await supabase
      .from('ai_interview_sessions')
      .insert([{
        candidate_id,
        job_id,
        messages: [{ role: 'assistant', content: firstQuestion }],
        status: 'in_progress',
      }])
      .select()
      .single();
    if (sessErr) throw sessErr;

    const sessionToken = generateSessionToken(session.id, candidate_id);

    res.json({
      sessionId: session.id,
      sessionToken,
      question: firstQuestion,
      candidateName: candidate.name,
      jobTitle: job.title,
    });
  } catch (err) {
    console.error('AI interview start error:', err);
    res.status(500).json({ error: 'Failed to start interview session' });
  }
});

router.post('/reply', async (req, res) => {
  try {
    const { sessionId, sessionToken, answer } = req.body;
    if (!sessionId || !answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'sessionId and answer are required' });
    }

    // Session token authorization check - mandatory to prevent answer forgery
    if (!sessionToken || !verifySessionToken(sessionToken, sessionId)) {
      return res.status(403).json({ error: 'Valid session token is required to submit interview replies' });
    }

    const sanitizedAnswer = answer.trim().slice(0, 3000);

    const { data: session, error: sessErr } = await supabase
      .from('ai_interview_sessions').select('*').eq('id', sessionId).single();
    if (sessErr) throw sessErr;
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'This interview has already been completed.' });
    }

    const { data: job, error: jobErr } = await supabase
      .from('job_profiles').select('*').eq('id', session.job_id).single();
    if (jobErr) throw jobErr;

    const { data: candidate, error: candErr } = await supabase
      .from('candidates').select('name').eq('id', session.candidate_id).single();
    if (candErr) throw candErr;

    const messages = [...session.messages, { role: 'user', content: sanitizedAnswer }];
    const questionsAskedSoFar = messages.filter((m) => m.role === 'assistant').length;
    const jobContext = buildJobContext(job);

    if (questionsAskedSoFar < TOTAL_QUESTIONS) {
      const systemPrompt = `You are a friendly, professional AI interviewer conducting a screening interview for the role below.

${jobContext}

Candidate name: ${candidate.name}

Continue the interview naturally based on the conversation so far. Ask exactly one new interview question (concise, 1-3 sentences, warm tone, no preamble). Do not repeat earlier questions. This is question ${questionsAskedSoFar + 1} of ${TOTAL_QUESTIONS}.`;

      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 200,
      });

      const nextQuestion = completion.choices[0].message.content.trim();
      const updatedMessages = [...messages, { role: 'assistant', content: nextQuestion }];

      await supabase.from('ai_interview_sessions').update({ messages: updatedMessages }).eq('id', sessionId);

      return res.json({ done: false, question: nextQuestion });
    }

    const transcriptText = messages
      .map((m) => (m.role === 'assistant' ? `Q: ${m.content}` : `A: ${m.content}`))
      .join('\n');

    const evalPrompt = `You are evaluating a candidate's screening interview transcript for this role:

${jobContext}

Transcript:
${transcriptText}

Score the candidate from 0-10 on each of: confidence, technical (role-relevant knowledge), communication (clarity, grammar, articulation). Also write a short 2-3 sentence feedback summary and a recommendation of either "Recommended" or "Not Recommended".

Respond with ONLY valid JSON, no other text, in exactly this shape:
{"confidence": <number>, "technical": <number>, "communication": <number>, "feedback": "<string>", "recommendation": "Recommended" | "Not Recommended"}`;

    const evalCompletion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: evalPrompt }],
      temperature: 0.3,
      max_tokens: 400,
    });

    let evalRaw = evalCompletion.choices[0].message.content.trim();
    evalRaw = evalRaw.replace(/```json|```/g, '').trim();
    const evaluation = JSON.parse(evalRaw);

    const overall = Number((
      (Number(evaluation.confidence) + Number(evaluation.technical) + Number(evaluation.communication)) / 3
    ).toFixed(1));

    // Concurrency defense: atomic check-and-set to complete the session
    const { data: updatedSession, error: updateErr } = await supabase
      .from('ai_interview_sessions')
      .update({ messages, status: 'completed' })
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .select()
      .maybeSingle();

    if (updateErr || !updatedSession) {
      return res.status(400).json({ error: 'This interview was already completed or concurrently modified.' });
    }

    // Also update ai_interview_invites table if it exists
    try {
      await supabase
        .from('ai_interview_invites')
        .update({ status: 'completed', completed_at: new Date() })
        .eq('candidate_id', session.candidate_id)
        .eq('job_id', session.job_id)
        .eq('status', 'in_progress');
    } catch {
      // Ignore if table does not exist
    }

    const { error: interviewErr } = await supabase.from('interviews').insert([{
      candidate_id: session.candidate_id,
      job_id: session.job_id,
      type: 'Mock',
      confidence: Number(evaluation.confidence),
      technical: Number(evaluation.technical),
      communication: Number(evaluation.communication),
      overall,
      notes: evaluation.feedback,
      recommendation: evaluation.recommendation,
    }]);
    if (interviewErr) console.error('Could not save interview result:', interviewErr);

    res.json({ done: true, evaluation: { ...evaluation, overall } });
  } catch (err) {
    console.error('AI interview reply error:', err);
    res.status(500).json({ error: 'Failed to process interview response' });
  }
});

router._helpers = {
  generateInterviewToken,
  verifyInterviewTokenPayload,
  generateSessionToken,
  verifySessionToken,
};

module.exports = router;
