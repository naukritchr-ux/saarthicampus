import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import "./Reports.css";

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

const FUNNEL_ORDER = ["Resume Review", "Aptitude", "GD", "Interview", "Selected", "Rejected"];

const CHART_COLORS = ["#7657E8", "#12A7C7", "#E59A21", "#EC6E9B", "#15A878", "#8A75DB"];

const REPORT_LIST = [
  { key: "jobs", icon: "💼", t: "My Jobs Report", d: "Applications & selections per job" },
  { key: "campus", icon: "🏛️", t: "Campus-wise Report", d: "Candidates by campus" },
  { key: "funnel", icon: "🔻", t: "Hiring Funnel", d: "Applied → Joined" },
  { key: "selection", icon: "📝", t: "Selection Report", d: "Shortlist to offer" },
  { key: "joining", icon: "🤝", t: "Joining Report", d: "Accepted vs joined" },
  { key: "monthly", icon: "📅", t: "Monthly Report", d: "My drives by month" },
];

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function downloadCSV(filename, columns, rows) {
  if (!rows || rows.length === 0) {
    alert("No data available to download for this report.");
    return;
  }
  const escape = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(c.render ? c.render(r) : r[c.key])).join(","))
    .join("\n");
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="rp-stat-card">
      <div className="rp-stat-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="rp-stat-label">{label}</div>
      <div className="rp-stat-value">{value}</div>
      {sub && <div className="rp-stat-sub">{sub}</div>}
    </div>
  );
}

