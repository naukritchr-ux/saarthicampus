import { supabase } from './supabaseClient';
export async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
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

export async function getPublicJobs() {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/public`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load open positions');
  return data;
}

export async function addJob(jobData) {
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(jobData),
      });
      const data = await res.json();
      if (res.ok && data.job) return data.job;
      if (!res.ok) throw new Error(data.error || 'Failed to add job');
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('fetch')) throw err;
  }

  const payload = {
    ...jobData,
    skills: Array.isArray(jobData.skills)
      ? jobData.skills
      : (jobData.skills ? jobData.skills.split(',').map((s) => s.trim()).filter(Boolean) : []),
  };
  const { data, error } = await supabase
    .from('job_profiles')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(id, jobData) {
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(jobData),
      });
      const data = await res.json();
      if (res.ok && data.job) return data.job;
      if (!res.ok) throw new Error(data.error || 'Failed to update job');
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('fetch')) throw err;
  }

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
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) return;
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete job');
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('fetch')) throw err;
  }

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

// ---------- Student Portal & Document Security ----------
export function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return 'file_' + Date.now();
  const base = name.replace(/^.*[\\/]/, '').replace(/\0/g, '');
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.slice(-80) || 'file_' + Date.now();
}

export function validateUploadFile(file, { allowedTypes, maxSize, typeLabel = 'File' }) {
  if (!file) throw new Error(`${typeLabel} is required`);
  if (file.size > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    throw new Error(`${typeLabel} size exceeds ${maxMb}MB limit`);
  }
  if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type for ${typeLabel.toLowerCase()}. Supported formats: ${allowedTypes.map((t) => t.split('/')[1] || t).join(', ')}`);
  }
}

export async function uploadResume(file) {
  validateUploadFile(file, {
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 5 * 1024 * 1024,
    typeLabel: 'Resume',
  });
  const safeName = sanitizeFileName(file.name);
  const fileName = `${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function uploadPhoto(file) {
  validateUploadFile(file, {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 2 * 1024 * 1024,
    typeLabel: 'Photo',
  });
  const safeName = sanitizeFileName(file.name);
  const fileName = `${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from('candidate-photos').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('candidate-photos').getPublicUrl(fileName);
  return data.publicUrl;
}

// In-memory cache for short-lived signed URLs to avoid re-fetching on every re-render
const MAX_SIGNED_URL_CACHE_SIZE = 300;
const signedUrlCache = new Map();

/**
 * Clears the in-memory signed URL cache. Called on sign-out and account changes.
 */
export function clearSignedUrlCache() {
  signedUrlCache.clear();
}

// Automatically clear cached signed URLs on sign-out or session identity change
if (typeof window !== 'undefined' && supabase?.auth?.onAuthStateChange) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      clearSignedUrlCache();
    }
  });
}

export async function getDocumentSignedUrl({ bucket, path, url }) {
  const headers = await authHeaders();
  let query;
  if (url) {
    query = `url=${encodeURIComponent(url)}`;
  } else if (bucket && path) {
    query = `bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
  } else {
    throw new Error('Either url or bucket and path must be provided');
  }
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/documents/signed-url?${query}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to retrieve signed URL');
  return data.signedUrl;
}

/**
 * Returns a cached signed URL for viewing an image/document or fetches a new one.
 * Avoids repeated network roundtrips on every component re-render.
 * Includes authenticated user ID in cache key to isolate caches across different users.
 * Fails closed (returns null) on error without falling back to raw public URL.
 */
export async function getCachedSignedUrl(url) {
  if (!url || typeof url !== 'string') return null;

  let userId = 'anonymous';
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) {
      userId = data.session.user.id;
    }
  } catch {
    // Treat as anonymous if session lookup fails
  }

  const cacheKey = `${userId}:${url}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.signedUrl;
  }

  try {
    const signedUrl = await getDocumentSignedUrl({ url });

    // Enforce cache size limit and prune expired entries
    if (signedUrlCache.size >= MAX_SIGNED_URL_CACHE_SIZE) {
      for (const [k, v] of signedUrlCache.entries()) {
        if (v.expiresAt <= now) signedUrlCache.delete(k);
      }
      if (signedUrlCache.size >= MAX_SIGNED_URL_CACHE_SIZE) {
        const oldestKey = signedUrlCache.keys().next().value;
        if (oldestKey) signedUrlCache.delete(oldestKey);
      }
    }

    // Cache for 10 minutes (backend signed URLs are valid for 15 minutes)
    signedUrlCache.set(cacheKey, { signedUrl, expiresAt: now + 10 * 60 * 1000 });
    return signedUrl;
  } catch (err) {
    console.warn('Could not retrieve secure document URL:', err.message || err);
    return null; // Fail closed: do not fall back to raw URL
  }
}

/**
 * Opens a document (resume, marksheet, KYC) in a new tab securely using a short-lived signed URL.
 * Fails closed if signed-URL generation fails (does NOT open raw public URL).
 */
