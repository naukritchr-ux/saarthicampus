import { useEffect, useState, useMemo } from "react";
import { getCorporateKpis, getCorporateCandidates } from "../lib/api";
import "./Reports.css";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = ["#7657E8", "#12A7C7", "#E59A21", "#EC6E9B", "#15A878", "#8A75DB"];

const REPORT_LIST = [
  { key: "overview", icon: "📊", t: "Hiring Overview", d: "Jobs, applications, offers" },
  { key: "campus", icon: "🏛️", t: "Campus-wise Report", d: "Candidates by campus" },
  { key: "job", icon: "💼", t: "Job-wise Report", d: "Candidates per job posting" },
  { key: "funnel", icon: "🔻", t: "Hiring Funnel", d: "Applied → Joined" },
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

function getCandidateCampus(c) {
  return c?.college || c?.colleges?.name || c?.college_name || "Unknown";
}

function getCandidateJob(c) {
  return c?.job_title || c?.job_profiles?.title || c?.applied_for || "Unknown Job";
}

function getCandidateStage(c) {
  return c?.stage || c?.application_stage || "Unknown";
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

export default function CorporateReports() {
  const [kpis, setKpis] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState("overview");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [kpiData, candidateData] = await Promise.all([
          getCorporateKpis(),
          getCorporateCandidates().catch(() => []),
        ]);
        if (!ignore) {
          setKpis(kpiData);
          setCandidates(candidateData || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to load hiring analytics");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const campusRows = useMemo(() => {
    const byCampus = {};
    candidates.forEach((c) => {
      const name = getCandidateCampus(c);
      if (!byCampus[name]) byCampus[name] = { name, total: 0, selected: 0 };
      byCampus[name].total += 1;
      if (getCandidateStage(c) === "Selected") byCampus[name].selected += 1;
    });
    return Object.values(byCampus)
      .map((c) => ({ ...c, rate: pct(c.selected, c.total) }))
      .sort((a, b) => b.total - a.total);
  }, [candidates]);

  const jobRows = useMemo(() => {
    const byJob = {};
    candidates.forEach((c) => {
      const name = getCandidateJob(c);
      if (!byJob[name]) byJob[name] = { name, total: 0, selected: 0 };
      byJob[name].total += 1;
      if (getCandidateStage(c) === "Selected") byJob[name].selected += 1;
    });
    return Object.values(byJob)
      .map((j) => ({ ...j, rate: pct(j.selected, j.total) }))
      .sort((a, b) => b.total - a.total);
  }, [candidates]);

  const funnelRows = useMemo(() => {
    const counts = {};
    candidates.forEach((c) => {
      const stage = getCandidateStage(c);
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([stage]) => stage !== "Unknown")
      .map(([stage, count]) => ({ stage, count }));
  }, [candidates]);

  function renderOverview() {
    const matchRate = kpis?.matchRate ?? 0;
    const hiringConversion = kpis?.hiringConversion ?? 0;
    return (
      <>
        <div className="rp-detail-head">
          <h2>Hiring Overview</h2>
          <p>Actual hiring activity across your job postings</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="💼" label="Jobs Posted" value={kpis?.jobsPosted ?? 0} color="#7657E8" />
          <StatCard icon="📌" label="Active Jobs" value={kpis?.activeJobs ?? 0} color="#12A7C7" />
          <StatCard icon="📥" label="Applications" value={kpis?.applications ?? 0} color="#15A878" />
          <StatCard icon="📋" label="Shortlisted" value={kpis?.shortlisted ?? 0} color="#E59A21" />
          <StatCard icon="🗣️" label="Interviews" value={kpis?.interviews ?? 0} color="#EC6E9B" />
          <StatCard icon="📨" label="Offers" value={kpis?.offers ?? 0} color="#8A75DB" />
          <StatCard icon="✅" label="Joined" value={kpis?.joined ?? 0} color="#15A878" />
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🎯" label="Candidate Match Rate" value={`${matchRate}%`} sub="Avg AI match score" color="#7657E8" />
          <StatCard icon="📈" label="Hiring Conversion" value={`${hiringConversion}%`} sub="Applications → Joining" color="#12A7C7" />
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
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Campus" },
              { key: "total", label: "Applications" },
              { key: "selected", label: "Selected" },
              { key: "rate", label: "Selection Rate", render: (r) => `${r.rate}%` },
            ]}
            rows={campusRows}
          />
        </div>
      </>
    );
  }

  function renderJob() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Job-wise Report</h2>
          <p>Candidates per job posting</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Job Breakdown</h3>
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Job Title" },
              { key: "total", label: "Applications" },
              { key: "selected", label: "Selected" },
              { key: "rate", label: "Selection Rate", render: (r) => `${r.rate}%` },
            ]}
            rows={jobRows}
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
          <p>Candidate progression across stages</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Funnel Breakdown</h3>
          </div>
          {funnelRows.length === 0 ? (
            <div className="rp-empty">No stage data available.</div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </>
    );
  }

  const RENDERERS = {
    overview: renderOverview,
    campus: renderCampus,
    job: renderJob,
    funnel: renderFunnel,
  };

  const DOWNLOAD_DATA = {
    overview: {
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Jobs Posted", value: kpis?.jobsPosted ?? 0 },
        { metric: "Active Jobs", value: kpis?.activeJobs ?? 0 },
        { metric: "Applications", value: kpis?.applications ?? 0 },
        { metric: "Shortlisted", value: kpis?.shortlisted ?? 0 },
        { metric: "Interviews", value: kpis?.interviews ?? 0 },
        { metric: "Offers", value: kpis?.offers ?? 0 },
        { metric: "Joined", value: kpis?.joined ?? 0 },
        { metric: "Match Rate %", value: kpis?.matchRate ?? 0 },
        { metric: "Hiring Conversion %", value: kpis?.hiringConversion ?? 0 },
      ],
    },
    campus: {
      columns: [
        { key: "name", label: "Campus" },
        { key: "total", label: "Applications" },
        { key: "selected", label: "Selected" },
        { key: "rate", label: "Selection Rate %" },
      ],
      rows: campusRows,
    },
    job: {
      columns: [
        { key: "name", label: "Job Title" },
        { key: "total", label: "Applications" },
        { key: "selected", label: "Selected" },
        { key: "rate", label: "Selection Rate %" },
      ],
      rows: jobRows,
    },
    funnel: {
      columns: [
        { key: "stage", label: "Stage" },
        { key: "count", label: "Candidates" },
      ],
      rows: funnelRows,
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
    <div className="page active rp-page" id="page-corporate-reports">
      <div className="rp-breadcrumb">Reports &amp; Analytics {activeMeta ? `> ${activeMeta.t}` : ""}</div>

      <div className="rp-page-head">
        <div className="rp-page-title">
          <span className="rp-page-icon">📊</span>
          <h1>Reports &amp; Analytics</h1>
        </div>
        <div className="rp-page-actions">
          <button className="btn-outline" onClick={handleDownloadReport}>
            ⬇ Download Report
          </button>
        </div>
      </div>

      <div className="rp-layout" style={{ gridTemplateColumns: "260px 1fr" }}>
        <div className="rp-sidebar">
          <div className="rp-sidebar-head">
            <div className="rp-sidebar-title">My Reports</div>
            <div className="rp-sidebar-sub">Scoped to your company</div>
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

        <div className="rp-detail">{RENDERERS[active] ? RENDERERS[active]() : null}</div>
      </div>
    </div>
  );
}