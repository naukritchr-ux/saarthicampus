import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { authHeaders } from "../lib/api";

const RATING_CRITERIA = [
  { key: "confidence", label: "Confidence" },
  { key: "communication", label: "Communication" },
  { key: "content_knowledge", label: "Content Knowledge" },
  { key: "leadership", label: "Leadership" },
  { key: "teamwork", label: "Teamwork" },
];

export default function GDAdmin() {
  const [sessions, setSessions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ topic: "", duration_minutes: 30 });
  const [sessionMode, setSessionMode] = useState("online"); // 'online' | 'offline'
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Per-session "Rate Participants" panel state
  const [ratingSession, setRatingSession] = useState(null);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [savingRatingId, setSavingRatingId] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Fetch GD sessions (RLS automatically filters Corporate sessions to user's company)
  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("gd_sessions")
        .select("*, job_profiles(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error("Failed to load GD sessions:", err);
      setSessions([]);
    }
  };

  // Fetch available jobs for the current role
  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("job_profiles")
        .select("id, title, company")
        .order("title", { ascending: true });
      if (error) throw error;
      setJobs(data || []);
      if (data && data.length > 0 && !selectedJobId) {
        setSelectedJobId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load job profiles:", err);
      setJobs([]);
    }
  };

  // Fetch only candidates who applied to this exact job and are in the "GD" stage
  const fetchCandidatesForJob = async (jobId) => {
    if (!jobId) {
      setCandidates([]);
      return;
    }
    setLoadingCandidates(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("job_id, candidates ( id, name, email, college_id, colleges ( name ) )")
        .eq("stage", "GD")
        .eq("job_id", jobId);

      if (error) throw error;

      const seen = new Map();
      (data || []).forEach((row) => {
        const c = row.candidates;
        if (c && !seen.has(c.id)) seen.set(c.id, { ...c, job_id: row.job_id });
      });
      setCandidates(Array.from(seen.values()));
    } catch (err) {
      console.error("Failed to load candidates for job:", err);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchSessions();
      await fetchJobs();
    };
    loadInitialData();
  }, []);

  // Whenever selected job changes, refresh the candidate list and clear selection
  useEffect(() => {
    setSelectedCandidates([]);
    if (selectedJobId) {
      fetchCandidatesForJob(selectedJobId);
    } else {
      setCandidates([]);
    }
  }, [selectedJobId]);

  const fetchSessionData = async (sessionId) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}`,
        { headers },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load session details");
        return null;
      }
      setSessionData(data);
      return data;
    } catch (err) {
      console.error("fetchSessionData error:", err);
      return null;
    }
  };

  const handleCreate = async () => {
    if (!selectedJobId) {
      alert("Please select a Job Profile first.");
      return;
    }
    if (!form.topic.trim()) {
      alert("Please enter a GD Topic.");
      return;
    }
    if (selectedCandidates.length === 0) {
      alert("Please select at least 1 candidate for the Group Discussion.");
      return;
    }

    if (sessionMode === "online") {
      if (!form.duration_minutes || isNaN(form.duration_minutes)) {
        alert("Please enter a valid duration in minutes.");
        return;
      }
      setCreating(true);
      try {
        const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/gd/create`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              topic: form.topic.trim(),
              duration_minutes: form.duration_minutes,
              job_id: selectedJobId,
              candidates: selectedCandidates,
            }),
          },
        );
        const data = await res.json();
        if (data.success) {
          alert("Online GD Session created! Invite emails sent to all selected students.");
          setForm({ topic: "", duration_minutes: 30 });
          setSelectedCandidates([]);
          await fetchSessions();
        } else {
          alert(data.error || "Failed to create GD session.");
        }
      } catch (err) {
        console.error("GD create error:", err);
        alert("Error connecting to server. Please try again.");
      } finally {
        setCreating(false);
      }
    } else {
      setCreating(true);
      try {
        const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/gd/create-offline`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              topic: form.topic.trim(),
              job_id: selectedJobId,
              candidates: selectedCandidates,
            }),
          },
        );
        const data = await res.json();
        if (data.success) {
          alert("Offline GD session created! You can now record manual candidate evaluations.");
          setForm({ topic: "", duration_minutes: 30 });
          setSelectedCandidates([]);
          await fetchSessions();
          setRatingSession(data.session.id);
          setActiveSession(data.session.id);
          await fetchSessionData(data.session.id);
        } else {
          alert(data.error || "Failed to create offline GD session.");
        }
      } catch (err) {
        console.error("Offline GD create error:", err);
        alert("Error connecting to server. Please try again.");
      } finally {
        setCreating(false);
      }
    }
  };

  const handleStart = async (sessionId) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}/start`,
        { method: "POST", headers },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to start session");
        return;
      }
      await fetchSessions();
      setActiveSession(sessionId);
      await fetchSessionData(sessionId);
    } catch (err) {
      console.error(err);
      alert("Error starting session");
    }
  };

  const handleEnd = async (sessionId) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}/end`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to end session");
        return;
      }
      alert("GD ended! AI is scoring all participants. Check back in 30 seconds.");
      await fetchSessions();
      await fetchSessionData(sessionId);
    } catch (err) {
      console.error(err);
      alert("Error ending session");
    }
  };

  const handleShortlist = async (sessionId, participantIds) => {
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}/shortlist`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ participantIds }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to shortlist candidates");
        return;
      }
      alert("Shortlisted! Selected candidates have been moved to Interview stage on the Pipeline board.");
      await fetchSessionData(sessionId);
    } catch (err) {
      console.error(err);
      alert("Error shortlisting candidates");
    }
  };

  const toggleCandidate = (c) => {
    setSelectedCandidates((prev) =>
      prev.find((x) => x.id === c.id)
        ? prev.filter((x) => x.id !== c.id)
        : [...prev, c],
    );
  };

  const handleToggleRating = async (sessionId) => {
    if (ratingSession === sessionId) {
      setRatingSession(null);
      return;
    }
    setRatingSession(sessionId);
    setActiveSession(sessionId);
    if (!sessionData || activeSession !== sessionId) {
      await fetchSessionData(sessionId);
    }
  };

  const getOrInitDraft = (p) => {
    return (
      ratingDrafts[p.id] || {
        confidence: p.manual_confidence || 0,
        communication: p.manual_communication || 0,
        content_knowledge: p.manual_content_knowledge || 0,
        leadership: p.manual_leadership || 0,
        teamwork: p.manual_teamwork || 0,
        comment: p.manual_comment || "",
      }
    );
  };

  const setRatingDraft = (p, key, value) => {
    setRatingDrafts((prev) => ({
      ...prev,
      [p.id]: { ...getOrInitDraft(p), [key]: value },
    }));
  };

  const saveRating = async (sessionId, p) => {
    const draft = getOrInitDraft(p);
    setSavingRatingId(p.id);
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/gd/participant/${p.id}/manual-rating`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(draft),
        },
      );
      const data = await res.json();
      if (data.success) {
        await fetchSessionData(sessionId);
        setRatingDrafts((prev) => {
          const copy = { ...prev };
          delete copy[p.id];
          return copy;
        });
      } else {
        alert(data.error || "Failed to save rating");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save rating");
    } finally {
      setSavingRatingId(null);
    }
  };

  const StarRow = ({ p, critKey }) => {
    const draft = getOrInitDraft(p);
    const value = draft[critKey] || 0;
    return (
      <div style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            onClick={() => setRatingDraft(p, critKey, n)}
            style={{
              cursor: "pointer",
              fontSize: 17,
              lineHeight: 1,
              color: n <= value ? "var(--warning)" : "var(--text-muted)",
              opacity: n <= value ? 1 : 0.5,
              userSelect: "none",
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="page active">
      <div className="page-head">
        <div>
          <h1>Group Discussion</h1>
          <p>Schedule online and offline GD rounds, evaluate candidates, and sync shortlisted talent directly to the Interview pipeline stage.</p>
        </div>
      </div>

      {/* Create Session Card */}
      <div className="panel" style={{ position: "relative", zIndex: 10 }}>
        <div className="panel-title">Create New GD Session</div>

        <div className="mode-toggle" style={{ marginBottom: 16 }}>
          <button
            className={`mode-btn ${sessionMode === "online" ? "active" : ""}`}
            onClick={() => setSessionMode("online")}
          >
            🎥 Online (Video Call)
          </button>
          <button
            className={`mode-btn ${sessionMode === "offline" ? "active" : ""}`}
            onClick={() => setSessionMode("offline")}
          >
            🤝 Offline (In-Person)
          </button>
        </div>

        <div className="panel-sub" style={{ marginBottom: 16 }}>
          {sessionMode === "online"
            ? "Students receive an automated email with their personal join link to the video room."
            : "Directly records scores for discussions that took place in person. No video rooms or candidate emails are sent."}
        </div>

        {/* Step 1: Mandatory Job Selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Target Job Profile <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          {jobs.length === 0 ? (
            <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-surface-2)", color: "var(--text-muted)", fontSize: 12 }}>
              No active job profiles found. Please create a job profile before scheduling a Group Discussion.
            </div>
          ) : (
            <select
              className="search-box"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8 }}
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.company ? `(${j.company})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Step 2: Topic & Duration */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: sessionMode === "online" ? "2fr 1fr" : "1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>GD Topic <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              className="search-box"
              style={{ width: "100%" }}
              placeholder="e.g. AI vs Human Intelligence in 2026"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>
          {sessionMode === "online" && (
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Duration (minutes)</label>
              <input
                type="number"
                className="search-box"
                style={{ width: "100%" }}
                value={form.duration_minutes}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({
                    ...form,
                    duration_minutes: val === "" ? "" : parseInt(val) || "",
                  });
                }}
              />
            </div>
          )}
        </div>

        {/* Step 3: Candidate Selection Scoped to Selected Job */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-muted)",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Eligible Candidates in "GD" Stage ({selectedCandidates.length} selected)</span>
            {loadingCandidates && <span>Loading candidates...</span>}
          </div>

          {/* Chips container */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              width: "100%",
              minHeight: 40,
              padding: "6px 8px",
              border: "1.5px solid var(--border-default)",
              borderRadius: 8,
              background: "var(--bg-surface-2)",
            }}
          >
            {selectedCandidates.map((c) => (
              <span
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--warning-soft)",
                  border: "1px solid var(--warning-border)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {c.name}
                <span
                  onClick={() => toggleCandidate(c)}
                  style={{
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                  }}
                >
                  ✕
                </span>
              </span>
            ))}
            <input
              style={{
                flex: 1,
                minWidth: 120,
                border: "none",
                outline: "none",
                fontSize: 12.5,
                padding: "4px 2px",
                background: "transparent",
                color: "var(--text-primary)",
              }}
              placeholder={
                selectedCandidates.length
                  ? "Add more…"
                  : candidates.length === 0
                  ? "No candidates currently in GD stage for this job"
                  : "Click to select eligible candidates…"
              }
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
          </div>

          {/* Candidates dropdown list */}
          {showDropdown && candidates.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 20,
                marginTop: 6,
                maxHeight: 240,
                overflowY: "auto",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                background: "var(--bg-surface)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {candidates
                .filter(
                  (c) =>
                    !selectedCandidates.find((x) => x.id === c.id) &&
                    (c.name
                      ?.toLowerCase()
                      .includes(candidateSearch.toLowerCase()) ||
                      c.colleges?.name
                        ?.toLowerCase()
                        .includes(candidateSearch.toLowerCase())),
                )
                .slice(0, 30)
                .map((c) => (
                  <div
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleCandidate(c)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-default)",
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-surface-2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {c.name}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {c.colleges?.name || "No college specified"} ·{" "}
                        {c.email || "No email"}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {candidates.length === 0 && selectedJobId && !loadingCandidates && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              No candidates are currently in the <strong>GD</strong> stage for this job. Move candidates to GD on the Candidate Pipeline board to schedule them.
            </div>
          )}
        </div>

        <button className="btn-gold" onClick={handleCreate} disabled={creating || !selectedJobId}>
          {creating
            ? sessionMode === "online"
              ? "Creating & Sending Emails..."
              : "Creating Session..."
            : sessionMode === "online"
              ? "+ Create Online GD Session"
              : "+ Create Offline GD & Rate Now"}
        </button>
      </div>

      {/* Sessions List */}
      <div className="panel">
        <div className="panel-title">Your Group Discussion Sessions</div>
        {sessions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 32,
              color: "var(--text-muted)",
            }}
          >
            No GD sessions scheduled yet.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{session.topic}</span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: session.mode === "offline" ? "rgba(100,116,139,0.12)" : "rgba(14,165,233,0.12)",
                        color: session.mode === "offline" ? "#475569" : "#0284c7",
                        fontWeight: 600,
                      }}
                    >
                      {session.mode === "offline" ? "🤝 Offline" : "🎥 Online"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted)",
                      marginTop: 3,
                    }}
                  >
                    {session.job_profiles?.title ? `Job: ${session.job_profiles.title} · ` : ""}
                    {session.duration_minutes ? `${session.duration_minutes} mins · ` : ""}
                    Created {new Date(session.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className={`badge ${session.status === "Active" ? "green" : session.status === "Ended" ? "gray" : "gold"}`}
                  >
                    {session.status}
                  </span>
                  {session.status === "Pending" && (
                    <button
                      className="btn-gold"
                      style={{ fontSize: 11.5, padding: "6px 12px" }}
                      onClick={() => handleStart(session.id)}
                    >
                      Start GD
                    </button>
                  )}
                  {session.status === "Active" && (
                    <button
                      className="btn-outline"
                      style={{
                        fontSize: 11.5,
                        padding: "6px 12px",
                        color: "var(--danger)",
                        borderColor: "var(--danger)",
                      }}
                      onClick={() => handleEnd(session.id)}
                    >
                      End GD
                    </button>
                  )}
                  <button
                    className="btn-outline"
                    style={{
                      fontSize: 11.5,
                      padding: "6px 12px",
                      color: "var(--warning)",
                      borderColor: "var(--warning-border)",
                      background:
                        ratingSession === session.id
                          ? "var(--warning-soft)"
                          : "transparent",
                    }}
                    onClick={() => handleToggleRating(session.id)}
                  >
                    ★ {ratingSession === session.id ? "Hide Evaluation" : "Rate Candidates"}
                  </button>
                  <button
                    className="btn-outline"
                    style={{ fontSize: 11.5, padding: "6px 12px" }}
                    onClick={async () => {
                      setActiveSession(session.id);
                      await fetchSessionData(session.id);
                    }}
                  >
                    View Results
                  </button>
                </div>
              </div>

              {/* Evaluation Panel */}
              {ratingSession === session.id && (
                <div
                  style={{
                    marginTop: 16,
                    background: "var(--bg-surface-2)",
                    borderRadius: 10,
                    padding: 16,
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      marginBottom: 4,
                      color: "var(--text-primary)",
                    }}
                  >
                    Manual Evaluation (1 to 5 Stars)
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginBottom: 14,
                    }}
                  >
                    Rate participants on the 5 key criteria. An average rating of 3.0 or higher automatically advances the candidate's application to the <strong>Interview</strong> stage on the hiring pipeline board.
                  </div>

                  {!sessionData || activeSession !== session.id ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      Loading participants…
                    </div>
                  ) : !sessionData.participants || sessionData.participants.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      No participants registered in this session.
                    </div>
                  ) : (
                    sessionData.participants.map((p) => {
                      const draft = getOrInitDraft(p);
                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: "14px 0",
                            borderBottom: "1px solid var(--border-default)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: "var(--text-primary)",
                              marginBottom: 10,
                            }}
                          >
                            {p.candidate_name} ({p.candidate_email || "No email"})
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(150px, 1fr))",
                              gap: 10,
                              marginBottom: 10,
                            }}
                          >
                            {RATING_CRITERIA.map((c) => (
                              <div key={c.key}>
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    color: "var(--text-muted)",
                                    marginBottom: 4,
                                  }}
                                >
                                  {c.label}
                                </div>
                                <StarRow p={p} critKey={c.key} />
                              </div>
                            ))}
                          </div>

                          <textarea
                            className="search-box"
                            placeholder="Optional evaluation comments..."
                            value={draft.comment}
                            onChange={(e) =>
                              setRatingDraft(p, "comment", e.target.value)
                            }
                            style={{
                              width: "100%",
                              minHeight: 56,
                              fontSize: 12,
                              resize: "vertical",
                              marginBottom: 10,
                            }}
                          />

                          <button
                            className="btn-gold"
                            style={{ fontSize: 11.5, padding: "6px 14px" }}
                            disabled={savingRatingId === p.id}
                            onClick={() => saveRating(session.id, p)}
                          >
                            {savingRatingId === p.id ? "Saving..." : "Save Rating"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* AI & Results Panel */}
              {activeSession === session.id && sessionData && (
                <div
                  style={{
                    marginTop: 16,
                    background: "var(--bg-surface-2)",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      marginBottom: 12,
                      color: "var(--text-primary)",
                    }}
                  >
                    Candidate Scores & Shortlist{" "}
                    {session.status !== "Ended" && session.mode === "online"
                      ? "(AI scores will generate once the session is marked Ended)"
                      : ""}
                  </div>
                  {sessionData.participants &&
                    sessionData.participants.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: "1px solid var(--border-default)",
                        }}
                      >
                        <div
                          className={`score-ring ${p.ai_score >= 70 ? "high" : p.ai_score >= 50 ? "mid" : "low"}`}
                          style={{ fontSize: p.ai_score ? 12 : 10 }}
                        >
                          {p.ai_score || "..."}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: "var(--text-primary)",
                            }}
                          >
                            {p.candidate_name}
                          </div>
                          {p.ai_score && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                marginTop: 2,
                              }}
                            >
                              Participation: {p.participation_score} ·
                              Communication: {p.communication_score} ·
                              Leadership: {p.leadership_score}
                            </div>
                          )}
                          {p.ai_feedback && (
                            <div
                              style={{
                                fontSize: 11.5,
                                color: "var(--text-muted)",
                                marginTop: 4,
                                fontStyle: "italic",
                              }}
                            >
                              {p.ai_feedback}
                            </div>
                          )}
                        </div>
                        {p.shortlisted ? (
                          <span className="badge green">Shortlisted</span>
                        ) : (
                          <button
                            className="btn-gold"
                            style={{ fontSize: 11, padding: "5px 10px" }}
                            onClick={() => handleShortlist(session.id, [p.id])}
                          >
                            Shortlist
                          </button>
                        )}
                      </div>
                    ))}

                  {sessionData.participants &&
                    sessionData.participants.filter(
                      (p) => p.ai_score && !p.shortlisted,
                    ).length > 0 && (
                      <button
                        className="btn-gold"
                        style={{ marginTop: 12 }}
                        onClick={() => {
                          const top = sessionData.participants
                            .filter((p) => p.ai_score >= 70 && !p.shortlisted)
                            .map((p) => p.id);
                          if (top.length) handleShortlist(session.id, top);
                          else alert("No candidates scored 70 or above");
                        }}
                      >
                        Shortlist All Above 70
                      </button>
                    )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
