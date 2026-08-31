const express = require('express');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const { sendAIInterviewInviteEmail } = require('./emailService');
const { moveApplicationStage } = require('./pipelineSync');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const MODEL = 'openai/gpt-oss-120b';

router.post('/generate', async (req, res) => {
  try {
    const { job_id, difficulty, question_count } = req.body;
    const count = Math.min(Math.max(Number(question_count) || 20, 5), 50);

    let jobContext = 'General aptitude test for a fresher-level role.';
    let resolvedDifficulty = difficulty === 'auto' || !difficulty ? 'medium' : difficulty;

    if (job_id) {
      const { data: job, error: jobErr } = await supabase
        .from('job_profiles')
        .select('*')
        .eq('id', job_id)
        .single();
      if (jobErr) throw jobErr;

      jobContext = `Job Title: ${job.title}
Experience Level: ${job.experience || 'Not specified'}
Qualification: ${job.qualification || 'Not specified'}
Key Skills: ${Array.isArray(job.skills) ? job.skills.join(', ') : job.skills || 'Not specified'}`;

      if (difficulty === 'auto' || !difficulty) {
        const exp = (job.experience || '').toLowerCase();
        if (exp.includes('senior') || exp.includes('5') || exp.includes('lead')) {
          resolvedDifficulty = 'hard';
        } else if (exp.includes('fresher') || exp.includes('0') || exp.includes('intern')) {
          resolvedDifficulty = 'easy';
        } else {
          resolvedDifficulty = 'medium';
        }
      }
    }

    const prompt = `Generate ${count} aptitude test questions for a candidate applying to this role:

${jobContext}

Difficulty level: ${resolvedDifficulty}

Mix these topic areas roughly evenly: quantitative/numerical reasoning, logical reasoning, verbal ability, general knowledge/current affairs, and basic role-relevant technical/domain knowledge (based on the key skills above, if any).

Respond with ONLY valid JSON, no markdown, no code fences, no explanation, in exactly this shape:
{"questions": [{"q": "<question text>", "options": ["<A>", "<B>", "<C>", "<D>"], "answer": "<the correct option text, must exactly match one of the options>", "topic": "<Quantitative|Logical|Verbal|GK|Technical>", "difficulty": "${resolvedDifficulty}"}]}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 4000,
    });

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.');
    }

    res.json({
      questions: parsed.questions || [],
      total: (parsed.questions || []).length,
      difficulty: resolvedDifficulty,
    });
  } catch (err) {
    console.error('Aptitude generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save a generated test + email the link to a candidate
router.post('/send-invite', async (req, res) => {
  try {
    const { candidate_id, job_id, questions, difficulty } = req.body;
    if (!candidate_id || !questions) {
      return res.status(400).json({ error: 'candidate_id and questions are required' });
    }

    const { data: candidate, error: candErr } = await supabase
      .from('candidates').select('name, email').eq('id', candidate_id).single();
    if (candErr) throw candErr;

    const { data: test, error: testErr } = await supabase
      .from('aptitude_tests')
      .insert([{ job_id: job_id || null, difficulty, questions }])
      .select()
      .single();
    if (testErr) throw testErr;

    const { data: invite, error: inviteErr } = await supabase
      .from('aptitude_invites')
      .insert([{ test_id: test.id, candidate_id, job_id: job_id || null }])
      .select()
      .single();
    if (inviteErr) throw inviteErr;

    const testLink = `${process.env.FRONTEND_URL || req.headers.origin}/aptitude-test/${invite.token}`;

    await sendAIInterviewInviteEmail({
      studentName: candidate.name,
      studentEmail: candidate.email,
      jobTitle: 'Aptitude Test',
      company: '',
      interviewLink: testLink,
    });

    res.json({ success: true, invite });
  } catch (err) {
    console.error('Aptitude send-invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Student opens the link — load the test WITHOUT correct answers
router.get('/take/:token', async (req, res) => {
  try {
    const { data: invite, error: inviteErr } = await supabase
      .from('aptitude_invites')
      .select('*, aptitude_tests(questions), candidates(name)')
      .eq('token', req.params.token)
      .single();
    if (inviteErr || !invite) return res.status(404).json({ error: 'Invalid or expired link' });

    if (invite.status === 'completed') {
      return res.status(400).json({ error: 'This test has already been completed.' });
    }

    if (!invite.started_at) {
      await supabase.from('aptitude_invites').update({ started_at: new Date(), status: 'in_progress' }).eq('id', invite.id);
    }

    // Strip correct answers before sending to the student
    const safeQuestions = invite.aptitude_tests.questions.map((q, i) => ({
      index: i,
      q: q.q,
      options: q.options,
      topic: q.topic,
    }));

    res.json({ candidateName: invite.candidates.name, questions: safeQuestions });
  } catch (err) {
    console.error('Aptitude take error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Student submits answers — auto-score and save result
router.post('/submit/:token', async (req, res) => {
  try {
    const { answers } = req.body; // array of selected option strings, same order as questions
    const { data: invite, error: inviteErr } = await supabase
      .from('aptitude_invites')
      .select('*, aptitude_tests(questions)')
      .eq('token', req.params.token)
      .single();
    if (inviteErr || !invite) return res.status(404).json({ error: 'Invalid or expired link' });
    if (invite.status === 'completed') {
      return res.status(400).json({ error: 'This test has already been completed.' });
    }

    const questions = invite.aptitude_tests.questions;
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.answer) score++;
    });
    const total = questions.length;
    const passed = score / total >= 0.5;

    await supabase.from('aptitude_invites').update({ status: 'completed', completed_at: new Date() }).eq('id', invite.id);

    const { data: result, error: resultErr } = await supabase
      .from('aptitude_results')
      .insert([{ candidate_id: invite.candidate_id, job_id: invite.job_id, score, total, passed }])
      .select()
      .single();
    if (resultErr) throw resultErr;

    // Pipeline sync: passing auto-moves the candidate from Aptitude to GD.
    if (passed) {
      await moveApplicationStage(supabase, {
        candidateId: invite.candidate_id,
        jobId: invite.job_id,
        fromStage: 'Aptitude',
        toStage: 'GD',
      });
    }

    res.json({ success: true, score, total, passed, result });
  } catch (err) {
    console.error('Aptitude submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;