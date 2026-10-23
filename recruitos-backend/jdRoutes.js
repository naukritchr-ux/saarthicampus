const express = require('express');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const { createAuthMiddleware } = require('./authHelpers');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
const { requireRole } = createAuthMiddleware(supabase);

router.post('/generate', requireRole('admin', 'recruiter', 'corporate'), async (req, res) => {
  try {
    const { prompt, company } = req.body;
    let targetCompany = company;
    if (req.userProfile?.role === 'corporate') {
      if (!req.userProfile.company_id) {
        return res.status(403).json({ error: 'Company association required' });
      }
      const { data: comp } = await supabase
        .from('companies')
        .select('name')
        .eq('id', req.userProfile.company_id)
        .maybeSingle();
      targetCompany = comp?.name || company;
    }

    const fullPrompt = `Generate a complete, professional job description based on this request:
"${prompt}"
${targetCompany ? `Company: ${targetCompany}` : ''}

Respond with ONLY valid JSON, no markdown, no explanation, in exactly this shape:
{
  "title": "<job title>",
  "job_summary": "<2-3 sentence overview>",
  "responsibilities": "<key responsibilities, separated by semicolons>",
  "skills": ["<skill1>", "<skill2>"],
  "experience": "<e.g. 0-2 years>",
  "qualification": "<required education>",
  "salary_range": "<realistic Indian market range in LPA, or empty string if unclear>",
  "location": "<location or 'Not specified'>",
  "employment_type": "<Full-Time|Internship|Part-Time>"
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.5,
      max_tokens: 800,
    });

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/```json|```/g, '').trim();
    const jd = JSON.parse(raw);

    res.json({ jd });
  } catch (err) {
    console.error('JD generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;