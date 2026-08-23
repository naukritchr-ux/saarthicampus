import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { supabase } from "../lib/supabaseClient";

import "./Dashboard.css";

/* =========================================================
   GREETING
========================================================= */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

const COLORS = ["#743bf1", "#d83da9", "#239ddd", "#079b6d", "#f59e0b"];
const STAGE_LABELS = ["Applied", "Shortlisted", "Interview", "Selected", "Rejected"];

const DATE_FILTERS = {
  "This Month": 30,
  "Last 3 Months": 90,
  "Last 6 Months": 180,
  "This Year": 365,
};

export default function RecruiterDashboard({ user }) {
  const [dateFilter, setDateFilter] = useState("Last 6 Months");
  const [activeChart, setActiveChart] = useState("trend");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState({ candidates: 0, positions: 0, interviews: 0, selected: 0 });
  const [trend, setTrend] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [allApplications, setAllApplications] = useState([]);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [tableSearch, setTableSearch] = useState("");
  const [showTableView, setShowTableView] = useState(false);
  const [funnelStage, setFunnelStage] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const rowsPerPage = 5;

  const greeting = getGreeting();

  /* =========================================================
     LOAD DATA FROM SUPABASE (filtered to this recruiter)
  ========================================================= */

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const userId = user?.id;
        if (!userId) throw new Error("No logged-in user found.");

        const { data: myJobs, error: myJobsError } = await supabase
          .from("job_profiles")
          .select("id, title")
          .eq("recruiter_id", userId);

        if (myJobsError) throw myJobsError;

        const jobIds = (myJobs || []).map((j) => j.id);

        if (jobIds.length === 0) {
          if (!ignore) {
            setKpis({ candidates: 0, positions: 0, interviews: 0, selected: 0 });
            setTrend([]);
            setStatusBreakdown([]);
            setFunnel([]);
            setAllApplications([]);
            setLoading(false);
          }
          return;
        }

        const days = DATE_FILTERS[dateFilter] || 180;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const { data: apps, error: appsError } = await supabase
          .from("applications")
          .select(
            "id, stage, resume_score, created_at, candidates(id, name, email, phone, degree, branch), job_profiles(title)"
          )
          .in("job_id", jobIds)
          .gte("created_at", sinceDate.toISOString())
          .order("created_at", { ascending: false });

        if (appsError) throw appsError;

        if (ignore) return;

        const applicationsList = apps || [];
        setAllApplications(applicationsList);

        const interviewCount = applicationsList.filter((a) => a.stage === "Interview" || a.stage === "GD").length;
        const selectedCount = applicationsList.filter((a) => a.stage === "Selected").length;

        setKpis({
          candidates: applicationsList.length,
          positions: jobIds.length,
          interviews: interviewCount,
          selected: selectedCount,
        });

        const weeks = {};
        applicationsList.forEach((a) => {
          const d = new Date(a.created_at);
          if (Number.isNaN(d.getTime())) return;
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
          if (!weeks[key]) weeks[key] = { week: key, candidates: 0, interviews: 0, selected: 0 };
          weeks[key].candidates += 1;
          if (a.stage === "Interview" || a.stage === "GD") weeks[key].interviews += 1;
          if (a.stage === "Selected") weeks[key].selected += 1;
        });
        setTrend(Object.values(weeks).slice(-8));

        const stages = {};
        applicationsList.forEach((a) => {
          const s = a.stage || "Applied";
          stages[s] = (stages[s] || 0) + 1;
        });
        setStatusBreakdown(Object.entries(stages).map(([name, value]) => ({ name, value })));

        const total = applicationsList.length || 1;
        const funnelCounts = STAGE_LABELS.map((label) => {
          const count = applicationsList.filter((a) => (a.stage || "Applied") === label).length;
          return { label, value: count, percentage: Math.round((count / total) * 100) };
        });
        setFunnel(funnelCounts);
      } catch (err) {
        console.error("Recruiter dashboard load error:", err);
        if (!ignore) setError(err?.message || "Could not load your dashboard data.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [user, dateFilter]);

  /* =========================================================
     DERIVED CANDIDATE ROWS
  ========================================================= */

  const candidateRows = useMemo(() => {
    return allApplications.map((a) => ({
      id: a.id,
      name: a.candidates?.name || "—",
      email: a.candidates?.email || "—",
      phone: a.candidates?.phone || "—",
      position: a.job_profiles?.title || "—",
      degree: a.candidates?.degree || "—",
      branch: a.candidates?.branch || "—",
      stage: a.stage || "Applied",
      status: a.stage || "Applied",
      resumeScore: a.resume_score ?? "—",
    }));
  }, [allApplications]);

  const filteredCandidates = useMemo(() => {
    const search = candidateSearch.toLowerCase().trim();
    return candidateRows.filter((c) => {
      const matchesSearch =
        !search || c.name.toLowerCase().includes(search) || c.position.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [candidateRows, candidateSearch, statusFilter]);

  const tableCandidates = useMemo(() => {
    const search = tableSearch.toLowerCase().trim();
    return candidateRows.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search) ||
        c.position.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      const matchesStage = stageFilter === "All" || c.stage === stageFilter;
      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [candidateRows, tableSearch, statusFilter, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(tableCandidates.length / rowsPerPage));
  const paginatedCandidates = tableCandidates.slice((tablePage - 1) * rowsPerPage, tablePage * rowsPerPage);

  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, statusFilter, stageFilter]);

  const funnelCandidates = funnelStage ? candidateRows.filter((c) => c.stage === funnelStage) : [];

  /* =========================================================
     CHART RENDER
  ========================================================= */

  const renderChart = () => {
    if (loading) return null;

    if (activeChart === "trend") {
      if (trend.length === 0) return <EmptyChart message="No trend data yet." />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeaf3" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#9995ae" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9995ae" allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="candidates" name="Candidates" stroke="#743bf1" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="interviews" name="Interviews" stroke="#239ddd" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="selected" name="Selected" stroke="#079b6d" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (activeChart === "status") {
      if (statusBreakdown.length === 0) return <EmptyChart message="No status data yet." />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={statusBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeaf3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9995ae" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9995ae" allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name="Candidates" fill="#743bf1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (statusBreakdown.length === 0) return <EmptyChart message="No distribution data yet." />;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={statusBreakdown}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={95}
            innerRadius={55}
            paddingAngle={3}
            label
          >
            {statusBreakdown.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="page active" id="page-recruiter-dashboard">
      <section className="content">
        {error && (
          <div className="card" style={{ color: "crimson", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="greeting">
          <div>
            <div className="greeting-small">MY RECRUITMENT OVERVIEW</div>
            <h2>{greeting}</h2>
            <p>Track your own jobs, candidate progress and hiring performance from one dashboard.</p>
          </div>
          <div className="greeting-icon">📊</div>
        </div>

        <div className="dashboard-controls">
          <div />
          <select className="chart-filter" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option>Last 6 Months</option>
            <option>This Month</option>
            <option>Last 3 Months</option>
            <option>This Year</option>
          </select>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-top">👥</div>
            <h3>{loading ? "—" : kpis.candidates}</h3>
            <p>My Applications</p>
          </div>
          <div className="stat-card">
            <div className="stat-top">💼</div>
            <h3>{loading ? "—" : kpis.positions}</h3>
            <p>My Open Positions</p>
          </div>
          <div className="stat-card">
            <div className="stat-top">📅</div>
            <h3>{loading ? "—" : kpis.interviews}</h3>
            <p>Interviews</p>
          </div>
          <div className="stat-card">
            <div className="stat-top">✓</div>
            <h3>{loading ? "—" : kpis.selected}</h3>
            <p>Selected / Hired</p>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3>My Recruitment Analytics</h3>
              <p>Your performance • {dateFilter}</p>
            </div>
          </div>

          <div className="workspace-switcher">
            <button className={activeChart === "trend" ? "active" : ""} onClick={() => setActiveChart("trend")}>
              Trend
            </button>
            <button className={activeChart === "status" ? "active" : ""} onClick={() => setActiveChart("status")}>
              Status
            </button>
            <button className={activeChart === "pie" ? "active" : ""} onClick={() => setActiveChart("pie")}>
              Distribution
            </button>
          </div>

          <div className="chart-container">{renderChart()}</div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <h3>My Recruitment Funnel</h3>
                <p>Candidate movement through your hiring stages</p>
              </div>
            </div>

            {funnel.length === 0 && !loading ? (
              <EmptyState message="No candidates yet." />
            ) : (
              funnel.map((item) => (
                <div className="funnel-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))
            )}

            <div style={{ marginTop: 15, textAlign: "right" }}>
              <button className="candidate-view-btn" onClick={() => setFunnelStage("Applied")}>
                View Details
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3>Stage Summary</h3>
                <p>How your candidates are distributed</p>
              </div>
            </div>

            {statusBreakdown.length === 0 && !loading ? (
              <EmptyState message="No data yet." />
            ) : (
              statusBreakdown.map((s) => (
                <div className="performance-row" key={s.name}>
                  <div>
                    <strong>{s.name}</strong>
                    <span>{kpis.candidates ? Math.round((s.value / kpis.candidates) * 100) : 0}% of total</span>
                  </div>
                  <div className="performance-value">{s.value}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <h3>Candidate Overview</h3>
              <p>Recent applicants to your jobs</p>
            </div>
            <button className="candidate-view-btn" onClick={() => setShowTableView(true)}>
              Table View
            </button>
          </div>

          <div className="candidate-table-container">
            <table className="candidate-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Resume Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>Loading…</td>
                  </tr>
                ) : filteredCandidates.length > 0 ? (
                  filteredCandidates.slice(0, 5).map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.position}</td>
                      <td>{c.stage}</td>
                      <td>
                        <span className={`candidate-status ${c.status.toLowerCase().replace(" ", "-")}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>{c.resumeScore}</td>
                      <td>
                        <button className="candidate-view-btn" onClick={() => setSelectedCandidate(c)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#9995ae" }}>
                      No candidates yet for your jobs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FULL TABLE VIEW MODAL */}
      {showTableView && (
        <div className="candidate-modal-overlay" onClick={() => setShowTableView(false)}>
          <div
            className="candidate-modal"
            style={{ width: "95%", maxWidth: 1200, maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="candidate-modal-header">
              <div>
                <h3>Candidate Table</h3>
                <div className="candidate-modal-label">Complete overview of your candidates</div>
              </div>
              <button className="candidate-modal-close" onClick={() => setShowTableView(false)}>×</button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <input
                type="text"
                placeholder="Search name, position or email..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{
                  flex: 1, minWidth: 220, padding: "10px 12px",
                  border: "1px solid #e3e0eb", borderRadius: 8, outline: "none", fontSize: 12,
                }}
              />

              <select className="chart-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All Status</option>
                {STAGE_LABELS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select className="chart-filter" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="All">All Stages</option>
                {STAGE_LABELS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="candidate-table-container">
              <table className="candidate-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position</th>
                    <th>Degree/Branch</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Resume Score</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCandidates.length > 0 ? (
                    paginatedCandidates.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.position}</td>
                        <td>{c.degree} / {c.branch}</td>
                        <td>{c.stage}</td>
                        <td>
                          <span className={`candidate-status ${c.status.toLowerCase().replace(" ", "-")}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>{c.resumeScore}</td>
                        <td>
                          <button className="candidate-view-btn" onClick={() => setSelectedCandidate(c)}>View</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#9995ae" }}>
                        No candidates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15, gap: 10 }}>
              <span style={{ fontSize: 12, color: "#77738a" }}>
                Showing {tableCandidates.length === 0 ? 0 : (tablePage - 1) * rowsPerPage + 1}
                {" - "}
                {Math.min(tablePage * rowsPerPage, tableCandidates.length)}
                {" of "}
                {tableCandidates.length}
              </span>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="candidate-view-btn"
                  disabled={tablePage === 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                >
                  ←
                </button>
                <span style={{ padding: "7px 10px", fontSize: 12 }}>{tablePage} / {totalPages}</span>
                <button
                  className="candidate-view-btn"
                  disabled={tablePage === totalPages}
                  onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                >
                  →
                </button>
              </div>
            </div>

            <div className="candidate-modal-footer">
              <button className="candidate-close-btn" onClick={() => setShowTableView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* FUNNEL DETAILS MODAL */}
      {funnelStage && (
        <div className="candidate-modal-overlay" onClick={() => setFunnelStage(null)}>
          <div
            className="candidate-modal"
            style={{ width: "90%", maxWidth: 900, maxHeight: "85vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="candidate-modal-header">
              <div>
                <h3>{funnelStage} Candidates</h3>
                <div className="candidate-modal-label">Candidates currently in this stage</div>
              </div>
              <button className="candidate-modal-close" onClick={() => setFunnelStage(null)}>×</button>
            </div>

            <div className="workspace-switcher" style={{ marginBottom: 15, flexWrap: "wrap" }}>
              {STAGE_LABELS.map((label) => (
                <button
                  key={label}
                  className={funnelStage === label ? "active" : ""}
                  onClick={() => setFunnelStage(label)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="candidate-table-container">
              <table className="candidate-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelCandidates.length > 0 ? (
                    funnelCandidates.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.position}</td>
                        <td>{c.status}</td>
                        <td>
                          <button className="candidate-view-btn" onClick={() => setSelectedCandidate(c)}>View</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: 30, color: "#9995ae" }}>
                        No candidates in this stage.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="candidate-modal-footer">
              <button className="candidate-close-btn" onClick={() => setFunnelStage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE DETAILS MODAL */}
      {selectedCandidate && (
        <div className="candidate-modal-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="candidate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="candidate-modal-header">
              <div>
                <h3>{selectedCandidate.name}</h3>
                <div className="candidate-modal-label">Candidate Details</div>
              </div>
              <button className="candidate-modal-close" onClick={() => setSelectedCandidate(null)}>×</button>
            </div>

            <div className="candidate-detail-grid">
              <div className="candidate-detail-item">
                <strong>POSITION</strong>
                <span>{selectedCandidate.position}</span>
              </div>
              <div className="candidate-detail-item">
                <strong>DEGREE/BRANCH</strong>
                <span>{selectedCandidate.degree} / {selectedCandidate.branch}</span>
              </div>
              <div className="candidate-detail-item">
                <strong>STAGE</strong>
                <span>{selectedCandidate.stage}</span>
              </div>
              <div className="candidate-detail-item">
                <strong>RESUME SCORE</strong>
                <span>{selectedCandidate.resumeScore}</span>
              </div>
              <div className="candidate-detail-item">
                <strong>EMAIL</strong>
                <span>{selectedCandidate.email}</span>
              </div>
              <div className="candidate-detail-item">
                <strong>PHONE</strong>
                <span>{selectedCandidate.phone}</span>
              </div>
            </div>

            <div className="candidate-modal-footer">
              <button className="candidate-close-btn" onClick={() => setSelectedCandidate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9995ae", fontSize: 12.5 }}>
      {message}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0", color: "#9995ae", fontSize: 12.5 }}>
      {message}
    </div>
  );
}