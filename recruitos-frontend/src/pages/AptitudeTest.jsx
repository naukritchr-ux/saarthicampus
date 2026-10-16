import { useEffect, useState } from 'react';
import { getAptitudeTestByToken, submitAptitudeTest } from '../lib/api';

export default function AptitudeTest() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const token = parts[1];

  const [phase, setPhase] = useState('loading');
  const [candidateName, setCandidateName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        setErrorMsg('Invalid test link. Please use the link exactly as shared with you.');
        setPhase('error');
        return;
      }
      try {
        const data = await getAptitudeTestByToken(token);
        setCandidateName(data.candidateName);
        setQuestions(data.questions);
        setPhase('intro');
      } catch (err) {
        setErrorMsg(err.message);
        setPhase('error');
      }
    }
    load();
  }, [token]);

  function startTest() {
    setPhase('test');
  }

  function selectAnswer(qIndex, option) {
    setAnswers((prev) => ({ ...prev, [qIndex]: option }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const orderedAnswers = questions.map((q, i) => answers[i] || null);
      const data = await submitAptitudeTest(token, orderedAnswers);
      setResult(data);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
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
    maxWidth: 640,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  };

  if (phase === 'loading') {
    return <div style={pageStyle}><p style={{ color: 'var(--text-muted)' }}>Loading your test…</p></div>;
  }

  if (phase === 'error') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, padding: '40px 36px', textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 20px' }}>R</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 21, marginBottom: 8, color: 'var(--text-primary)' }}>
            Hi {candidateName?.split(' ')[0]}, ready for your aptitude test?
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '16px 0 28px', lineHeight: 1.6 }}>
            This test has {questions.length} questions. Take your time and answer honestly.
            Once you submit, you cannot retake the test.
          </p>
          <button className="btn-primary" onClick={startTest}>Start Test</button>
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
            Thanks, {candidateName?.split(' ')[0]}!
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your test has been submitted. You scored {result?.score} out of {result?.total}.
            Our recruitment team will review your result and reach out with next steps soon.
          </p>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, padding: '32px 32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Aptitude Test</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{answeredCount} / {questions.length} answered</div>
        </div>

        <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingRight: 6 }}>
          {questions.map((q, i) => (
            <div key={i} style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: 'var(--text-primary)' }}>
                {i + 1}. {q.q}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: answers[i] === opt ? 'var(--surface-2)' : 'transparent',
                      border: '1px solid ' + (answers[i] === opt ? 'var(--primary)' : 'transparent'),
                    }}
                  >
                    <input
                      type="radio"
                      name={`q-${i}`}
                      checked={answers[i] === opt}
                      onChange={() => selectAnswer(i, opt)}
                    />
                    {String.fromCharCode(65 + oi)}. {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {errorMsg && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 14 }}>{errorMsg}</p>}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting…' : 'Submit Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
