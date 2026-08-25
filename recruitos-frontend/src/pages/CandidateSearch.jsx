import { useEffect, useState } from "react";
import {
  searchCandidates,
  saveCandidate,
  unsaveCandidate,
} from "../lib/api";

const emptyFilters = {
  name: "",
  college: "",
  degree: "",
  branch: "",
  skills: "",
  location: "",
  minCgpa: "",
  minExperience: "",
};

export default function CandidateSearch() {
  const [filters, setFilters] = useState(emptyFilters);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [minMatch, setMinMatch] = useState("All");

  async function runSearch(activeFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const data = await searchCandidates(activeFilters);
      setCandidates(data || []);
    } catch (err) {
      console.error("Candidate search failed:", err);
      setError("Could not load candidates. Check your connection.");
    }
    setLoading(false);
  }

  useEffect(() => {
    runSearch(emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    runSearch(filters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setMinMatch("All");
    runSearch(emptyFilters);
  }

  async function toggleSave(candidate) {
    setSavingId(candidate.id);
    try {
      if (candidate.saved) {
        await unsaveCandidate(candidate.id);
      } else {
        await saveCandidate(candidate.id);
      }
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id ? { ...c, saved: !c.saved } : c,
        ),
      );
      if (selectedCandidate?.id === candidate.id) {
        setSelectedCandidate((prev) => ({ ...prev, saved: !prev.saved }));
      }
    } catch (err) {
      console.error("Save/unsave failed:", err);
      alert("Could not update saved status.");
    }
    setSavingId(null);
  }

  const displayedCandidates = candidates.filter((c) => {
    if (minMatch === "All") return true;
    const threshold = Number(minMatch);
    return (c.match ?? 0) >= threshold;
  });

  return (
    <div className="page active" id="page-candidate-search">
      <div className="page-head">
        <div>
          <h1>Candidate Search</h1>
          <p>Search the full candidate pool and find the right freshers for your roles</p>
        </div>
      </div>

      {/* FILTER FORM */}
      <form onSubmit={handleSearchSubmit} className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Filters</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <input
            className="search-box"
            placeholder="Name"
            value={filters.name}
            onChange={(e) => handleFilterChange("name", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="College"
            value={filters.college}
            onChange={(e) => handleFilterChange("college", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="Degree (e.g. B.Tech)"
            value={filters.degree}
            onChange={(e) => handleFilterChange("degree", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="Branch"
            value={filters.branch}
            onChange={(e) => handleFilterChange("branch", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="Skills (e.g. React)"
            value={filters.skills}
            onChange={(e) => handleFilterChange("skills", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="Location"
            value={filters.location}
            onChange={(e) => handleFilterChange("location", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="Min CGPA"
            type="number"
            step="0.1"
            value={filters.minCgpa}
            onChange={(e) => handleFilterChange("minCgpa", e.target.value)}
          />
          <input
            className="search-box"
            placeholder="Min Experience (yrs)"
            type="number"
            step="0.5"
            value={filters.minExperience}
            onChange={(e) => handleFilterChange("minExperience", e.target.value)}
          />

          <select
            className="search-box"
            value={minMatch}
            onChange={(e) => setMinMatch(e.target.value)}
          >
            <option value="All">All Match Scores</option>
            <option value="90">90%+</option>
            <option value="80">80%+</option>
            <option value="70">70%+</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn-gold" type="submit">
            Search
          </button>
          <button className="btn-outline" type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="panel" style={{ color: "crimson", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* RESULTS */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--border-default, #eee)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {loading ? "Searching…" : `${displayedCandidates.length} candidates found`}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", minWidth: 1200 }}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>College</th>
                <th>Degree / Branch</th>
                <th>CGPA</th>
                <th>Skills</th>
                <th>Location</th>
                <th>Experience</th>
                <th>Match</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              ) : displayedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                    No candidates match the selected filters.
                  </td>
                </tr>
              ) : (
                displayedCandidates.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.college}</td>
                    <td>
                      {c.degree} {c.branch !== "—" ? `/ ${c.branch}` : ""}
                    </td>
                    <td>{c.cgpa ?? "—"}</td>
                    <td>{c.skills || "—"}</td>
                    <td>{c.location}</td>
                    <td>
                      {c.experience_years != null
                        ? `${c.experience_years} yrs`
                        : "Fresher"}
                    </td>
                    <td>
                      {c.match != null ? (
                        <span className="match-score">{c.match}%</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          Not Applied
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                        <button
                          className="btn-outline"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => setSelectedCandidate(c)}
                        >
                          View
                        </button>
                        <button
                          className="btn-outline"
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            opacity: savingId === c.id ? 0.6 : 1,
                          }}
                          disabled={savingId === c.id}
                          onClick={() => toggleSave(c)}
                        >
                          {c.saved ? "★ Saved" : "☆ Save"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CANDIDATE DETAILS MODAL */}
      {selectedCandidate && (
        <div
          className="corporate-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="panel"
            style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{selectedCandidate.name}</h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                  Candidate Profile
                </p>
              </div>
              <button
                className="btn-outline"
                style={{ padding: "5px 10px" }}
                onClick={() => setSelectedCandidate(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginTop: 18,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>COLLEGE</span>
                <div style={{ fontWeight: 700 }}>{selectedCandidate.college}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>DEGREE / BRANCH</span>
                <div style={{ fontWeight: 700 }}>
                  {selectedCandidate.degree} {selectedCandidate.branch !== "—" ? `/ ${selectedCandidate.branch}` : ""}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>CGPA</span>
                <div style={{ fontWeight: 700 }}>{selectedCandidate.cgpa ?? "—"}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>LOCATION</span>
                <div style={{ fontWeight: 700 }}>{selectedCandidate.location}</div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>SKILLS</span>
                <div style={{ fontWeight: 700 }}>{selectedCandidate.skills || "—"}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>MATCH SCORE</span>
                <div style={{ fontWeight: 700 }}>
                  {selectedCandidate.match != null ? `${selectedCandidate.match}%` : "Not Applied"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>EMAIL</span>
                <div style={{ fontWeight: 700 }}>{selectedCandidate.email || "—"}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>PHONE</span>
                <div style={{ fontWeight: 700 }}>{selectedCandidate.phone || "—"}</div>
              </div>
              {selectedCandidate.linkedin_url && (
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>LINKEDIN</span>
                  <div>
                    <a href={selectedCandidate.linkedin_url} target="_blank" rel="noreferrer">
                      View Profile ↗
                    </a>
                  </div>
                </div>
              )}
              {selectedCandidate.github_url && (
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>GITHUB</span>
                  <div>
                    <a href={selectedCandidate.github_url} target="_blank" rel="noreferrer">
                      View Profile ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 22,
                paddingTop: 14,
                borderTop: "1px solid var(--border-default, #eee)",
              }}
            >
              {selectedCandidate.resume_url && (
                <a
                  href={selectedCandidate.resume_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                  style={{ textDecoration: "none", textAlign: "center" }}
                >
                  View Resume
                </a>
              )}

              {selectedCandidate.email && (
                <a
                  href={`mailto:${selectedCandidate.email}`}
                  className="btn-outline"
                  style={{ textDecoration: "none", textAlign: "center" }}
                >
                  Contact Candidate
                </a>
              )}

              <button
                className="btn-gold"
                style={{ marginLeft: "auto" }}
                disabled={savingId === selectedCandidate.id}
                onClick={() => toggleSave(selectedCandidate)}
              >
                {selectedCandidate.saved ? "★ Saved" : "☆ Save Candidate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}