export async function openSecureDocument(url) {
  if (!url) return;
  try {
    const signedUrl = await getDocumentSignedUrl({ url });
    window.open(signedUrl, '_blank', 'noreferrer');
  } catch (err) {
    console.error('Access denied or failed to retrieve secure document:', err);
    alert('Unable to open document: access denied or file unavailable.');
  }
}

/**
 * Updates an application document via secure backend endpoint with fallback to direct Supabase client.
 */
export async function updateApplicationDocument(applicationId, docKey, fileUrl) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/applications/${applicationId}/document`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ docKey, fileUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.application;
    }
  } catch (err) {
    console.warn('Backend application document update failed, attempting direct Supabase fallback:', err);
  }

  // Fallback to direct Supabase update
  const { data, error } = await supabase
    .from('applications')
    .update({
      [`${docKey}_url`]: fileUrl,
      [`${docKey}_status`]: 'Submitted',
    })
    .eq('id', applicationId);

  if (error) throw error;
  return data;
}

export async function createCandidate({
  name, email, phone, college_id, college_other, resume_url, photo_url,
  degree, branch, cgpa, passing_year, active_backlogs, tenth_percentage, twelfth_percentage,
  skills, linkedin_url, github_url,   // ⭐ NEW
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
    skills: skills && skills.length ? skills : null,        // ⭐ NEW
    linkedin_url: linkedin_url || null,                      // ⭐ NEW
    github_url: github_url || null,                          // ⭐ NEW
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
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aptitude/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job_id, difficulty, question_count }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate test');
  return data;
}

export async function sendAptitudeInvite({ candidate_id, job_id, questions, difficulty }) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/aptitude/send-invite`, {
    method: 'POST',
    headers,
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
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jd/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, company }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate JD');
  return data.jd;
}

export async function addManualGDResult(data) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/gd/manual`, {
    method: 'POST',
    headers,
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
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/calls`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to log call');
  return result;
}

export async function getRecruiterPerformance() {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/calls/performance`, { headers });
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

export async function saveCandidate(candidateId) {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/corporate/candidates/${candidateId}/save`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save candidate');
  return data;
}

export async function unsaveCandidate(candidateId) {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/corporate/candidates/${candidateId}/save`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unsave candidate');
  return data;
}

export async function searchCandidates(filters = {}) {
  let query = supabase
    .from('candidates')
    .select(`
      id, name, email, phone, cgpa, skills, resume_url,
      linkedin_url, github_url, degree, branch,
      college_id, college_other, colleges ( name, city )
    `);

  if (filters.name) query = query.ilike('name', `%${filters.name}%`);
  if (filters.degree) query = query.ilike('degree', `%${filters.degree}%`);
  if (filters.branch) query = query.ilike('branch', `%${filters.branch}%`);
  if (filters.minCgpa) query = query.gte('cgpa', Number(filters.minCgpa));

  const { data, error } = await query;
  if (error) throw error;

  // Get saved candidate ids for the logged-in company
  const { data: { user } } = await supabase.auth.getUser();
  let savedIds = new Set();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.company_id) {
      const { data: saved } = await supabase
        .from('saved_candidates')
        .select('candidate_id')
        .eq('company_id', profile.company_id);
      savedIds = new Set((saved || []).map((s) => s.candidate_id));
    }
  }

  let results = (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    college: c.colleges?.name || c.college_other || '—',
    location: c.colleges?.city || '—',
    degree: c.degree || '—',
    branch: c.branch || '—',
    cgpa: c.cgpa,
    skills: Array.isArray(c.skills) ? c.skills.join(', ') : (c.skills || ''),
    experience_years: null, // freshers — no experience tracked yet
    resume_url: c.resume_url,
    linkedin_url: c.linkedin_url,
    github_url: c.github_url,
    match: null, // wired up in AI Match Score step (Step 6)
    saved: savedIds.has(c.id),
  }));

  // Client-side filters for fields not directly queryable above
  if (filters.college) {
    const q = filters.college.toLowerCase();
    results = results.filter((c) => c.college.toLowerCase().includes(q));
  }
  if (filters.skills) {
    const q = filters.skills.toLowerCase();
    results = results.filter((c) => c.skills.toLowerCase().includes(q));
  }
  if (filters.location) {
    const q = filters.location.toLowerCase();
    results = results.filter((c) => c.location.toLowerCase().includes(q));
  }

  return results;
}

export async function getHiringAnalytics() {
  const headers = await authHeaders();
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/corporate/hiring-analytics`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load hiring analytics');
  return data;
}

// ---------- Job Match Score ----------
export function computeMatchScore(candidateSkills, jobSkills) {
  const normalize = (skills) => {
    if (!skills) return [];
    const arr = Array.isArray(skills) ? skills : skills.split(',');
    return arr.map((s) => s.trim().toLowerCase()).filter(Boolean);
  };
  const candSet = new Set(normalize(candidateSkills));
  const jobList = normalize(jobSkills);
  if (jobList.length === 0) return null;
  const matched = jobList.filter((s) => candSet.has(s));
  return Math.round((matched.length / jobList.length) * 100);
}