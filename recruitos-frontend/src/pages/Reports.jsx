import { useEffect, useState, useMemo } from "react";
import "./Reports.css";
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

const FUNNEL_ORDER = ["Resume Review", "Interview", "Selected", "Rejected"];

const CHART_COLORS = [
  "#7C3AED", "#06B6D4", "#EC4899", "#F59E0B",
  "#10B981", "#6366F1", "#14B8A6", "#EF4444",
];

const ANALYTICS_TARGETS = {
  institutes: 300,
  corporates: 150,
  candidates: 15000,
};

const REPORT_LIST = [
  { key: "campus", icon: "🏛️", t: "Campus-wise Report", d: "Performance per college" },
  { key: "company", icon: "🏢", t: "Company-wise Report", d: "Performance per company" },
  { key: "recruiter", icon: "🧑‍💼", t: "Recruiter Performance", d: "Drives handled, conversion" },
  { key: "funnel", icon: "🔻", t: "Hiring Funnel", d: "Applied → Joined" },
  { key: "selection", icon: "📝", t: "Selection Report", d: "Shortlist to offer" },
  { key: "joining", icon: "🤝", t: "Joining Report", d: "Accepted vs joined" },
  { key: "acceptance", icon: "📨", t: "Offer Acceptance", d: "Acceptance rate trend" },
  { key: "monthly", icon: "📅", t: "Monthly / Yearly Report", d: "Drive summary" },
  { key: "calls", icon: "📞", t: "Call Records Report", d: "Completed calls, follow-ups" },
  { key: "instituteAnalytics", icon: "🎓", t: "Institute Analytics", d: "Institutes, drives, students" },
  { key: "corporateAnalytics", icon: "🏭", t: "Corporate Analytics", d: "Companies, jobs posted" },
  { key: "candidateAnalytics", icon: "👥", t: "Candidate Analytics", d: "Candidates, profiles" },
];