function DataTable({ columns, rows, rowKey }) {
  if (rows.length === 0) {
    return <div className="rp-empty">No data available.</div>;
  }
  return (
    <div className="rp-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RecruiterReports({ user }) {
  const [apps, setApps] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [offers, setOffers] = useState([]);
  const [joining, setJoining] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [active, setActive] = useState("jobs");

  useEffect(() => {
    let ignore = false;

    async function loadRecruiterReports() {
      setLoading(true);
      setError("");

      try {
        const userId = user?.id;
        if (!userId) throw new Error("No logged-in user found.");

        const { data: myJobs, error: jobsError } = await supabase
          .from("job_profiles")
          .select("id, title, company")
          .eq("recruiter_id", userId);

        if (jobsError) throw jobsError;

        const jobIds = (myJobs || []).map((j) => j.id);

        if (jobIds.length === 0) {
          if (!ignore) {
            setJobs([]);
            setApps([]);
            setOffers([]);
            setJoining([]);
            setLoading(false);
          }
          return;
        }

        const { data: myApps, error: appsError } = await supabase
          .from("applications")
          .select(
            "id, stage, resume_score, created_at, job_id, candidates(name, colleges(name)), job_profiles(title, company)"
          )
          .in("job_id", jobIds);

        if (appsError) throw appsError;

        const applicationIds = (myApps || []).map((a) => a.id);

        const [{ data: myOffers, error: offersError }, { data: myJoining, error: joiningError }] =
          await Promise.all([
            applicationIds.length > 0
              ? supabase.from("offers").select("*").in("application_id", applicationIds)
              : Promise.resolve({ data: [], error: null }),
            applicationIds.length > 0
              ? supabase.from("joining").select("*").in("application_id", applicationIds)
              : Promise.resolve({ data: [], error: null }),
          ]);

        if (offersError) throw offersError;
        if (joiningError) throw joiningError;

        if (!ignore) {
          setJobs(myJobs || []);
          setApps(myApps || []);
          setOffers(myOffers || []);
          setJoining(myJoining || []);
        }
      } catch (err) {
        console.error("Recruiter reports load error:", err);
        if (!ignore) setError(err?.message || "Could not load your reports.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadRecruiterReports();
    return () => {
      ignore = true;
    };
  }, [user]);

  /* ---------------- JOBS REPORT ---------------- */

  const jobRows = useMemo(() => {
    return jobs.map((job) => {
      const jobApps = apps.filter((a) => a.job_id === job.id);
      const selected = jobApps.filter((a) => a.stage === "Selected").length;
      return {
        title: job.title || "Untitled",
        company: job.company || "—",
        applications: jobApps.length,
        selected,
        placementRate: pct(selected, jobApps.length),
      };
    }).sort((a, b) => b.applications - a.applications);
  }, [jobs, apps]);

  const jobStats = useMemo(() => {
    const selected = apps.filter((a) => a.stage === "Selected").length;
    const joinedCount = joining.filter((j) => j.status === "Joined").length;
    return {
      myJobs: jobs.length,
      totalApplications: apps.length,
      selected,
      joined: joinedCount,
    };
  }, [jobs, apps, joining]);

  /* ---------------- CAMPUS REPORT ---------------- */

  const campusRows = useMemo(() => {
    const byCollege = {};
    apps.forEach((a) => {
      const name = a?.candidates?.colleges?.name || "Unknown";
      if (!byCollege[name]) byCollege[name] = { name, total: 0, selected: 0 };
      byCollege[name].total += 1;
      if (a.stage === "Selected") byCollege[name].selected += 1;
    });
    return Object.values(byCollege)
      .map((c) => ({ ...c, placementRate: pct(c.selected, c.total) }))
      .sort((a, b) => b.total - a.total);
  }, [apps]);

  /* ---------------- FUNNEL ---------------- */

  const funnelRows = useMemo(() => {
    const counts = {};
    apps.forEach((a) => {
      counts[a.stage] = (counts[a.stage] || 0) + 1;
    });
    return FUNNEL_ORDER.filter((s) => counts[s]).map((s) => ({ stage: s, count: counts[s] }));
  }, [apps]);

  /* ---------------- SELECTION / JOINING ---------------- */

  const selectedCount = apps.filter((a) => a.stage === "Selected").length;
  const offersSent = offers.length;
  const offersAccepted = offers.filter((o) => o.status === "Accepted").length;
  const joinedCount = joining.filter((j) => j.status === "Joined").length;

  /* ---------------- MONTHLY ---------------- */

  const monthlyRows = useMemo(() => {
    const byMonth = {};
    apps.forEach((a) => {
      if (!a.created_at) return;
      const m = new Date(a.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (!byMonth[m]) byMonth[m] = { month: m, applied: 0, selected: 0 };
      byMonth[m].applied += 1;
      if (a.stage === "Selected") byMonth[m].selected += 1;
    });
    return Object.values(byMonth);
  }, [apps]);

  /* ---------------- RENDERERS ---------------- */

  function renderJobs() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>My Jobs Report</h2>
          <p>Applications and selections across your posted jobs</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="💼" label="My Open Jobs" value={jobStats.myJobs} color="#7657E8" />
          <StatCard icon="👥" label="Applications" value={jobStats.totalApplications.toLocaleString()} color="#12A7C7" />
          <StatCard icon="🎯" label="Selections" value={jobStats.selected.toLocaleString()} color="#E59A21" />
          <StatCard icon="✅" label="Joined" value={jobStats.joined.toLocaleString()} color="#15A878" />
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Job-wise Breakdown</h3>
            <p>Applications and selection rate per job</p>
          </div>
          <DataTable
            rowKey={(r) => r.title + r.company}
            columns={[
              { key: "title", label: "Job Title" },
              { key: "company", label: "Company" },
              { key: "applications", label: "Applications" },
              { key: "selected", label: "Selected" },
              { key: "placementRate", label: "Selection Rate", render: (r) => `${r.placementRate}%` },
            ]}
            rows={jobRows}
          />
        </div>
      </>
    );
  }

  function renderCampus() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Campus-wise Report</h2>
          <p>Candidates who applied to your jobs, by campus</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Campus Breakdown</h3>
            <p>Applications and selections by campus</p>
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Campus" },
              { key: "total", label: "Applications" },
              { key: "selected", label: "Selected" },
              { key: "placementRate", label: "Selection Rate", render: (r) => `${r.placementRate}%` },
            ]}
            rows={campusRows}
          />
        </div>
      </>
    );
  }

  function renderFunnel() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Hiring Funnel</h2>
          <p>Your candidates' progression from Applied to Joined</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Funnel Breakdown</h3>
          </div>
          <div style={{ width: "100%", height: 280, marginBottom: 16 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={funnelRows}
                  dataKey="count"
                  nameKey="stage"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={(entry) => `${entry.stage}: ${entry.count}`}
                >
                  {funnelRows.map((entry, i) => (
                    <Cell key={entry.stage} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            rowKey={(r) => r.stage}
            columns={[
              { key: "stage", label: "Stage" },
              { key: "count", label: "Candidates" },
            ]}
            rows={funnelRows}
          />
        </div>
      </>
    );
  }

  function renderSelection() {
    const conversion = pct(offersSent, selectedCount);
    return (
      <>
        <div className="rp-detail-head">
          <h2>Selection Report</h2>
          <p>Shortlist to offer conversion for your jobs</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🎯" label="Selected Candidates" value={selectedCount.toLocaleString()} color="#7657E8" />
          <StatCard icon="📨" label="Offers Sent" value={offersSent.toLocaleString()} color="#12A7C7" />
          <StatCard icon="📈" label="Conversion" value={`${conversion}%`} sub="Offers / Selected" color="#15A878" />
        </div>
      </>
    );
  }

  function renderJoining() {
    const conversion = pct(joinedCount, offersAccepted);
    return (
      <>
        <div className="rp-detail-head">
          <h2>Joining Report</h2>
          <p>Accepted offers vs actual joinings for your candidates</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="📨" label="Offers Accepted" value={offersAccepted.toLocaleString()} color="#7657E8" />
          <StatCard icon="✅" label="Joined" value={joinedCount.toLocaleString()} color="#12A7C7" />
          <StatCard icon="📈" label="Conversion" value={`${conversion}%`} sub="Joined / Accepted" color="#15A878" />
        </div>
      </>
    );
  }

  function renderMonthly() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Monthly Report</h2>
          <p>Your applications and selections by month</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Monthly Summary</h3>
          </div>
          <div style={{ width: "100%", height: 280, marginBottom: 16 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="applied" name="Applied" fill="#7657E8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="selected" name="Selected" fill="#12A7C7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            rowKey={(r) => r.month}
            columns={[
              { key: "month", label: "Month" },
              { key: "applied", label: "Applied" },
              { key: "selected", label: "Selected" },
            ]}
            rows={monthlyRows}
          />
        </div>
      </>
    );
  }

  const RENDERERS = {
    jobs: renderJobs,
    campus: renderCampus,
    funnel: renderFunnel,
    selection: renderSelection,
    joining: renderJoining,
    monthly: renderMonthly,
  };

  const DOWNLOAD_DATA = {
    jobs: {
      columns: [
        { key: "title", label: "Job Title" },
        { key: "company", label: "Company" },
        { key: "applications", label: "Applications" },
        { key: "selected", label: "Selected" },
        { key: "placementRate", label: "Selection Rate %" },
      ],
      rows: jobRows,
    },
    campus: {
      columns: [
        { key: "name", label: "Campus" },
        { key: "total", label: "Applications" },
        { key: "selected", label: "Selected" },
        { key: "placementRate", label: "Selection Rate %" },
      ],
      rows: campusRows,
    },
    funnel: {
      columns: [
        { key: "stage", label: "Stage" },
        { key: "count", label: "Candidates" },
      ],
      rows: funnelRows,
    },
    selection: {
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Selected Candidates", value: selectedCount },
        { metric: "Offers Sent", value: offersSent },
        { metric: "Conversion %", value: pct(offersSent, selectedCount) },
      ],
    },
    joining: {
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Offers Accepted", value: offersAccepted },
        { metric: "Joined", value: joinedCount },
        { metric: "Conversion %", value: pct(joinedCount, offersAccepted) },
      ],
    },
    monthly: {
      columns: [
        { key: "month", label: "Month" },
        { key: "applied", label: "Applied" },
        { key: "selected", label: "Selected" },
      ],
      rows: monthlyRows,
    },
  };

  function handleDownloadReport() {
    const data = DOWNLOAD_DATA[active];
    if (!data) return;
    const meta = REPORT_LIST.find((r) => r.key === active);
    const filename = `${(meta?.t || active).replace(/\s+/g, "_")}.csv`;
    downloadCSV(filename, data.columns, data.rows);
  }

  if (loading) {
    return (
      <div className="page active">
        <div className="panel">
          <p style={{ color: "var(--slate-light)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page active">
        <div className="panel">
          <p style={{ color: "var(--red, #d64545)" }}>{error}</p>
        </div>
      </div>
    );
  }

  const activeMeta = REPORT_LIST.find((r) => r.key === active);

  return (
    <div className="page active rp-page" id="page-recruiter-reports">
      <div className="rp-breadcrumb">Reports &amp; Analytics {activeMeta ? `> ${activeMeta.t}` : ""}</div>

      <div className="rp-page-head">
        <div className="rp-page-title">
          <span className="rp-page-icon">📊</span>
          <h1>My Reports</h1>
        </div>
        <div className="rp-page-actions">
          <button className="btn-outline" onClick={handleDownloadReport}>
            ⬇ Download Report
          </button>
        </div>
      </div>

      <div className="rp-layout" style={{ gridTemplateColumns: "260px 1fr" }}>
        {/* LEFT: REPORT LIST */}
        <div className="rp-sidebar">
          <div className="rp-sidebar-head">
            <div className="rp-sidebar-title">My Reports</div>
            <div className="rp-sidebar-sub">Scoped to your jobs & candidates</div>
          </div>
          <div className="rp-report-list">
            {REPORT_LIST.map((r) => (
              <div
                key={r.key}
                className={`rp-report-item ${active === r.key ? "active" : ""}`}
                onClick={() => setActive(r.key)}
              >
                <span className="rp-report-icon">{r.icon}</span>
                <div>
                  <div className="rp-report-title">{r.t}</div>
                  <div className="rp-report-desc">{r.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DETAIL PANEL */}
        <div className="rp-detail">{RENDERERS[active] ? RENDERERS[active]() : null}</div>
      </div>
    </div>
  );
}