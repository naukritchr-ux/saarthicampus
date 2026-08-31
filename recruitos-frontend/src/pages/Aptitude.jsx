import { useEffect, useState } from 'react';
import { getAptitudeResults, addAptitudeResult, getCandidatesByStage, getJobs, generateAptitudeTest, sendAptitudeInvite } from '../lib/api';

const TOPIC_OPTIONS = ['Quantitative', 'Logical', 'Verbal', 'GK', 'Technical'];
const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'];

const blankQuestion = () => ({
  q: '',
  options: ['', '', '', ''],
  answer: '',
  topic: 'Quantitative',
  difficulty: 'medium',
});

export default function Aptitude() {
  const [results, setResults] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ candidate_id: '', job_id: '', score: '', total: '40' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showGenForm, setShowGenForm] = useState(false);
  const [genJobId, setGenJobId] = useState('');
  const [genDifficulty, setGenDifficulty] = useState('auto');
  const [genQCount, setGenQCount] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [generatedTest, setGeneratedTest] = useState(null);
  const [sendCandidateId, setSendCandidateId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  // Only candidates the Pipeline board has moved into the "Aptitude" column
  // show up here — keeps this module in sync with the pipeline stage.
  async function loadAll() {
    setLoading(true);
    try {
      const [r, c, j] = await Promise.all([getAptitudeResults(), getCandidatesByStage('Aptitude'), getJobs()]);
      setResults(r);
      setCandidates(c);
      setJobs(j);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      setLoading(true);
      try {
        const [r, c, j] = await Promise.all([getAptitudeResults(), getCandidatesByStage('Aptitude'), getJobs()]);
        if (!ignore) {
          setResults(r);
          setCandidates(c);
          setJobs(j);
          setError('');
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load data');
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
    if (!form.candidate_id || !form.score || !form.total) {
      setFormError('Candidate, score, and total are required');
      return;
    }
    setSaving(true);
    try {
      await addAptitudeResult(form);
      setForm({ candidate_id: '', job_id: '', score: '', total: '40' });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setGenError('');
    setGeneratedTest(null);
    setGenerating(true);
    try {
      const test = await generateAptitudeTest({
        job_id: genJobId || null,
        difficulty: genDifficulty,
        question_count: genQCount,
      });
      setGeneratedTest(test);
      if (genJobId) {
        setForm((f) => ({ ...f, job_id: genJobId, total: String(test.total) }));
      }
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  // ---- Manual question editing ----

  function updateQuestions(updater) {
    setGeneratedTest((prev) => {
      if (!prev) return prev;
      const questions = updater(prev.questions);
      return { ...prev, questions, total: questions.length };
    });
    setForm((f) => ({ ...f, total: String(updater([...(generatedTest?.questions || [])]).length) }));
  }

  function updateQuestionField(index, field, value) {
    setGeneratedTest((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) => (i === index ? { ...q, [field]: value } : q));
      return { ...prev, questions };
    });
  }

  function updateOption(index, optIndex, value) {
    setGeneratedTest((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) => {
        if (i !== index) return q;
        const oldValue = q.options[optIndex];
        const options = q.options.map((o, oi) => (oi === optIndex ? value : o));
        // If the edited option was the correct answer, keep the answer in sync
        const answer = q.answer === oldValue ? value : q.answer;
        return { ...q, options, answer };
      });
      return { ...prev, questions };
    });
  }

  function setCorrectAnswer(index, optionValue) {
    setGeneratedTest((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) => (i === index ? { ...q, answer: optionValue } : q));
      return { ...prev, questions };
    });
  }

  function deleteQuestion(index) {
    if (!window.confirm('Remove this question from the test?')) return;
    setGeneratedTest((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.filter((_, i) => i !== index);
      return { ...prev, questions, total: questions.length };
    });
    setForm((f) => ({ ...f, total: String((generatedTest?.questions.length || 1) - 1) }));
  }

  function addManualQuestion() {
    setGeneratedTest((prev) => {
      const base = prev || { questions: [], difficulty: genDifficulty === 'auto' ? 'medium' : genDifficulty };
      const questions = [...base.questions, blankQuestion()];
      return { ...base, questions, total: questions.length };
    });
    setForm((f) => ({ ...f, total: String(((generatedTest?.questions?.length) || 0) + 1) }));
  }

  async function handleSendInvite() {
    if (!sendCandidateId || !generatedTest) return;
    setSendError('');
    setSendSuccess('');

    // Validate every question has text, 4 non-empty options, and a correct answer that matches one of them
    const invalidIndex = generatedTest.questions.findIndex((q) => {
      const filledOptions = q.options.filter((o) => o.trim() !== '');
      return !q.q.trim() || filledOptions.length < 2 || !q.options.includes(q.answer) || !q.answer;
    });
    if (invalidIndex !== -1) {
      setSendError(`Question ${invalidIndex + 1} is incomplete — check the question text, options, and correct answer.`);
      return;
    }

    setSendingInvite(true);
    try {
      await sendAptitudeInvite({
        candidate_id: sendCandidateId,
        job_id: genJobId || null,
        questions: generatedTest.questions,
        difficulty: generatedTest.difficulty,
      });
      setSendSuccess('Test link emailed successfully!');
      setSendCandidateId('');
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSendingInvite(false);
    }
  }

  const attempted = results.length;
  const passed = results.filter((r) => r.passed).length;
  const passRate = attempted ? Math.round((passed / attempted) * 100) : 0;
  const avgScore = attempted
    ? (results.reduce((sum, r) => sum + r.score, 0) / attempted).toFixed(1)
    : '0';
  const avgTotal = attempted ? results[0].total : 0;

  return (
    <div className="page active" id="page-aptitude">
      <div className="page-head">
        <div><h1>Aptitude Test</h1><p>Live results across all aptitude tests</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" onClick={() => setShowGenForm((v) => !v)}>
            {showGenForm ? 'Cancel' : '✨ Generate AI Test'}
          </button>
          <button className="btn-gold" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add Result'}
          </button>
        </div>
      </div>

      {showGenForm && (
        <div className="panel">
          <div className="panel-title">Generate AI-Tailored Aptitude Test</div>
          <p className="panel-sub">
            Pick a job so the AI matches question difficulty and topics to that role's level and skills —
            or leave it blank for a general fresher-level test.
          </p>
          <form onSubmit={handleGenerate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div className="field">
              <label>Job Profile</label>
              <select value={genJobId} onChange={(e) => setGenJobId(e.target.value)}>
                <option value="">General / no specific job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.company} — {j.title}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Difficulty</label>
              <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value)}>
                <option value="auto">Auto (match job level)</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="field">
              <label># Questions</label>
              <input type="number" min={5} max={50} value={genQCount} onChange={(e) => setGenQCount(Number(e.target.value))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {genError && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{genError}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" type="submit" disabled={generating}>
                  {generating ? 'Generating…' : 'Generate Test'}
                </button>
                <button
                  className="btn-outline"
                  type="button"
                  onClick={addManualQuestion}
                >
                  + Start Blank / Add Question Manually
                </button>
              </div>
            </div>
          </form>

          {generatedTest && (
            <div style={{ marginTop: 20 }}>
              <div className="panel-title" style={{ fontSize: 14 }}>
                Preview — {generatedTest.questions.length} questions ({generatedTest.difficulty} level)
              </div>
              <p className="panel-sub" style={{ marginTop: -4 }}>
                Edit any question, option, or the correct answer below before sending.
              </p>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <select value={sendCandidateId} onChange={(e) => setSendCandidateId(e.target.value)} style={{ minWidth: 200 }}>
                  <option value="">Select candidate to email…</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  className="btn-primary"
                  type="button"
                  disabled={!sendCandidateId || sendingInvite}
                  onClick={handleSendInvite}
                  style={{ width: 'auto', padding: '0 18px', height: 36 }}
                >
                  {sendingInvite ? 'Sending…' : '📧 Send Test to Candidate'}
                </button>
              </div>
              {sendError && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{sendError}</p>}
              {sendSuccess && <p style={{ color: 'var(--success)', fontSize: 12.5, marginBottom: 8 }}>{sendSuccess}</p>}

              <div style={{ maxHeight: 460, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {generatedTest.questions.map((q, i) => (
                  <div key={i} style={{ padding: '14px 16px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, paddingTop: 8, flexShrink: 0 }}>{i + 1}.</div>
                      <textarea
                        value={q.q}
                        onChange={(e) => updateQuestionField(i, 'q', e.target.value)}
                        placeholder="Question text..."
                        rows={2}
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => deleteQuestion(i)}
                        title="Remove question"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, padding: 4, flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginLeft: 24 }}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`correct-${i}`}
                            checked={opt !== '' && opt === q.answer}
                            onChange={() => setCorrectAnswer(i, opt)}
                            title="Mark as correct answer"
                            style={{ flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(i, oi, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                            style={{
                              flex: 1,
                              fontSize: 12.5,
                              padding: '6px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border-default)',
                              fontWeight: opt !== '' && opt === q.answer ? 700 : 400,
                              color: opt !== '' && opt === q.answer ? 'var(--success)' : 'inherit',
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 10, marginLeft: 24 }}>
                      <select
                        value={q.topic}
                        onChange={(e) => updateQuestionField(i, 'topic', e.target.value)}
                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-default)' }}
                      >
                        {TOPIC_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select
                        value={q.difficulty}
                        onChange={(e) => updateQuestionField(i, 'difficulty', e.target.value)}
                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-default)' }}
                      >
                        {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-outline"
                onClick={addManualQuestion}
                style={{ marginTop: 12 }}
              >
                + Add Another Question
              </button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="panel">
          <div className="panel-title">Add Aptitude Result</div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Candidate *</label>
              <select value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} required>
                <option value="">Select candidate…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Job Profile</label>
              <select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })}>
                <option value="">Optional…</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.company} — {j.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Score *</label>
              <input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required />
            </div>
            <div className="field">
              <label>Total *</label>
              <input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} required />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {formError && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{formError}</p>}
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Result'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid2">
        <div className="panel">
          <div className="panel-title">Leaderboard</div>
          <table>
            <tbody>
              <tr><th>Rank</th><th>Candidate</th><th>Score</th><th>Result</th></tr>
              {loading && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading…</td></tr>
              )}
              {error && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--danger)', padding: 24 }}>{error}</td></tr>
              )}
              {!loading && !error && results.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No aptitude results yet</td></tr>
              )}
              {!loading && !error && results.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.candidates?.name}</td>
                  <td>{r.score}/{r.total}</td>
                  <td><span className={`badge ${r.passed ? 'green' : 'red'}`}>{r.passed ? 'Pass' : 'Fail'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <div className="panel-title">Test Summary</div>
          <div className="resume-row" style={{ paddingTop: 0 }}><div className="resume-info"><div className="name">Attempted</div></div><strong>{attempted}</strong></div>
          <div className="resume-row"><div className="resume-info"><div className="name">Pass Rate</div></div><strong>{passRate}%</strong></div>
          <div className="resume-row"><div className="resume-info"><div className="name">Avg. Score</div></div><strong>{avgScore} / {avgTotal}</strong></div>
        </div>
      </div>
    </div>
  );
}