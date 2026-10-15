import { useEffect, useState } from 'react';
import { authHeaders } from '../lib/api';

export default function TalentPassport({ candidateId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidate/${candidateId}/passport`, { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load passport');
        if (!ignore) setData(json);
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    if (candidateId) load();
    return () => { ignore = true; };
  }, [candidateId]);

  if (loading) return <div className="panel"><p style={{ color: 'var(--text-muted)' }}>Loading passport…</p></div>;
  if (error) return <div className="panel"><p style={{ color: 'var(--danger)' }}>{error}</p></div>;
  if (!data) return null;

  const { candidate, applications, aptitude, gd, interview } = data;
  const latestApp = applications[0];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
      >
        {/* Header */}
        <div style={{ background: 'var(--gradient-brand-2, linear-gradient(135deg,#7C3AED,#EC4899))', padding: '28px 32px', color: 'white', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, flexShrink: 0 }}>
              {candidate.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{candidate.name}</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>
                {candidate.colleges?.name || candidate.college || 'No college listed'} {latestApp?.job_profiles?.title ? `· Applying for ${latestApp.job_profiles.title}` : ''}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 4 }}>
                {candidate.email} {candidate.phone ? `· ${candidate.phone}` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px' }}>
          {/* Score summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <ScoreBox label="Resume Match" value={latestApp?.resume_score} suffix="%" />
            <ScoreBox label="Aptitude" value={aptitude?.score} suffix={aptitude ? `/${aptitude.total}` : ''} />
            <ScoreBox label="GD Score" value={gd?.overall ?? gd?.manual_communication} suffix={gd ? '/5' : ''} />
            <ScoreBox label="Interview" value={interview?.overall} suffix={interview ? '/10' : ''} />
          </div>

          {/* Resume skills */}
          {(latestApp?.matched_skills?.length || latestApp?.missing_skills?.length) ? (
            <Section title="Skills Assessment">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 8 }}>✅ Matched</div>
                  {(latestApp.matched_skills || []).length > 0
                    ? latestApp.matched_skills.map((s) => <span key={s} className="course-chip" style={{ cursor: 'default' }}>{s}</span>)
                    : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>None recorded</span>}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: 8 }}>❌ Missing</div>
                  {(latestApp.missing_skills || []).length > 0
                    ? latestApp.missing_skills.map((s) => <span key={s} className="course-chip" style={{ cursor: 'default' }}>{s}</span>)
                    : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>None recorded</span>}
                </div>
              </div>
            </Section>
          ) : null}

          {/* GD feedback */}
          {(gd?.ai_feedback || gd?.manual_comment) && (
            <Section title="Group Discussion Feedback">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{gd.ai_feedback || gd.manual_comment}</p>
            </Section>
          )}

          {/* Interview feedback */}
          {(interview?.notes || interview?.recommendation) && (
            <Section title="Interview Panel Notes">
              {interview.notes && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{interview.notes}</p>}
              {interview.recommendation && (
                <span className={`badge ${interview.recommendation === 'Recommended' ? 'green' : 'red'}`}>{interview.recommendation}</span>
              )}
            </Section>
          )}

          {/* Resume feedback */}
          {latestApp?.ai_feedback && (
            <Section title="AI Resume Feedback">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{latestApp.ai_feedback}</p>
            </Section>
          )}

          {/* Application history */}
          <Section title="Application History">
            <table>
              <tbody>
                <tr><th>Role</th><th>Company</th><th>Stage</th></tr>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>{a.job_profiles?.title || '—'}</td>
                    <td>{a.job_profiles?.company || '—'}</td>
                    <td><span className="badge blue">{a.stage}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn-outline" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBox({ label, value, suffix }) {
  return (
    <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-purple, #7C3AED)' }}>
        {value != null ? `${value}${suffix || ''}` : '—'}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, borderBottom: '1px solid var(--border-default)', paddingBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}