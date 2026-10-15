import { useEffect, useState } from 'react';
import { getInterviews, addInterview, getAllApplications, authHeaders } from '../lib/api';

export default function Interview() {
  const [interviews, setInterviews] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    candidate_id: '', type: 'Mock', confidence: '', technical: '', communication: '', notes: '', recommendation: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showLinks, setShowLinks] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [openLinkGroup, setOpenLinkGroup] = useState(null);
  const [openResultGroup, setOpenResultGroup] = useState(null);

  const [viewMode, setViewMode] = useState('inhouse');

  function loadAll() {
    setLoading(true);
    Promise.all([getInterviews(), getAllApplications()])
      .then(([i, a]) => { setInterviews(i); setApplications(a); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let ignore = false;
    async function init() {
      setLoading(true);
      try {
        const [i, a] = await Promise.all([getInterviews(), getAllApplications()]);
        if (!ignore) { setInterviews(i); setApplications(a); setError(''); }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.candidate_id) { setFormError('Candidate is required'); return; }
    setSaving(true);
    try {
      await addInterview(form);
      setForm({ candidate_id: '', type: 'Mock', confidence: '', technical: '', communication: '', notes: '', recommendation: '' });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function copyInterviewLink(app) {
    const candId = app.candidates?.id;
    const jobId = app.job_profiles?.id;
    if (!candId || !jobId) return;
    const link = `${window.location.origin}/interview/${candId}/${jobId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(app.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function sendInterviewEmail(app) {
    const candId = app.candidates?.id;
    const jobId = app.job_profiles?.id;
    if (!candId || !jobId) return;
    setSendingId(app.id);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ai-interview/send-invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ candidate_id: candId, job_id: jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send email');
      alert(`Interview link emailed to ${app.candidates?.name}!`);
    } catch (err) {
      alert('Could not send email: ' + err.message);
    } finally {
      setSendingId(null);
    }
  }

  function isInHouse(interview) {
    return Boolean(interview.candidates?.college_id || interview.candidates?.colleges?.name);
  }

  const inScope = interviews.filter((i) => (viewMode === 'inhouse' ? isInHouse(i) : !isInHouse(i)));
  const mockInterviews = inScope.filter((i) => i.type === 'Mock');
  const personalInterviews = inScope.filter((i) => i.type === 'HR');

  const inHouseCount = interviews.filter(isInHouse).length;
  const corporateCount = interviews.length - inHouseCount;

  function groupByCandidate(list, getCandidate) {
    const map = new Map();
    list.forEach((item) => {
      const cand = getCandidate(item);
      const key = cand?.id || cand?.name || 'unknown';
      if (!map.has(key)) map.set(key, { key, candidate: cand, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values());
  }

  const linkGroups = groupByCandidate(applications, (a) => a.candidates);
  // Only candidates the Pipeline board has moved into the "Interview" column
  // are offered in the "Add Interview" form — keeps this module in sync
  // with the pipeline stage.
  const interviewStageCandidates = groupByCandidate(
    applications.filter((a) => a.stage === 'Interview'),
    (a) => a.candidates
  ).map((g) => g.candidate).filter(Boolean);
  const mockGroups = groupByCandidate(mockInterviews, (i) => i.candidates);
  const personalGroups = groupByCandidate(personalInterviews, (i) => i.candidates);

  return (
    <div className="page active" id="page-interview">
      <div className="page-head">
        <div><h1>Interviews</h1><p>Mock Interview (AI) and Personal Interview (HR) stages</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" onClick={() => setShowLinks((v) => !v)}>
            {showLinks ? 'Hide' : '🔗'} AI Interview Links
          </button>
          <button className="btn-gold" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add Interview'}
          </button>
        </div>
      </div>

      <div className="mode-toggle" style={{ marginBottom: 20 }}>
        <button className={`mode-btn ${viewMode === 'inhouse' ? 'active' : ''}`} onClick={() => setViewMode('inhouse')}>
          🎓 In-house (Campus) · {inHouseCount}
        </button>
        <button className={`mode-btn ${viewMode === 'corporate' ? 'active' : ''}`} onClick={() => setViewMode('corporate')}>
          🏢 Corporate (Client) · {corporateCount}
        </button>
      </div>

      {showLinks && (
        <div className="panel">
          <div className="panel-title">🤖 Send AI Interview</div>
          <div className="panel-sub">Pick a candidate, then copy the link or email it directly for the specific job.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {linkGroups.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No applications yet.</p>}
            {linkGroups.map((g) => {
              const isOpen = openLinkGroup === g.key;
              return (
                <div key={g.key} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div
                    onClick={() => setOpenLinkGroup(isOpen ? null : g.key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-surface-2)', cursor: 'pointer' }}
                  >
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{g.candidate?.name}</strong>
                    <span className="pill">{g.items.length} job{g.items.length > 1 ? 's' : ''} {isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {g.items.map((app) => (
                        <div key={app.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8 }}>
                          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            {app.job_profiles?.title} {app.job_profiles?.company ? `at ${app.job_profiles.company}` : ''}
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-outline" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => copyInterviewLink(app)}>
                              {copiedId === app.id ? '✓ Copied' : '📋 Copy Link'}
                            </button>
                            <button className="btn-gold" style={{ fontSize: 11.5, padding: '5px 10px' }} disabled={sendingId === app.id} onClick={() => sendInterviewEmail(app)}>
                              {sendingId === app.id ? 'Sending…' : '📧 Send Email'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="panel">
          <div className="panel-title">Add Interview Record (manual entry)</div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Candidate *</label>
              <select value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} required>
                <option value="">Select candidate…</option>
                {interviewStageCandidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.colleges?.name ? `— ${c.colleges.name} (In-house)` : '(Corporate)'}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="Mock">Mock Interview (AI)</option>
                <option value="HR">Personal Interview (HR)</option>
              </select>
            </div>
            {form.type === 'Mock' ? (
              <>
                <div className="field"><label>Confidence (0-10)</label><input type="number" step="0.1" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} /></div>
                <div className="field"><label>Technical Knowledge (0-10)</label><input type="number" step="0.1" value={form.technical} onChange={(e) => setForm({ ...form, technical: e.target.value })} /></div>
                <div className="field"><label>Grammar & Communication (0-10)</label><input type="number" step="0.1" value={form.communication} onChange={(e) => setForm({ ...form, communication: e.target.value })} /></div>
              </>
            ) : (
              <>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>HR Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="field">
                  <label>Recommendation</label>
                  <select value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="Recommended">Recommended</option>
                    <option value="Not Recommended">Not Recommended</option>
                  </select>
                </div>
              </>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              {formError && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{formError}</p>}
              <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Interview'}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="panel"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></div>}
      {error && <div className="panel"><p style={{ color: 'var(--danger)' }}>{error}</p></div>}

      <div className="grid2">
        <div className="panel">
          <div className="panel-title">Mock Interview — AI Evaluation</div>
          <div className="panel-sub">{viewMode === 'inhouse' ? 'In-house / campus candidates' : 'Corporate / client hiring'}</div>
          {!loading && mockGroups.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No mock interviews yet</p>}
          {mockGroups.map((g) => {
            const isOpen = openResultGroup === `mock-${g.key}`;
            const best = Math.max(...g.items.map((i) => i.overall ?? 0));
            return (
              <div key={g.key} style={{ marginBottom: 12, border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setOpenResultGroup(isOpen ? null : `mock-${g.key}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-surface-2)', cursor: 'pointer' }}>
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{g.candidate?.name}</strong>
                    {g.candidate?.colleges?.name && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> · {g.candidate.colleges.name}</span>}
                  </div>
                  <span className="pill">{g.items.length} interview{g.items.length > 1 ? 's' : ''} · best {best}/10 {isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 14px 14px' }}>
                    {g.items.map((i) => (
                      <div key={i.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-default)' }}>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                          {i.job_profiles?.title || 'Role not linked'} {i.job_profiles?.company ? `· ${i.job_profiles.company}` : ''}
                        </p>
                        <div className="rating-row"><span>Confidence</span><strong>{i.confidence} / 10</strong></div>
                        <div className="rating-row"><span>Technical Knowledge</span><strong>{i.technical} / 10</strong></div>
                        <div className="rating-row"><span>Grammar & Communication</span><strong>{i.communication} / 10</strong></div>
                        <div className="rating-row"><strong>Overall Score</strong><strong style={{ color: 'var(--brand-gold, var(--warning))' }}>{i.overall} / 10</strong></div>
                        {i.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>{i.notes}</p>}
                        {i.recommendation && <span className={`badge ${i.recommendation === 'Recommended' ? 'green' : 'red'}`} style={{ marginTop: 8, display: 'inline-block' }}>{i.recommendation}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel">
          <div className="panel-title">Personal Interview — HR Notes</div>
          <div className="panel-sub">{viewMode === 'inhouse' ? 'In-house / campus candidates' : 'Corporate / client hiring'}</div>
          {!loading && personalGroups.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No personal interviews yet</p>}
          {personalGroups.map((g) => {
            const isOpen = openResultGroup === `personal-${g.key}`;
            return (
              <div key={g.key} style={{ marginBottom: 12, border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setOpenResultGroup(isOpen ? null : `personal-${g.key}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-surface-2)', cursor: 'pointer' }}>
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{g.candidate?.name}</strong>
                    {g.candidate?.colleges?.name && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> · {g.candidate.colleges.name}</span>}
                  </div>
                  <span className="pill">{g.items.length} interview{g.items.length > 1 ? 's' : ''} {isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 14px 14px' }}>
                    {g.items.map((i) => (
                      <div key={i.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-default)' }}>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                          {i.job_profiles?.title || 'Role not linked'} {i.job_profiles?.company ? `· ${i.job_profiles.company}` : ''}
                        </p>
                        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>{i.notes}</p>
                        {i.recommendation && <span className={`badge ${i.recommendation === 'Recommended' ? 'green' : 'red'}`}>{i.recommendation}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}