import { useEffect, useState, useMemo } from 'react';
import { getOffers, getCandidates, getJobs, addOffer, getAllApplications } from '../lib/api';

const STATUS_BADGE = {
  Drafted: 'gray',
  Sent: 'green',
  Accepted: 'green',
  Declined: 'red',
};

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ candidate_id: '', job_id: '', ctc: '', status: 'Drafted', sent_on: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function loadAll() {
    setLoading(true);
    Promise.all([getOffers(), getCandidates(), getJobs(), getAllApplications()])
      .then(([o, c, j, a]) => {
        setOffers(o);
        setCandidates(c);
        setJobs(j);
        setApplications(a || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      setLoading(true);
      try {
        const [o, c, j, a] = await Promise.all([getOffers(), getCandidates(), getJobs(), getAllApplications()]);
        if (!ignore) {
          setOffers(o);
          setCandidates(c);
          setJobs(j);
          setApplications(a || []);
          setError('');
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    init();
    return () => { ignore = true; };
  }, []);

  const candidateOptions = useMemo(() => {
    if (form.job_id) {
      const appCands = applications
        .filter((a) => (a.job_profiles?.id || a.job_id) === form.job_id)
        .map((a) => a.candidates)
        .filter(Boolean);
      if (appCands.length > 0) return appCands;
    }
    return candidates;
  }, [form.job_id, applications, candidates]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.candidate_id || !form.job_id) { setFormError('Candidate and Job are required'); return; }
    setSaving(true);
    try {
      await addOffer(form);
      setForm({ candidate_id: '', job_id: '', ctc: '', status: 'Drafted', sent_on: '' });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page active" id="page-offers">
      <div className="page-head">
        <div><h1>Offer Letters</h1><p>Auto-generated on Final Selection · sent via Email Center</p></div>
        <button className="btn-gold" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Generate Offer'}
        </button>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel-title">Generate New Offer</div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Candidate *</label>
              <select value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} required>
                <option value="">Select candidate…</option>
                {candidateOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Job Profile *</label>
              <select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })} required>
                <option value="">Select job…</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.company} — {j.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label>CTC</label>
              <input value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} placeholder="e.g. ₹4.5 LPA" />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Drafted">Drafted</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Declined">Declined</option>
              </select>
            </div>
            <div className="field">
              <label>Sent On</label>
              <input type="date" value={form.sent_on} onChange={(e) => setForm({ ...form, sent_on: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {formError && <p style={{ color: 'var(--red, #d64545)', fontSize: 12.5, marginBottom: 8 }}>{formError}</p>}
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Offer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <table>
          <tbody>
            <tr><th>Candidate</th><th>Role</th><th>Company</th><th>CTC</th><th>Status</th><th>Sent On</th></tr>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--slate-light)', padding: 24 }}>Loading…</td></tr>
            )}
            {error && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--red, #d64545)', padding: 24 }}>{error}</td></tr>
            )}
            {!loading && !error && offers.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--slate-light)', padding: 24 }}>No offers yet</td></tr>
            )}
            {!loading && !error && offers.map((o) => (
              <tr key={o.id}>
                <td>{o.candidates?.name}</td>
                <td>{o.job_profiles?.title}</td>
                <td>{o.job_profiles?.company}</td>
                <td>{o.ctc}</td>
                <td><span className={`badge ${STATUS_BADGE[o.status] || 'gray'}`}>{o.status}</span></td>
                <td>{o.sent_on ? new Date(o.sent_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}