const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const { moveApplicationStage } = require('./pipelineSync');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function scoreGDSession(sessionId) {
  try {
    console.log('🤖 AI scoring GD session:', sessionId);

    // Get session topic
    const { data: session } = await supabase
      .from('gd_sessions')
      .select('topic, job_id')
      .eq('id', sessionId)
      .single();

    // Get all messages
    const { data: messages } = await supabase
      .from('gd_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('sent_at', { ascending: true });

    // Get all participants
    const { data: participants } = await supabase
      .from('gd_participants')
      .select('*')
      .eq('session_id', sessionId);

    if (!messages.length) {
      console.log('No messages to score');
      return;
    }

    // Build transcript grouped by participant
    const transcript = messages.map(m =>
      `[${m.candidate_name}]: ${m.message}`
    ).join('\n');

    // Count messages per participant
    const messageCounts = {};
    messages.forEach(m => {
      messageCounts[m.candidate_name] = (messageCounts[m.candidate_name] || 0) + 1;
    });

    const totalMessages = messages.length;

    // Score each participant
    for (const participant of participants) {
      const participantMessages = messages
        .filter(m => m.participant_id === participant.id)
        .map(m => m.message)
        .join('\n');

      const messageCount = messageCounts[participant.candidate_name] || 0;
      const participationRate = Math.round((messageCount / totalMessages) * 100);

      const prompt = `
You are an expert Group Discussion evaluator for campus recruitment.

GD Topic: "${session.topic}"

Full GD Transcript:
---
${transcript}
---

Now evaluate ONLY this participant: ${participant.candidate_name}
Their messages during the GD:
---
${participantMessages || 'No messages — did not participate'}
---

Total messages in GD: ${totalMessages}
Messages by this participant: ${messageCount}
Participation rate: ${participationRate}%

Score this participant and respond ONLY in this exact JSON format:
{
  "participation_score": <0-100, based on how much they spoke>,
  "communication_score": <0-100, based on clarity and quality of points>,
  "leadership_score": <0-100, based on introducing points, guiding discussion>,
  "keyword_score": <0-100, based on relevance of their points to the topic>,
  "overall_score": <0-100, weighted average>,
  "feedback": "<2-3 sentences of specific feedback about this candidate's GD performance>"
}`;

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const raw = completion.choices[0].message.content;
      const clean = raw.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      await supabase
        .from('gd_participants')
        .update({
          ai_score: result.overall_score,
          participation_score: result.participation_score,
          communication_score: result.communication_score,
          leadership_score: result.leadership_score,
          keyword_score: result.keyword_score,
          ai_feedback: result.feedback,
        })
        .eq('id', participant.id);

      // Pipeline sync: fallback trigger for candidates sir hasn't manually
      // rated yet — a strong AI score also moves them GD → Interview.
      // (If sir later gives a manual rating ≥3/5, that check in index.js
      // runs independently — harmless here since stage won't be 'GD' anymore.)
      if (result.overall_score >= 70 && participant.candidate_id) {
        await moveApplicationStage(supabase, {
          candidateId: participant.candidate_id,
          jobId: session.job_id,
          fromStage: 'GD',
          toStage: 'Interview',
        });
      }

      console.log(`✅ Scored ${participant.candidate_name}: ${result.overall_score}/100`);
    }

    console.log('✅ All participants scored!');
  } catch (err) {
    console.error('❌ GD scoring failed:', err.message);
  }
}

module.exports = { scoreGDSession };
