import { useEffect, useState, useMemo } from 'react';
import { getPublicJobs, getColleges, uploadResume, uploadPhoto, createCandidate, applyToJob, updateApplicationScore, computeMatchScore } from '../lib/api';
import { extractPdfText, scoreResume } from '../lib/resumeScoring';
import CollegeAutocomplete from './CollegeAutocomplete';
import SaarthiLogo from '../components/SaarthiLogo';
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
    getPublicJobs().then(setJobs).catch(() => {});
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

  function processPhotoFile(f) {
    if (!f) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type) && !f.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP) for the photo.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError('Photo size must be under 2MB. Please choose a smaller image.');
      return;
    }
    setError('');
    setPhoto(f);
  }

  function handlePhotoChange(e) {
    const f = e.target.files?.[0];
    if (f) processPhotoFile(f);
    e.target.value = '';
  }

  function handleRemovePhoto() {
    setPhoto(null);
    const input = document.getElementById('photo-input');
    if (input) input.value = '';
  }

  function processResumeFile(f) {
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Please upload your resume in PDF format (.pdf).');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Resume file size exceeds 5MB limit. Please compress your PDF or choose a smaller file.');
      return;
    }
    setError('');
    setFile(f);
  }

  function handleResumeChange(e) {
    const f = e.target.files?.[0];
    if (f) processResumeFile(f);
    e.target.value = '';
  }

  function handleRemoveResume() {
    setFile(null);
    const input = document.getElementById('resume-input');
    if (input) input.value = '';
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setError('');

    // Mandatory validations
    if (!form.name.trim()) { setError('Full Name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!isValidEmail(form.email)) { setError('Please enter a valid email address.'); return; }
    if (form.phone && form.phone.length !== 10) { setError('Phone number must be exactly 10 digits.'); return; }
    if (!form.degree) { setError('Please select your degree.'); return; }
    if (!form.branch.trim()) { setError('Branch / Specialization is required.'); return; }
    if (!form.cgpa || isNaN(Number(form.cgpa))) { setError('Valid CGPA or percentage is required.'); return; }
    if (!form.passing_year || isNaN(Number(form.passing_year))) { setError('Valid passing year is required.'); return; }
    if (!file) { setError('Please upload your resume (PDF only, max 5MB).'); return; }

    setLoading(true);
    try {
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to submit registration. Please check your files and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(job) {
    setApplyingJobId(job.id);
    try {
      let currentCandidateId = candidateId;

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
      alert('Could not apply: ' + (err.message || 'Unknown error'));
    } finally {
      setApplyingJobId(null);
    }
  }

  const getPhotoUrl = () => {
    if (!photo) return null;
    return URL.createObjectURL(photo);
  };

  const filterSelectStyle = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    color: '#334155',
    background: '#ffffff',
    cursor: 'pointer',
    outline: 'none',
  };

  // STEP 1: STUDENT REGISTRATION FORM
  if (step === 1) {
    return (
      <div className="student-apply-container">
        <style>{`
          .student-apply-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 16px;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            box-sizing: border-box;
          }
          .student-apply-card {
            background: #ffffff;
            border-radius: 16px;
            padding: 36px 36px;
            width: 100%;
            max-width: 820px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.1);
            box-sizing: border-box;
          }
          .student-section {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 22px;
            margin-bottom: 20px;
          }
          .student-section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #f1f5f9;
          }
          .student-badge {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #ede9fe;
            color: #6d28d9;
            font-size: 13px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .student-section-title {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
          }
          .student-section-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 2px 0 0;
          }
          .student-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
          .student-input {
            width: 100%;
            padding: 10px 13px;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            font-size: 13.5px;
            box-sizing: border-box;
            background: #ffffff;
            color: #0f172a;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .student-input:focus {
            border-color: #7c3aed;
            box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
          }
          .student-label {
            display: block;
            font-size: 12.5px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 5px;
          }
          .student-label-sub {
            font-size: 11px;
            font-weight: 500;
            color: #64748b;
          }
          @media (max-width: 640px) {
            .student-apply-card {
              padding: 22px 16px;
              border-radius: 12px;
            }
            .student-section {
              padding: 16px 14px;
            }
            .student-grid-2 {
              grid-template-columns: 1fr;
              gap: 12px;
            }
          }
        `}</style>

        <div className="student-apply-card">
          {/* Header Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <SaarthiLogo size={42} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b' }}>Saarthi Campus</div>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Student Application & Placement Portal
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
              Student Registration
            </h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Register your academic profile and upload your resume to discover and apply for campus recruitment opportunities.
            </p>
          </div>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '12px 16px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleFormSubmit}>
            {/* SECTION 1: PERSONAL DETAILS */}
            <div className="student-section">
              <div className="student-section-header">
                <div className="student-badge">1</div>
                <div>
                  <h2 className="student-section-title">Personal Details</h2>
                  <p className="student-section-subtitle">Basic contact information and student identification</p>
                </div>
              </div>

              <div className="student-grid-2">
                <div>
                  <label className="student-label">
                    Full Name *
                  </label>
                  <input
                    className="student-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div>
                  <label className="student-label">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    className="student-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="student@college.edu or personal email"
                    required
                  />
                </div>

                <div>
                  <label className="student-label">
                    Mobile Number <span className="student-label-sub">(Optional - 10 digits)</span>
                  </label>
                  <input
                    className="student-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                  />
                </div>

                {/* Profile Photo Upload */}
                <div>
                  <label className="student-label">
                    Profile Photo <span className="student-label-sub">(Optional - JPG, PNG or WebP, max 2MB)</span>
                  </label>
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />

                  {!photo ? (
                    <div
                      onClick={() => document.getElementById('photo-input').click()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '9px 14px',
                        border: '1.5px dashed #cbd5e1',
                        borderRadius: 8,
                        background: '#f8fafc',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                        height: 44,
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#faf5ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                    >
                      <span style={{ fontSize: 18 }}>📷</span>
                      <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                        Upload Profile Photo
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        background: '#ffffff',
                        height: 44,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <img
                          src={getPhotoUrl()}
                          alt="Preview"
                          onClick={() => window.open(getPhotoUrl(), '_blank')}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1px solid #8b5cf6',
                            cursor: 'zoom-in',
                            flexShrink: 0,
                          }}
                          title="Click to preview photo"
                        />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {photo.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => document.getElementById('photo-input').click()}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                          title="Replace photo"
                        >
                          🔄 Replace
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: '1px solid #fca5a5',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: EDUCATION */}
            <div className="student-section">
              <div className="student-section-header">
                <div className="student-badge">2</div>
                <div>
                  <h2 className="student-section-title">Education</h2>
                  <p className="student-section-subtitle">Academic background, institution, and performance</p>
                </div>
              </div>

              {/* College Picker */}
              <div style={{ marginBottom: 14 }}>
                <label className="student-label">
                  College / University <span className="student-label-sub">(Search campus directory or enter name)</span>
                </label>
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
                      className="student-input"
                      value={form.college_other}
                      onChange={(e) => setForm({ ...form, college_other: e.target.value })}
                      placeholder="Type your college or university name"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCollegeMode('search');
                        setForm({ ...form, college_other: '' });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#7c3aed',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '6px 0 0',
                        display: 'inline-block',
                      }}
                    >
                      ← Back to search directory
                    </button>
                  </div>
                )}
              </div>

              <div className="student-grid-2">
                <div>
                  <label className="student-label">
                    Degree *
                  </label>
                  <select
                    className="student-input"
                    value={form.degree}
                    onChange={(e) => setForm({ ...form, degree: e.target.value })}
                    required
                  >
                    <option value="">Select degree</option>
                    <option value="B.Tech">B.Tech</option>
                    <option value="BCA">BCA</option>
                    <option value="B.Sc">B.Sc</option>
                    <option value="MBA">MBA</option>
                    <option value="MCA">MCA</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="student-label">
                    Branch / Specialization *
                  </label>
                  <input
                    className="student-input"
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    placeholder="e.g. Computer Science, Information Technology"
                    required
                  />
                </div>

                <div>
                  <label className="student-label">
                    CGPA / Percentage *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="student-input"
                    value={form.cgpa}
                    onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
                    placeholder="e.g. 8.4 or 84"
                    required
                  />
                </div>

                <div>
                  <label className="student-label">
                    Passing Year *
                  </label>
                  <input
                    type="number"
                    className="student-input"
                    value={form.passing_year}
                    onChange={(e) => setForm({ ...form, passing_year: e.target.value })}
                    placeholder="e.g. 2026"
                    required
                  />
                </div>

                <div>
                  <label className="student-label">
                    10th Percentage <span className="student-label-sub">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="student-input"
                    value={form.tenth_percentage}
                    onChange={(e) => setForm({ ...form, tenth_percentage: e.target.value })}
                    placeholder="e.g. 85.5"
                  />
                </div>

                <div>
                  <label className="student-label">
                    12th Percentage / Diploma <span className="student-label-sub">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="student-input"
                    value={form.twelfth_percentage}
                    onChange={(e) => setForm({ ...form, twelfth_percentage: e.target.value })}
                    placeholder="e.g. 82.0"
                  />
                </div>
              </div>

              {/* Active Backlogs */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="backlogs"
                  checked={form.active_backlogs}
                  onChange={(e) => setForm({ ...form, active_backlogs: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
                />
                <label htmlFor="backlogs" style={{ fontSize: 13, color: '#334155', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                  I have active backlogs
                </label>
              </div>
            </div>

            {/* SECTION 3: PROFILE & SKILLS */}
            <div className="student-section">
              <div className="student-section-header">
                <div className="student-badge">3</div>
                <div>
                  <h2 className="student-section-title">Profile & Skills</h2>
                  <p className="student-section-subtitle">Highlight key skills for AI job matching and recruiter discovery</p>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="student-label">
                  Technical & Domain Skills <span className="student-label-sub">(Optional - comma separated)</span>
                </label>
                <input
                  className="student-input"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g. React, Node.js, Python, SQL, Machine Learning, Java"
                />
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  💡 Skills are evaluated by our AI matching engine against employer requirements.
                </div>
              </div>

              <div className="student-grid-2">
                <div>
                  <label className="student-label">
                    LinkedIn Profile <span className="student-label-sub">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    className="student-input"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                <div>
                  <label className="student-label">
                    GitHub / Portfolio <span className="student-label-sub">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    className="student-input"
                    value={form.github_url}
                    onChange={(e) => setForm({ ...form, github_url: e.target.value })}
                    placeholder="https://github.com/username"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: RESUME */}
            <div className="student-section">
              <div className="student-section-header">
                <div className="student-badge">4</div>
                <div>
                  <h2 className="student-section-title">Resume *</h2>
                  <p className="student-section-subtitle">Upload your latest PDF resume for automated parsing and match scoring</p>
                </div>
              </div>

              <input
                id="resume-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleResumeChange}
                style={{ display: 'none' }}
              />

              {!file ? (
                <div
                  onClick={() => document.getElementById('resume-input').click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      processResumeFile(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    padding: '28px 20px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: 12,
                    background: '#f8fafc',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#faf5ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Click to browse or drag & drop your resume
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Supported format: <strong style={{ color: '#475569' }}>PDF only (.pdf)</strong> · Max file size: <strong style={{ color: '#475569' }}>5 MB</strong>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 6, background: '#ede9fe', color: '#6d28d9', fontSize: 12, fontWeight: 600 }}>
                      Select PDF File *
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '16px 18px',
                    border: '1.5px solid #c4b5fd',
                    borderRadius: 12,
                    background: '#faf5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 200px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#7c3aed', flexShrink: 0 }}>
                      📄
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e1b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        <span style={{ color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '1px 8px', borderRadius: 12, fontSize: 11 }}>
                          ✓ Ready for AI match
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => document.getElementById('resume-input').click()}
                      style={{
                        padding: '7px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Replace PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveResume}
                      style={{
                        padding: '7px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 8,
                        border: '1px solid #fca5a5',
                        background: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Registration Data Privacy & Workflow Notice */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>🔒</span>
              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
                <strong style={{ color: '#1e293b' }}>Registration & Application Flow:</strong> Your academic profile and resume are securely verified and analyzed for campus placement opportunities. In the next step, you can explore matching jobs and apply with one click.
              </div>
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: 14.5,
                fontWeight: 700,
                borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? 'Uploading & Analyzing Resume…' : 'Continue to Job Openings →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // STEP 2: JOB OPENINGS & APPLICATIONS
  return (
    <div className="student-apply-container">
      <style>{`
        .student-apply-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
        }
        .student-apply-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 36px 36px;
          width: 100%;
          max-width: 880px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.1);
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .student-apply-card {
            padding: 22px 16px;
            border-radius: 12px;
          }
        }
      `}</style>

      <div className="student-apply-card">
        {/* Header Branding */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SaarthiLogo size={38} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#1e1b4b' }}>Saarthi Campus</div>
              <div style={{ fontSize: 10.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Positions</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Edit Profile & Resume
          </button>
        </div>

        {/* Success / Status Banner */}
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
              ✓ Welcome, {form.name.split(' ')[0]}! Your profile and resume are prepared.
            </div>
            <div style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>
              Browse matching roles below and click "Apply" on any position to submit your application.
            </div>
          </div>
          {pendingResumeUrl && (
            <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
              Resume Attached
            </span>
          )}
        </div>

        {/* Search & Filters */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by role title, keyword, or company…"
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 13.5,
            marginBottom: 12,
            boxSizing: 'border-box',
            outline: 'none',
          }}
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

        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
          {filteredJobs.length} role{filteredJobs.length !== 1 ? 's' : ''} available
        </p>

        {/* Jobs List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredJobs.map((j) => {
            const applied = appliedJobIds.includes(j.id);
            const scoring = scoringJobIds.includes(j.id);
            const isExpanded = expandedJobId === j.id;
            const responsibilities = (j.responsibilities || '').split(';').map((r) => r.trim()).filter(Boolean);
            const hasDetails = j.job_summary || responsibilities.length > 0 || j.qualification || (j.skills || []).length > 0;
            const isBusy = applyingJobId === j.id;

            return (
              <div key={j.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: '#0f172a', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                      <strong style={{ color: '#334155' }}>{j.company}</strong>{j.location ? ` · 📍 ${j.location}` : ''}{j.salary_range ? ` · 💰 ${j.salary_range}` : ''}
                    </div>
                    {scoring && <div style={{ fontSize: 11.5, color: '#B8894A', marginTop: 4 }}>Analyzing your resume…</div>}
                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => setExpandedJobId(isExpanded ? null : j.id)}
                        style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
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
                        minWidth: 120,
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: applied ? '1px solid #e2e8f0' : 'none',
                        background: applied ? '#f1f5f9' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
                        color: applied ? '#64748b' : '#ffffff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: applied || isBusy ? 'default' : 'pointer',
                        boxShadow: applied ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.25)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {applied ? 'Applied ✓' : isBusy ? 'Applying…' : 'Apply Now'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                    {j.job_summary && <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.6, marginBottom: 10 }}>{j.job_summary}</p>}
                    {responsibilities.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Key responsibilities</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#334155', lineHeight: 1.6 }}>
                          {responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {j.qualification && (
                      <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 8 }}><strong>Qualification: </strong>{j.qualification}</div>
                    )}
                    {(j.skills || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {j.skills.map((s) => (
                          <span key={s} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {jobs.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>No open campus positions right now — check back later.</p>}
          {jobs.length > 0 && filteredJobs.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>No roles match your filters.</p>}
        </div>
      </div>
    </div>
  );
}
