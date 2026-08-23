import { supabase } from './supabaseClient';
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  return userId ? { 'x-user-id': userId } : {};
}


// ---------- Dashboard ----------
export async function getRecentApplications(limit = 4) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, stage, resume_score,
      candidates ( name, colleges ( name ) ),
      job_profiles ( title, company )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export const STAGE_META = {
  resume_review: { label: 'Resume Review', badge: 'gray' },
  resume_ai_analysis: { label: 'Resume Analysis', badge: 'gray' },
  aptitude: { label: 'Aptitude', badge: 'gold' },
  gd: { label: 'GD', badge: 'gold' },
  mock_interview: { label: 'Mock Interview', badge: 'blue' },
  personal_interview: { label: 'Interview', badge: 'blue' },
  interview: { label: 'Interview', badge: 'blue' },
  selected: { label: 'Selected', badge: 'green' },
  rejected: { label: 'Rejected', badge: 'red' },
  offer_sent: { label: 'Offer Sent', badge: 'green' },
  joined: { label: 'Joined', badge: 'green' },
};

// ---------- Campus Database ----------
export async function getColleges({ course, status, search } = {}) {
  let query = supabase.from('colleges').select('*').range(0, 4999);
  if (course) query = query.eq('course', course);
  if (status && status !== 'All Status') query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,tpo.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addCollege({ name, city, course, tpo, strength }) {
  const { data, error } = await supabase
    .from('colleges')
    .insert([{ name, city, course, tpo, strength: strength ? Number(strength) : null }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCollege(id, { name, city, course, tpo, strength, status }) {
  const { data, error } = await supabase
    .from('colleges')
    .update({ name, city, course, tpo, strength: strength ? Number(strength) : null, status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCollege(id) {
  const { error } = await supabase.from('colleges').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Corporate Database ----------
export async function getCompanies() {
  const { data, error } = await supabase.from('companies').select('*');
  if (error) throw error;
  return data;
}

export async function addCompany({ name, sector, hr_name, hq_location }) {
  const { data, error } = await supabase
    .from('companies')
    .insert([{ name, sector, hr_name, hq_location }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompany(id, { name, sector, hr_name, hq_location, hiring_status }) {
  const { data, error } = await supabase
    .from('companies')
    .update({ name, sector, hr_name, hq_location, hiring_status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCompany(id) {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Job Profiles ----------
export async function getJobs() {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load jobs');
  return data;
}

export async function addJob({ title, company, location, salary_range, experience, skills }) {
  const { data, error } = await supabase
    .from('job_profiles')
    .insert([{
      title,
      company,
      location,
      salary_range,
      experience,
      skills: skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(id, jobData) {
  const { data, error } = await supabase
    .from('job_profiles')
    .update(jobData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJob(id) {
  const { error } = await supabase.from('job_profiles').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Resume Analyzer ----------
export async function getResumeAnalysis(jobId) {
  // No longer filters out null resume_score — unscored applications are
  // shown too, with an "Add Score" action, so admins can find and score them.
  let query = supabase
    .from('applications')
    .select(`
      id, resume_score, matched_skills, missing_skills, created_at,
      candidates ( name, resume_url, colleges ( name ) ),
      job_profiles ( title )
    `)
    .order('resume_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (jobId) query = query.eq('job_id', jobId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateResumeScore(applicationId, { resume_score, matched_skills, missing_skills }) {
  const { data, error } = await supabase
    .from('applications')
    .update({
      resume_score: Number(resume_score),
      matched_skills: matched_skills
        ? matched_skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      missing_skills: missing_skills
        ? missing_skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    })
    .eq('id', applicationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Aptitude ----------
export async function getAptitudeResults(jobId) {
  let query = supabase
    .from('aptitude_results')
    .select('id, score, total, passed, candidates ( name )')
    .order('score', { ascending: false });
  if (jobId) query = query.eq('job_id', jobId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addAptitudeResult({ candidate_id, job_id, score, total }) {
  const s = Number(score);
  const t = Number(total);
  const passed = t > 0 ? s / t >= 0.5 : false;
  const { data, error } = await supabase
    .from('aptitude_results')
    .insert([{ candidate_id, job_id: job_id || null, score: s, total: t, passed }])
    .select()
    .single();
  if (error) throw error;

  if (passed) {
    const { data: app } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidate_id)
      .eq('stage', 'Aptitude')
      .maybeSingle();
    if (app) {
      await supabase.from('applications').update({ stage: 'GD' }).eq('id', app.id);
    }
  }

  return data;
}

// ---------- Group Discussion ----------
export async function getGdRatings() {
  const { data, error } = await supabase
    .from('gd_ratings')
    .select('*, candidates ( name )')
    .order('overall', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addGdRating({ candidate_id, confidence, communication, leadership, participation, knowledge, teamwork }) {
  const vals = [confidence, communication, leadership, participation, knowledge, teamwork].map(Number);
  const overall = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  const { data, error } = await supabase
    .from('gd_ratings')
    .insert([{ candidate_id, confidence: vals[0], communication: vals[1], leadership: vals[2], participation: vals[3], knowledge: vals[4], teamwork: vals[5], overall }])
    .select()
    .single();
  if (error) throw error;

  if (overall >= 3) {
    const { data: app } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidate_id)
      .eq('stage', 'GD')
      .maybeSingle();
    if (app) {
      await supabase.from('applications').update({ stage: 'Interview' }).eq('id', app.id);
    }
  }

  return data;
}

// ---------- Interviews ----------
export async function getInterviews() {
  const { data, error } = await supabase
    .from('interviews')
    .select('*, candidates ( name, college_id, colleges ( name ) ), job_profiles ( title, company )')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addInterview({ candidate_id, type, confidence, technical, communication, notes, recommendation }) {
  let overall = null;
  if (type === 'Mock') {
    const vals = [confidence, technical, communication].map(Number);
    overall = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  }
  const { data, error } = await supabase
    .from('interviews')
    .insert([{
      candidate_id,
      type,
      confidence: type === 'Mock' ? Number(confidence) : null,
      technical: type === 'Mock' ? Number(technical) : null,
      communication: type === 'Mock' ? Number(communication) : null,
      overall,
      notes: notes || null,
      recommendation: recommendation || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Offers ----------
export async function getOffers() {
  const { data, error } = await supabase
    .from('offers')
    .select('*, candidates ( name ), job_profiles ( title, company )');
  if (error) throw error;
  return data;
}

// Only candidates who currently have an application sitting in the given
// Pipeline stage (e.g. 'Aptitude', 'GD', 'Interview'). Used to keep the
// candidate dropdowns in those modules in sync with the Hiring Pipeline board.
export async function getCandidatesByStage(stage) {
  const { data, error } = await supabase
    .from('applications')
    .select('job_id, candidates ( id, name, email, college_id, colleges ( name ) )')
    .eq('stage', stage);
  if (error) throw error;

  const seen = new Map();
  (data || []).forEach((row) => {
    const c = row.candidates;
    if (c && !seen.has(c.id)) seen.set(c.id, { ...c, job_id: row.job_id });
  });
  return Array.from(seen.values());
}

export async function addOffer({ candidate_id, job_id, ctc, status, sent_on }) {
  const { data, error } = await supabase
    .from('offers')
    .insert([{ candidate_id, job_id, ctc, status, sent_on: sent_on || null }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Joining Tracker ----------
export async function getJoiningStatus() {
  const { data, error } = await supabase
    .from('joining')
    .select(`
      id, status, joining_date,
      candidates ( name, resume_url, colleges ( name ) ),
      offers ( ctc, status, job_profiles ( title, company ) )
    `);
  if (error) throw error;
  return data;
}

// ---------- Call Records ----------
export async function getCallRecords() {
  const { data, error } = await supabase
    .from('call_records')
    .select('*')
    .order('call_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addCallRecord({ contact_name, organization, phone, entity_type, call_date, duration, status, notes }) {
  const { data, error } = await supabase
    .from('call_records')
    .insert([{ contact_name, organization, phone, entity_type, call_date: call_date || null, duration: duration ? Number(duration) : null, status, notes }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCallRecord(id, { contact_name, organization, phone, entity_type, call_date, duration, status, notes }) {
  const { data, error } = await supabase
    .from('call_records')
    .update({ contact_name, organization, phone, entity_type, call_date: call_date || null, duration: duration ? Number(duration) : null, status, notes })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCallRecord(id) {
  const { error } = await supabase.from('call_records').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Communication CRM ----------
export async function getCommunications() {
  const { data, error } = await supabase
    .from('communications')
    .select('*, colleges ( name ), companies ( name )')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addCommunication({ entity_type, entity_id, type, note, date }) {
  const record = {
    college_id: entity_type === 'college' ? entity_id : null,
    company_id: entity_type === 'company' ? entity_id : null,
    type,
    note,
    date: date || null,
  };
  const { data, error } = await supabase
    .from('communications')
    .insert([record])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Reports & Analytics ----------
export async function getAllApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, stage, resume_score, created_at,
      candidates ( id, name, college_id, colleges ( id, name ) ),
      job_profiles ( id, title, company )
    `);
  if (error) throw error;
  return data;
}

export async function updateApplicationStage(applicationId, stage) {
  const { error } = await supabase
    .from('applications')
    .update({ stage })
    .eq('id', applicationId);
  if (error) throw error;
}

// ---------- Upcoming Drives ----------
export async function getUpcomingDrives(limit = 4) {
  const { data, error } = await supabase
    .from('drives')
    .select('*, colleges ( name ), job_profiles ( title, company )')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function addDrive({ title, type, scheduled_at, college_id, job_id, notes }) {
  const { data, error } = await supabase
    .from('drives')
    .insert([{
      title,
      type,
      scheduled_at,
      college_id: college_id || null,
      job_id: job_id || null,
      notes: notes || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDrive(id) {
  const { error } = await supabase.from('drives').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Student Portal (public, no login required) ----------
export async function uploadResume(file) {
  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function uploadPhoto(file) {
  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const { error: uploadError } = await supabase.storage.from('candidate-photos').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('candidate-photos').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function createCandidate({
  name, email, phone, college_id, college_other, resume_url, photo_url,
  degree, branch, cgpa, passing_year, active_backlogs, tenth_percentage, twelfth_percentage,
}) {
  const payload = {
    name, phone,
    college_id: college_id || null,
    college_other: college_other || null,
    resume_url, photo_url,
    degree: degree || null,
    branch: branch || null,
    cgpa: cgpa ? Number(cgpa) : null,
    passing_year: passing_year ? Number(passing_year) : null,
    active_backlogs: !!active_backlogs,
    tenth_percentage: tenth_percentage ? Number(tenth_percentage) : null,
    twelfth_percentage: twelfth_percentage ? Number(twelfth_percentage) : null,
  };

  const { data: existing, error: lookupError } = await supabase
    .from('candidates')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { data, error } = await supabase
      .from('candidates')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('candidates')
    .insert([{ ...payload, email }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function applyToJob({ candidate_id, job_id }) {
  const { data, error } = await supabase
    .from('applications')
    .insert([{ candidate_id, job_id, stage: 'Resume Review' }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateApplicationScore(applicationId, { resume_score, matched_skills, missing_skills }) {
  const { error } = await supabase
    .from('applications')
    .update({ resume_score, matched_skills, missing_skills })
    .eq('id', applicationId);
  if (error) throw error;
}

export async function getInteractions() {
  const { data, error } = await supabase
    .from('interactions')
    .select('*, colleges ( name )')
    .order('interaction_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInteraction(payload) {
  const { data, error } = await supabase
    .from('interactions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCompanyNames() {
  const { data, error } = await supabase
    .from('job_profiles')
    .select('company');
  if (error) throw error;
  // distinct, non-empty
  return [...new Set((data || []).map((j) => j.company).filter(Boolean))].sort();
}

export async function generateAptitudeTest({ job_id, difficulty, question_count }) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aptitude/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id, difficulty, question_count }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate test');
  return data;
}

export async function sendAptitudeInvite({ candidate_id, job_id, questions, difficulty }) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aptitude/send-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id, job_id, questions, difficulty }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send test invite');
  return data;
}

export async function getAptitudeTestByToken(token) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aptitude/take/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load test');
  return data;
}

export async function submitAptitudeTest(token, answers) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aptitude/submit/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit test');
  return data;
}

export async function generateJD({ prompt, company }) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jd/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, company }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate JD');
  return data.jd;
}

export async function addManualGDResult(data) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/gd/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to save GD result');
  return result;
}

export async function getCandidatesInEmailPhase(phase) {
  const { data, error } = await supabase
    .from('applications')
    .select('id, stage, candidates(name, email)')
    .eq('stage', phase);
  if (error) throw error;
  return data;
}

export async function logCall(data) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to log call');
  return result;
}

export async function getRecruiterPerformance() {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/calls/performance`);
  if (!res.ok) throw new Error('Failed to load recruiter performance');
  return res.json();
}

export async function getCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select(`
      id, name, email, phone, photo_url, resume_url,
      degree, branch, cgpa, passing_year, active_backlogs,
      tenth_percentage, twelfth_percentage,
      college_id, college_other, colleges ( name )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCorporateCandidates() {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/corporate/candidates`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load candidates');
  return data;
}

export async function getCorporateKpis() {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/corporate/kpis`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load KPIs');
  return data;
}