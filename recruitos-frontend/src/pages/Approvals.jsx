import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Approvals() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);

  // filters
  const [branchFilter, setBranchFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [backlogFilter, setBacklogFilter] = useState(""); // "", "yes", "no"
  const [minCgpa, setMinCgpa] = useState("");

  async function loadShortlisted() {
    setLoading(true);
    setError(null);

    const { data: profile } = await supabase.auth.getUser();
    const userId = profile?.user?.id;
    console.log("userId:", userId);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    console.log("profileRow:", profileRow, "profileError:", profileError);

    if (!profileRow?.company_id) {
      setError("No company linked to this account.");
      setLoading(false);
      return;
    }

    const { data: myJobs, error: jobsError } = await supabase
      .from("job_profiles")
      .select("id, title")
      .eq("company_id", profileRow.company_id);
    console.log("myJobs:", myJobs, "jobsError:", jobsError);

    const jobIds = (myJobs || []).map((j) => j.id);
    if (jobIds.length === 0) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("applications")
      .select(`
        id, stage, resume_score, created_at,
        candidates ( id, name, email, phone, resume_url, photo_url, degree, branch, cgpa, passing_year, active_backlogs, tenth_percentage, twelfth_percentage ),
        job_profiles ( title )
      `)
      .in("job_id", jobIds)
      .in("stage", ["Interview", "GD", "Selected"])
      .order("created_at", { ascending: false });
    console.log("applications data:", data, "applications error:", error);

    if (error) {
      setError("Could not load shortlisted candidates.");
    } else {
      setCandidates(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      await loadShortlisted(ignore);
    }

    init();
    return () => { ignore = true; };
  }, []);

  async function handleApprove(applicationId) {
    const { error } = await supabase
      .from("applications")
      .update({ stage: "Selected" })
      .eq("id", applicationId);

    if (error) {
      alert("Could not approve candidate.");
    } else {
      setSelectedApp(null);
      await loadShortlisted();
    }
  }

  async function handleReject(applicationId) {
    if (!window.confirm("Reject this candidate?")) return;

    const { error } = await supabase
      .from("applications")
      .update({ stage: "Rejected" })
      .eq("id", applicationId);

    if (error) {
      alert("Could not reject candidate.");
    } else {
      setSelectedApp(null);
      await loadShortlisted();
    }
  }

  // Unique branch list for the dropdown, derived from loaded data
  const branchOptions = useMemo(() => {
    const set = new Set();
    candidates.forEach((c) => {
      if (c.candidates?.branch) set.add(c.candidates.branch);
    });
    const opts = Array.from(set).sort();
    console.log("candidates loaded:", candidates.length, "branch values found:", opts);
    return opts;
  }, [candidates]);

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.candidates?.name?.toLowerCase().includes(q) ||
      c.job_profiles?.title?.toLowerCase().includes(q) ||
      c.candidates?.email?.toLowerCase().includes(q);

    const matchesBranch = !branchFilter || c.candidates?.branch === branchFilter;
    const matchesStage = !stageFilter || c.stage === stageFilter;
    const matchesBacklog =
      !backlogFilter ||
      (backlogFilter === "yes" ? !!c.candidates?.active_backlogs : !c.candidates?.active_backlogs);
    const matchesCgpa =
      !minCgpa || (c.candidates?.cgpa !== null && c.candidates?.cgpa !== undefined && c.candidates.cgpa >= parseFloat(minCgpa));

    return matchesSearch && matchesBranch && matchesStage && matchesBacklog && matchesCgpa;
  });

  const hasActiveFilters = branchFilter || stageFilter || backlogFilter || minCgpa;

  function clearFilters() {
    setBranchFilter("");
    setStageFilter("");
    setBacklogFilter("");
    setMinCgpa("");
  }

  return (
    <div className="page active" id="page-approvals">
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p>
            {loading ? "Loading…" : `${filtered.length} of ${candidates.length} shortlisted candidates`}
            {" · "}
            review and finalize who moves ahead
          </p>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ color: "crimson" }}>
          {error}
        </div>
      )}

      <div className="panel">
        {/* SEARCH + FILTER ROW */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            className="search-box"
            placeholder="Search by name, email, or job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 260px", minWidth: 220 }}
          />

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="search-box"
            style={{ flex: "0 1 160px", minWidth: 140 }}
          >
            <option value="">All Branches</option>
            {branchOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="search-box"
            style={{ flex: "0 1 150px", minWidth: 130 }}
          >
            <option value="">All Stages</option>
            <option value="Interview">Interview</option>
            <option value="GD">GD</option>
            <option value="Selected">Selected</option>
          </select>

          <select
            value={backlogFilter}
            onChange={(e) => setBacklogFilter(e.target.value)}
            className="search-box"
            style={{ flex: "0 1 150px", minWidth: 130 }}
          >
            <option value="">Backlogs: Any</option>
            <option value="no">No Backlogs</option>
            <option value="yes">Has Backlogs</option>
          </select>

          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            placeholder="Min CGPA"
            value={minCgpa}
            onChange={(e) => setMinCgpa(e.target.value)}
            className="search-box"
            style={{ flex: "0 1 110px", minWidth: 100 }}
          />

          {hasActiveFilters && (
            <button
              className="btn-outline"
              style={{ padding: "6px 12px", fontSize: 12.5 }}
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", minWidth: 900 }}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Stage</th>
                <th>Resume Score</th>
                <th>Resume</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((app) => (
                  <tr key={app.id}>
                    <td style={{ cursor: "pointer" }} onClick={() => setSelectedApp(app)}>
                      <strong style={{ color: "var(--primary)" }}>{app.candidates?.name}</strong>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {app.candidates?.email}
                      </div>
                    </td>
                    <td>{app.job_profiles?.title || "—"}</td>
                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: app.stage === "Selected" ? "#E8F7EE" : "#FFF3E0",
                          color: app.stage === "Selected" ? "#16803A" : "#A15C00",
                        }}
                      >
                        {app.stage}
                      </span>
                    </td>
                    <td>{app.resume_score ?? "—"}</td>
                    <td>
                      {app.candidates?.resume_url ? (
                        <a href={app.candidates.resume_url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {app.stage !== "Selected" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-gold" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleApprove(app.id)}>
                            Approve
                          </button>
                          <button className="btn-outline" style={{ padding: "4px 10px", fontSize: 12, color: "crimson" }} onClick={() => handleReject(app.id)}>
                            Reject
                          </button>
                        </div>
                      )}
                      {app.stage === "Selected" && (
                        <span style={{ fontSize: 12, color: "#16803A", fontWeight: 600 }}>✓ Approved</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--slate-light)", padding: 24 }}>
                    No candidates match your search/filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CANDIDATE QUICK VIEW POPUP */}
      {selectedApp && (
        <div
          onClick={() => setSelectedApp(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="panel-title" style={{ margin: 0 }}>Candidate Profile</div>
              <button onClick={() => setSelectedApp(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              {selectedApp.candidates?.photo_url ? (
                <img src={selectedApp.candidates.photo_url} alt="" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#eee" }} />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedApp.candidates?.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{selectedApp.candidates?.email}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{selectedApp.candidates?.phone || "—"}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <div><strong>Job:</strong> {selectedApp.job_profiles?.title || "—"}</div>
              <div><strong>Stage:</strong> {selectedApp.stage}</div>
              <div><strong>Degree:</strong> {selectedApp.candidates?.degree || "—"}</div>
              <div><strong>Branch:</strong> {selectedApp.candidates?.branch || "—"}</div>
              <div><strong>CGPA:</strong> {selectedApp.candidates?.cgpa ?? "—"}</div>
              <div><strong>Passing Year:</strong> {selectedApp.candidates?.passing_year || "—"}</div>
              <div><strong>10th %:</strong> {selectedApp.candidates?.tenth_percentage ?? "—"}</div>
              <div><strong>12th %:</strong> {selectedApp.candidates?.twelfth_percentage ?? "—"}</div>
              <div><strong>Resume Score:</strong> {selectedApp.resume_score ?? "—"}</div>
              <div>
                <strong>Backlogs:</strong>{" "}
                <span style={{ color: selectedApp.candidates?.active_backlogs ? "#c0392b" : "#16803A", fontWeight: 600 }}>
                  {selectedApp.candidates?.active_backlogs ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {selectedApp.candidates?.resume_url && (
              <div style={{ marginTop: 14 }}>
                <a href={selectedApp.candidates.resume_url} target="_blank" rel="noreferrer" className="btn-outline" style={{ display: "inline-block", padding: "6px 14px", fontSize: 12.5, textDecoration: "none" }}>
                  View Resume
                </a>
              </div>
            )}

            {selectedApp.stage !== "Selected" && (
              <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border-default, #eee)" }}>
                <button className="btn-gold" onClick={() => handleApprove(selectedApp.id)}>Approve Candidate</button>
                <button className="btn-outline" style={{ color: "crimson" }} onClick={() => handleReject(selectedApp.id)}>Reject</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}