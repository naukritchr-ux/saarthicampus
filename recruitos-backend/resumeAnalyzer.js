const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
const { parseStorageUrl, validateFileBuffer } = require("./storageHelpers");

async function analyzeResume(resumeUrl, jobSkills, applicationId) {
  try {
    console.log(`🔍 Starting analysis for application ${applicationId}`);

    const pdfParse = require('pdf-parse');
    let buffer = null;

    // 1. Try authorized Supabase Storage download (compatible with private and public buckets)
    const parsed = parseStorageUrl(resumeUrl, 'resumes');
    if (parsed) {
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from(parsed.bucket)
        .download(parsed.path);

      if (dlErr) {
        throw new Error(`Storage download failed: ${dlErr.message}`);
      }
      buffer = Buffer.from(await fileBlob.arrayBuffer());
    } else if (typeof resumeUrl === 'string' && (resumeUrl.startsWith('http://') || resumeUrl.startsWith('https://'))) {
      // 2. Fallback to HTTP fetch for external URLs
      const response = await fetch(resumeUrl);
      if (!response.ok) {
        throw new Error(`HTTP download failed with status ${response.status}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error('Unsupported or malformed resume URL');
    }

    // Validate buffer size (max 15MB) and enforce valid %PDF magic-bytes signature
    const validation = validateFileBuffer(buffer, {
      maxBytes: 15 * 1024 * 1024,
      requirePdf: true,
    });
    if (!validation.valid) {
      throw new Error(`Resume validation failed: ${validation.error}`);
    }

    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    console.log(`📄 PDF text extracted — ${resumeText.length} characters`);

    const prompt = `
You are a resume analyzer for a campus recruitment platform called RecruitOS by Talent Corner.

The job requires these skills: ${jobSkills.join(', ')}

Here is the candidate's resume text:
---
${resumeText.slice(0, 3000)}
---

Analyze the resume against the job requirements and respond ONLY in this exact JSON format, nothing else, no extra text:
{
  "score": <number between 0 and 100>,
  "matched_skills": [<array of skills from job requirements that are present in the resume>],
  "missing_skills": [<array of skills from job requirements that are NOT in the resume>],
  "match_label": "<exactly one of: Strong Match, Moderate Match, Weak Match>",
  "feedback": "<2-3 sentences of specific actionable feedback for this candidate>"
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    console.log(`✅ AI scored application ${applicationId} — Score: ${result.score} — ${result.match_label}`);

    const { error } = await supabase
      .from('applications')
      .update({
        ai_score: result.score,
        matched_skills: result.matched_skills,
        missing_skills: result.missing_skills,
        match_label: result.match_label,
        ai_feedback: result.feedback,
        ai_status: 'Analyzed',
      })
      .eq('id', applicationId);

    if (error) console.error('❌ DB update failed:', error);

    return result;
  } catch (err) {
    console.error('❌ Analysis failed:', err.message);
    await supabase
      .from('applications')
      .update({ ai_status: 'Failed' })
      .eq('id', applicationId);
  }
}

module.exports = { analyzeResume };