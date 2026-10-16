import { useEffect, useState, useCallback, useMemo } from "react";
import { updateApplicationScore, openSecureDocument } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import TalentPassport from "./TalentPassport";

function badgeColor(score) {
  if (score >= 85) return { badge: "green", label: "Strong Match" };
  if (score >= 70) return { badge: "gold", label: "Moderate Match" };
  return { badge: "red", label: "Weak Match" };
}

function ringClass(score) {
  if (score >= 85) return "high";
  if (score >= 70) return "mid";
  return "low";
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Resume() {
  const [rows, setRows] = useState([]);
  const [passportId, setPassportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    resume_score: "",
    matched_skills: "",
    missing_skills: "",
  });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [search, setSearch] = useState("");

  const loadResumes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("applications")
        .select(
          `
          id, resume_score, matched_skills, missing_skills,
          ai_score, ai_status, match_label, ai_feedback,
          candidate_id,
          candidates ( id, name, resume_url, colleges ( name ) ),
          job_profiles ( title, company )
        `,
        )
        .order("created_at", { ascending: false });
      if (err) throw err;
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadResumes();
    };
    init();
  }, [loadResumes]);

  // Group applications by candidate — one person, one card, every job they
  // applied to listed underneath instead of repeated as separate entries.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.candidates?.id ?? r.candidate_id ?? r.id;
      if (!map.has(key)) {
        map.set(key, { key, candidate: r.candidates, applications: [] });
      }
      map.get(key).applications.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      const name = g.candidate?.name?.toLowerCase() || "";
      const college = g.candidate?.colleges?.name?.toLowerCase() || "";
      const jobs = g.applications
        .map((a) =>
          `${a.job_profiles?.title} ${a.job_profiles?.company}`.toLowerCase(),
        )
        .join(" ");
      return name.includes(q) || college.includes(q) || jobs.includes(q);
    });
  }, [groups, search]);

  function startEdit(r) {
    setEditingId(r.id);
    setEditForm({
      resume_score: r.resume_score ?? r.ai_score ?? "",
      matched_skills: (r.matched_skills || []).join(", "),
      missing_skills: (r.missing_skills || []).join(", "),
    });
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      await updateApplicationScore(id, {
        resume_score: Number(editForm.resume_score),
        matched_skills: editForm.matched_skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        missing_skills: editForm.missing_skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditingId(null);
      await loadResumes();
    } catch (err) {
      alert("Could not save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function getScore(r) {
    if (r.resume_score != null) return { score: r.resume_score, isAI: false };
    if (r.ai_score != null) return { score: r.ai_score, isAI: true };
    return { score: null, isAI: false };
  }

  if (loading) {
    return (
      <div className="page active">
        <div className="page-head">
          <div>
            <h1>Resume Analyzer (AI)</h1>
            <p>Loading...</p>
          </div>
        </div>
        <div
          className="panel"
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text-muted)",
          }}
        >
          Loading resumes...
        </div>
      </div>
    );
  }

  return (
    <div className="page active" id="page-resume">
      <div className="page-head">
        <div>
          <h1>Resume Analyzer (AI)</h1>
          <p>
            {rows.length} application{rows.length !== 1 ? "s" : ""} ·{" "}
            {groups.length} candidate{groups.length !== 1 ? "s" : ""} · AI
            auto-scores against job requirements
          </p>
        </div>
        <button className="btn-outline" onClick={loadResumes}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "var(--danger-soft)",
            border: "1px solid var(--danger-border)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          Error: {error}
        </div>
      )}

      {groups.length > 0 && (
        <div className="toolbar">
          <input
            className="search-box"
            placeholder="Search by candidate name, college, or job..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {groups.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            No resumes yet.
          </div>
          <div
            style={{
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "10px 20px",
              display: "inline-block",
              fontSize: 13,
              color: "var(--text-primary)",
              fontWeight: 600,
            }}
          >
            Share this link → {window.location.origin}/apply
          </div>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div
          className="panel"
          style={{
            textAlign: "center",
            padding: 48,
            color: "var(--text-muted)",
            fontSize: 13.5,
          }}
        >
          No candidates match "{search}".
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleGroups.map((g) => {
            const candidate = g.candidate;
            const apps = g.applications;
            const isCandidateOpen = expandedCandidate === g.key;
            const scored = apps.map(getScore).filter((s) => s.score != null);
            const bestScore = scored.length
              ? Math.max(...scored.map((s) => s.score))
              : null;
            const hasAnyScore = bestScore != null;
            const pendingCount = apps.filter(
              (a) => a.ai_status === "Pending",
            ).length;

            return (
              <div key={g.key} className="panel" style={{ padding: 0 }}>
                {/* Candidate summary row */}
                <div
                  style={{
                    padding: "18px 22px",
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setExpandedCandidate(isCandidateOpen ? null : g.key)
                  }
                >
                  <div
                    className="avatar"
                    style={{
                      width: 46,
                      height: 46,
                      fontSize: 15,
                      cursor: "default",
                    }}
                  >
                    {initials(candidate?.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="panel-title" style={{ marginBottom: 0 }}>
                        {candidate?.name || "Unnamed candidate"}
                      </span>
                      <span className="pill">
                        {apps.length} application{apps.length > 1 ? "s" : ""}
                      </span>
                      {pendingCount > 0 && (
                        <span className="badge gold">
                          ⏳ {pendingCount} analyzing
                        </span>
                      )}
                    </div>
                    <div
                      className="panel-sub"
                      style={{ marginBottom: 0, marginTop: 2 }}
                    >
                      {candidate?.colleges?.name || "College not set"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      className={`score-ring ${hasAnyScore ? ringClass(bestScore) : ""}`}
                      style={{
                        width: 46,
                        height: 46,
                        fontSize: 13,
                        ...(!hasAnyScore && {
                          background: "var(--bg-surface-2)",
                          color: "var(--text-muted)",
                          border: "2px solid var(--border-default)",
                        }),
                      }}
                    >
                      {hasAnyScore ? bestScore : "—"}
                    </div>
                    {candidate?.resume_url && (
                      <button
                        className="btn-outline"
                        style={{ padding: "7px 12px", fontSize: 12.5 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openSecureDocument(candidate.resume_url);
                        }}
                      >
                        📎 Resume
                      </button>
                    )}
                    <button
                      className="btn-outline"
                      style={{ padding: "7px 12px", fontSize: 12.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPassportId(candidate?.id);
                      }}
                    >
                      📋 Passport
                    </button>
                    <span
                      style={{
                        fontSize: 18,
                        color: "var(--text-muted)",
                        transform: isCandidateOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                        display: "inline-block",
                      }}
                    >
                      ⌄
                    </span>
                  </div>
                </div>

                {/* Per-job applications */}
                {isCandidateOpen && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border-default)",
                      background: "var(--bg-surface-2)",
                      padding: "4px 22px 8px",
                    }}
                  >
                    {apps.map((r) => {
                      const { score, isAI } = getScore(r);
                      const hasScore = score != null;
                      const matched = r.matched_skills || [];
                      const missing = r.missing_skills || [];
                      const isEditing = editingId === r.id;
                      const isExpanded = expandedId === r.id;

                      return (
                        <div
                          key={r.id}
                          className="resume-row"
                          style={{
                            borderBottom: "1px solid var(--border-default)",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            className={`score-ring ${hasScore ? ringClass(score) : ""}`}
                            style={{
                              width: 44,
                              height: 44,
                              fontSize: 13,
                              ...(!hasScore && {
                                background: "var(--bg-surface)",
                                color: "var(--text-muted)",
                                border: "2px solid var(--border-default)",
                              }),
                            }}
                          >
                            {hasScore
                              ? score
                              : r.ai_status === "Pending"
                                ? "···"
                                : "—"}
                          </div>

                          <div
                            className="resume-info"
                            style={{ flex: 1, minWidth: 180 }}
                          >
                            <div className="name">
                              {r.job_profiles?.title}{" "}
                              <span
                                style={{
                                  fontWeight: 400,
                                  color: "var(--text-muted)",
                                }}
                              >
                                · {r.job_profiles?.company}
                              </span>
                            </div>
                            <div className="skills">
                              {isAI && hasScore && "🤖 AI scored"}
                              {!hasScore &&
                                r.ai_status === "Pending" &&
                                "⏳ Analyzing resume..."}
                              {!hasScore &&
                                r.ai_status === "Failed" &&
                                "⚠️ Auto-scoring failed — add score manually"}
                              {!hasScore &&
                                r.ai_status !== "Pending" &&
                                r.ai_status !== "Failed" &&
                                "Not scored yet"}
                            </div>
                            {hasScore && (
                              <div
                                className="progress-bar"
                                style={{ maxWidth: 240 }}
                              >
                                <div
                                  style={{
                                    width: `${score}%`,
                                    background:
                                      score >= 85
                                        ? "var(--success)"
                                        : score >= 70
                                          ? "var(--warning)"
                                          : "var(--danger)",
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {hasScore && (
                            <span
                              className={`badge ${badgeColor(score).badge}`}
                            >
                              {r.match_label || badgeColor(score).label}
                            </span>
                          )}

                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn-outline"
                              style={{ padding: "6px 12px", fontSize: 12 }}
                              onClick={() =>
                                setExpandedId(isExpanded ? null : r.id)
                              }
                            >
                              {isExpanded ? "▲ Hide" : "▼ Details"}
                            </button>
                            <button
                              className="btn-gold"
                              style={{ padding: "6px 14px", fontSize: 12 }}
                              onClick={() => startEdit(r)}
                            >
                              {hasScore ? "✏️ Edit" : "+ Add"}
                            </button>
                          </div>

                          {isExpanded && !isEditing && (
                            <div
                              style={{
                                width: "100%",
                                background: "var(--bg-surface)",
                                borderRadius: 10,
                                border: "1px solid var(--border-default)",
                                padding: "16px 18px",
                                margin: "4px 0 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: 16,
                                  marginBottom: r.ai_feedback ? 16 : 0,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: "#059669",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 8,
                                    }}
                                  >
                                    ✅ Matched skills
                                  </div>
                                  {matched.length > 0 ? (
                                    <div>
                                      {matched.map((s) => (
                                        <span
                                          key={s}
                                          className="course-chip"
                                          style={{
                                            cursor: "default",
                                            background: "var(--bg-surface-2)",
                                            borderColor: "#34D399",
                                            color: "var(--text-primary)",
                                          }}
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      None recorded
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: "#DC2626",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 8,
                                    }}
                                  >
                                    ❌ Missing skills
                                  </div>
                                  {missing.length > 0 ? (
                                    <div>
                                      {missing.map((s) => (
                                        <span
                                          key={s}
                                          className="course-chip"
                                          style={{
                                            cursor: "default",
                                            background: "var(--bg-surface-2)",
                                            borderColor: "#F87171",
                                            color: "var(--text-primary)",
                                          }}
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      None recorded
                                    </div>
                                  )}
                                </div>
                              </div>
                              {r.ai_feedback && (
                                <div
                                  style={{
                                    borderTop:
                                      "1px solid var(--border-default)",
                                    paddingTop: 14,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: "var(--info)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 6,
                                    }}
                                  >
                                    🤖 AI feedback
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 13.5,
                                      color: "var(--text-secondary)",
                                      lineHeight: 1.7,
                                    }}
                                  >
                                    {r.ai_feedback}
                                  </div>
                                </div>
                              )}
                              {!hasScore && !r.ai_feedback && (
                                <div
                                  style={{
                                    textAlign: "center",
                                    color: "var(--text-muted)",
                                    fontSize: 13,
                                  }}
                                >
                                  No analysis yet — click "+ Add" to score
                                  manually.
                                </div>
                              )}
                            </div>
                          )}

                          {isEditing && (
                            <div
                              style={{
                                width: "100%",
                                background: "var(--bg-surface)",
                                borderRadius: 10,
                                border: "1px solid var(--border-default)",
                                padding: "16px 18px",
                                margin: "4px 0 12px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                  marginBottom: 14,
                                }}
                              >
                                Edit score — {r.job_profiles?.title} at{" "}
                                {r.job_profiles?.company}
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "110px 1fr 1fr",
                                  gap: 12,
                                  marginBottom: 14,
                                }}
                              >
                                <div>
                                  <label
                                    style={{
                                      fontSize: 11.5,
                                      color: "var(--text-muted)",
                                      display: "block",
                                      marginBottom: 5,
                                    }}
                                  >
                                    Score (0–100)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editForm.resume_score}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        resume_score: e.target.value,
                                      })
                                    }
                                    className="search-box"
                                    style={{ fontWeight: 700 }}
                                  />
                                </div>
                                <div>
                                  <label
                                    style={{
                                      fontSize: 11.5,
                                      color: "var(--text-muted)",
                                      display: "block",
                                      marginBottom: 5,
                                    }}
                                  >
                                    Matched skills
                                  </label>
                                  <input
                                    value={editForm.matched_skills}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        matched_skills: e.target.value,
                                      })
                                    }
                                    placeholder="Java, SQL, Communication"
                                    className="search-box"
                                  />
                                </div>
                                <div>
                                  <label
                                    style={{
                                      fontSize: 11.5,
                                      color: "var(--text-muted)",
                                      display: "block",
                                      marginBottom: 5,
                                    }}
                                  >
                                    Missing skills
                                  </label>
                                  <input
                                    value={editForm.missing_skills}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        missing_skills: e.target.value,
                                      })
                                    }
                                    placeholder="AWS, Docker"
                                    className="search-box"
                                  />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 10 }}>
                                <button
                                  className="btn-gold"
                                  disabled={saving}
                                  onClick={() => saveEdit(r.id)}
                                >
                                  {saving ? "Saving..." : "✓ Save score"}
                                </button>
                                <button
                                  className="btn-outline"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {passportId && (
        <TalentPassport
          candidateId={passportId}
          onClose={() => setPassportId(null)}
        />
      )}
    </div>
  );
}
