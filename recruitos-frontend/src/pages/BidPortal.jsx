import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { authHeaders } from '../lib/api';

const PERFORMANCE_LABELS = {
  exceptional: { label: 'Exceptional', color: '#7C3AED', bg: '#EEF0FF', icon: '🚀' },
  excellent: { label: 'Excellent', color: '#059669', bg: '#D1FAE5', icon: '⭐' },
  good: { label: 'Good', color: '#2563EB', bg: '#DBEAFE', icon: '👍' },
  average: { label: 'Average', color: '#D97706', bg: '#FEF3C7', icon: '📊' },
  poor: { label: 'Needs Improvement', color: '#DC2626', bg: '#FEE2E2', icon: '⚠️' },
};

const RAISE_PERCENT = {
  exceptional: 30,
  excellent: 20,
  good: 12,
  average: 5,
  poor: 0,
};

export default function BidPortal() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({
    current_salary: '',
    company_cost: '',
    performance: 'good',
    raise_percent: '',
    reason: '',
    effective_date: '',
  });
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('candidates')
        .select('*, colleges(name)')
        .order('name', { ascending: true });
      setCandidates(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const openCandidate = async (c) => {
    setSelected(c);
    setAiSuggestion(null);
    setForm({
      current_salary: c.current_salary || '',
      company_cost: c.company_cost || '',
      performance: 'good',
      raise_percent: '',
      reason: '',
      effective_date: new Date().toISOString().split('T')[0],
    });

    const { data } = await supabase
      .from('salary_history')
      .select('*')
      .eq('candidate_id', c.id)
      .order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const getNewSalary = () => {
    const current = parseFloat(form.current_salary) || 0;
    const pct = parseFloat(form.raise_percent) || 0;
    return current + (current * pct / 100);
  };

  const getNewCost = () => {
    const current = parseFloat(form.company_cost) || 0;
    const pct = parseFloat(form.raise_percent) || 0;
    return current + (current * pct / 100);
  };

  const handlePerformanceChange = (perf) => {
    setForm(f => ({
      ...f,
      performance: perf,
      raise_percent: RAISE_PERCENT[perf].toString(),
    }));
    setAiSuggestion(null);
  };

  const getAiSuggestion = async () => {
    if (!selected || !form.current_salary) {
      alert('Please select a candidate and enter current salary first');
      return;
    }
    setAiSuggesting(true);
    setAiSuggestion(null);

    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bid/suggest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          candidateName: selected.name,
          currentSalary: parseFloat(form.current_salary),
          companyCost: parseFloat(form.company_cost) || 0,
          performance: form.performance,
          reason: form.reason,
          history: history.slice(0, 3),
        }),
      });

      const data = await res.json();
      if (data.suggestion) {
        setAiSuggestion(data.suggestion);
        setForm(f => ({
          ...f,
          raise_percent: data.suggestion.raise_percent.toString(),
          reason: f.reason || data.suggestion.reasoning,
        }));
      }
    } catch {
      alert('AI suggestion failed. Please enter raise % manually.');
    }
    setAiSuggesting(false);
  };

  const handleSave = async () => {
    if (!selected || !form.current_salary || !form.raise_percent) {
      alert('Please fill in current salary and raise percentage');
      return;
    }

    setSaving(true);
    const newSalary = getNewSalary();
    const newCost = getNewCost();

    try {
      // Save to history
      await supabase.from('salary_history').insert([{
        candidate_id: selected.id,
        candidate_name: selected.name,
        old_salary: parseFloat(form.current_salary),
        new_salary: newSalary,
        old_cost: parseFloat(form.company_cost) || 0,
        new_cost: newCost,
        raise_percent: parseFloat(form.raise_percent),
        performance: form.performance,
        reason: form.reason,
        effective_date: form.effective_date,
      }]);

      // Update candidate record
      await supabase.from('candidates').update({
        current_salary: newSalary,
        company_cost: newCost,
      }).eq('id', selected.id);

      // Update local list
      setCandidates(prev => prev.map(c =>
        c.id === selected.id
          ? { ...c, current_salary: newSalary, company_cost: newCost }
          : c
      ));

      // Reload history
      const { data } = await supabase
        .from('salary_history')
        .select('*')
        .eq('candidate_id', selected.id)
        .order('created_at', { ascending: false });
      setHistory(data || []);

      setSelected(prev => ({ ...prev, current_salary: newSalary, company_cost: newCost }));
      setForm(f => ({
        ...f,
        current_salary: newSalary.toString(),
        company_cost: newCost.toString(),
        raise_percent: '',
        reason: '',
      }));
      setAiSuggestion(null);

      alert(`✅ Salary updated for ${selected.name}!\nNew Salary: ₹${newSalary.toLocaleString('en-IN')}`);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '—';
    return '₹' + parseFloat(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const filtered = candidates.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page active">
      <div className="page-head">
        <div>
          <h1>Bid Portal</h1>
          <p>Salary & cost management · raise compensation based on performance</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Candidate list */}
        <div>
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Select Candidate
            </div>
            <input
              className="search-box"
              style={{ width: '100%', marginBottom: 12 }}
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>Loading...</div>}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => openCandidate(c)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    marginBottom: 4,
                    background: selected?.id === c.id ? 'rgba(124,58,237,0.08)' : 'transparent',
                    border: selected?.id === c.id ? '1.5px solid rgba(124,58,237,0.3)' : '1.5px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {c.colleges?.name || c.college || 'No college'}
                  </div>
                  {c.current_salary ? (
                    <div style={{ fontSize: 12, color: 'var(--brand-purple)', fontWeight: 700, marginTop: 4 }}>
                      {formatCurrency(c.current_salary)} / yr
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>No salary set</div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
                  No candidates found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Bid form + history */}
        <div>
          {!selected ? (
            <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Select a candidate from the left to manage their salary
              </div>
            </div>
          ) : (
            <>
              {/* Candidate header */}
              <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px' }}>
                <div style={{
                  width: 54, height: 54,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand-purple), #06B6D4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 20,
                  flexShrink: 0,
                }}>
                  {selected.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selected.colleges?.name || selected.college || 'No college'} · {selected.email}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-purple)', fontFamily: 'var(--font-display)' }}>
                    {formatCurrency(selected.current_salary)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Current Annual Salary</div>
                </div>
              </div>

              {/* Bid form */}
              <div className="panel">
                <div className="panel-title">Raise Compensation</div>
                <div className="panel-sub">Enter current figures and set performance rating to calculate new salary</div>

                {/* Current figures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Current Salary (₹ / year)
                    </div>
                    <input
                      type="number"
                      className="search-box"
                      style={{ width: '100%' }}
                      placeholder="e.g. 300000"
                      value={form.current_salary}
                      onChange={e => setForm(f => ({ ...f, current_salary: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Company Cost (₹ / year)
                    </div>
                    <input
                      type="number"
                      className="search-box"
                      style={{ width: '100%' }}
                      placeholder="e.g. 360000 (CTC)"
                      value={form.company_cost}
                      onChange={e => setForm(f => ({ ...f, company_cost: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Performance rating */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Performance Rating
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(PERFORMANCE_LABELS).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => handlePerformanceChange(key)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 20,
                          border: `2px solid ${form.performance === key ? val.color : 'var(--border-default)'}`,
                          background: form.performance === key ? val.bg : 'var(--bg-surface)',
                          color: form.performance === key ? val.color : 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {val.icon} {val.label}
                        {RAISE_PERCENT[key] > 0 && (
                          <span style={{ marginLeft: 6, opacity: 0.7 }}>+{RAISE_PERCENT[key]}%</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Raise % + reason + date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Raise %
                    </div>
                    <input
                      type="number"
                      className="search-box"
                      style={{ width: '100%', fontWeight: 700, fontSize: 16, color: 'var(--brand-purple)' }}
                      placeholder="e.g. 15"
                      value={form.raise_percent}
                      onChange={e => setForm(f => ({ ...f, raise_percent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Reason / Notes
                    </div>
                    <input
                      className="search-box"
                      style={{ width: '100%' }}
                      placeholder="e.g. Exceptional performance in Q2 drive"
                      value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Effective Date
                    </div>
                    <input
                      type="date"
                      className="search-box"
                      style={{ width: '100%' }}
                      value={form.effective_date}
                      onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* AI suggestion box */}
                {aiSuggestion && (
                  <div style={{
                    background: 'rgba(124,58,237,0.06)',
                    border: '1.5px solid rgba(124,58,237,0.2)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-purple)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      🤖 AI Recommendation
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-purple)' }}>+{aiSuggestion.raise_percent}%</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Recommended Raise</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(aiSuggestion.new_salary)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>New Salary</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--warning)' }}>{formatCurrency(aiSuggestion.new_cost)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>New Company Cost</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {aiSuggestion.reasoning}
                    </div>
                  </div>
                )}

                {/* Preview calculation */}
                {form.current_salary && form.raise_percent && (
                  <div style={{
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    marginBottom: 20,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: 12,
                    textAlign: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>Current Salary</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(form.current_salary)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>Raise</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-purple)' }}>+{form.raise_percent}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>New Salary</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(getNewSalary())}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>New Cost</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>{formatCurrency(getNewCost())}</div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-outline"
                    onClick={getAiSuggestion}
                    disabled={aiSuggesting}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {aiSuggesting ? '⏳ Thinking...' : '🤖 Get AI Suggestion'}
                  </button>
                  <button
                    className="btn-gold"
                    onClick={handleSave}
                    disabled={saving || !form.current_salary || !form.raise_percent}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {saving ? 'Saving...' : '💰 Apply Raise'}
                  </button>
                </div>
              </div>

              {/* Salary history */}
              {history.length > 0 && (
                <div className="panel">
                  <div className="panel-title">Salary History</div>
                  <table>
                    <tbody>
                      <tr>
                        <th>Date</th>
                        <th>Old Salary</th>
                        <th>Raise</th>
                        <th>New Salary</th>
                        <th>Performance</th>
                        <th>Reason</th>
                      </tr>
                      {history.map(h => (
                        <tr key={h.id}>
                          <td style={{ fontSize: 12 }}>{new Date(h.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={{ fontSize: 12 }}>{formatCurrency(h.old_salary)}</td>
                          <td>
                            <span style={{
                              background: '#D1FAE5',
                              color: '#059669',
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontSize: 11,
                              fontWeight: 700,
                            }}>
                              +{h.raise_percent}%
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--brand-purple)', fontSize: 13 }}>
                            {formatCurrency(h.new_salary)}
                          </td>
                          <td>
                            {h.performance && (
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: PERFORMANCE_LABELS[h.performance]?.color,
                                background: PERFORMANCE_LABELS[h.performance]?.bg,
                                padding: '2px 8px',
                                borderRadius: 10,
                              }}>
                                {PERFORMANCE_LABELS[h.performance]?.icon} {PERFORMANCE_LABELS[h.performance]?.label}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>{h.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}