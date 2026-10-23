import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { generateJD, addJob, updateJob, deleteJob } from '../lib/api';

const IN_HOUSE_COMPANY = 'Talent Corner';
const NEW_COMPANY_VALUE = '__new__';

const emptyForm = {
  title: '', company: '', location: '', salary_range: '', experience: '', skills: '',
  job_summary: '', responsibilities: '', qualification: '', employment_type: '', reporting_to: '',
};

function JobCard({ job, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="jd-card panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {job.company && <span className="co">{job.company}</span>}
        {job.employment_type && (
          <span
            style={{
              fontSize: 11, fontWeight: 600, color: '#8a6d3b', background: '#f6ecd9',
              border: '1px solid #e7d3ab', borderRadius: 999, padding: '2px 9px',
            }}
          >
            {job.employment_type}
          </span>
        )}
      </div>

      <h3 style={{ fontWeight: 700, margin: '8px 0 2px' }}>{job.title}</h3>
      {job.location && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{job.location}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '10px 0' }}>
        {job.salary_range && (
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 6 }}>Salary:-</span>
            <span style={{ color: 'var(--text-secondary)' }}>{job.salary_range}</span>
          </div>
        )}
        {job.experience && (
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 6 }}>Experience:-</span>
            <span style={{ color: 'var(--text-secondary)' }}>{job.experience}</span>
          </div>
        )}
        {job.qualification && (
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 6 }}>Qualification:-</span>
            <span style={{ color: 'var(--text-secondary)' }}>{job.qualification}</span>
          </div>
        )}
        {job.reporting_to && (
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 6 }}>Reporting To:-</span>
            <span style={{ color: 'var(--text-secondary)' }}>{job.reporting_to}</span>
          </div>
        )}
      </div>

      {(job.skills ?? []).length > 0 && (
        <div className="skills">
          {job.skills.map((s) => <span key={s}>{s}</span>)}
        </div>
      )}

      {(job.job_summary || job.responsibilities) && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: '#8a6d3b',
            }}
          >
            {expanded ? '– Hide full description' : '+ View full description'}
          </button>

          {expanded && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {job.job_summary && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Job Summary</div>
                  <div>{job.job_summary}</div>
                </div>
              )}
              {job.responsibilities && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Key Responsibilities</div>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {job.responsibilities.split(';').map((r) => r.trim()).filter(Boolean).map((r, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onEdit(job)}>Edit</button>
        <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12, color: 'crimson' }} onClick={() => onDelete(job.id, job.title)}>Delete</button>
      </div>
    </div>
  );
}

