import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./Dashboard.css";

const CHART_COLORS = [
  "#7657E8",
  "#12A7C7",
  "#E59A21",
  "#EC6E9B",
  "#15A878",
  "#8A75DB",
];

const stageBadgeClass = {
  "Resume Review": "gray",
  Aptitude: "gold",
  GD: "gold",
  Interview: "blue",
  Selected: "green",
  Rejected: "gray",
};

const PRIORITY_COLOR = { high: "#EF4444", medium: "#F59E0B", low: "#10B981" };
const EVENT_COLOR = { drive: "#7C3AED", interview: "#06B6D4", gd: "#F59E0B", meeting: "#10B981", other: "#8B90A7" };
const EVENT_LABEL = { drive: "Campus Drive", interview: "Interview", gd: "Group Discussion", meeting: "Meeting", other: "Other" };

export default function RecruiterDashboard({ user, setActivePage }) {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    myJobs: 0,
    resumes: 0,
    selections: 0,
    joined: 0,
  });

  const [applications, setApplications] = useState([]);
  const [growthData, setGrowthData] = useState([]);
  const [stageBreakdown, setStageBreakdown] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function goToCalendar() {
    if (typeof setActivePage === "function") {
      setActivePage("calendartasks");
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadRecruiterDashboard() {
      setLoading(true);
      setError("");

      try {
        const userId = user?.id;

        if (!userId) {
          throw new Error("No logged-in user found.");
        }

        const { data: myJobs, error: myJobsError } = await supabase
          .from("job_profiles")
          .select("id, title")
          .eq("recruiter_id", userId);

        if (myJobsError) {
          throw myJobsError;
        }

        const jobIds = (myJobs || []).map((job) => job.id);

        if (jobIds.length === 0) {
          if (!ignore) {
            setStats({
              myJobs: 0,
              resumes: 0,
              selections: 0,
              joined: 0,
            });

            setApplications([]);
            setGrowthData([]);
            setStageBreakdown([]);
            setLoading(false);
          }

          return;
        }

        const {
          data: applicationIdRows,
          error: applicationIdsError,
        } = await supabase
          .from("applications")
          .select("id")
          .in("job_id", jobIds);

        if (applicationIdsError) {
          throw applicationIdsError;
        }

        const applicationIds = (applicationIdRows || []).map(
          (application) => application.id,
        );

        const [
          { count: resumesCount, error: resumesError },
          { count: selectionsCount, error: selectionsError },
          { data: recentApplications, error: applicationsError },
          { data: allApplications, error: allApplicationsError },
          { count: joinedCount, error: joinedError },
        ] = await Promise.all([
          supabase
            .from("applications")
            .select("*", {
              count: "exact",
              head: true,
            })
            .in("job_id", jobIds),

          supabase
            .from("applications")
            .select("*", {
              count: "exact",
              head: true,
            })
            .in("job_id", jobIds)
            .eq("stage", "Selected"),

          supabase
            .from("applications")
            .select(
              "id, stage, resume_score, created_at, candidates(name, colleges(name)), job_profiles(title)",
            )
            .in("job_id", jobIds)
            .order("created_at", {
              ascending: false,
            })
            .limit(5),

          supabase
            .from("applications")
            .select("created_at, stage")
            .in("job_id", jobIds)
            .order("created_at", {
              ascending: true,
            }),

          applicationIds.length > 0
            ? supabase
                .from("joining")
                .select("*", {
                  count: "exact",
                  head: true,
                })
                .in("application_id", applicationIds)
                .eq("status", "Joined")
            : Promise.resolve({
                count: 0,
                error: null,
              }),
        ]);

        const firstError =
          resumesError ||
          selectionsError ||
          applicationsError ||
          allApplicationsError ||
          joinedError;

        if (firstError) {
          throw firstError;
        }

        if (ignore) {
          return;
        }

        const weeks = {};
        const stages = {};

        (allApplications || []).forEach((application) => {
          const date = new Date(application.created_at);

          if (Number.isNaN(date.getTime())) {
            return;
          }

          const weekStart = new Date(date);

          weekStart.setDate(
            date.getDate() - date.getDay(),
          );

          const weekKey = weekStart.toLocaleDateString(
            "en-GB",
            {
              day: "2-digit",
              month: "short",
            },
          );

          weeks[weekKey] = (weeks[weekKey] || 0) + 1;

          const stage = application.stage || "Unknown";

          stages[stage] = (stages[stage] || 0) + 1;
        });

        setGrowthData(
          Object.entries(weeks)
            .slice(-8)
            .map(([week, count]) => ({
              week,
              count,
            })),
        );

        setStageBreakdown(
          Object.entries(stages).map(([name, value]) => ({
            name,
            value,
          })),
        );

        setStats({
          myJobs: jobIds.length,
          resumes: resumesCount ?? 0,
          selections: selectionsCount ?? 0,
          joined: joinedCount ?? 0,
        });

        setApplications(recentApplications ?? []);
      } catch (loadError) {
        console.error(
          "Recruiter dashboard load error:",
          loadError,
        );

        if (!ignore) {
          setError(
            loadError?.message ||
              "Could not load your dashboard data.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadRecruiterDashboard();

    return () => {
      ignore = true;
    };
  }, [user]);

  return (
    <div
      className="dashboard-page"
      id="page-recruiter-dashboard"
    >
      <StarticleBackground />

      <header
        className="dashboard-header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <p className="dashboard-kicker">
            SAARTHI ANALYTICS
          </p>

          <h1>My Recruitment Dashboard</h1>

          <p>
            Track your own jobs and candidates from posting
            to joining.
          </p>
        </div>

        <button
          type="button"
          onClick={goToCalendar}
          aria-label="Calendar & Tasks"
          title="Calendar & Tasks"
          style={{
            background: "rgba(124,58,237,0.1)",
            border: "none",
            borderRadius: 12,
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          📅
        </button>
      </header>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      <div className="dashboard-stat-grid">
        <StatCard
          value={loading ? "—" : stats.myJobs}
          label="My Open Jobs"
          tone="purple"
        />

        <StatCard
          value={loading ? "—" : stats.resumes}
          label="Applications Received"
          tone="cyan"
        />

        <StatCard
          value={loading ? "—" : stats.selections}
          label="My Selections"
          tone="orange"
        />

        <StatCard
          value={loading ? "—" : stats.joined}
          label="Joined"
          tone="green"
        />
      </div>

      <section className="dashboard-chart-card growth-card">
        <div className="chart-heading">
          <div>
            <div className="dashboard-panel-title">
              Applications Growth
            </div>

            <div className="chart-caption">
              Your applications received by week
            </div>
          </div>

          <span className="chart-chip">
            Last 8 weeks
          </span>
        </div>

        <div className="growth-chart">
          {growthData.length === 0 && !loading ? (
            <ChartEmptyState message="No application growth data yet." />
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={growthData}
                margin={{
                  top: 10,
                  right: 15,
                  left: -20,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--dash-border)"
                />

                <XAxis
                  dataKey="week"
                  tick={{
                    fontSize: 10,
                    fill: "var(--dash-muted)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{
                    fontSize: 10,
                    fill: "var(--dash-muted)",
                  }}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={<DashboardTooltip />}
                />

                <Line
                  type="monotone"
                  dataKey="count"
                  name="Applications"
                  stroke="var(--dash-chart-primary)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "var(--dash-chart-primary)",
                    stroke: "var(--dash-surface)",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="dashboard-grid-two">
        <div className="dashboard-chart-card mini-chart-card">
          <div className="chart-heading">
            <div>
              <div className="dashboard-panel-title">
                Candidates by Stage
              </div>

              <div className="chart-caption">
                Your current pipeline
              </div>
            </div>
          </div>

          <div className="mini-chart">
            {stageBreakdown.length === 0 &&
            !loading ? (
              <ChartEmptyState message="No stage data yet." />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={stageBreakdown}
                  margin={{
                    top: 10,
                    right: 10,
                    left: -20,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--dash-border)"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 9,
                      fill: "var(--dash-muted)",
                    }}
                    angle={-15}
                    textAnchor="end"
                    height={48}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "var(--dash-muted)",
                    }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    content={<DashboardTooltip />}
                  />

                  <Bar
                    dataKey="value"
                    name="Candidates"
                    radius={[7, 7, 0, 0]}
                  >
                    {stageBreakdown.map(
                      (entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            CHART_COLORS[
                              index %
                                CHART_COLORS.length
                            ]
                          }
                        />
                      ),
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card mini-chart-card">
          <div className="chart-heading">
            <div>
              <div className="dashboard-panel-title">
                Stage Distribution
              </div>

              <div className="chart-caption">
                Share of your applications
              </div>
            </div>
          </div>

          <div className="mini-chart">
            {stageBreakdown.length === 0 &&
            !loading ? (
              <ChartEmptyState message="No stage distribution yet." />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={stageBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={76}
                    innerRadius={42}
                    paddingAngle={3}
                    label={false}
                  >
                    {stageBreakdown.map(
                      (entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            CHART_COLORS[
                              index %
                                CHART_COLORS.length
                            ]
                          }
                        />
                      ),
                    )}
                  </Pie>

                  <Tooltip
                    content={<DashboardTooltip />}
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize: 10,
                      color: "var(--dash-muted)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-panel applications-panel">
        <div className="dashboard-section-heading">
          <div>
            <div className="dashboard-panel-title">
              Recent Applications
            </div>

            <div className="chart-caption">
              Latest activity on your jobs
            </div>
          </div>

          <span className="section-icon">↗️</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Campus</th>
                <th>Applied For</th>
                <th>Stage</th>
                <th>Score</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading...</td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    No applications yet.
                  </td>
                </tr>
              ) : (
                applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div className="candidate-cell">
                        <span className="candidate-avatar">
                          {(
                            application.candidates?.name ||
                            "?"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <span>
                          {application.candidates?.name ||
                            "—"}
                        </span>
                      </div>
                    </td>

                    <td>
                      {application.candidates?.colleges
                        ?.name || "—"}
                    </td>

                    <td>
                      {application.job_profiles?.title ||
                        "—"}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          stageBadgeClass[
                            application.stage
                          ] || "gray"
                        }`}
                      >
                        {application.stage ||
                          "Unknown"}
                      </span>
                    </td>

                    <td>
                      {application.resume_score ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ value, label, helper, tone = "purple" }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-decoration" />

      <div className="stat-icon" aria-hidden="true">
        {tone === "purple"
          ? "✦"
          : tone === "cyan"
            ? "↗️"
            : tone === "orange"
              ? "◈"
              : "✓"}
      </div>

      <div className="num">{value}</div>

      <div className="lbl">{label}</div>

      {helper && (
        <div className="delta">{helper}</div>
      )}
    </article>
  );
}

function DashboardTooltip({
  active,
  payload,
  label,
}) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="dashboard-tooltip">
      <div className="tooltip-label">{label}</div>

      <div className="tooltip-value">
        {payload[0].name}: {payload[0].value}
      </div>
    </div>
  );
}

function ChartEmptyState({ message }) {
  return (
    <div className="chart-empty-state">
      <span>◌</span>
      <p>{message}</p>
    </div>
  );
}

function StarticleBackground() {
  return (
    <div
      className="starticle-background"
      aria-hidden="true"
    >
      {Array.from({ length: 15 }, (_, index) => (
        <span
          key={index}
          className={`starticle starticle-${index + 1}`}
        />
      ))}
    </div>
  );
}