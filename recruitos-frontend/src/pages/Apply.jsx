import { useEffect, useState, useMemo } from 'react';
import { getJobs, getColleges, uploadResume, uploadPhoto, createCandidate, applyToJob, updateApplicationScore, computeMatchScore } from '../lib/api';
import { extractPdfText, scoreResume } from '../lib/resumeScoring';
import CollegeAutocomplete from './CollegeAutocomplete';
import { sanitizePhone } from '../lib/phone';
import { isValidEmail } from '../lib/email';

function normalizeEmploymentType(raw) {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t.includes('intern')) return 'Internship';
  if (t.includes('part')) return 'Part-Time';
  if (t.includes('contract')) return 'Contract';
  if (t.includes('full')) return 'Full-Time';
  return raw.trim();
}

export default function Apply() {
  const [step, setStep] = useState(1);
  const [colleges, setColleges] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidateId, setCandidateId] = useState(null);
  const [pendingResumeUrl, setPendingResumeUrl] = useState(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeExtractFailed, setResumeExtractFailed] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState([]);
  const [scoringJobIds, setScoringJobIds] = useState([]);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', college_id: '', college_other: '',
    degree: '', branch: '', cgpa: '', passing_year: '',
    active_backlogs: false, tenth_percentage: '', twelfth_percentage: '',
    skills: '', linkedin_url: '', github_url: '',
  });
  const [collegeMode, setCollegeMode] = useState('search');
  const [file, setFile] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applyingJobId, setApplyingJobId] = useState(null);

  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);

  useEffect(() => {
    getColleges().then(setColleges).catch(() => {});
    getJobs().then(setJobs).catch(() => {});
  }, []);

  const locationOptions = useMemo(
    () => ['all', ...new Set(jobs.map((j) => j.location).filter(Boolean))],
    [jobs]
  );
  const typeOptions = useMemo(
    () => ['all', ...new Set(jobs.map((j) => normalizeEmploymentType(j.employment_type)).filter(Boolean))],
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchesSearch = !q || j.title?.toLowerCase().includes(q);
      const matchesLocation = locationFilter === 'all' || j.location === locationFilter;
      const matchesExperience = experienceFilter === 'all' || (j.experience || '').toLowerCase().includes(experienceFilter);
      const matchesType = typeFilter === 'all' || normalizeEmploymentType(j.employment_type) === typeFilter;
      return matchesSearch && matchesLocation && matchesExperience && matchesType;
    });
  }, [jobs, search, locationFilter, experienceFilter, typeFilter]);

  function handlePhotoChange(e) {
    const f = e.target.files[0];
    if (!f) { setPhoto(null); return; }
    if (!f.type.startsWith('image/')) {
      setError('Please upload a valid image file for the photo.');
      e.target.value = '';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Photo size must be under 5MB.');
      e.target.value = '';
      return;
    }
    setError('');
    setPhoto(f);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    const input = document.getElementById('photo-input');
    if (input) input.value = '';
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setError('');
    if (!file) { setError('Please upload your resume (PDF).'); return; }
    if (!isValidEmail(form.email)) { setError('Please enter a valid email address.'); return; }
    if (form.phone && form.phone.length !== 10) { setError('Phone number must be exactly 10 digits.'); return; }
    setLoading(true);
    try {
      // NOTE: The candidate record is deliberately NOT created here.
      // We only upload the resume/photo and extract resume text (needed
      // for job match scoring on the next screen). The candidate is only
      // saved to the database once they actually apply to a job — see
      // handleApply below. This avoids saving "ghost" candidates who fill
      // in the form but never complete an application.
      let photo_url = null;
      if (photo) {
        photo_url = await uploadPhoto(photo);
      }

      const resume_url = await uploadResume(file);
      setPendingResumeUrl(resume_url);
      setPendingPhotoUrl(photo_url);

      try {
        const text = await extractPdfText(file);
        setResumeText(text);
      } catch (extractErr) {
        console.warn('Could not extract resume text, AI scoring will be skipped:', extractErr);
        setResumeExtractFailed(true);
      }

      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(job) {
    setApplyingJobId(job.id);
    try {
      let currentCandidateId = candidateId;

      // Create the candidate record only on the first successful apply.
      // Subsequent applies (to other jobs) reuse the same candidateId.
      if (!currentCandidateId) {
        const skillsArray = form.skills
          ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        const candidate = await createCandidate({
          ...form,
          skills: skillsArray,
          resume_url: pendingResumeUrl,
          photo_url: pendingPhotoUrl,
        });
        currentCandidateId = candidate.id;
        setCandidateId(currentCandidateId);
      }

      const application = await applyToJob({ candidate_id: currentCandidateId, job_id: job.id });
      setAppliedJobIds((prev) => [...prev, job.id]);

      if (resumeText) {
        setScoringJobIds((prev) => [...prev, job.id]);
        scoreResume(resumeText, job.skills, job.title)
          .then((result) =>
            updateApplicationScore(application.id, {
              resume_score: result.score,
              matched_skills: result.matched_skills,
              missing_skills: result.missing_skills,
              ai_status: 'Done',
            })
          )
          .catch((scoreErr) => {
            console.warn('AI scoring failed:', scoreErr);
            updateApplicationScore(application.id, {
              ai_status: 'Failed',
              ai_feedback: `Automated scoring failed: ${scoreErr.message}`,
            }).catch((e2) => console.error('Could not even update ai_status to Failed:', e2));
          })
          .finally(() => setScoringJobIds((prev) => prev.filter((id) => id !== job.id)));
      } else if (resumeExtractFailed) {
        updateApplicationScore(application.id, {
          ai_status: 'Failed',
          ai_feedback: 'Could not extract text from resume PDF (may be scanned/image-only).',
        }).catch((e) => console.error(e));
      }
    } catch (err) {
      alert('Could not apply: ' + err.message);
    } finally {
      setApplyingJobId(null);
    }
  }

  const getPhotoUrl = () => {
    if (!photo) return null;
    return URL.createObjectURL(photo);
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--cream, #f7f5f0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  };

  const cardStyle = {
    background: 'white',
    borderRadius: 16,
    padding: '40px 38px',
    width: '100%',
    maxWidth: step === 2 ? 720 : 480,
    border: '1px solid var(--line, #e5e5e5)',
    boxShadow: '0 8px 32px -8px rgba(10,12,18,0.12)',
  };

  const filterSelectStyle = {
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid var(--line, #e5e5e5)',
    fontSize: 12,
    color: '#444',
    background: 'white',
    cursor: 'pointer',
  };

  if (step === 1) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div className="brand-mark">R</div>
            <div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, color: 'var(--navy-deep)' }}>RecruitOS</div>
              <div style={{ fontSize: 10, color: 'var(--slate-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Candidate Application</div>
            </div>
          </div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, marginBottom: 4 }}>Apply for a Role</h2>
          <p style={{ fontSize: 12.5, color: 'var(--slate-light)', marginBottom: 24 }}>Fill in your details and upload your resume to get started.</p>

          <form onSubmit={handleFormSubmit}>
            <div className="field">
              <label>Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })}
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="field">
              <label>College</label>
              {collegeMode === 'search' ? (
                <CollegeAutocomplete
                  colleges={colleges}
                  value={form.college_id}
                  onChange={(id) => setForm({ ...form, college_id: id, college_other: '' })}
                  onCantFind={() => {
                    setCollegeMode('manual');
                    setForm({ ...form, college_id: '' });
                  }}
                />
              ) : (
                <div>
                  <input
                    value={form.college_other}
                    onChange={(e) => setForm({ ...form, college_other: e.target.value })}
                    placeholder="Type your college name"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCollegeMode('search');
                      setForm({ ...form, college_other: '' });
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#8B5CF6',
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      padding: '6px 0 0', display: 'block',
                    }}
                  >
                    ← Back to search
                  </button>
                </div>
              )}
            </div>

            <div className="field">
              <label>Degree *</label>
              <select value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} required>
                <option value="">Select degree</option>
                <option value="B.Tech">B.Tech</option>
                <option value="BCA">BCA</option>
                <option value="B.Sc">B.Sc</option>
                <option value="MBA">MBA</option>
                <option value="MCA">MCA</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="field">
              <label>Branch / Specialization *</label>
              <input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="e.g. Computer Science"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>CGPA / % *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.cgpa}
                  onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
                  placeholder="e.g. 8.2"
                  required
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Passing Year *</label>
                <input
                  type="number"
                  value={form.passing_year}
                  onChange={(e) => setForm({ ...form, passing_year: e.target.value })}
                  placeholder="e.g. 2026"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>10th %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.tenth_percentage}
                  onChange={(e) => setForm({ ...form, tenth_percentage: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>12th %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.twelfth_percentage}
                  onChange={(e) => setForm({ ...form, twelfth_percentage: e.target.value })}
                />
              </div>
            </div>

            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="backlogs"
                checked={form.active_backlogs}
                onChange={(e) => setForm({ ...form, active_backlogs: e.target.checked })}
                style={{ width: 'auto' }}
              />
              <label htmlFor="backlogs" style={{ margin: 0 }}>I have active backlogs</label>
            </div>

            <div className="field">
              <label>Profile Photo</label>
              <input id="photo-input" type="file" accept="image/*" onChange={handlePhotoChange} />
              {photo && (
                <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                  <img
                    src={getPhotoUrl()}
                    alt="Preview"
                    onClick={() => window.open(getPhotoUrl(), '_blank')}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid var(--line, #e5e5e5)',
                      cursor: 'zoom-in',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#d64545',
                      color: '#fff',
                      border: '2px solid #fff',
                      fontSize: 12,
                      lineHeight: '16px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="field">
              <label>Skills</label>
              <input
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="e.g. React, Node.js, Python (comma-separated)"
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>LinkedIn (optional)</label>
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>GitHub (optional)</label>
                <input
                  type="url"
                  value={form.github_url}
                  onChange={(e) => setForm({ ...form, github_url: e.target.value })}
                  placeholder="https://github.com/…"
                />
              </div>
            </div>

            <div className="field">
              <label>Resume (PDF) *</label>
              <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} required />
            </div>

            {error && <p style={{ color: 'var(--red, #d64545)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? 'Submitting…' : 'Continue to Job Openings'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="brand-mark">R</div>
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, color: 'var(--navy-deep)' }}>RecruitOS</div>
            <div style={{ fontSize: 10, color: 'var(--slate-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open Positions</div>
          </div>
        </div>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, marginBottom: 4 }}>Welcome, {form.name.split(' ')[0]}!</h2>
        <p style={{ fontSize: 12.5, color: 'var(--slate-light)', marginBottom: 18 }}>Browse open roles and apply directly.</p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by role title…"
          style={{ width: '100%', padding: '10px 13px', borderRadius: 8, border: '1px solid var(--line, #e5e5e5)', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={filterSelectStyle}>
            {locationOptions.map((l) => <option key={l} value={l}>{l === 'all' ? 'All locations' : l}</option>)}
          </select>
          <select value={experienceFilter} onChange={(e) => setExperienceFilter(e.target.value)} style={filterSelectStyle}>
            <option value="all">All experience</option>
            <option value="fresher">Freshers</option>
            <option value="1">1+ yrs</option>
            <option value="3">3+ yrs</option>
            <option value="5">5+ yrs</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={filterSelectStyle}>
            {typeOptions.map((t) => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
          </select>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--slate-light)', marginBottom: 10 }}>
          {filteredJobs.length} role{filteredJobs.length !== 1 ? 's' : ''} found
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredJobs.map((j) => {
            const applied = appliedJobIds.includes(j.id);
            const scoring = scoringJobIds.includes(j.id);
            const isExpanded = expandedJobId === j.id;
            const responsibilities = (j.responsibilities || '').split(';').map((r) => r.trim()).filter(Boolean);
            const hasDetails = j.job_summary || responsibilities.length > 0 || j.qualification || (j.skills || []).length > 0;
            const isBusy = applyingJobId === j.id;

            return (
              <div key={j.id} style={{ border: '1px solid #EEE', borderRadius: 12, padding: '16px 18px', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
<div style={{ fontWeight: 700, fontSize: 15, color: '#111', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 8 }}>
  {j.title}
  {(() => {
    const match = computeMatchScore(form.skills, j.skills);
    if (match === null) return null;
    const color = match >= 70 ? '#16A34A' : match >= 40 ? '#B8894A' : '#DC2626';
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${color}18`, color }}>
        {match}% Match
      </span>
    );
  })()}
</div>                    <div style={{ fontSize: 12, color: '#999', marginTop: 4, lineHeight: 1.6 }}>
                      {j.company}{j.location ? ` · ${j.location}` : ''}{j.salary_range ? ` · ${j.salary_range}` : ''}
                    </div>
                    {scoring && <div style={{ fontSize: 11, color: '#B8894A', marginTop: 4 }}>Analyzing your resume…</div>}
                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => setExpandedJobId(isExpanded ? null : j.id)}
                        style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>
                    )}
                  </div>

                  <div style={{ flex: '0 0 auto' }}>
                    <button
                      type="button"
                      disabled={applied || isBusy}
                      onClick={() => handleApply(j)}
                      style={{
                        width: 120,
                        padding: '10px 0',
                        borderRadius: 10,
                        border: applied ? '1px solid #EEE' : 'none',
                        background: applied ? '#FAFAFA' : 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                        color: applied ? '#AAA' : '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: applied || isBusy ? 'default' : 'pointer',
                        boxShadow: applied ? 'none' : '0 4px 14px rgba(139,92,246,0.3)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {applied ? 'Applied ✓' : isBusy ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F0F0' }}>
                    {j.job_summary && <p style={{ fontSize: 12.5, color: '#444', lineHeight: 1.6, marginBottom: 10 }}>{j.job_summary}</p>}
                    {responsibilities.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Key responsibilities</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#444', lineHeight: 1.6 }}>
                          {responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {j.qualification && (
                      <div style={{ fontSize: 12, color: '#444', marginBottom: 8 }}><strong>Qualification: </strong>{j.qualification}</div>
                    )}
                    {(j.skills || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {j.skills.map((s) => (
                          <span key={s} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#F5F0FF', color: '#8B5CF6', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {jobs.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: '32px 0' }}>No open positions right now — check back later.</p>}
          {jobs.length > 0 && filteredJobs.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: '32px 0' }}>No roles match your filters.</p>}
        </div>
      </div>
    </div>
  );
}