export default function Jobs({ user }) {
  const [userProfile, setUserProfile] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Companies for the dropdown, loaded from the `companies` table.
  const [companyOptions, setCompanyOptions] = useState([]);
  const [companySelect, setCompanySelect] = useState(''); // dropdown value
  const [newCompanyName, setNewCompanyName] = useState(''); // shown when "Add new company" chosen

  const [showAIGen, setShowAIGen] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiCompany, setAiCompany] = useState('');
  const [aiSkills, setAiSkills] = useState('');
  const [aiExperience, setAiExperience] = useState('');
  const [aiLocation, setAiLocation] = useState('');
  const [aiEmploymentType, setAiEmploymentType] = useState('');
  const [aiSalaryRange, setAiSalaryRange] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  async function loadJobs(profileParam) {
    const profile = profileParam || userProfile;
    setLoading(true);
    setError(null);

    if (profile?.role === 'corporate') {
      if (!profile.company_id) {
        setError('No company is linked to your corporate account. Please contact an administrator to link your company.');
        setJobs([]);
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('job_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (err) {
        console.error('Failed to load company jobs:', err);
        setError('Could not load job profiles for your company.');
      } else {
        setJobs(data ?? []);
      }
    } else {
      // Admin / recruiter: see all companies' jobs
      const { data, error: err } = await supabase
        .from('job_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) {
        console.error('Failed to load jobs:', err);
        setError('Could not load job profiles. Check your Supabase connection.');
      } else {
        setJobs(data ?? []);
      }
    }
    setLoading(false);
  }

  async function loadCompanyOptions(profileParam) {
    const profile = profileParam || userProfile;
    if (profile?.role === 'corporate' && profile.company_id) {
      setCompanyOptions([{ id: profile.company_id, name: profile.company_name || 'My Company' }]);
      return;
    }

    const { data, error: err } = await supabase.from('companies').select('id, name').order('name');
    if (!err) setCompanyOptions(data ?? []);
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      setLoading(true);
      setError(null);

      // Verify authenticated user from Supabase session
      let activeUserId = user?.id;
      if (!activeUserId) {
        const { data: authData } = await supabase.auth.getUser();
        activeUserId = authData?.user?.id;
      }

      let verifiedProfile = null;
      if (activeUserId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, email, name, role, company_id')
          .eq('id', activeUserId)
          .single();

        if (prof) {
          verifiedProfile = prof;
          if (prof.company_id) {
            const { data: comp } = await supabase
              .from('companies')
              .select('id, name')
              .eq('id', prof.company_id)
              .maybeSingle();
            verifiedProfile.company_name = comp?.name || null;
          }
        }
      }

      if (ignore) return;

      setUserProfile(verifiedProfile);

      if (verifiedProfile?.role === 'corporate') {
        setAiCompany(verifiedProfile.company_name || '');
      }

      await loadJobs(verifiedProfile);
      await loadCompanyOptions(verifiedProfile);
    }

    init();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep the dropdown + "new company" text field in sync with form.company
  // whenever the form is opened for add/edit.
  function syncCompanySelectFromForm(companyValue) {
    if (userProfile?.role === 'corporate') {
      setCompanySelect(userProfile.company_name || companyValue || '');
      setNewCompanyName('');
      return;
    }

    if (!companyValue || companyValue === IN_HOUSE_COMPANY) {
      setCompanySelect(companyValue === IN_HOUSE_COMPANY ? IN_HOUSE_COMPANY : '');
      setNewCompanyName('');
      return;
    }
    const match = companyOptions.find((c) => c.name === companyValue);
    if (match) {
      setCompanySelect(companyValue);
      setNewCompanyName('');
    } else {
      setCompanySelect(NEW_COMPANY_VALUE);
      setNewCompanyName(companyValue);
    }
  }

  function startEdit(j) {
    setEditingId(j.id);
    const coName = userProfile?.role === 'corporate' ? (userProfile.company_name || j.company || '') : (j.company || '');
    setForm({
      title: j.title || '',
      company: coName,
      location: j.location || '',
      salary_range: j.salary_range || '',
      experience: j.experience || '',
      skills: (j.skills || []).join(', '),
      job_summary: j.job_summary || '',
      responsibilities: j.responsibilities || '',
      qualification: j.qualification || '',
      employment_type: j.employment_type || '',
      reporting_to: j.reporting_to || '',
    });
    syncCompanySelectFromForm(coName);
    setShowForm(true);
  }

  function startAdd() {
    setEditingId(null);
    const defaultCo = userProfile?.role === 'corporate' ? (userProfile.company_name || '') : '';
    setForm({
      ...emptyForm,
      company: defaultCo,
    });
    setCompanySelect(defaultCo);
    setNewCompanyName('');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setCompanySelect('');
    setNewCompanyName('');
  }

  // Dropdown change handler: keeps form.company in sync
  function handleCompanySelectChange(value) {
    if (userProfile?.role === 'corporate') return; // Locked for corporate users
    setCompanySelect(value);
    if (value === NEW_COMPANY_VALUE) {
      setForm((f) => ({ ...f, company: newCompanyName }));
    } else {
      setNewCompanyName('');
      setForm((f) => ({ ...f, company: value }));
    }
  }

  function handleNewCompanyNameChange(value) {
    if (userProfile?.role === 'corporate') return;
    setNewCompanyName(value);
    setForm((f) => ({ ...f, company: value }));
  }

  async function handleSaveJob(e) {
    e.preventDefault();

    if (userProfile?.role === 'corporate' && !userProfile.company_id) {
      alert('Your corporate account does not have a linked company. Please contact an admin.');
      return;
    }

    const companyToSave = userProfile?.role === 'corporate'
      ? (userProfile.company_name || form.company.trim())
      : form.company.trim();

    if (!companyToSave) {
      alert('Please select or enter a company (choose "Talent Corner (In-house)" for internal roles).');
      return;
    }

    setSaving(true);

    const skillsArray = form.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let targetCompanyId = null;
    if (userProfile?.role === 'corporate') {
      targetCompanyId = userProfile.company_id;
    } else {
      const match = companyOptions.find(
        (c) => c.name.toLowerCase() === companyToSave.toLowerCase()
      );
      if (match) targetCompanyId = match.id;
    }

    const payload = {
      title: form.title.trim(),
      company: companyToSave,
      company_id: targetCompanyId,
      location: form.location,
      salary_range: form.salary_range,
      experience: form.experience,
      skills: skillsArray,
      job_summary: form.job_summary || null,
      responsibilities: form.responsibilities || null,
      qualification: form.qualification || null,
      employment_type: form.employment_type || null,
      reporting_to: form.reporting_to || null,
    };

    // If an admin typed a brand-new company name, add it to companies table
    if (userProfile?.role !== 'corporate' && companySelect === NEW_COMPANY_VALUE && newCompanyName.trim()) {
      const exists = companyOptions.some(
        (c) => c.name.toLowerCase() === newCompanyName.trim().toLowerCase(),
      );
      if (!exists) {
        const { data: createdCo, error: coErr } = await supabase
          .from('companies')
          .insert([{ name: newCompanyName.trim() }])
          .select()
          .single();
        if (coErr) {
          console.warn('Could not add new company to companies table:', coErr.message);
        } else if (createdCo) {
          payload.company_id = createdCo.id;
          await loadCompanyOptions(userProfile);
        }
      }
    }

    try {
      if (editingId) {
        await updateJob(editingId, payload);
      } else {
        await addJob(payload);
      }
      cancelForm();
      await loadJobs(userProfile);
    } catch (err) {
      console.error('Failed to save job:', err);
      alert(err.message || 'Could not save job profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteJob(id, title) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteJob(id);
      await loadJobs(userProfile);
    } catch (err) {
      console.error('Failed to delete job:', err);
      alert(err.message || 'Could not delete job profile.');
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const mapped = rows.map((r) => ({
        title: r.title || r.Title || r.role || r.Role || '',
        // Import rows without a company are treated as in-house rather than
        // silently going NULL, matching how the manual form now behaves.
        company: r.company || r.Company || IN_HOUSE_COMPANY,
        location: r.location || r.Location || '',
        salary_range: r.salary_range || r['Salary Range'] || r['Salary range'] || r.salary || '',
        experience: r.experience || r.Experience || '',
        skills: r.skills || r.Skills || r['Core Skills'] || '',
        job_summary: r.job_summary || r['Job Summary'] || '',
        responsibilities: r.responsibilities || r['Key Responsibilities'] || r.Responsibilities || '',
        qualification: r.qualification || r.Qualification || '',
        employment_type: r.employment_type || r['Employment Type'] || '',
        reporting_to: r.reporting_to || r['Reporting To'] || '',
      })).filter((r) => r.title);
      setImportRows(mapped);
    };
    reader.readAsBinaryString(file);
  }

  async function handleConfirmImport() {
    if (!importRows || importRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;

    const isCorp = userProfile?.role === 'corporate';
    const corpCompanyId = isCorp ? userProfile.company_id : null;
    const corpCompanyName = isCorp ? (userProfile.company_name || 'Corporate') : null;

    for (const row of importRows) {
      const skillsArray = (row.skills || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const targetCompany = corpCompanyName || row.company || IN_HOUSE_COMPANY;
      let targetCompanyId = corpCompanyId;
      if (!isCorp && !targetCompanyId) {
        const match = companyOptions.find(
          (c) => c.name.toLowerCase() === targetCompany.toLowerCase()
        );
        if (match) targetCompanyId = match.id;
      }

      const { error: insErr } = await supabase.from('job_profiles').insert([{
        title: row.title,
        company: targetCompany,
        company_id: targetCompanyId,
        location: row.location || null,
        salary_range: row.salary_range || null,
        experience: row.experience || null,
        skills: skillsArray,
        job_summary: row.job_summary || null,
        responsibilities: row.responsibilities || null,
        qualification: row.qualification || null,
        employment_type: row.employment_type || null,
        reporting_to: row.reporting_to || null,
      }]);
      if (insErr) failed += 1; else success += 1;
    }
    setImporting(false);
    setImportResult({ success, failed });
    setImportRows(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadJobs(userProfile);
  }

  async function handleGenerateJD() {
    if (!aiTitle.trim()) {
      setGenError('Please enter a job title');
      return;
    }
    setGenError('');
    setGenerating(true);
    try {
      // Backend still takes a single prompt string, so we compose one from
      // the structured fields the user filled in - AI drafts the rest
      // (summary, responsibilities, qualification) from these details.
      const parts = [`Job title: ${aiTitle.trim()}`];
      if (aiSkills.trim()) parts.push(`Key skills required: ${aiSkills.trim()}`);
      if (aiExperience.trim()) parts.push(`Experience level: ${aiExperience.trim()}`);
      if (aiLocation.trim()) parts.push(`Location: ${aiLocation.trim()}`);
      if (aiEmploymentType.trim()) parts.push(`Employment type: ${aiEmploymentType.trim()}`);
      if (aiSalaryRange.trim()) parts.push(`Salary range: ${aiSalaryRange.trim()}`);
      const composedPrompt = parts.join('. ') + '.';

      const jd = await generateJD({ prompt: composedPrompt, company: aiCompany });
      const resolvedCompany = aiCompany.trim() || IN_HOUSE_COMPANY;
      setForm({
        title: jd.title || aiTitle.trim(),
        company: resolvedCompany,
        location: jd.location || aiLocation || '',
        salary_range: jd.salary_range || aiSalaryRange || '',
        experience: jd.experience || aiExperience || '',
        skills: (jd.skills || []).join(', ') || aiSkills,
        job_summary: jd.job_summary || '',
        responsibilities: jd.responsibilities || '',
        qualification: jd.qualification || '',
        employment_type: jd.employment_type || aiEmploymentType || '',
        reporting_to: '',
      });
      syncCompanySelectFromForm(resolvedCompany);
      setShowAIGen(false);
      setEditingId(null);
      setShowForm(true);
      setAiTitle('');
      setAiCompany('');
      setAiSkills('');
      setAiExperience('');
      setAiLocation('');
      setAiEmploymentType('');
      setAiSalaryRange('');
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function cancelImport() {
    setImportRows(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="page active" id="page-jobs">
      <div className="page-head">
        <div>
          <h1>Job Profiles / JD</h1>
          <p>
            {loading
              ? 'Loading…'
              : userProfile?.role === 'corporate'
                ? `${jobs.length} active job profiles for ${userProfile.company_name || 'your company'}`
                : `${jobs.length} active job descriptions across in-house and corporate`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button className="btn-outline" onClick={() => fileInputRef.current.click()}>Import Excel</button>
          <button className="btn-outline" onClick={() => setShowAIGen((v) => !v)}>
            {showAIGen ? 'Cancel' : '✨ Generate with AI'}
          </button>
          <button className="btn-gold" onClick={startAdd}>+ Create Job Profile</button>
        </div>
      </div>

      {error && <div className="panel" style={{ color: 'crimson', borderLeft: '4px solid crimson' }}>{error}</div>}
      {showAIGen && (
        <div className="panel">
          <div className="panel-title">✨ Generate Job Description with AI</div>
          <p className="panel-sub">Fill in the key details, and AI will draft the full JD (summary, responsibilities, qualification) for you to review and edit.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Job Title *</label>
              <input
                className="search-box" style={{ width: '100%' }}
                placeholder="e.g. Business Development Engineer"
                value={aiTitle} onChange={(e) => setAiTitle(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Company</label>
              {userProfile?.role === 'corporate' ? (
                <div
                  className="search-box"
                  style={{
                    width: '100%',
                    background: 'var(--bg-card, #f8f9fa)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 10px',
                  }}
                >
                  🏢 {userProfile.company_name || 'Your Company'}
                </div>
              ) : (
                <input
                  className="search-box" style={{ width: '100%' }}
                  placeholder="e.g. TCS"
                  value={aiCompany} onChange={(e) => setAiCompany(e.target.value)}
                />
              )}
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Key Skills</label>
              <input
                className="search-box" style={{ width: '100%' }}
                placeholder="e.g. Sales, Communication, CRM"
                value={aiSkills} onChange={(e) => setAiSkills(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Experience</label>
              <input
                className="search-box" style={{ width: '100%' }}
                placeholder="e.g. 2-4 years"
                value={aiExperience} onChange={(e) => setAiExperience(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Location</label>
              <input
                className="search-box" style={{ width: '100%' }}
                placeholder="e.g. Mumbai"
                value={aiLocation} onChange={(e) => setAiLocation(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Employment Type</label>
              <select
                className="search-box" style={{ width: '100%' }}
                value={aiEmploymentType} onChange={(e) => setAiEmploymentType(e.target.value)}
              >
                <option value="">— Select —</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Internship">Internship</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Salary Range</label>
              <input
                className="search-box" style={{ width: '100%' }}
                placeholder="e.g. 4-6 LPA"
                value={aiSalaryRange} onChange={(e) => setAiSalaryRange(e.target.value)}
              />
            </div>
          </div>
          {genError && <p style={{ color: 'var(--danger, crimson)', fontSize: 12.5, marginTop: 10 }}>{genError}</p>}
          <button className="btn-primary" style={{ marginTop: 14 }} disabled={generating} onClick={handleGenerateJD}>
            {generating ? 'Generating…' : 'Generate JD'}
          </button>
        </div>
      )}

      {importResult && (
        <div className="panel">
          <p>Import done: {importResult.success} added, {importResult.failed} failed.</p>
          <button className="btn-outline" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      {importRows && (
        <div className="panel">
          <div className="panel-title">Preview — {importRows.length} rows found</div>
          <table>
            <tbody>
              <tr><th>Title</th><th>Company</th><th>Qualification</th><th>Experience</th></tr>
              {importRows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td><td>{r.company}</td><td>{r.qualification}</td><td>{r.experience}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {importRows.length > 10 && <p>...and {importRows.length - 10} more rows</p>}
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Rows without a company will be imported as "{IN_HOUSE_COMPANY}" (In-house).
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-gold" onClick={handleConfirmImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${importRows.length} Job Profiles`}
            </button>
            <button className="btn-outline" onClick={cancelImport}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid3">
        {loading ? (
          <div className="panel">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="panel">No job profiles found.</div>
        ) : (
          jobs.map((j) => (
            <JobCard key={j.id} job={j} onEdit={startEdit} onDelete={handleDeleteJob} />
          ))
        )}
      </div>

      {showForm && (
        <div
          onClick={cancelForm}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{ maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="panel-title" style={{ margin: 0 }}>{editingId ? 'Edit Job Profile' : 'Create Job Profile'}</div>
              <button onClick={cancelForm} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <form onSubmit={handleSaveJob} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <input
                className="search-box" placeholder="Job title" required
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              {/* Company selection: locked for corporate users, dropdown for staff */}
              {userProfile?.role === 'corporate' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    className="search-box"
                    style={{
                      background: 'var(--bg-card, #f8f9fa)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 10px',
                    }}
                  >
                    🏢 {userProfile.company_name || form.company || 'Your Company'}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Locked to your verified company profile
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select
                    className="search-box"
                    required
                    value={companySelect}
                    onChange={(e) => handleCompanySelectChange(e.target.value)}
                  >
                    <option value="" disabled>— Select company —</option>
                    <option value={IN_HOUSE_COMPANY}>Talent Corner (In-house)</option>
                    {companyOptions
                      .filter((c) => c.name !== IN_HOUSE_COMPANY)
                      .map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    <option value={NEW_COMPANY_VALUE}>+ Add new company…</option>
                  </select>
                  {companySelect === NEW_COMPANY_VALUE && (
                    <input
                      className="search-box"
                      placeholder="New company name (e.g. TCS)"
                      required
                      value={newCompanyName}
                      onChange={(e) => handleNewCompanyNameChange(e.target.value)}
                    />
                  )}
                </div>
              )}

              <input
                className="search-box" placeholder="Location (e.g. Pan India, Pune)"
                value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <input
                className="search-box" placeholder="Salary range (e.g. ₹3.6–4.5 LPA)"
                value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
              />
              <input
                className="search-box" placeholder="Experience (e.g. Freshers, 0–1 yrs)"
                value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })}
              />
              <input
                className="search-box" placeholder="Skills (comma separated)"
                value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
              <input
                className="search-box" placeholder="Qualification"
                value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              />
              <input
                className="search-box" placeholder="Employment Type (e.g. Full-Time)"
                value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
              />
              <input
                className="search-box" placeholder="Reporting To"
                value={form.reporting_to} onChange={(e) => setForm({ ...form, reporting_to: e.target.value })}
              />
              <textarea
                className="search-box" placeholder="Job Summary" style={{ gridColumn: '1 / -1', minHeight: 60 }}
                value={form.job_summary} onChange={(e) => setForm({ ...form, job_summary: e.target.value })}
              />
              <textarea
                className="search-box" placeholder="Key Responsibilities" style={{ gridColumn: '1 / -1', minHeight: 80 }}
                value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn-gold" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Update Job Profile' : 'Save Job Profile'}
                </button>
                <button className="btn-outline" type="button" onClick={cancelForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}