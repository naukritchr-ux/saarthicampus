import { useEffect, useState, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function AIInterview() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Support both /interview/:token and legacy /interview/:candidateId/:jobId
  const isDirectToken = parts.length === 2 && parts[0] === 'interview';
  const rawToken = isDirectToken ? parts[1] : null;

  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get('token');
  const token = rawToken || queryToken;

  const candidateId = !isDirectToken && parts.length >= 3 ? parts[1] : null;
  const jobId = !isDirectToken && parts.length >= 3 ? parts[2] : null;

  const [phase, setPhase] = useState('loading'); // loading | intro | chatting | done | error
  const [candidateName, setCandidateName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function loadInfo() {
      if (!token && (!candidateId || !jobId)) {
        setErrorMsg('Invalid or missing interview link. Please use the link sent to your email.');
        setPhase('error');
        return;
      }

      try {
        if (token) {
          const res = await fetch(`${BACKEND_URL}/api/ai-interview/invite/${token}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not verify interview invitation');
          setCandidateName(data.candidateName || 'Candidate');
          setJobTitle(data.jobTitle || 'Role Interview');
          setCompany(data.company || '');
          setPhase('intro');
        } else {
          // Legacy URL without token
          setErrorMsg('An invitation token is required. Please use the latest link emailed to you.');
          setPhase('error');
        }
      } catch (err) {
        console.error('Failed to load interview info:', err);
        setErrorMsg(err.message || 'Could not load your interview details. Please check the link or contact the recruiter.');
        setPhase('error');
      }
    }

    loadInfo();
  }, [token, candidateId, jobId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function startInterview() {
    setPhase('chatting');
    setSending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, candidate_id: candidateId, job_id: jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start interview');
      setSessionId(data.sessionId);
      if (data.sessionToken) setSessionToken(data.sessionToken);
      if (data.candidateName) setCandidateName(data.candidateName);
      if (data.jobTitle) setJobTitle(data.jobTitle);
      setMessages([{ role: 'assistant', content: data.question }]);
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    } finally {
      setSending(false);
    }
  }

  async function sendAnswer() {
    if (!input.trim() || sending) return;
    const answer = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: answer }]);
    setSending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-interview/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sessionToken, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      if (data.done) {
        setResult(data.evaluation);
        setPhase('done');
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.question }]);
      }
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  };

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    width: '100%',
    maxWidth: 580,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  };

  if (phase === 'loading') {
    return (
      <div style={pageStyle}>
        <p style={{ color: 'var(--text-muted)' }}>Loading your interview…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
          <h3 style={{ fontSize: 18, marginBottom: 8, color: 'var(--text-primary)' }}>Interview Unavailable</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, padding: '40px 36px', textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 20px' }}>S</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, marginBottom: 8, color: 'var(--text-primary)' }}>
            Hi {candidateName?.split(' ')[0] || 'there'}, ready for your AI interview?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
            for <strong style={{ color: 'var(--text-primary)' }}>{jobTitle || 'Role'}</strong> {company ? `at ${company}` : ''}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '16px 0 28px', lineHeight: 1.6 }}>
            This is a friendly, professional screening interview. Our AI will ask you a series of role-relevant questions.
            Answer honestly, take your time, and write clear responses. It typically takes 5–10 minutes.
          </p>
          <button className="btn-primary" onClick={startInterview}>Start Interview</button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, padding: '40px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, marginBottom: 8, color: 'var(--text-primary)' }}>
            Thank you, {candidateName?.split(' ')[0] || 'Candidate'}!
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your interview responses have been submitted. Our recruitment team will review the evaluation and contact you with next steps.
          </p>
          {result?.summary && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16, fontStyle: 'italic', background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
              {result.summary}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '82vh', maxHeight: 660 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="brand-mark" style={{ width: 32, height: 32, fontSize: 14 }}>S</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>AI Screening Interview</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{jobTitle} {company ? `• ${company}` : ''}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%',
                padding: '11px 15px',
                borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: m.role === 'user' ? 'var(--primary)' : 'var(--surface-2)',
                color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                fontSize: 13.5,
                lineHeight: 1.5,
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 13 }}>
                Thinking…
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer here…"
            disabled={sending}
            rows={2}
            style={{
              flex: 1, resize: 'none', padding: '10px 14px', border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-sm)', fontSize: 13.5, fontFamily: 'inherit', background: 'var(--bg)',
            }}
          />
          <button
            className="btn-primary"
            disabled={sending || !input.trim()}
            onClick={sendAnswer}
            style={{ width: 'auto', padding: '0 20px', alignSelf: 'flex-end', height: 42 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}