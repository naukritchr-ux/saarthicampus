import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import "./CorporateDashboard.css";

const COLORS = [
  "#743bf1",
  "#d83da9",
  "#239ddd",
  "#079b6d",
  "#f59e0b",
];

const rowsPerPage = 5;

/* =========================================================
   GREETING
========================================================= */

function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function CorporateDashboard({
  data = { kpis: {}, profiles: [], experience: [], locations: [] },
  candidates = [],
}) {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showCandidateTable, setShowCandidateTable] = useState(false);
  const [profileChartType, setProfileChartType] = useState("profiles");

  /* =======================================================
     FILTER STATES
  ======================================================= */

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [experienceFilter, setExperienceFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [matchFilter, setMatchFilter] = useState("All");
  const [tablePage, setTablePage] = useState(1);

  function updateTableFilter(setter, value) {
    setTablePage(1);
    setter(value);
  }

  /* =======================================================
     DYNAMIC JOB PROFILE OPTIONS
  ======================================================= */

  const jobProfiles = useMemo(() => {
    const profiles = candidates
      .map((candidate) => candidate.role)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(profiles)).sort()];
  }, [candidates]);

  /* =======================================================
     DYNAMIC EXPERIENCE OPTIONS
  ======================================================= */

  const experienceOptions = useMemo(() => {
    const values = candidates
      .map((candidate) => candidate.experienceYears)
      .filter((value) => value !== undefined && value !== null);

    return ["All", ...Array.from(new Set(values)).sort((a, b) => a - b)];
  }, [candidates]);

  /* =======================================================
     DYNAMIC LOCATION OPTIONS
  ======================================================= */

  const locationOptions = useMemo(() => {
    const values = candidates
      .map((candidate) => candidate.location)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [candidates]);

  /* =======================================================
     DYNAMIC STAGE OPTIONS
  ======================================================= */

  const stageOptions = useMemo(() => {
    const values = candidates
      .map((candidate) => candidate.stage)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values))];
  }, [candidates]);

  /* =======================================================
     GREETING
  ======================================================= */

  const greeting = getGreeting();

  /* =======================================================
     FILTER CANDIDATES
  ======================================================= */

  const filteredCandidates = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return candidates.filter((candidate) => {
      const matchesSearch =
        !searchValue ||
        candidate.name?.toLowerCase().includes(searchValue) ||
        candidate.role?.toLowerCase().includes(searchValue) ||
        candidate.skills?.toLowerCase().includes(searchValue);

      const matchesRole =
        roleFilter === "All" || candidate.role === roleFilter;

      let matchesExperience = true;

      if (experienceFilter !== "All") {
        matchesExperience =
          candidate.experienceYears === Number(experienceFilter);
      }

      const matchesLocation =
        locationFilter === "All" || candidate.location === locationFilter;

      const matchesStage =
        stageFilter === "All" || candidate.stage === stageFilter;

      let matchesMatch = true;

      if (matchFilter === "80+") {
        matchesMatch = candidate.match >= 80;
      }

      if (matchFilter === "85+") {
        matchesMatch = candidate.match >= 85;
      }

      if (matchFilter === "90+") {
        matchesMatch = candidate.match >= 90;
      }

      return (
        matchesSearch &&
        matchesRole &&
        matchesExperience &&
        matchesLocation &&
        matchesStage &&
        matchesMatch
      );
    });
  }, [
    candidates,
    search,
    roleFilter,
    experienceFilter,
    locationFilter,
    stageFilter,
    matchFilter,
  ]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCandidates.length / rowsPerPage)
  );

  const paginatedCandidates = filteredCandidates.slice(
    (tablePage - 1) * rowsPerPage,
    tablePage * rowsPerPage
  );

  /* =======================================================
     RESET FILTERS
  ======================================================= */

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("All");
    setExperienceFilter("All");
    setLocationFilter("All");
    setStageFilter("All");
    setMatchFilter("All");
    setTablePage(1);
  };

  /* =======================================================
     PROFILE / EXPERIENCE CHART
  ======================================================= */

  const chartData =
    profileChartType === "profiles"
      ? data.profiles || []
      : data.experience || [];

  return (
    <div className="corporate-app">
      {/* MAIN */}
      <main className="corporate-main" style={{ marginLeft: 0, width: "100%" }}>
        {/* TOPBAR */}
        <header className="corporate-topbar">
          <div>
            <h1>Corporate Dashboard</h1>
            <p>Explore available talent and discover suitable candidates</p>
          </div>

          <div className="corporate-top-actions">
            <button className="corporate-notification" type="button">
              🔔
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <section className="corporate-content">
          {/* GREETING */}
          <div className="corporate-greeting">
            <div>
              <div className="corporate-greeting-label">TALENT OVERVIEW</div>
              <h2>{greeting}</h2>
              <p>
                Explore the available talent pool and find candidates that match
                your requirements.
              </p>
            </div>

            <div className="corporate-greeting-icon">🏢</div>
          </div>

          {/* KPI CARDS */}
          <div className="corporate-stats">
            <div className="corporate-stat-card">
              <div className="corporate-stat-icon">👥</div>
              <h3>{data.kpis?.availableCandidates ?? 0}</h3>
              <p>Available Candidates</p>
              <span className="corporate-stat-change">Talent Pool</span>
            </div>

            <div className="corporate-stat-card">
              <div className="corporate-stat-icon">⭐</div>
              <h3>{data.kpis?.matchingCandidates ?? 0}</h3>
              <p>Matching Candidates</p>
              <span className="corporate-stat-change">High relevance</span>
            </div>

            <div className="corporate-stat-card">
              <div className="corporate-stat-icon">💼</div>
              <h3>{data.kpis?.jobProfiles ?? 0}</h3>
              <p>Job Profiles</p>
              <span className="corporate-stat-change">Specializations</span>
            </div>

            <div className="corporate-stat-card">
              <div className="corporate-stat-icon">📍</div>
              <h3>{data.kpis?.locations ?? 0}</h3>
              <p>Candidate Locations</p>
              <span className="corporate-stat-change">Available cities</span>
            </div>
          </div>

          {/* TALENT PROFILE ANALYTICS */}
          <div className="corporate-chart-card">
            <div className="corporate-card-header">
              <div>
                <h3>Talent Pool Overview</h3>
                <p>Explore available candidates by profile and experience</p>
              </div>

              <div className="corporate-toggle">
                <button
                  className={profileChartType === "profiles" ? "active" : ""}
                  onClick={() => setProfileChartType("profiles")}
                  type="button"
                >
                  Profiles
                </button>

                <button
                  className={profileChartType === "experience" ? "active" : ""}
                  onClick={() => setProfileChartType("experience")}
                  type="button"
                >
                  Experience
                </button>
              </div>
            </div>

            <div className="corporate-chart-container">
              {profileChartType === "profiles" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{
                      left: 20,
                      right: 25,
                      top: 5,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eeeaf3" />
                    <XAxis
                      type="number"
                      stroke="#9995ae"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={125}
                      stroke="#9995ae"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="candidates"
                      name="Candidates"
                      fill="#743bf1"
                      radius={[0, 5, 5, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="candidates"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      label
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.name || index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* LOCATION + TOP PROFILES */}
          <div className="corporate-two-column">
            {/* LOCATION */}
            <div className="corporate-card">
              <div className="corporate-card-header">
                <div>
                  <h3>Candidate Locations</h3>
                  <p>Where available candidates are located</p>
                </div>
              </div>

              <div className="corporate-location-list">
                {(data.locations || []).map((location) => (
                  <div className="corporate-location-row" key={location.name}>
                    <div>
                      <span>📍</span>
                      <strong>{location.name}</strong>
                    </div>
                    <div>
                      <strong>{location.candidates}</strong>
                      <span>candidates</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP SPECIALIZATIONS */}
            <div className="corporate-card">
              <div className="corporate-card-header">
                <div>
                  <h3>Available Specializations</h3>
                  <p>Most available candidate profiles</p>
                </div>
              </div>

              <div className="corporate-profile-list">
                {(data.profiles || []).map((profile, index) => (
                  <div className="corporate-profile-row" key={profile.name}>
                    <div>
                      <span className="corporate-profile-number">
                        {index + 1}
                      </span>
                      <strong>{profile.name}</strong>
                    </div>
                    <div>
                      <strong>{profile.candidates}</strong>
                      <span>candidates</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RECOMMENDED CANDIDATES */}
          <div className="corporate-card">
            <div className="corporate-card-header">
              <div>
                <h3>Recommended Candidates</h3>
                <p>Find candidates based on your hiring requirements</p>
              </div>

              <button
                className="corporate-details-button"
                onClick={() => setShowCandidateTable(true)}
                type="button"
              >
                View All Candidates
              </button>
            </div>

            {/* FILTER BAR */}
            <div className="corporate-quick-filters">
              <div className="corporate-filter-field">
                <label>Job Profile</label>
                <select
                  value={roleFilter}
                  onChange={(e) =>
                    updateTableFilter(setRoleFilter, e.target.value)
                  }
                >
                  {jobProfiles.map((profile) => (
                    <option key={profile} value={profile}>
                      {profile === "All" ? "All Profiles" : profile}
                    </option>
                  ))}
                </select>
              </div>

              <div className="corporate-filter-field">
                <label>Experience</label>
                <select
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                >
                  <option value="All">All Experience</option>
                  {experienceOptions
                    .filter((value) => value !== "All")
                    .map((value) => (
                      <option key={value} value={value}>
                        {value} {value === 1 ? "Year" : "Years"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="corporate-filter-field">
                <label>Location</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location === "All" ? "All Locations" : location}
                    </option>
                  ))}
                </select>
              </div>

              <div className="corporate-filter-field">
                <label>Match Score</label>
                <select
                  value={matchFilter}
                  onChange={(e) => setMatchFilter(e.target.value)}
                >
                  <option value="All">All Scores</option>
                  <option value="80+">80%+</option>
                  <option value="85+">85%+</option>
                  <option value="90+">90%+</option>
                </select>
              </div>

              <button
                className="corporate-reset-filter"
                onClick={resetFilters}
                type="button"
              >
                Reset
              </button>
            </div>

            {/* RESULT COUNT */}
            <div className="corporate-filter-result">
              <span>
                Showing <strong>{filteredCandidates.length}</strong> matching candidates
              </span>
              {roleFilter !== "All" && (
                <span className="corporate-active-filter">
                  Profile: {roleFilter}
                </span>
              )}
            </div>

            {/* RECOMMENDED TABLE */}
            <div className="corporate-table-wrapper">
              <table className="corporate-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Profile</th>
                    <th>Match</th>
                    <th>Experience</th>
                    <th>Location</th>
                    <th>Skills</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCandidates
                    .slice()
                    .sort((a, b) => b.match - a.match)
                    .slice(0, 5)
                    .map((candidate) => (
                      <tr key={candidate.id}>
                        <td>
                          <div className="corporate-candidate-name">
                            <div className="corporate-avatar">
                              {candidate.name?.charAt(0) || "?"}
                            </div>
                            <strong>{candidate.name}</strong>
                          </div>
                        </td>
                        <td>{candidate.role}</td>
                        <td>
                          <span className="match-score">{candidate.match}%</span>
                        </td>
                        <td>{candidate.experience}</td>
                        <td>{candidate.location}</td>
                        <td>{candidate.skills}</td>
                        <td>
                          <button
                            className="corporate-view-button"
                            onClick={() => setSelectedCandidate(candidate)}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}

                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan="7" className="corporate-empty">
                        No candidates match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* FULL CANDIDATE TABLE MODAL */}
      {showCandidateTable && (
        <div
          className="corporate-modal-overlay"
          onClick={() => setShowCandidateTable(false)}
        >
          <div
            className="corporate-modal corporate-large-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="corporate-modal-header">
              <div>
                <h3>Candidate Table</h3>
                <p>Search and explore available candidates</p>
              </div>
              <button
                className="corporate-modal-close"
                onClick={() => setShowCandidateTable(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="corporate-filters">
              <input
                type="text"
                placeholder="Search candidate, profile or skill..."
                value={search}
                onChange={(e) =>
                  updateTableFilter(setSearch, e.target.value)
                }
              />

              <select
                value={roleFilter}
                onChange={(e) =>
                  updateTableFilter(setRoleFilter, e.target.value)
                }
              >
                {jobProfiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {profile === "All" ? "All Profiles" : profile}
                  </option>
                ))}
              </select>

              <select
                value={experienceFilter}
                onChange={(e) => setExperienceFilter(e.target.value)}
              >
                <option value="All">All Experience</option>
                {experienceOptions
                  .filter((value) => value !== "All")
                  .map((value) => (
                    <option key={value} value={value}>
                      {value} {value === 1 ? "Year" : "Years"}
                    </option>
                  ))}
              </select>

              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location === "All" ? "All Locations" : location}
                  </option>
                ))}
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage === "All" ? "All Stages" : stage}
                  </option>
                ))}
              </select>
            </div>

            <div className="corporate-modal-match-filter">
              <label>Match Score</label>
              <select
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value)}
              >
                <option value="All">All Scores</option>
                <option value="80+">80%+</option>
                <option value="85+">85%+</option>
                <option value="90+">90%+</option>
              </select>

              <button
                className="corporate-reset-filter"
                onClick={resetFilters}
                type="button"
              >
                Reset Filters
              </button>
            </div>

            <div className="corporate-table-wrapper">
              <table className="corporate-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Profile</th>
                    <th>Match</th>
                    <th>Resume</th>
                    <th>Experience</th>
                    <th>Skills</th>
                    <th>Location</th>
                    <th>Stage</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedCandidates.length > 0 ? (
                    paginatedCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>
                          <strong>{candidate.name}</strong>
                        </td>
                        <td>{candidate.role}</td>
                        <td>
                          <span className="match-score">{candidate.match}%</span>
                        </td>
                        <td>{candidate.resumeScore}</td>
                        <td>{candidate.experience}</td>
                        <td>{candidate.skills}</td>
                        <td>{candidate.location}</td>
                        <td>
                          <span
                            className={`corporate-status ${candidate.stage
                              ?.toLowerCase()
                              .replace(" ", "-")}`}
                          >
                            {candidate.stage}
                          </span>
                        </td>
                        <td>
                          <button
                            className="corporate-view-button"
                            onClick={() => setSelectedCandidate(candidate)}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="corporate-empty">
                        No candidates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="corporate-pagination">
              <span>
                Showing{" "}
                {filteredCandidates.length === 0
                  ? 0
                  : (tablePage - 1) * rowsPerPage + 1}{" "}
                -{" "}
                {Math.min(
                  tablePage * rowsPerPage,
                  filteredCandidates.length
                )}{" "}
                of {filteredCandidates.length}
              </span>

              <div>
                <button
                  disabled={tablePage === 1}
                  onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  ←
                </button>
                <span>
                  {tablePage} / {totalPages}
                </span>
                <button
                  disabled={tablePage === totalPages}
                  onClick={() =>
                    setTablePage((page) => Math.min(totalPages, page + 1))
                  }
                  type="button"
                >
                  →
                </button>
              </div>
            </div>

            <div className="corporate-modal-footer">
              <button
                className="corporate-close-button"
                onClick={() => setShowCandidateTable(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE DETAILS MODAL */}
      {selectedCandidate && (
        <div
          className="corporate-modal-overlay"
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="corporate-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="corporate-modal-header">
              <div>
                <h3>{selectedCandidate.name}</h3>
                <p>Candidate Details</p>
              </div>
              <button
                className="corporate-modal-close"
                onClick={() => setSelectedCandidate(null)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="corporate-detail-grid">
              <div>
                <span>PROFILE</span>
                <strong>{selectedCandidate.role}</strong>
              </div>
              <div>
                <span>MATCH SCORE</span>
                <strong>{selectedCandidate.match}%</strong>
              </div>
              <div>
                <span>RESUME SCORE</span>
                <strong>{selectedCandidate.resumeScore}</strong>
              </div>
              <div>
                <span>EXPERIENCE</span>
                <strong>{selectedCandidate.experience}</strong>
              </div>
              <div>
                <span>SKILLS</span>
                <strong>{selectedCandidate.skills}</strong>
              </div>
              <div>
                <span>LOCATION</span>
                <strong>{selectedCandidate.location}</strong>
              </div>
              <div>
                <span>CURRENT STAGE</span>
                <strong>{selectedCandidate.stage}</strong>
              </div>
              <div>
                <span>SOURCE</span>
                <strong>{selectedCandidate.source}</strong>
              </div>
              <div>
                <span>EMAIL</span>
                <strong>{selectedCandidate.email}</strong>
              </div>
              <div>
                <span>PHONE</span>
                <strong>{selectedCandidate.phone}</strong>
              </div>
            </div>

            <div className="corporate-modal-footer">
              <button
                className="corporate-close-button"
                onClick={() => setSelectedCandidate(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CorporateDashboard;