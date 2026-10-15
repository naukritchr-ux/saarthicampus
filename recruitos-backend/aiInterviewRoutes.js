const express = require('express');
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

function buildJobContext(job) {
  return `Job Title: ${job.title}
Job Summary: ${job.job_summary || 'N/A'}
Responsibilities: ${job.responsibilities || 'N/A'}
Required Qualification: ${job.qualification || 'N/A'}
Key Skills: ${Array.isArray(job.skills) ? job.skills.join(', ') : job.skills || 'N/A'}`;
}

// Send the AI interview link to the candidate's email (staff only)
router.post('/send-invite', requireStaff, async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    if (!candidate_id || !job_id) {
      return res.status(400).json({ error: 'candidate_id and job_id are required' });
    }

    const { data: candidate, error: candErr } = await supabase
      .from('candidates').select('name, email').eq('id', candidate_id).single();
    if (candErr || !candidate) throw candErr || new Error('Candidate not found');

    const { data: job, error: jobErr } = await supabase
      .from('job_profiles').select('title, company').eq('id', job_id).single();
    if (jobErr || !job) throw jobErr || new Error('Job not found');

    const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
    const interviewLink = `${baseUrl}/interview/${candidate_id}/${job_id}`;

    await sendAIInterviewInviteEmail({
      studentName: candidate.name,
      studentEmail: candidate.email,
      jobTitle: job.title,
      company: job.company,
      interviewLink,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Send interview invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/score-resume', async (req, res) => {
  try {
    const { resumeText, jobSkills, jobTitle } = req.body;
    if (!resumeText || !jobTitle) {
      return res.status(400).json({ error: 'resumeText and jobTitle are required' });
    }

    const prompt = `You are a resume screening assistant for a job titled "${jobTitle}".
Required skills for this job: ${(jobSkills || []).join(', ') || 'not specified'}.

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
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    if (!candidate_id || !job_id) {
      return res.status(400).json({ error: 'candidate_id and job_id are required' });
    }

    const { data: candidate, error: candErr } = await supabase
      .from('candidates').select('name').eq('id', candidate_id).single();
    if (candErr || !candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const { data: job, error: jobErr } = await supabase
      .from('job_profiles').select('*').eq('id', job_id).single();
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

    res.json({ sessionId: session.id, question: firstQuestion, candidateName: candidate.name, jobTitle: job.title });
  } catch (err) {
    console.error('AI interview start error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reply', async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    if (!sessionId || !answer) {
      return res.status(400).json({ error: 'sessionId and answer are required' });
    }

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

    const messages = [...session.messages, { role: 'user', content: answer }];
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

    await supabase.from('ai_interview_sessions')
      .update({ messages, status: 'completed' })
      .eq('id', sessionId);

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
    if (interviewErr) console.error('Could not save interview result (check RLS policy on interviews table):', interviewErr);

    res.json({ done: true, evaluation: { ...evaluation, overall } });
  } catch (err) {
    console.error('AI interview reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
