import { useEffect, useState, useMemo } from "react";
import {
  getAllApplications,
  getColleges,
  getCompanies,
  getOffers,
  getJoiningStatus,
  getCallRecords,
  getCandidates,
  getJobs,
} from "../lib/api";

import {
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
  ResponsiveContainer,
} from "recharts";

const FUNNEL_ORDER = [
  "Resume Review",
  "Interview",
  "Selected",
  "Rejected",
];

const CHART_COLORS = [
  "#7C3AED",
  "#06B6D4",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#6366F1",
  "#14B8A6",
  "#EF4444",
];

const ANALYTICS_TARGETS = {
  institutes: 300,
  corporates: 150,
  candidates: 15000,
};

/* ---------------------------------------------------------
   REPORT LIST
--------------------------------------------------------- */

const REPORT_LIST = [
  {
    key: "campus",
    t: "Campus-wise Report",
    d: "Performance per college",
  },
  {
    key: "company",
    t: "Company-wise Report",
    d: "Performance per company",
  },
  {
    key: "recruiter",
    t: "Recruiter Performance",
    d: "Drives handled, conversion",
  },
  {
    key: "funnel",
    t: "Hiring Funnel",
    d: "Applied → Joined",
  },
  {
    key: "selection",
    t: "Selection Report",
    d: "Shortlist to offer",
  },
  {
    key: "joining",
    t: "Joining Report",
    d: "Accepted vs joined",
  },
  {
    key: "acceptance",
    t: "Offer Acceptance",
    d: "Acceptance rate trend",
  },
  {
    key: "monthly",
    t: "Monthly / Yearly Report",
    d: "Drive summary",
  },
  {
    key: "calls",
    t: "Call Records Report",
    d: "Completed calls, follow-ups by organization",
  },
  {
    key: "instituteAnalytics",
    t: "Institute Analytics",
    d: "Institutes, drives, students shared vs target",
  },
  {
    key: "corporateAnalytics",
    t: "Corporate Analytics",
    d: "Corporates, jobs posted, hiring activity vs target",
  },
  {
    key: "candidateAnalytics",
    t: "Candidate Analytics",
    d: "Candidates, profiles, applications vs target",
  },
];

/* ---------------------------------------------------------
   HELPER
--------------------------------------------------------- */

function getRecruiterName(application) {
  const job = application?.job_profiles || {};

  return (
    application?.recruiter_name ||
    application?.recruiter?.name ||
    application?.recruiter?.full_name ||
    application?.recruiter?.email ||
    job?.recruiter_name ||
    job?.recruiter?.name ||
    job?.recruiter?.full_name ||
    job?.recruiter?.email ||
    job?.recruiter_name ||
    job?.recruiter_email ||
    application?.recruiter_email ||
    "Unassigned"
  );
}

function getJobName(application) {
  const job = application?.job_profiles || {};

  return (
    job?.title ||
    job?.job_title ||
    job?.name ||
    "Unknown Job"
  );
}

/* ---------------------------------------------------------
   COMPONENT
--------------------------------------------------------- */