/* ---------------------------------------------------------
   HELPERS
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
    job?.recruiter_email ||
    application?.recruiter_email ||
    "Unassigned"
  );
}

function getJobName(application) {
  const job = application?.job_profiles || {};
  return job?.title || job?.job_title || job?.name || "Unknown Job";
}

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

/* ---------------------------------------------------------
   SMALL SHARED UI PIECES
--------------------------------------------------------- */

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

  const [active, setActive] = useState("campus");

  const [academicYear, setAcademicYear] = useState("2026-27");
  const [driveStatus, setDriveStatus] = useState("all");

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
        if (!ignore) setLoading(false);
      }
    }

    init();
    return () => { ignore = true; };
  }, []);

  /* -------------------------------------------------------
     CAMPUS REPORT
  ------------------------------------------------------- */

  const campusRows = useMemo(() => {
    const byCollege = {};
    apps.forEach((a) => {
      const name = a?.candidates?.colleges?.name || a?.college_name || "Unknown";
      if (!byCollege[name]) byCollege[name] = { name, drives: new Set(), total: 0, selected: 0, joined: 0 };
      byCollege[name].total += 1;
      if (a.job_id) byCollege[name].drives.add(a.job_id);
      if (a.stage === "Selected") byCollege[name].selected += 1;
      if (a.stage === "Joined") byCollege[name].joined += 1;
    });
    return Object.values(byCollege)
      .map((c) => ({
        name: c.name,
        drives: c.drives.size,
        applications: c.total,
        selected: c.selected,
        joined: c.joined,
        placementRate: pct(c.selected, c.total),
      }))
      .sort((x, y) => y.applications - x.applications);
  }, [apps]);

  const campusStats = useMemo(() => {
    const totalCampuses = colleges.length || campusRows.length;
    const totalDrives = new Set(apps.map((a) => a.job_id).filter(Boolean)).size;
    const totalApplications = apps.length;
    const totalSelections = apps.filter((a) => a.stage === "Selected").length;
    const placementRate = pct(totalSelections, totalApplications);
    return { totalCampuses, totalDrives, totalApplications, totalSelections, placementRate };
  }, [colleges, apps, campusRows]);

  const campusInsights = useMemo(() => {
    if (campusRows.length === 0) return [];
    const highest = [...campusRows].sort((a, b) => b.placementRate - a.placementRate)[0];
    const mostApps = [...campusRows].sort((a, b) => b.applications - a.applications)[0];
    const improving = campusRows.filter((c) => c.placementRate >= 15).length;
    return [
      { icon: "📈", label: "Highest Placement Rate", detail: `${highest.name} has the highest placement rate of ${highest.placementRate}%` },
      { icon: "📥", label: "Most Applications", detail: `${mostApps.name} leads with ${mostApps.applications.toLocaleString()} total applications` },
      { icon: "🎯", label: "Total Selections", detail: `${campusStats.totalSelections.toLocaleString()} students selected across all campuses` },
      { icon: "📊", label: "Improving Trend", detail: `${improving} campuses showing strong placement rates` },
    ];
  }, [campusRows, campusStats]);

  /* -------------------------------------------------------
     COMPANY REPORT
  ------------------------------------------------------- */

  const companyRows = useMemo(() => {
    const byCompany = {};
    apps.forEach((a) => {
      const name = a?.job_profiles?.company || a?.company_name || "Unknown";
      if (!byCompany[name]) byCompany[name] = { name, drives: new Set(), total: 0, selected: 0, joined: 0 };
      byCompany[name].total += 1;
      if (a.job_id) byCompany[name].drives.add(a.job_id);
      if (a.stage === "Selected") byCompany[name].selected += 1;
      if (a.stage === "Joined") byCompany[name].joined += 1;
    });
    return Object.values(byCompany)
      .map((c) => ({
        name: c.name,
        drives: c.drives.size,
        applications: c.total,
        selected: c.selected,
        joined: c.joined,
        placementRate: pct(c.selected, c.total),
      }))
      .sort((x, y) => y.applications - x.applications);
  }, [apps]);

  const companyStats = useMemo(() => {
    const totalCompanies = companies.length || companyRows.length;
    const totalJobs = jobs.length;
    const totalApplications = apps.length;
    const totalSelections = apps.filter((a) => a.stage === "Selected").length;
    return { totalCompanies, totalJobs, totalApplications, totalSelections };
  }, [companies, jobs, apps, companyRows]);

  const companyInsights = useMemo(() => {
    if (companyRows.length === 0) return [];
    const highest = [...companyRows].sort((a, b) => b.placementRate - a.placementRate)[0];
    const mostApps = [...companyRows].sort((a, b) => b.applications - a.applications)[0];
    return [
      { icon: "📈", label: "Best Conversion", detail: `${highest.name} converts ${highest.placementRate}% of applicants` },
      { icon: "📥", label: "Most Applications", detail: `${mostApps.name} received ${mostApps.applications.toLocaleString()} applications` },
      { icon: "🎯", label: "Total Selections", detail: `${companyStats.totalSelections.toLocaleString()} candidates selected across all companies` },
    ];
  }, [companyRows, companyStats]);

  /* -------------------------------------------------------
     RECRUITER PERFORMANCE
  ------------------------------------------------------- */

  const recruiterRows = useMemo(() => {
    const recruiters = {};
    apps.forEach((a) => {
      const recruiterName = getRecruiterName(a);
      const jobName = getJobName(a);
      if (!recruiters[recruiterName]) {
        recruiters[recruiterName] = { name: recruiterName, jobs: new Set(), applications: 0, selected: 0, joined: 0 };
      }
      const r = recruiters[recruiterName];
      r.jobs.add(jobName);
      r.applications += 1;
      if (a.stage === "Selected") r.selected += 1;
      if (a.stage === "Joined") r.joined += 1;
    });
    return Object.values(recruiters)
      .map((r) => ({
        name: r.name,
        drives: r.jobs.size,
        applications: r.applications,
        selected: r.selected,
        joined: r.joined,
        selectionRate: pct(r.selected, r.applications),
        joiningRate: pct(r.joined, r.selected),
        conversion: pct(r.joined, r.applications),
      }))
      .sort((a, b) => b.applications - a.applications);
  }, [apps]);

  const recruiterStats = useMemo(() => {
    const totalApplications = apps.length;
    const selected = apps.filter((a) => a.stage === "Selected").length;
    const joined = apps.filter((a) => a.stage === "Joined").length;
    return { totalRecruiters: recruiterRows.length, totalApplications, selected, joined };
  }, [apps, recruiterRows]);

  const recruiterInsights = useMemo(() => {
    if (recruiterRows.length === 0) return [];
    const top = [...recruiterRows].sort((a, b) => b.conversion - a.conversion)[0];
    const busiest = [...recruiterRows].sort((a, b) => b.applications - a.applications)[0];
    return [
      { icon: "🏆", label: "Top Converter", detail: `${top.name} has the highest conversion rate of ${top.conversion}%` },
      { icon: "📥", label: "Busiest Recruiter", detail: `${busiest.name} handled ${busiest.applications.toLocaleString()} applications` },
      { icon: "🎯", label: "Total Joined", detail: `${recruiterStats.joined.toLocaleString()} candidates joined across all recruiters` },
    ];
  }, [recruiterRows, recruiterStats]);

  /* -------------------------------------------------------
     FUNNEL
  ------------------------------------------------------- */

  const funnelRows = useMemo(() => {
    const counts = {};
    apps.forEach((a) => { counts[a.stage] = (counts[a.stage] || 0) + 1; });
    return FUNNEL_ORDER.filter((s) => counts[s]).map((s) => ({ stage: s, count: counts[s] }));
  }, [apps]);

  const funnelStats = useMemo(() => {
    const applied = apps.length;
    const interview = apps.filter((a) => a.stage === "Interview").length;
    const selected = apps.filter((a) => a.stage === "Selected").length;
    const joined = apps.filter((a) => a.stage === "Joined").length;
    return { applied, interview, selected, joined };
  }, [apps]);

  /* -------------------------------------------------------
     SELECTION / JOINING
  ------------------------------------------------------- */

  const selectedCount = apps.filter((a) => a.stage === "Selected").length;
  const offersSent = offers.length;
  const offersAccepted = offers.filter((o) => o.status === "Accepted").length;
  const joinedCount = joining.filter((j) => j.status === "Joined").length;

  /* -------------------------------------------------------
     OFFER ACCEPTANCE
  ------------------------------------------------------- */

  const acceptanceByMonth = useMemo(() => {
    const byMonth = {};
    offers.forEach((o) => {
      if (!o.sent_on) return;
      const m = new Date(o.sent_on).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (!byMonth[m]) byMonth[m] = { month: m, sent: 0, accepted: 0 };
      byMonth[m].sent += 1;
      if (o.status === "Accepted") byMonth[m].accepted += 1;
    });
    return Object.values(byMonth).map((r) => ({ ...r, rate: pct(r.accepted, r.sent) }));
  }, [offers]);

  /* -------------------------------------------------------
     MONTHLY
  ------------------------------------------------------- */

  const monthlyRows = useMemo(() => {
    const byMonth = {};
    apps.forEach((a) => {
      if (!a.created_at) return;
      const m = new Date(a.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (!byMonth[m]) byMonth[m] = { month: m, applied: 0, selected: 0, joined: 0 };
      byMonth[m].applied += 1;
      if (a.stage === "Selected") byMonth[m].selected += 1;
      if (a.stage === "Joined") byMonth[m].joined += 1;
    });
    return Object.values(byMonth);
  }, [apps]);

  /* -------------------------------------------------------
     CALL RECORDS
  ------------------------------------------------------- */

  const callStats = useMemo(() => {
    const total = calls.length;
    const completed = calls.filter((c) => c.status === "Completed").length;
    const followUp = calls.filter((c) => c.status === "Follow Up").length;
    const pending = calls.filter((c) => c.status !== "Completed" && c.status !== "Follow Up").length;
    return { total, completed, followUp, pending };
  }, [calls]);

  const callsByOrg = useMemo(() => {
    const byOrg = {};
    calls.forEach((c) => {
      const name = c.organization || "Unknown";
      if (!byOrg[name]) byOrg[name] = { name, total: 0, completed: 0, followUp: 0 };
      byOrg[name].total += 1;
      if (c.status === "Completed") byOrg[name].completed += 1;
      if (c.status === "Follow Up") byOrg[name].followUp += 1;
    });
    return Object.values(byOrg).sort((a, b) => b.total - a.total);
  }, [calls]);

  /* -------------------------------------------------------
     INSTITUTE / CORPORATE / CANDIDATE ANALYTICS
  ------------------------------------------------------- */

  const instituteStats = useMemo(() => {
    const total = colleges.length;
    const active = colleges.filter((c) => c.status !== "Inactive").length;
    const inactive = total - active;
    const studentsShared = apps.filter((a) => a?.candidates?.college_id).length;
    return { total, active, inactive, studentsShared };
  }, [colleges, apps]);

  const corporateStats = useMemo(() => {
    const total = companies.length;
    const verified = companies.filter((c) => c.hiring_status === "Verified" || c.hiring_status === "Active").length;
    const active = companies.filter((c) => c.hiring_status === "Active").length;
    const jobsPosted = jobs.length;
    return { total, verified, active, jobsPosted };
  }, [companies, jobs]);

  const candidateStats = useMemo(() => {
    const total = candidates.length;
    const profileCompleted = candidates.filter((c) => c.resume_url && c.degree && c.branch && c.cgpa).length;
    const applications = apps.length;
    const selected = apps.filter((a) => a.stage === "Selected").length;
    const joined = apps.filter((a) => a.stage === "Joined").length;
    return { total, profileCompleted, applications, selected, joined };
  }, [candidates, apps]);

  /* -------------------------------------------------------
     RENDER HELPERS FOR EACH REPORT
  ------------------------------------------------------- */

  function renderCampus() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Campus-wise Report</h2>
          <p>Performance overview of all registered campuses</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🏛️" label="Total Campuses" value={campusStats.totalCampuses} sub="Active colleges" color="#7C3AED" />
          <StatCard icon="📋" label="Drives Conducted" value={campusStats.totalDrives} sub="This academic year" color="#06B6D4" />
          <StatCard icon="👥" label="Students Applied" value={campusStats.totalApplications.toLocaleString()} sub="Total applications" color="#10B981" />
          <StatCard icon="🎯" label="Selections" value={campusStats.totalSelections.toLocaleString()} sub="Total selections" color="#F59E0B" />
          <StatCard icon="📈" label="Placement Rate" value={`${campusStats.placementRate}%`} sub="Selections / Applied" color="#EC4899" />
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Campus Performance Overview</h3>
            <p>Detailed performance metrics of top campuses</p>
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Campus" },
              { key: "drives", label: "Drives" },
              { key: "applications", label: "Applications" },
              { key: "selected", label: "Selections" },
              { key: "placementRate", label: "Placement Rate", render: (r) => `${r.placementRate}%` },
            ]}
            rows={campusRows.slice(0, 10)}
          />
        </div>
      </>
    );
  }

  function renderCompany() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Company-wise Report</h2>
          <p>Performance overview of all hiring companies</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🏢" label="Total Companies" value={companyStats.totalCompanies} sub="Registered corporates" color="#7C3AED" />
          <StatCard icon="💼" label="Jobs Posted" value={companyStats.totalJobs} sub="This academic year" color="#06B6D4" />
          <StatCard icon="👥" label="Applications" value={companyStats.totalApplications.toLocaleString()} sub="Total applications" color="#10B981" />
          <StatCard icon="🎯" label="Selections" value={companyStats.totalSelections.toLocaleString()} sub="Total selections" color="#F59E0B" />
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Company Performance Overview</h3>
            <p>Detailed performance metrics of top companies</p>
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Company" },
              { key: "drives", label: "Drives" },
              { key: "applications", label: "Applications" },
              { key: "selected", label: "Selections" },
              { key: "placementRate", label: "Placement Rate", render: (r) => `${r.placementRate}%` },
            ]}
            rows={companyRows.slice(0, 10)}
          />
        </div>
      </>
    );
  }

  function renderRecruiter() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Recruiter Performance</h2>
          <p>Drives handled, applications and conversion by recruiter</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🧑‍💼" label="Recruiters" value={recruiterStats.totalRecruiters} color="#7C3AED" />
          <StatCard icon="👥" label="Total Applications" value={recruiterStats.totalApplications.toLocaleString()} color="#06B6D4" />
          <StatCard icon="🎯" label="Selected" value={recruiterStats.selected.toLocaleString()} color="#10B981" />
          <StatCard icon="✅" label="Joined" value={recruiterStats.joined.toLocaleString()} color="#F59E0B" />
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Recruiter Performance Overview</h3>
            <p>Applications, selections and conversion by recruiter</p>
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Recruiter" },
              { key: "drives", label: "Drives" },
              { key: "applications", label: "Applications" },
              { key: "selected", label: "Selected" },
              { key: "joined", label: "Joined" },
              { key: "selectionRate", label: "Selection %", render: (r) => `${r.selectionRate}%` },
              { key: "conversion", label: "Conversion %", render: (r) => `${r.conversion}%` },
            ]}
            rows={recruiterRows}
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
          <p>Candidate progression from Applied to Joined</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="📥" label="Applied" value={funnelStats.applied.toLocaleString()} color="#7C3AED" />
          <StatCard icon="🗣️" label="Interview" value={funnelStats.interview.toLocaleString()} color="#06B6D4" />
          <StatCard icon="🎯" label="Selected" value={funnelStats.selected.toLocaleString()} color="#10B981" />
          <StatCard icon="✅" label="Joined" value={funnelStats.joined.toLocaleString()} color="#F59E0B" />
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Funnel Breakdown</h3>
            <p>Candidates at each stage of the hiring process</p>
          </div>
          <div style={{ width: "100%", height: 300, marginBottom: 16 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={funnelRows}
                  dataKey="count"
                  nameKey="stage"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
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
          <p>Shortlist to offer conversion</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🎯" label="Selected Candidates" value={selectedCount.toLocaleString()} color="#7C3AED" />
          <StatCard icon="📨" label="Offers Sent" value={offersSent.toLocaleString()} color="#06B6D4" />
          <StatCard icon="📈" label="Conversion" value={`${conversion}%`} sub="Offers / Selected" color="#10B981" />
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
          <p>Accepted offers vs actual joinings</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="📨" label="Offers Accepted" value={offersAccepted.toLocaleString()} color="#7C3AED" />
          <StatCard icon="✅" label="Joined" value={joinedCount.toLocaleString()} color="#06B6D4" />
          <StatCard icon="📈" label="Conversion" value={`${conversion}%`} sub="Joined / Accepted" color="#10B981" />
        </div>
      </>
    );
  }

  function renderAcceptance() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Offer Acceptance</h2>
          <p>Month-wise offer acceptance rate trend</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Acceptance Trend</h3>
            <p>Offers sent vs accepted by month</p>
          </div>
          <DataTable
            rowKey={(r) => r.month}
            columns={[
              { key: "month", label: "Month" },
              { key: "sent", label: "Offers Sent" },
              { key: "accepted", label: "Accepted" },
              { key: "rate", label: "Rate", render: (r) => `${r.rate}%` },
            ]}
            rows={acceptanceByMonth}
          />
        </div>
      </>
    );
  }

  function renderMonthly() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Monthly / Yearly Report</h2>
          <p>Drive summary by month</p>
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Monthly Summary</h3>
            <p>Applied, selected and joined by month</p>
          </div>
          <div style={{ width: "100%", height: 300, marginBottom: 16 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="applied" name="Applied" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                <Bar dataKey="selected" name="Selected" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="joined" name="Joined" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            rowKey={(r) => r.month}
            columns={[
              { key: "month", label: "Month" },
              { key: "applied", label: "Applied" },
              { key: "selected", label: "Selected" },
              { key: "joined", label: "Joined" },
            ]}
            rows={monthlyRows}
          />
        </div>
      </>
    );
  }

  function renderCalls() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Call Records Report</h2>
          <p>Completed calls and follow-ups by organization</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="📞" label="Total Calls" value={callStats.total} color="#7C3AED" />
          <StatCard icon="✅" label="Completed" value={callStats.completed} color="#10B981" />
          <StatCard icon="🔁" label="Follow Ups" value={callStats.followUp} color="#F59E0B" />
          <StatCard icon="⏳" label="Pending" value={callStats.pending} color="#EC4899" />
        </div>
        <div className="rp-panel-card">
          <div className="rp-panel-card-head">
            <h3>Calls by Organization</h3>
            <p>Breakdown of call activity per organization</p>
          </div>
          <DataTable
            rowKey={(r) => r.name}
            columns={[
              { key: "name", label: "Organization" },
              { key: "total", label: "Total Calls" },
              { key: "completed", label: "Completed" },
              { key: "followUp", label: "Follow Up" },
            ]}
            rows={callsByOrg}
          />
        </div>
      </>
    );
  }

  function renderInstituteAnalytics() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Institute Analytics</h2>
          <p>Institutes, drives and students shared vs target</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🎓" label="Total Institutes" value={`${instituteStats.total} / ${ANALYTICS_TARGETS.institutes}+`} color="#7C3AED" />
          <StatCard icon="✅" label="Active" value={instituteStats.active} color="#10B981" />
          <StatCard icon="⏸️" label="Inactive" value={instituteStats.inactive} color="#EF4444" />
          <StatCard icon="👥" label="Students Shared" value={instituteStats.studentsShared.toLocaleString()} color="#06B6D4" />
        </div>
      </>
    );
  }

  function renderCorporateAnalytics() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Corporate Analytics</h2>
          <p>Corporates, jobs posted and hiring activity vs target</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="🏭" label="Total Corporates" value={`${corporateStats.total} / ${ANALYTICS_TARGETS.corporates}+`} color="#7C3AED" />
          <StatCard icon="✅" label="Verified" value={corporateStats.verified} color="#10B981" />
          <StatCard icon="🟢" label="Active" value={corporateStats.active} color="#06B6D4" />
          <StatCard icon="💼" label="Jobs Posted" value={corporateStats.jobsPosted} color="#F59E0B" />
        </div>
      </>
    );
  }

  function renderCandidateAnalytics() {
    return (
      <>
        <div className="rp-detail-head">
          <h2>Candidate Analytics</h2>
          <p>Candidates, profiles and applications vs target</p>
        </div>
        <div className="rp-stats-row">
          <StatCard icon="👥" label="Total Candidates" value={`${candidateStats.total} / ${ANALYTICS_TARGETS.candidates.toLocaleString()}+`} color="#7C3AED" />
          <StatCard icon="📋" label="Profile Completed" value={candidateStats.profileCompleted} color="#06B6D4" />
          <StatCard icon="📥" label="Applications" value={candidateStats.applications.toLocaleString()} color="#10B981" />
          <StatCard icon="🎯" label="Selected" value={candidateStats.selected.toLocaleString()} color="#F59E0B" />
          <StatCard icon="✅" label="Joined" value={candidateStats.joined.toLocaleString()} color="#EC4899" />
        </div>
      </>
    );
  }

  const RENDERERS = {
    campus: renderCampus,
    company: renderCompany,
    recruiter: renderRecruiter,
    funnel: renderFunnel,
    selection: renderSelection,
    joining: renderJoining,
    acceptance: renderAcceptance,
    monthly: renderMonthly,
    calls: renderCalls,
    instituteAnalytics: renderInstituteAnalytics,
    corporateAnalytics: renderCorporateAnalytics,
    candidateAnalytics: renderCandidateAnalytics,
  };

  const INSIGHTS = {
    campus: campusInsights,
    company: companyInsights,
    recruiter: recruiterInsights,
  };

  /* -------------------------------------------------------
     DOWNLOAD REPORT (CSV export of the currently active report)
  ------------------------------------------------------- */

  const DOWNLOAD_DATA = {
    campus: {
      columns: [
        { key: "name", label: "Campus" },
        { key: "drives", label: "Drives" },
        { key: "applications", label: "Applications" },
        { key: "selected", label: "Selections" },
        { key: "joined", label: "Joined" },
        { key: "placementRate", label: "Placement Rate %" },
      ],
      rows: campusRows,
    },
    company: {
      columns: [
        { key: "name", label: "Company" },
        { key: "drives", label: "Drives" },
        { key: "applications", label: "Applications" },
        { key: "selected", label: "Selections" },
        { key: "joined", label: "Joined" },
        { key: "placementRate", label: "Placement Rate %" },
      ],
      rows: companyRows,
    },
    recruiter: {
      columns: [
        { key: "name", label: "Recruiter" },
        { key: "drives", label: "Drives" },
        { key: "applications", label: "Applications" },
        { key: "selected", label: "Selected" },
        { key: "joined", label: "Joined" },
        { key: "selectionRate", label: "Selection %" },
        { key: "conversion", label: "Conversion %" },
      ],
      rows: recruiterRows,
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
    acceptance: {
      columns: [
        { key: "month", label: "Month" },
        { key: "sent", label: "Offers Sent" },
        { key: "accepted", label: "Accepted" },
        { key: "rate", label: "Rate %" },
      ],
      rows: acceptanceByMonth,
    },
    monthly: {
      columns: [
        { key: "month", label: "Month" },
        { key: "applied", label: "Applied" },
        { key: "selected", label: "Selected" },
        { key: "joined", label: "Joined" },
      ],
      rows: monthlyRows,
    },
    calls: {
      columns: [
        { key: "name", label: "Organization" },
        { key: "total", label: "Total Calls" },
        { key: "completed", label: "Completed" },
        { key: "followUp", label: "Follow Up" },
      ],
      rows: callsByOrg,
    },
    instituteAnalytics: {
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Total Institutes", value: instituteStats.total },
        { metric: "Active", value: instituteStats.active },
        { metric: "Inactive", value: instituteStats.inactive },
        { metric: "Students Shared", value: instituteStats.studentsShared },
      ],
    },
    corporateAnalytics: {
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Total Corporates", value: corporateStats.total },
        { metric: "Verified", value: corporateStats.verified },
        { metric: "Active", value: corporateStats.active },
        { metric: "Jobs Posted", value: corporateStats.jobsPosted },
      ],
    },
    candidateAnalytics: {
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Total Candidates", value: candidateStats.total },
        { metric: "Profile Completed", value: candidateStats.profileCompleted },
        { metric: "Applications", value: candidateStats.applications },
        { metric: "Selected", value: candidateStats.selected },
        { metric: "Joined", value: candidateStats.joined },
      ],
    },
  };

  function handleDownloadReport() {
    const data = DOWNLOAD_DATA[active];
    if (!data) return;
    const meta = REPORT_LIST.find((r) => r.key === active);
    const filename = `${(meta?.t || active).replace(/\s+/g, "_")}.csv`;
    downloadCSV(filename, data.columns, data.rows);
  }

  /* -------------------------------------------------------
     LOADING / ERROR
  ------------------------------------------------------- */

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
  const insights = INSIGHTS[active] || [];

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <div className="page active rp-page" id="page-reports">
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

      <div className="rp-layout">
        {/* LEFT: REPORT LIST */}
        <div className="rp-sidebar">
          <div className="rp-sidebar-head">
            <div className="rp-sidebar-title">All Reports</div>
            <div className="rp-sidebar-sub">Select a report to view details</div>
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

        {/* MIDDLE: DETAIL PANEL */}
        <div className="rp-detail">
          {RENDERERS[active] ? RENDERERS[active]() : null}
        </div>

        {/* RIGHT: INSIGHTS + FILTERS */}
        <div className="rp-right">
          <div className="rp-panel-card">
            <div className="rp-panel-card-head">
              <h3>Insights</h3>
            </div>
            {insights.length > 0 ? (
              <div className="rp-insights-list">
                {insights.map((ins, i) => (
                  <div className="rp-insight" key={i}>
                    <span className="rp-insight-icon">{ins.icon}</span>
                    <div>
                      <div className="rp-insight-label">{ins.label}</div>
                      <div className="rp-insight-detail">{ins.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rp-insights-empty">
                No insights yet for this report — they'll appear once there's enough data.
              </div>
            )}
          </div>

          <div className="rp-panel-card">
            <div className="rp-panel-card-head">
              <h3>Filters</h3>
            </div>
            <div className="rp-filter-field">
              <label>Academic Year</label>
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                <option value="2026-27">2026-27</option>
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
                <option value="2022-23">2022-23</option>
              </select>
            </div>
            <div className="rp-filter-field">
              <label>Drive Status</label>
              <select value={driveStatus} onChange={(e) => setDriveStatus(e.target.value)}>
                <option value="all">All Drives</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <button className="btn-primary rp-apply-filters">🔻 Apply Filters</button>
          </div>
        </div>
      </div>
    </div>
  );
}