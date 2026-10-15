import { useEffect, useState } from 'react';
import { getCommunications, addCommunication, getColleges, getCompanies, authHeaders } from '../lib/api';

async function generateEmailNote({ entityType, entityName, hint }) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/generate-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ entityType, entityName, hint }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Could not generate email. Please try again.');
  }
  const data = await res.json();
  return data.email;
}

export default function Comm() {
  const [comms, setComms] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entity_type: 'college', entity_id: '', type: 'Email', note: '', date: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [generating, setGenerating] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([getCommunications(), getColleges(), getCompanies()])
      .then(([c, col, comp]) => {
        setComms(c);
        setColleges(col);
        setCompanies(comp);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

 useEffect(() => {
  let ignore = false;

  async function init() {
    setLoading(true);
    try {
      const [c, col, comp] = await Promise.all([getCommunications(), getColleges(), getCompanies()]);
      if (!ignore) {
        setComms(c);
        setColleges(col);
        setCompanies(comp);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.entity_id) { setFormError('Please select a college or company'); return; }
    setSaving(true);
    try {
      await addCommunication(form);
      setForm({ entity_type: 'college', entity_id: '', type: 'Email', note: '', date: '' });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateEmail() {
    if (!form.entity_id) { setFormError('Please select a college or company first'); return; }
    setFormError('');
    setGenerating(true);
    try {
      const list = form.entity_type === 'college' ? colleges : companies;
      const entityName = list.find((x) => x.id === form.entity_id)?.name || '';
      const email = await generateEmailNote({
        entityType: form.entity_type,
        entityName,
        hint: form.note,
      });
      setForm((f) => ({ ...f, note: email }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Group communications by entity (college or company name)
  const grouped = {};
  comms.forEach((c) => {
    const key = c.colleges?.name || c.companies?.name || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  return (
    <div className="page active" id="page-comm">
      <div className="page-head">
        <div><h1>Communication CRM</h1><p>Every call, email and meeting — logged and tracked</p></div>
        <button className="btn-gold" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Log Interaction'}
        </button>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel-title">Log New Interaction</div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Entity Type *</label>
              <select
                value={form.entity_type}
                onChange={(e) => setForm({ ...form, entity_type: e.target.value, entity_id: '' })}
              >
                <option value="college">College</option>
                <option value="company">Company</option>
              </select>
            </div>
            <div className="field">
              <label>{form.entity_type === 'college' ? 'College' : 'Company'} *</label>
              <select value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} required>
                <option value="">Select…</option>
                {(form.entity_type === 'college' ? colleges : companies).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="Email">Email</option>
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Note *</label>
                {form.type === 'Email' && (
                <button
                  type="button"
                   onClick={handleGenerateEmail}
                   disabled={generating}
                    className="btn-gold"
                    style={{ fontSize: 11.5, padding: '5px 14px' }}
                >
                 {generating ? 'Generating…' : '✨ Generate with AI'}
                 </button>
                )}
              </div>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                required
                rows={form.type === 'Email' ? 5 : 2}
                placeholder="e.g. Job Profile sent for Software Trainee"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', sans-serif", resize: 'vertical' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {formError && <p style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 8 }}>{formError}</p>}
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Interaction'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="panel"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></div>}
      {error && <div className="panel"><p style={{ color: 'var(--red)' }}>{error}</p></div>}
      {!loading && !error && Object.keys(grouped).length === 0 && (
        <div className="panel"><p style={{ color: 'var(--text-muted)' }}>No interactions logged yet</p></div>
      )}

      <div className="grid2">
        {Object.entries(grouped).map(([name, items]) => (
          <div className="panel" key={name}>
            <div className="panel-title">{name} — Timeline</div>
            {items.map((c) => (
              <div className="timeline-item" key={c.id}>
                <div className="timeline-dot"></div>
                <div>
                  <div className="t">{c.type}: {c.note}</div>
                  <div className="d">{c.date ? new Date(c.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">Email Flow</div>
        <div className="email-flow" style={{ marginBottom: 12 }}><span className="email-step">Job Posted</span><span className="email-sep">➜</span><span className="email-step">College Notified</span></div>
        <div className="email-flow"><span className="email-step">Final Selection</span><span className="email-sep">➜</span><span className="email-step">Student: Offer Letter</span><span className="email-sep">➜</span><span className="email-step">College: CC + Notice</span><span className="email-sep">➜</span><span className="email-step">Company: Selected List</span></div>
      </div>
    </div>
  );
}