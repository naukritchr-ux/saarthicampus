import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCandidatesByStage, authHeaders } from "../lib/api";

const RATING_CRITERIA = [
  { key: "confidence", label: "Confidence" },
  { key: "communication", label: "Communication" },
  { key: "content_knowledge", label: "Content Knowledge" },
  { key: "leadership", label: "Leadership" },
  { key: "teamwork", label: "Teamwork" },
];

export default function GDAdmin() {
  const [sessions, setSessions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ topic: "", duration_minutes: 30 });
  const [sessionMode, setSessionMode] = useState("online"); // 'online' | 'offline'
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // NEW: which session's "Rate Participants" panel is open, and per-participant draft ratings
  const [ratingSession, setRatingSession] = useState(null);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [savingRatingId, setSavingRatingId] = useState(null);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("gd_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    setSessions(data || []);
  };

  // Only candidates the Pipeline board has moved into the "GD" column show
  // up here — keeps this module in sync with the pipeline stage.
  const fetchCandidates = async () => {
    try {
      const data = await getCandidatesByStage("GD");
      setCandidates(data || []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
      setCandidates([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchSessions();
      await fetchCandidates();
    };
    load();
  }, []);

  const fetchSessionData = async (sessionId) => {
    const headers = await authHeaders();
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}`,
      { headers },
    );
    const data = await res.json();
    setSessionData(data);
    return data;
  };

  const handleCreate = async () => {
    if (!form.topic || selectedCandidates.length === 0) {
      alert("Please enter a topic and select at least 1 candidate");
      return;
    }

    if (sessionMode === "online") {
      if (!form.duration_minutes || isNaN(form.duration_minutes)) {
        alert("Please enter a valid duration");
        return;
      }
      setCreating(true);
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/gd/create`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            topic: form.topic,
            duration_minutes: form.duration_minutes,
            candidates: selectedCandidates,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        alert("GD Session created! Invite emails sent to all students.");
        setForm({ topic: "", duration_minutes: 30 });
        setSelectedCandidates([]);
        await fetchSessions();
      }
      setCreating(false);
    } else {
      setCreating(true);
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/gd/create-offline`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            topic: form.topic,
            candidates: selectedCandidates,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        alert("Offline GD session created! You can now rate participants.");
        setForm({ topic: "", duration_minutes: 30 });
        setSelectedCandidates([]);
        await fetchSessions();
        setRatingSession(data.session.id);
        setActiveSession(data.session.id);
        await fetchSessionData(data.session.id);
      }
      setCreating(false);
    }
  };

  const handleStart = async (sessionId) => {
    const headers = await authHeaders();
    await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}/start`,
      { method: "POST", headers },
    );
    await fetchSessions();
    setActiveSession(sessionId);
    await fetchSessionData(sessionId);
  };

  const handleEnd = async (sessionId) => {
    const headers = await authHeaders();
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}/end`, {
      method: "POST",
      headers,
    });
    alert(
      "GD ended! AI is scoring all participants. Check back in 30 seconds.",
    );
    await fetchSessions();
    await fetchSessionData(sessionId);
  };

  const handleShortlist = async (sessionId, participantIds) => {
    const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
    await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/gd/${sessionId}/shortlist`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ participantIds }),
      },
    );
    alert("Shortlisted! Emails sent to selected students.");
    await fetchSessionData(sessionId);
  };

  const toggleCandidate = (c) => {
    setSelectedCandidates((prev) =>
      prev.find((x) => x.id === c.id)
        ? prev.filter((x) => x.id !== c.id)
        : [...prev, c],
    );
  };

  // NEW: toggle the "Rate Participants" collapsible section for a session
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

  // NEW: get current draft for a participant, defaulting to saved DB values
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

  // NEW: update a single field in a participant's draft
  const setRatingDraft = (p, key, value) => {
    setRatingDrafts((prev) => ({
      ...prev,
      [p.id]: { ...getOrInitDraft(p), [key]: value },
    }));
  };

  // NEW: save a participant's manual rating to the backend
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
    }
    setSavingRatingId(null);
  };

  // NEW: 5-star selector for one criterion
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
          <p>Create sessions, invite students, AI auto-scores after GD ends</p>
        </div>
      </div>

      {/* Create Session */}
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

        <div className="panel-sub">
          {sessionMode === "online"
            ? "Students will receive an email with their personal video call join link"
            : "No emails sent — record ratings directly for an in-person discussion that already happened"}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: sessionMode === "online" ? "2fr 1fr" : "1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label>GD Topic</label>
            <input
              className="search-box"
              style={{ width: "100%" }}
              placeholder="e.g. AI vs Human Intelligence"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>
          {sessionMode === "online" && (
            <div className="field" style={{ margin: 0 }}>
              <label>Duration (minutes)</label>
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

        <div style={{ marginBottom: 16, position: "relative" }}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Select Candidates ({selectedCandidates.length} selected)
          </div>

          {/* Input box with selected candidates shown as chips */}
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
                  : "Click to select candidates…"
              }
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />
          </div>

          {/* Dropdown suggestions — show on focus or while typing */}
          {showDropdown && (
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
                .slice(0, 20)
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
                        {c.colleges?.name || "No college set"} ·{" "}
                        {c.email || "No email"}
                      </div>
                    </div>
                  </div>
                ))}
              {candidates.filter(
                (c) =>
                  !selectedCandidates.find((x) => x.id === c.id) &&
                  (c.name
                    ?.toLowerCase()
                    .includes(candidateSearch.toLowerCase()) ||
                    c.colleges?.name
                      ?.toLowerCase()
                      .includes(candidateSearch.toLowerCase())),
              ).length === 0 && (
                <div
                  style={{
                    padding: 12,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  No candidates found
                </div>
              )}
            </div>
          )}
        </div>

        <button className="btn-gold" onClick={handleCreate} disabled={creating}>
          {creating
            ? sessionMode === "online"
              ? "Creating & Sending Emails..."
              : "Creating Session..."
            : sessionMode === "online"
              ? "+ Create GD Session"
              : "+ Create Offline Session & Rate Now"}
        </button>
      </div>

      {/* Sessions List */}
      <div className="panel">
        <div className="panel-title">GD Sessions</div>
        {sessions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 32,
              color: "var(--text-muted)",
            }}
          >
            No sessions yet
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
                    }}
                  >
                    {session.topic}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted)",
                      marginTop: 3,
                    }}
                  >
                    {session.duration_minutes} mins · Created{" "}
                    {new Date(session.created_at).toLocaleDateString()}
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
                  {/* NEW: Rate Participants toggle — available regardless of session status */}
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
                    ★{" "}
                    {ratingSession === session.id
                      ? "Hide Rating"
                      : "Rate Participants"}
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

              {/* NEW: Sir's Rating collapsible panel */}
              {ratingSession === session.id && (
                <div
                  style={{
                    marginTop: 16,
                    background: "rgba(0,0,0,0.22)",
                    borderRadius: 10,
                    padding: 16,
                    border: "1px solid rgba(245,158,11,0.3)",
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
                    Manual Evaluation
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginBottom: 14,
                    }}
                  >
                    Rate each participant on the criteria below. Ratings can be
                    submitted before, during, or after the GD.
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
                  ) : !sessionData.participants ||
                    sessionData.participants.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      No participants found
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
                            {p.candidate_name}
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
                            placeholder="Comment (optional)"
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
                            {savingRatingId === p.id
                              ? "Saving..."
                              : "Save Rating"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Results panel */}
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
                    AI Scores{" "}
                    {session.status !== "Ended"
                      ? "(available after GD ends)"
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
                          p.ai_score && (
                            <button
                              className="btn-gold"
                              style={{ fontSize: 11, padding: "5px 10px" }}
                              onClick={() =>
                                handleShortlist(session.id, [p.id])
                              }
                            >
                              Shortlist
                            </button>
                          )
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