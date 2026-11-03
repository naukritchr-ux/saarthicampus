import { useState, useEffect, useRef, useMemo } from "react";
import {
  RotateCw,
  Info,
  Briefcase,
  Users,
  Calendar,
  Award,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  ExternalLink,
  X,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { getCorporateKpis } from "../lib/api";
import "./CorporateDashboard.css";

/* =========================================================
   GREETING HELPER (Asia/Kolkata timezone)
========================================================= */
function getGreeting() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(formatter.format(new Date()), 10);
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

/* =========================================================
   INITIALS HELPER
========================================================= */
function getInitials(name = "") {
  if (!name) return "CO";
  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* =========================================================
   SEARCHABLE CUSTOM DROPDOWN (Admin dashboard style)
========================================================= */
function DropdownFilter({
  label,
  value,
  onChange,
  defaultLabel,
  options = [],
  searchable = false,
  getItemLabel = (item) => (typeof item === "object" ? item?.title || item?.label || item?.id : item),
  getItemValue = (item) => (typeof item === "object" ? item?.id || item?.value : item),
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((opt) => {
      const lbl = getItemLabel(opt);
      return String(lbl).toLowerCase().includes(q);
    });
  }, [options, search, searchable, getItemLabel]);

  // Display text for the active value
  const displayValue = useMemo(() => {
    if (!value || value === "All" || value === "All time" || value === defaultLabel) {
      return defaultLabel;
    }
    const found = options.find((opt) => getItemValue(opt) === value);
    if (found) return getItemLabel(found);
    return value;
  }, [value, defaultLabel, options, getItemValue, getItemLabel]);

  const isActive = value && value !== "All" && value !== "All time" && value !== defaultLabel;

  return (
    <div className="corporate-dropdown-container" ref={containerRef}>
      <label className="corporate-filter-label">{label}</label>
      <button
        type="button"
        className={`corporate-filter-btn ${isActive ? "active-filter" : ""}`}
        onClick={() => {
          setOpen((prev) => !prev);
          setSearch("");
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="corporate-filter-val-text" title={displayValue}>
          {displayValue}
        </span>
        <span className="corporate-caret">▾</span>
      </button>

      {open && (
        <div className="corporate-dropdown-popover" role="listbox">
          {searchable && (
            <div className="corporate-popover-search-wrap">
              <Search size={13} className="corporate-popover-search-icon" />
              <input
                type="text"
                className="corporate-popover-search-input"
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="corporate-popover-scroll-list">
            <button
              type="button"
              className={`corporate-popover-option ${!isActive ? "selected" : ""}`}
              onClick={() => {
                onChange("All");
                setOpen(false);
              }}
            >
              {defaultLabel}
            </button>

            {filteredOptions.map((opt) => {
              const optVal = getItemValue(opt);
              const optLabel = getItemLabel(opt);
              const isSel = optVal === value;

              return (
                <button
                  type="button"
                  key={String(optVal)}
                  className={`corporate-popover-option ${isSel ? "selected" : ""}`}
                  onClick={() => {
                    onChange(optVal);
                    setOpen(false);
                  }}
                  title={optLabel}
                >
                  {optLabel}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="corporate-popover-empty">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN CORPORATE DASHBOARD COMPONENT
========================================================= */
export default function CorporateDashboard({ setActivePage, user }) {
  // Loading & Refreshing States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState({
    company: { name: "", logo_url: null },
    kpis: {
      openJobPostings: 0,
      applicationsReceived: 0,
      interviewsScheduled: 0,
      offersPending: 0,
      joined: 0,
      talentPoolSize: 0,
    },
    attention: {
      applicationsAwaitingReview: 0,
      interviewsNeedingFeedback: 0,
      offersAwaitingResponse: 0,
      joiningsToConfirm: 0,
      attentionTotal: 0,
    },
    pipeline: [],
    applicationsByJob: [],
    zeroApplicationsCount: 0,
    recommendedCandidates: [],
    availableJobProfiles: [],
    availableStages: [],
  });

  // Filter States
  const [jobFilter, setJobFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState("All time");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Candidate detail modal
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // Stale request tracking
  const activeRequestIdRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Fetch Dashboard Data
  async function loadDashboardData(isRefresh = false) {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const requestId = ++activeRequestIdRef.current;
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError("");
    } else {
      setLoading(true);
      setError("");
    }

    try {
      const filters = {
        job_id: jobFilter !== "All" ? jobFilter : undefined,
        stage: stageFilter !== "All" ? stageFilter : undefined,
        date_range: dateRangeFilter !== "All time" ? dateRangeFilter : undefined,
        start_date: dateRangeFilter === "Custom range" && customStart ? customStart : undefined,
        end_date: dateRangeFilter === "Custom range" && customEnd ? customEnd : undefined,
      };

      const res = await getCorporateKpis(filters);

      if (activeRequestIdRef.current === requestId) {
        setDashboardData((prev) => ({
          ...prev,
          ...res,
          company: res.company || prev.company,
          kpis: res.kpis || prev.kpis,
          attention: res.attention || prev.attention,
          pipeline: res.pipeline || [],
          applicationsByJob: res.applicationsByJob || [],
          zeroApplicationsCount: res.zeroApplicationsCount ?? 0,
          recommendedCandidates: res.recommendedCandidates || [],
          availableJobProfiles: res.availableJobProfiles || prev.availableJobProfiles || [],
          availableStages: res.availableStages || prev.availableStages || [],
        }));
        setError("");
        setRefreshError("");
      }
    } catch (err) {
      if (activeRequestIdRef.current === requestId) {
        if (isRefresh) {
          setRefreshError("Could not refresh data. Retaining existing values.");
        } else {
          setError(err.message || "Failed to load corporate dashboard data.");
        }
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setRefreshing(false);
        setLoading(false);
        isFetchingRef.current = false;
      }
    }
  }

  // Load on filter change
  useEffect(() => {
    loadDashboardData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobFilter, stageFilter, dateRangeFilter, customStart, customEnd]);

  // Reset Filters
  function handleResetFilters() {
    setJobFilter("All");
    setStageFilter("All");
    setDateRangeFilter("All time");
    setCustomStart("");
    setCustomEnd("");
  }

  // Computed greeting and company info
  const greeting = getGreeting();
  const companyName = dashboardData.company?.name || user?.user_metadata?.company_name || "Company";
  const companyLogo = dashboardData.company?.logo_url || null;

  // Active filter chips
  const activeChips = [];
  if (jobFilter !== "All") {
    const jobObj = dashboardData.availableJobProfiles.find((j) => j.id === jobFilter);
    activeChips.push({
      key: "job",
      label: `Posting: ${jobObj?.title || jobFilter}`,
      clear: () => setJobFilter("All"),
    });
  }
  if (stageFilter !== "All") {
    activeChips.push({
      key: "stage",
      label: `Stage: ${stageFilter}`,
      clear: () => setStageFilter("All"),
    });
  }
  if (dateRangeFilter !== "All time") {
    const dateLabel =
      dateRangeFilter === "Custom range" && (customStart || customEnd)
        ? `Custom: ${customStart || "..."} to ${customEnd || "..."}`
        : dateRangeFilter;
    activeChips.push({
      key: "date",
      label: `Range: ${dateLabel}`,
      clear: () => {
        setDateRangeFilter("All time");
        setCustomStart("");
        setCustomEnd("");
      },
    });
  }

  // Attention total
  const attention = dashboardData.attention || {};
  const hasAttentionItems = (attention.attentionTotal || 0) > 0;

  // Safe navigation helper
  const navigate = (page) => {
    if (typeof setActivePage === "function") {
      setActivePage(page);
    }
  };

  // Initial Full Loading State
  if (loading && !dashboardData.company?.name && !refreshing) {
    return (
      <div className="corporate-dashboard-root">
        <div className="corporate-loading-state">
          <RotateCw className="corporate-refresh-icon spinning" size={28} />
          <p>Loading corporate dashboard...</p>
        </div>
      </div>
    );
  }

  // Fatal Error State
  if (error && !dashboardData.company?.name) {
    return (
      <div className="corporate-dashboard-root">
        <div className="corporate-error-state">
          <AlertCircle size={32} color="#dc2626" />
          <h2>Unable to Load Dashboard</h2>
          <p>{error}</p>
          <button
            type="button"
            className="corporate-btn-primary"
            onClick={() => loadDashboardData(false)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="corporate-dashboard-root">
      {/* =========================================================
          1. GREETING & HEADER
      ========================================================= */}
      <header className="corporate-header-bar">
        <div className="corporate-header-left">
          <div className="corporate-avatar-box" title={companyName}>
            {companyLogo ? (
              <img src={companyLogo} alt={companyName} className="corporate-avatar-img" />
            ) : (
              <span className="corporate-avatar-initials">{getInitials(companyName)}</span>
            )}
          </div>
          <div className="corporate-title-block">
            <span className="corporate-workspace-chip">{companyName}</span>
            <h1 className="corporate-greeting-title">
              {greeting}, {companyName}
            </h1>
          </div>
        </div>

        <div className="corporate-header-right">
          {refreshError && (
            <span className="corporate-refresh-toast" role="alert">
              {refreshError}
            </span>
          )}
          <button
            type="button"
            className="corporate-refresh-btn"
            disabled={refreshing || loading}
            onClick={() => loadDashboardData(true)}
            aria-label="Refresh dashboard"
          >
            <RotateCw
              className={`corporate-refresh-icon ${refreshing ? "spinning" : ""}`}
              size={14}
            />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* =========================================================
          2. GLOBAL FILTERS & REMOVABLE CHIPS
      ========================================================= */}
      <section className="corporate-filters-section">
        <div className="corporate-filters-row">
          {/* Job Posting Filter */}
          <DropdownFilter
            label="Job posting"
            value={jobFilter}
            onChange={setJobFilter}
            defaultLabel="All postings"
            options={dashboardData.availableJobProfiles}
            getItemLabel={(opt) => opt?.title || opt}
            getItemValue={(opt) => opt?.id || opt}
            searchable
          />

          {/* Application Stage Filter */}
          <DropdownFilter
            label="Application stage"
            value={stageFilter}
            onChange={setStageFilter}
            defaultLabel="All stages"
            options={
              dashboardData.availableStages.length > 0
                ? dashboardData.availableStages
                : ["Resume Review", "Aptitude", "GD", "Interview", "Selected", "Joined"]
            }
            searchable
          />

          {/* Date Range Filter */}
          <DropdownFilter
            label="Date range"
            value={dateRangeFilter}
            onChange={setDateRangeFilter}
            defaultLabel="All time"
            options={[
              "Today",
              "This week",
              "This month",
              "Last 3 months",
              "This year",
              "Custom range",
            ]}
          />

          {/* Reset Filters Button */}
          <div className="corporate-filter-action-box">
            <button
              type="button"
              className="corporate-reset-btn"
              onClick={handleResetFilters}
            >
              Reset filters
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateRangeFilter === "Custom range" && (
          <div className="corporate-custom-date-row">
            <div className="corporate-date-field">
              <label>Start date (IST)</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="corporate-date-field">
              <label>End date (IST)</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Removable Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="corporate-chips-bar">
            <span className="corporate-chips-label">Active filters:</span>
            {activeChips.map((chip) => (
              <span key={chip.key} className="corporate-filter-chip">
                <span>{chip.label}</span>
                <button
                  type="button"
                  className="corporate-chip-remove-btn"
                  onClick={chip.clear}
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================
          3. NEEDS YOUR ATTENTION (Rendered ONLY when count > 0)
      ========================================================= */}
      {hasAttentionItems && (
        <section className="corporate-attention-section" aria-label="Action items needing your attention">
          <div className="corporate-attention-header">
            <div className="corporate-attention-title-wrap">
              <AlertCircle size={18} className="corporate-attention-icon" />
              <h3>Needs your attention</h3>
            </div>
            <span className="corporate-attention-total-badge">
              {attention.attentionTotal} pending
            </span>
          </div>

          <div className="corporate-attention-cards-grid">
            {/* Applications awaiting review */}
            {(attention.applicationsAwaitingReview || 0) > 0 && (
              <div
                className="corporate-attention-card clickable"
                onClick={() => {
                  setStageFilter("Resume Review");
                  navigate("resume");
                }}
                role="button"
                tabIndex={0}
              >
                <div className="corporate-attention-count-bubble">
                  {attention.applicationsAwaitingReview}
                </div>
                <div className="corporate-attention-card-text">
                  <strong>Applications awaiting review</strong>
                  <p>Screen resumes and shortlist candidates</p>
                </div>
                <ArrowRight size={15} className="corporate-card-arrow" />
              </div>
            )}

            {/* Interviews needing feedback */}
            {(attention.interviewsNeedingFeedback || 0) > 0 && (
              <div
                className="corporate-attention-card clickable"
                onClick={() => navigate("interview")}
                role="button"
                tabIndex={0}
              >
                <div className="corporate-attention-count-bubble">
                  {attention.interviewsNeedingFeedback}
                </div>
                <div className="corporate-attention-card-text">
                  <strong>Interviews needing feedback</strong>
                  <p>Submit round scores and recommendations</p>
                </div>
                <ArrowRight size={15} className="corporate-card-arrow" />
              </div>
            )}

            {/* Offers awaiting response */}
            {(attention.offersAwaitingResponse || 0) > 0 && (
              <div
                className="corporate-attention-card clickable"
                onClick={() => navigate("offers")}
                role="button"
                tabIndex={0}
              >
                <div className="corporate-attention-count-bubble">
                  {attention.offersAwaitingResponse}
                </div>
                <div className="corporate-attention-card-text">
                  <strong>Offers awaiting candidate response</strong>
                  <p>Track sent offers and follow up with applicants</p>
                </div>
                <ArrowRight size={15} className="corporate-card-arrow" />
              </div>
            )}

            {/* Joinings to confirm */}
            {(attention.joiningsToConfirm || 0) > 0 && (
              <div
                className="corporate-attention-card clickable"
                onClick={() => navigate("joining")}
                role="button"
                tabIndex={0}
              >
                <div className="corporate-attention-count-bubble">
                  {attention.joiningsToConfirm}
                </div>
                <div className="corporate-attention-card-text">
                  <strong>Joinings to confirm</strong>
                  <p>Verify candidate onboarding status</p>
                </div>
                <ArrowRight size={15} className="corporate-card-arrow" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================
          4. FIVE KPI CARDS + TALENT POOL NOTE
      ========================================================= */}
      <section className="corporate-kpis-section">
        <div className="corporate-kpis-grid">
          {/* KPI 1: Open Job Postings */}
          <div
            className="corporate-kpi-card clickable"
            onClick={() => navigate("jobs")}
            role="button"
            tabIndex={0}
          >
            <div className="corporate-kpi-top">
              <span className="corporate-kpi-label">Open job postings</span>
              <div className="corporate-kpi-icon-box">
                <Briefcase size={16} />
              </div>
            </div>
            <div className="corporate-kpi-value">{dashboardData.kpis?.openJobPostings ?? 0}</div>
            <div className="corporate-kpi-subtitle">Active roles accepting applications</div>
          </div>

          {/* KPI 2: Applications Received */}
          <div
            className="corporate-kpi-card clickable"
            onClick={() => navigate("pipeline")}
            role="button"
            tabIndex={0}
          >
            <div className="corporate-kpi-top">
              <span className="corporate-kpi-label">Applications received</span>
              <div className="corporate-kpi-icon-box">
                <Users size={16} />
              </div>
            </div>
            <div className="corporate-kpi-value">
              {dashboardData.kpis?.applicationsReceived ?? 0}
            </div>
            <div className="corporate-kpi-subtitle">Distinct applications to your roles</div>
          </div>

          {/* KPI 3: Interviews Scheduled */}
          <div
            className="corporate-kpi-card clickable"
            onClick={() => navigate("interview")}
            role="button"
            tabIndex={0}
          >
            <div className="corporate-kpi-top">
              <span className="corporate-kpi-label">Interviews scheduled</span>
              <div className="corporate-kpi-icon-box">
                <Calendar size={16} />
              </div>
            </div>
            <div className="corporate-kpi-value">
              {dashboardData.kpis?.interviewsScheduled ?? 0}
            </div>
            <div className="corporate-kpi-subtitle">Upcoming scheduled interviews</div>
          </div>

          {/* KPI 4: Offers Pending */}
          <div
            className="corporate-kpi-card clickable"
            onClick={() => navigate("offers")}
            role="button"
            tabIndex={0}
          >
            <div className="corporate-kpi-top">
              <span className="corporate-kpi-label">Offers pending</span>
              <div className="corporate-kpi-icon-box">
                <Award size={16} />
              </div>
            </div>
            <div className="corporate-kpi-value">{dashboardData.kpis?.offersPending ?? 0}</div>
            <div className="corporate-kpi-subtitle">Offers sent awaiting candidate response</div>
          </div>

          {/* KPI 5: Joined */}
          <div
            className="corporate-kpi-card clickable"
            onClick={() => navigate("joining")}
            role="button"
            tabIndex={0}
          >
            <div className="corporate-kpi-top">
              <span className="corporate-kpi-label">Joined</span>
              <div className="corporate-kpi-icon-box">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="corporate-kpi-value">{dashboardData.kpis?.joined ?? 0}</div>
            <div className="corporate-kpi-subtitle">Verified joining records</div>
          </div>
        </div>

        {/* Talent pool size as a small line with link to Candidate Search */}
        <div className="corporate-talent-pool-line">
          <span>
            Campus talent pool:{" "}
            <strong>{(dashboardData.kpis?.talentPoolSize ?? 0).toLocaleString()}</strong>{" "}
            verified candidates available across partner institutions.
          </span>
          <button
            type="button"
            className="corporate-inline-link-btn"
            onClick={() => navigate("candidateSearch")}
          >
            Candidate Search <ExternalLink size={12} />
          </button>
        </div>
      </section>

      {/* =========================================================
          5. HIRING PIPELINE + APPLICATIONS BY JOB POSTING
      ========================================================= */}
      <section className="corporate-analytics-grid">
        {/* HIRING PIPELINE */}
        <div className="corporate-analytics-card">
          <div className="corporate-analytics-header">
            <div>
              <h3 className="corporate-analytics-title">Hiring pipeline</h3>
              <p className="corporate-analytics-subtitle">Candidate progression across stages</p>
            </div>
            <div className="corporate-tooltip-wrap" title="Conversion rates between consecutive stages are displayed only when the prior stage cohort has at least 10 applicants to ensure statistical validity.">
              <Info size={15} className="corporate-info-icon" />
            </div>
          </div>

          <div className="corporate-chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={dashboardData.pipeline}
                margin={{ top: 12, right: 16, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf5" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#8C91A0"
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#8C91A0"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => Math.round(v)}
                />
                <Tooltip
                  formatter={(value, name) => [value, "Candidates"]}
                  labelFormatter={(label) => `Stage: ${label}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #E2E4E9",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                />
                <Bar
                  dataKey="count"
                  name="Candidates"
                  fill="#6D3AE8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pipeline Conversion Indicators */}
          <div className="corporate-pipeline-stages-flow">
            {dashboardData.pipeline.map((p, idx) => (
              <div key={p.stage} className="corporate-pipeline-stage-pill">
                <span className="corporate-pipeline-stage-name">{p.label}</span>
                <span className="corporate-pipeline-stage-count">{p.count}</span>
                {idx > 0 && p.conversion !== null && (
                  <span className="corporate-pipeline-conversion" title={`Conversion from ${dashboardData.pipeline[idx - 1].label}`}>
                    {p.conversion}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* APPLICATIONS BY JOB POSTING */}
        <div className="corporate-analytics-card">
          <div className="corporate-analytics-header">
            <div>
              <h3 className="corporate-analytics-title">Applications by job posting</h3>
              <p className="corporate-analytics-subtitle">Volume of applications per active role</p>
            </div>
          </div>

          <div className="corporate-chart-wrapper">
            {dashboardData.applicationsByJob.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={dashboardData.applicationsByJob}
                  layout="vertical"
                  margin={{ top: 12, right: 24, left: 24, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0edf5" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="#8C91A0"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => Math.round(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="title"
                    stroke="#8C91A0"
                    tick={{ fontSize: 11 }}
                    width={130}
                  />
                  <Tooltip
                    formatter={(value) => [value, "Applications"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E2E4E9",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                  />
                  <Bar
                    dataKey="applications"
                    name="Applications"
                    fill="#079B6D"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="corporate-empty-chart">
                <p>No applications received yet for your active postings.</p>
                <button
                  type="button"
                  className="corporate-inline-link-btn"
                  onClick={() => navigate("jobs")}
                >
                  Manage job postings →
                </button>
              </div>
            )}
          </div>

          {/* Note about other postings with 0 applications */}
          {dashboardData.zeroApplicationsCount > 0 && (
            <div className="corporate-zero-jobs-note">
              <span>
                {dashboardData.zeroApplicationsCount}{" "}
                {dashboardData.zeroApplicationsCount === 1
                  ? "other posting has"
                  : "other postings have"}{" "}
                no applications yet.
              </span>
              <button
                type="button"
                className="corporate-inline-link-btn"
                onClick={() => navigate("jobs")}
              >
                Share postings →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          6. RECOMMENDED CANDIDATES (Max 5 rows)
      ========================================================= */}
      <section className="corporate-candidates-section">
        <div className="corporate-section-header">
          <div>
            <h3 className="corporate-section-title">Recommended candidates</h3>
            <p className="corporate-section-subtitle">
              Candidates who recently applied to your company roles
            </p>
          </div>
          <button
            type="button"
            className="corporate-details-link-btn"
            onClick={() => navigate("candidateSearch")}
          >
            View all candidates <ArrowRight size={14} />
          </button>
        </div>

        <div className="corporate-table-wrapper">
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job profile</th>
                <th>Experience</th>
                <th>Location</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recommendedCandidates.length > 0 ? (
                dashboardData.recommendedCandidates.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="corporate-candidate-cell">
                        <div className="corporate-cand-avatar">
                          {c.name ? c.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div className="corporate-cand-info">
                          <strong>{c.name}</strong>
                          {c.email && <span className="corporate-cand-email">{c.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{c.role || <span className="corporate-missing-val">Not added</span>}</td>
                    <td>
                      {c.experience ? (
                        <span>{c.experience}</span>
                      ) : (
                        <span className="corporate-missing-val">Not added</span>
                      )}
                    </td>
                    <td>
                      {c.location ? (
                        <span>{c.location}</span>
                      ) : (
                        <span className="corporate-missing-val">Not added</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="corporate-view-btn"
                        onClick={() => setSelectedCandidate(c)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="corporate-table-empty">
                    No candidates match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================================================
          CANDIDATE DETAIL PREVIEW MODAL
      ========================================================= */}
      {selectedCandidate && (
        <div
          className="corporate-modal-backdrop"
          onClick={() => setSelectedCandidate(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="corporate-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="corporate-modal-head">
              <div className="corporate-modal-cand-head">
                <div className="corporate-modal-avatar">
                  {selectedCandidate.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <h3 className="corporate-modal-name">{selectedCandidate.name}</h3>
                  <p className="corporate-modal-role">{selectedCandidate.role}</p>
                </div>
              </div>
              <button
                type="button"
                className="corporate-modal-close-btn"
                onClick={() => setSelectedCandidate(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="corporate-modal-body">
              <div className="corporate-modal-grid">
                <div className="corporate-modal-field">
                  <span className="corporate-field-label">Current stage</span>
                  <strong className="corporate-field-value">{selectedCandidate.stage}</strong>
                </div>

                <div className="corporate-modal-field">
                  <span className="corporate-field-label">Experience</span>
                  <strong className="corporate-field-value">
                    {selectedCandidate.experience || (
                      <span className="corporate-missing-val">Not added</span>
                    )}
                  </strong>
                </div>

                <div className="corporate-modal-field">
                  <span className="corporate-field-label">Location</span>
                  <strong className="corporate-field-value">
                    {selectedCandidate.location || (
                      <span className="corporate-missing-val">Not added</span>
                    )}
                  </strong>
                </div>

                <div className="corporate-modal-field">
                  <span className="corporate-field-label">Email</span>
                  <strong className="corporate-field-value">
                    {selectedCandidate.email || (
                      <span className="corporate-missing-val">Not added</span>
                    )}
                  </strong>
                </div>

                <div className="corporate-modal-field">
                  <span className="corporate-field-label">Phone</span>
                  <strong className="corporate-field-value">
                    {selectedCandidate.phone || (
                      <span className="corporate-missing-val">Not added</span>
                    )}
                  </strong>
                </div>

                <div className="corporate-modal-field">
                  <span className="corporate-field-label">Application date</span>
                  <strong className="corporate-field-value">
                    {selectedCandidate.created_at
                      ? new Date(selectedCandidate.created_at).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </strong>
                </div>
              </div>

              {selectedCandidate.resume_url && (
                <div className="corporate-modal-resume-wrap">
                  <a
                    href={selectedCandidate.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="corporate-resume-link"
                  >
                    View submitted resume <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>

            <div className="corporate-modal-foot">
              <button
                type="button"
                className="corporate-modal-close-action"
                onClick={() => setSelectedCandidate(null)}
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