export default function Reports() {
  const [apps, setApps] = useState([]);
  const [offers, setOffers] = useState([]);
  const [joining, setJoining] = useState([]);
  const [calls, setCalls] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [active, setActive] = useState(null);

  /* -------------------------------------------------------
     LOAD DATA
  ------------------------------------------------------- */

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const [a, collegesData, companiesData, off, joi, callData, candidatesData, jobsData] = await Promise.all([
          getAllApplications(),
          getColleges(),
          getCompanies(),
          getOffers(),
          getJoiningStatus(),
          getCallRecords(),
          getCandidates(),
          getJobs(),
        ]);

        if (!ignore) {
          setApps(a || []);
          setOffers(off || []);
          setJoining(joi || []);
          setCalls(callData || []);
          setColleges(collegesData || []);
          setCompanies(companiesData || []);
          setCandidates(candidatesData || []);
          setJobs(jobsData || []);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Reports loading error:", err);
          setError(err.message || "Failed to load reports.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      ignore = true;
    };
  }, []);

  /* -------------------------------------------------------
     CAMPUS REPORT
  ------------------------------------------------------- */

  const campusRows = useMemo(() => {
    const byCollege = {};

    apps.forEach((a) => {
      const name =
        a?.candidates?.colleges?.name ||
        a?.college_name ||
        "Unknown";

      if (!byCollege[name]) {
        byCollege[name] = {
          name,
          total: 0,
          selected: 0,
          joined: 0,
        };
      }

      byCollege[name].total += 1;

      if (a.stage === "Selected") {
        byCollege[name].selected += 1;
      }

      if (a.stage === "Joined") {
        byCollege[name].joined += 1;
      }
    });

    return Object.values(byCollege).sort(
      (x, y) => y.total - x.total
    );
  }, [apps]);

  /* -------------------------------------------------------
     COMPANY REPORT
  ------------------------------------------------------- */

  const companyRows = useMemo(() => {
    const byCompany = {};

    apps.forEach((a) => {
      const name =
        a?.job_profiles?.company ||
        a?.company_name ||
        "Unknown";

      if (!byCompany[name]) {
        byCompany[name] = {
          name,
          total: 0,
          selected: 0,
          joined: 0,
        };
      }

      byCompany[name].total += 1;

      if (a.stage === "Selected") {
        byCompany[name].selected += 1;
      }

      if (a.stage === "Joined") {
        byCompany[name].joined += 1;
      }
    });

    return Object.values(byCompany).sort(
      (x, y) => y.total - x.total
    );
  }, [apps]);

  /* -------------------------------------------------------
     RECRUITER PERFORMANCE
  ------------------------------------------------------- */

  const recruiterRows = useMemo(() => {
    const recruiters = {};

    apps.forEach((a) => {
      const recruiterName = getRecruiterName(a);
      const jobName = getJobName(a);

      if (!recruiters[recruiterName]) {
        recruiters[recruiterName] = {
          name: recruiterName,
          jobs: new Set(),
          applications: 0,
          selected: 0,
          joined: 0,
        };
      }

      const recruiter = recruiters[recruiterName];

      recruiter.jobs.add(jobName);
      recruiter.applications += 1;

      if (a.stage === "Selected") {
        recruiter.selected += 1;
      }

      if (a.stage === "Joined") {
        recruiter.joined += 1;
      }
    });

    return Object.values(recruiters)
      .map((r) => ({
        name: r.name,
        drives: r.jobs.size,
        applications: r.applications,
        selected: r.selected,
        joined: r.joined,

        selectionRate:
          r.applications > 0
            ? Math.round(
                (r.selected / r.applications) * 100
              )
            : 0,

        joiningRate:
          r.selected > 0
            ? Math.round(
                (r.joined / r.selected) * 100
              )
            : 0,

        conversion:
          r.applications > 0
            ? Math.round(
                (r.joined / r.applications) * 100
              )
            : 0,
      }))
      .sort((a, b) => b.applications - a.applications);
  }, [apps]);

  /* -------------------------------------------------------
     FUNNEL
  ------------------------------------------------------- */

  const funnelRows = useMemo(() => {
    const counts = {};

    apps.forEach((a) => {
      counts[a.stage] = (counts[a.stage] || 0) + 1;
    });

    return FUNNEL_ORDER
      .filter((s) => counts[s])
      .map((s) => ({
        stage: s,
        count: counts[s],
      }));
  }, [apps]);

  /* -------------------------------------------------------
     SELECTION
  ------------------------------------------------------- */

  const selectedCount = apps.filter(
    (a) => a.stage === "Selected"
  ).length;

  const offersSent = offers.length;

  /* -------------------------------------------------------
     JOINING
  ------------------------------------------------------- */

  const offersAccepted = offers.filter(
    (o) => o.status === "Accepted"
  ).length;

  const joinedCount = joining.filter(
    (j) => j.status === "Joined"
  ).length;

  /* -------------------------------------------------------
     OFFER ACCEPTANCE
  ------------------------------------------------------- */

  const acceptanceByMonth = useMemo(() => {
    const byMonth = {};

    offers.forEach((o) => {
      if (!o.sent_on) return;

      const m = new Date(o.sent_on).toLocaleDateString(
        "en-GB",
        {
          month: "short",
          year: "numeric",
        }
      );

      if (!byMonth[m]) {
        byMonth[m] = {
          month: m,
          sent: 0,
          accepted: 0,
        };
      }

      byMonth[m].sent += 1;

      if (o.status === "Accepted") {
        byMonth[m].accepted += 1;
      }
    });

    return Object.values(byMonth);
  }, [offers]);

  /* -------------------------------------------------------
     MONTHLY
  ------------------------------------------------------- */

  const monthlyRows = useMemo(() => {
    const byMonth = {};

    apps.forEach((a) => {
      if (!a.created_at) return;

      const m = new Date(a.created_at).toLocaleDateString(
        "en-GB",
        {
          month: "short",
          year: "numeric",
        }
      );

      if (!byMonth[m]) {
        byMonth[m] = {
          month: m,
          applied: 0,
          selected: 0,
          joined: 0,
        };
      }

      byMonth[m].applied += 1;

      if (a.stage === "Selected") {
        byMonth[m].selected += 1;
      }

      if (a.stage === "Joined") {
        byMonth[m].joined += 1;
      }
    });

    return Object.values(byMonth);
  }, [apps]);

  /* -------------------------------------------------------
     CALL RECORDS REPORT
  ------------------------------------------------------- */

  const callStats = useMemo(() => {
    const total = calls.length;
    const completed = calls.filter((c) => c.status === "Completed").length;
    const followUp = calls.filter((c) => c.status === "Follow Up").length;
    const pending = calls.filter(
      (c) => c.status !== "Completed" && c.status !== "Follow Up"
    ).length;

    return { total, completed, followUp, pending };
  }, [calls]);

  const callsByOrg = useMemo(() => {
    const byOrg = {};

    calls.forEach((c) => {
      const name = c.organization || "Unknown";

      if (!byOrg[name]) {
        byOrg[name] = {
          name,
          total: 0,
          completed: 0,
          followUp: 0,
        };
      }

      byOrg[name].total += 1;

      if (c.status === "Completed") {
        byOrg[name].completed += 1;
      }

      if (c.status === "Follow Up") {
        byOrg[name].followUp += 1;
      }
    });

    return Object.values(byOrg).sort((a, b) => b.total - a.total);
  }, [calls]);

  /* -------------------------------------------------------
     INSTITUTE ANALYTICS
  ------------------------------------------------------- */

  const instituteStats = useMemo(() => {
    const total = colleges.length;
    const active = colleges.filter((c) => c.status !== "Inactive").length;
    const inactive = total - active;
    const studentsShared = apps.filter((a) => a?.candidates?.college_id).length;

    return { total, active, inactive, studentsShared };
  }, [colleges, apps]);

  /* -------------------------------------------------------
     CORPORATE ANALYTICS
  ------------------------------------------------------- */

  const corporateStats = useMemo(() => {
    const total = companies.length;
    const verified = companies.filter(
      (c) => c.hiring_status === "Verified" || c.hiring_status === "Active"
    ).length;
    const active = companies.filter((c) => c.hiring_status === "Active").length;
    const jobsPosted = jobs.length;

    return { total, verified, active, jobsPosted };
  }, [companies, jobs]);

  /* -------------------------------------------------------
     CANDIDATE ANALYTICS
  ------------------------------------------------------- */

  const candidateStats = useMemo(() => {
    const total = candidates.length;
    const profileCompleted = candidates.filter(
      (c) => c.resume_url && c.degree && c.branch && c.cgpa
    ).length;
    const applications = apps.length;
    const selected = apps.filter((a) => a.stage === "Selected").length;
    const joined = apps.filter((a) => a.stage === "Joined").length;

    return { total, profileCompleted, applications, selected, joined };
  }, [candidates, apps]);

  /* -------------------------------------------------------
     LOADING
  ------------------------------------------------------- */

  if (loading) {
    return (
      <div className="page active">
        <div className="panel">
          <p style={{ color: "var(--slate-light)" }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     ERROR
  ------------------------------------------------------- */

  if (error) {
    return (
      <div className="page active">
        <div className="panel">
          <p
            style={{
              color: "var(--red, #d64545)",
            }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <div
      className="page active"
      id="page-reports"
    >
      {/* -------------------------------------------------
          HEADER
      ------------------------------------------------- */}

      <div className="page-head">
        <div>
          <h1>Reports & Analytics</h1>

          <p>
            {active
              ? REPORT_LIST.find(
                  (r) => r.key === active
                )?.t
              : "Export to PDF or Excel"}
          </p>
        </div>

        {active ? (
          <button
            className="btn-outline"
            onClick={() => setActive(null)}
          >
            ← Back
          </button>
        ) : (
          <button className="btn-outline">
            Export Excel
          </button>
        )}
      </div>

      {/* =================================================
          REPORT TILES
      ================================================= */}

      {!active && (
        <div className="report-grid">
          {REPORT_LIST.map((r) => (
            <div
              className="report-tile"
              key={r.key}
              style={{
                cursor: "pointer",
              }}
              onClick={() => setActive(r.key)}
            >
              <div>
                <div className="t">
                  {r.t}
                </div>

                <div className="d">
                  {r.d}
                </div>
              </div>

              <span className="arrow">
                →
              </span>
            </div>
          ))}
        </div>
      )}

      {/* =================================================
          CAMPUS REPORT
      ================================================= */}

      {active === "campus" && (
        <div className="panel">
          <div className="panel-title">
            Campus-wise Report
          </div>

          <div
            className="chart-card"
            style={{
              width: "100%",
              maxWidth: 700,
              height: 260,
              margin: "0 auto 20px",
            }}
          >
            <ResponsiveContainer>
              <BarChart
                data={campusRows.slice(0, 10)}
                margin={{
                  top: 10,
                  right: 10,
                  left: -10,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-default)"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="total"
                  name="Applications"
                  fill="#7C3AED"
                  radius={[6, 6, 0, 0]}
                />

                <Bar
                  dataKey="selected"
                  name="Selected"
                  fill="#06B6D4"
                  radius={[6, 6, 0, 0]}
                />

                <Bar
                  dataKey="joined"
                  name="Joined"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>College</th>
                <th>Applications</th>
                <th>Selected</th>
                <th>Joined</th>
              </tr>
            </thead>

            <tbody>
              {campusRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.total}</td>
                  <td>{r.selected}</td>
                  <td>{r.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================================================
          COMPANY REPORT
      ================================================= */}

      {active === "company" && (
        <div className="panel">
          <div className="panel-title">
            Company-wise Report
          </div>

          <div
            className="chart-card"
            style={{
              width: "100%",
              height: 360,
            }}
          >
            <ResponsiveContainer>
              <BarChart
                data={companyRows.slice(0, 10)}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-default)"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />

                <YAxis />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="total"
                  name="Applications"
                  fill="#7C3AED"
                />

                <Bar
                  dataKey="selected"
                  name="Selected"
                  fill="#06B6D4"
                />

                <Bar
                  dataKey="joined"
                  name="Joined"
                  fill="#10B981"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Applications</th>
                <th>Selected</th>
                <th>Joined</th>
              </tr>
            </thead>

            <tbody>
              {companyRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.total}</td>
                  <td>{r.selected}</td>
                  <td>{r.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================================================
          RECRUITER PERFORMANCE
      ================================================= */}

      {active === "recruiter" && (
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
            }}
          >
            <div>
              <div className="panel-title">
                Recruiter Performance
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 3,
                }}
              >
                Drives handled, applications and conversion
              </div>
            </div>
          </div>

          {/* SUMMARY CARDS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div className="panel">
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Recruiters
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 5,
                }}
              >
                {recruiterRows.length}
              </div>
            </div>

            <div className="panel">
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Total Applications
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 5,
                }}
              >
                {apps.length}
              </div>
            </div>

            <div className="panel">
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Selected
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 5,
                }}
              >
                {selectedCount}
              </div>
            </div>

            <div className="panel">
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Joined
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 5,
                }}
              >
                {joinedCount}
              </div>
            </div>
          </div>

          {/* RECRUITER CHART */}

          {recruiterRows.length > 0 && (
            <div
              className="chart-card"
              style={{
                width: "100%",
                height: 340,
                marginBottom: 24,
              }}
            >
              <ResponsiveContainer>
                <BarChart
                  data={recruiterRows}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 50,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-default)"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />

                  <YAxis
                    tick={{ fontSize: 11 }}
                  />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="applications"
                    name="Applications"
                    fill="#7C3AED"
                    radius={[5, 5, 0, 0]}
                  />

                  <Bar
                    dataKey="selected"
                    name="Selected"
                    fill="#06B6D4"
                    radius={[5, 5, 0, 0]}
                  />

                  <Bar
                    dataKey="joined"
                    name="Joined"
                    fill="#10B981"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RECRUITER TABLE */}

          {recruiterRows.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 30,
                color: "var(--text-muted)",
              }}
            >
              No recruiter performance data found.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th>Drives Handled</th>
                    <th>Applications</th>
                    <th>Selected</th>
                    <th>Joined</th>
                    <th>Selection %</th>
                    <th>Joining %</th>
                    <th>Conversion %</th>
                  </tr>
                </thead>

                <tbody>
                  {recruiterRows.map((r) => (
                    <tr key={r.name}>
                      <td>
                        <strong>
                          {r.name}
                        </strong>
                      </td>

                      <td>
                        {r.drives}
                      </td>

                      <td>
                        {r.applications}
                      </td>

                      <td>
                        {r.selected}
                      </td>

                      <td>
                        {r.joined}
                      </td>

                      <td>
                        <span
                          className="badge green"
                        >
                          {r.selectionRate}%
                        </span>
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              "#06B6D4",
                            color: "#fff",
                          }}
                        >
                          {r.joiningRate}%
                        </span>
                      </td>

                      <td>
                        <strong>
                          {r.conversion}%
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================
          FUNNEL REPORT
      ================================================= */}

      {active === "funnel" && (
        <div className="panel">
          <div className="panel-title">
            Hiring Funnel — Applied → Joined
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 320,
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={funnelRows}
                    dataKey="count"
                    nameKey="stage"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={(entry) =>
                      `${entry.stage}: ${entry.count}`
                    }
                  >
                    {funnelRows.map(
                      (entry, i) => (
                        <Cell
                          key={entry.stage}
                          fill={
                            CHART_COLORS[
                              i %
                                CHART_COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Candidates</th>
                </tr>
              </thead>

              <tbody>
                {funnelRows.map((r) => (
                  <tr key={r.stage}>
                    <td>{r.stage}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================
          SELECTION REPORT
      ================================================= */}

      {active === "selection" && (
        <div className="panel">
          <div className="panel-title">
            Selection Report — Shortlist to Offer
          </div>

          <p>
            Selected candidates:{" "}
            <b>{selectedCount}</b>
          </p>

          <p>
            Offers sent:{" "}
            <b>{offersSent}</b>
          </p>

          <p>
            Conversion:{" "}
            <b>
              {selectedCount > 0
                ? Math.round(
                    (offersSent /
                      selectedCount) *
                      100
                  )
                : 0}
              %
            </b>
          </p>
        </div>
      )}

      {/* =================================================
          JOINING REPORT
      ================================================= */}

      {active === "joining" && (
        <div className="panel">
          <div className="panel-title">
            Joining Report — Accepted vs Joined
          </div>

          <p>
            Offers accepted:{" "}
            <b>{offersAccepted}</b>
          </p>

          <p>
            Joined:{" "}
            <b>{joinedCount}</b>
          </p>

          <p>
            Conversion:{" "}
            <b>
              {offersAccepted > 0
                ? Math.round(
                    (joinedCount /
                      offersAccepted) *
                      100
                  )
                : 0}
              %
            </b>
          </p>
        </div>
      )}

      {/* =================================================
          ACCEPTANCE REPORT
      ================================================= */}

      {active === "acceptance" && (
        <div className="panel">
          <div className="panel-title">
            Offer Acceptance Trend
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Offers Sent</th>
                <th>Accepted</th>
                <th>Rate</th>
              </tr>
            </thead>

            <tbody>
              {acceptanceByMonth.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>

                  <td>{r.sent}</td>

                  <td>{r.accepted}</td>

                  <td>
                    {r.sent > 0
                      ? Math.round(
                          (r.accepted /
                            r.sent) *
                            100
                        )
                      : 0}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================================================
          MONTHLY REPORT
      ================================================= */}

      {active === "monthly" && (
        <div className="panel">
          <div className="panel-title">
            Monthly / Yearly Summary
          </div>

          <div
            style={{
              width: "100%",
              height: 340,
              marginBottom: 20,
            }}
          >
            <ResponsiveContainer>
              <BarChart data={monthlyRows}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-default)"
                />

                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="applied"
                  name="Applied"
                  fill="#7C3AED"
                  radius={[6, 6, 0, 0]}
                />

                <Bar
                  dataKey="selected"
                  name="Selected"
                  fill="#06B6D4"
                  radius={[6, 6, 0, 0]}
                />

                <Bar
                  dataKey="joined"
                  name="Joined"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Applied</th>
                <th>Selected</th>
                <th>Joined</th>
              </tr>
            </thead>

            <tbody>
              {monthlyRows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>{r.applied}</td>
                  <td>{r.selected}</td>
                  <td>{r.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================================================
          CALL RECORDS REPORT
      ================================================= */}

      {active === "calls" && (
        <div className="panel">
          <div className="panel-title">
            Call Records Report
          </div>

          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Total Calls
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>
                {callStats.total}
              </div>
            </div>

            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Completed
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>
                {callStats.completed}
              </div>
            </div>

            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Follow Ups
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>
                {callStats.followUp}
              </div>
            </div>

            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Pending
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>
                {callStats.pending}
              </div>
            </div>
          </div>

          {/* Chart by organization */}
          {callsByOrg.length > 0 && (
            <div
              className="chart-card"
              style={{ width: "100%", height: 320, marginBottom: 24 }}
            >
              <ResponsiveContainer>
                <BarChart
                  data={callsByOrg.slice(0, 10)}
                  margin={{ top: 10, right: 10, left: -10, bottom: 50 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-default)"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />

                  <YAxis tick={{ fontSize: 11 }} />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="total"
                    name="Total Calls"
                    fill="#7C3AED"
                    radius={[6, 6, 0, 0]}
                  />

                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                  />

                  <Bar
                    dataKey="followUp"
                    name="Follow Up"
                    fill="#F59E0B"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          {callsByOrg.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 30,
                color: "var(--text-muted)",
              }}
            >
              No call records found.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Total Calls</th>
                  <th>Completed</th>
                  <th>Follow Up</th>
                </tr>
              </thead>

              <tbody>
                {callsByOrg.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.total}</td>
                    <td>{r.completed}</td>
                    <td>{r.followUp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
                </div>
      )}

      {/* =================================================
          INSTITUTE ANALYTICS
      ================================================= */}

      {active === "instituteAnalytics" && (
        <div className="panel">
          <div className="panel-title">Institute Analytics</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Institutes</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{instituteStats.total} / {ANALYTICS_TARGETS.institutes}+</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Active Institutes</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{instituteStats.active}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Inactive Institutes</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{instituteStats.inactive}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Students Shared</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{instituteStats.studentsShared}</div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          CORPORATE ANALYTICS
      ================================================= */}

      {active === "corporateAnalytics" && (
        <div className="panel">
          <div className="panel-title">Corporate Analytics</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Corporates</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{corporateStats.total} / {ANALYTICS_TARGETS.corporates}+</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Verified Corporates</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{corporateStats.verified}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Active Corporates</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{corporateStats.active}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Jobs Posted</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{corporateStats.jobsPosted}</div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          CANDIDATE ANALYTICS
      ================================================= */}

      {active === "candidateAnalytics" && (
        <div className="panel">
          <div className="panel-title">Candidate Analytics</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Candidates</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{candidateStats.total} / {ANALYTICS_TARGETS.candidates.toLocaleString()}+</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Profile Completed</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{candidateStats.profileCompleted}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Applications</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{candidateStats.applications}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Selected</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{candidateStats.selected}</div>
            </div>
            <div className="panel">
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Joined</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{candidateStats.joined}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}