import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./AdminDashboard.css";

const STATUS_OPTIONS = [
  "Joined",
  "Selected",
  "Interview",
  "Shortlisted",
];

function AdminDashboard() {
  const [profileFilter, setProfileFilter] =
    useState("All Profiles");

  const [collegeFilter, setCollegeFilter] =
    useState("All Colleges");

  const [companyFilter, setCompanyFilter] =
    useState("All Corporates");

  const [statusFilter, setStatusFilter] =
    useState("All Status");

  const [view, setView] = useState("college");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [candidates, setCandidates] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function fetchDashboardData() {
      setLoading(true);
      setError("");

      try {
        const [
          { data: candidatesData, error: candidatesError },
          { data: requirementsData, error: requirementsError },
          { data: monthlyDataPoints, error: monthlyError },
        ] = await Promise.all([
          supabase
            .from("candidates")
            .select("*")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("requirements")
            .select("*")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("monthly_recruitment")
            .select("*")
            .order("month_order", {
              ascending: true,
            }),
        ]);

        if (candidatesError) {
          throw candidatesError;
        }

        if (requirementsError) {
          throw requirementsError;
        }

        if (monthlyError) {
          throw monthlyError;
        }

        if (!ignore) {
          setCandidates(candidatesData || []);
          setRequirements(requirementsData || []);
          setMonthlyData(monthlyDataPoints || []);
        }
      } catch (fetchError) {
        console.error(
          "Admin dashboard fetch error:",
          fetchError,
        );

        if (!ignore) {
          setError(
            fetchError?.message ||
              "Could not load dashboard data.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchDashboardData();

    return () => {
      ignore = true;
    };
  }, []);

  const profiles = useMemo(() => {
    return [
      ...new Set(
        candidates
          .map((candidate) => candidate.profile)
          .filter(Boolean),
      ),
    ].sort();
  }, [candidates]);

  const colleges = useMemo(() => {
    return [
      ...new Set(
        candidates
          .map((candidate) => candidate.college)
          .filter(Boolean),
      ),
    ].sort();
  }, [candidates]);

  const companies = useMemo(() => {
    return [
      ...new Set(
        requirements
          .map((requirement) => requirement.company)
          .filter(Boolean),
      ),
    ].sort();
  }, [requirements]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const matchesProfile =
        profileFilter === "All Profiles" ||
        candidate.profile === profileFilter;

      const matchesCollege =
        collegeFilter === "All Colleges" ||
        candidate.college === collegeFilter;

      const matchesStatus =
        statusFilter === "All Status" ||
        candidate.status === statusFilter;

      return (
        matchesProfile &&
        matchesCollege &&
        matchesStatus
      );
    });
  }, [
    candidates,
    profileFilter,
    collegeFilter,
    statusFilter,
  ]);

  const filteredRequirements = useMemo(() => {
    return requirements.filter((requirement) => {
      const matchesProfile =
        profileFilter === "All Profiles" ||
        requirement.profile === profileFilter;

      const matchesCompany =
        companyFilter === "All Corporates" ||
        requirement.company === companyFilter;

      return matchesProfile && matchesCompany;
    });
  }, [
    requirements,
    profileFilter,
    companyFilter,
  ]);

  const totalCandidates = filteredCandidates.length;

  const selectedCandidates = filteredCandidates.filter(
    (candidate) => candidate.status === "Selected",
  ).length;

  const joinedCandidates = filteredCandidates.filter(
    (candidate) => candidate.status === "Joined",
  ).length;

  const shortlistedCandidates = filteredCandidates.filter(
    (candidate) => candidate.status === "Shortlisted",
  ).length;

  const interviewCandidates = filteredCandidates.filter(
    (candidate) => candidate.status === "Interview",
  ).length;

  const activeRequirements = filteredRequirements.filter(
    (requirement) => requirement.status === "Active",
  ).length;

  const fulfilledRequirements = filteredRequirements.filter(
    (requirement) => requirement.status === "Fulfilled",
  ).length;

  const pendingRequirements = filteredRequirements.filter(
    (requirement) => requirement.status === "Pending",
  ).length;

  const totalShared = filteredRequirements.reduce(
    (sum, requirement) =>
      sum + Number(requirement.candidates_shared || 0),
    0,
  );

  const totalCorporateSelected = filteredRequirements.reduce(
    (sum, requirement) =>
      sum + Number(requirement.selected || 0),
    0,
  );

  const maxMonthlyValue = monthlyData.length
    ? Math.max(
        1,
        ...monthlyData.map(
          (item) =>
            Number(item.college || 0) +
            Number(item.shared || 0),
        ),
      )
    : 1;

  function resetFilters() {
    setProfileFilter("All Profiles");
    setCollegeFilter("All Colleges");
    setCompanyFilter("All Corporates");
    setStatusFilter("All Status");
  }

  function getPipelineWidth(value) {
    if (totalCandidates === 0) {
      return "0%";
    }

    return `${Math.min(
      100,
      Math.max(
        value > 0 ? 15 : 0,
        (value / totalCandidates) * 100,
      ),
    )}%`;
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-state-card">
          <div className="state-spinner" />
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-state-card admin-error-state">
          <div className="state-icon">!</div>
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="header">
        <div>
          <p className="admin-kicker">
            SAARTHI ADMINISTRATION
          </p>

          <h1>Saarthi Admin Dashboard</h1>

          <p>
            Complete recruitment and corporate overview.
          </p>
        </div>

        <div className="admin-info">
          <div className="live">
            <span />
            Live
          </div>

          <div className="admin-user">
            <div className="avatar">A</div>

            <div>
              <strong>Admin</strong>
              <small>Administrator</small>
            </div>
          </div>
        </div>
      </header>

      <section className="filters">
        <Filter
          label="Job Profile"
          value={profileFilter}
          onChange={setProfileFilter}
          defaultLabel="All Profiles"
          options={profiles}
        />

        <Filter
          label="College"
          value={collegeFilter}
          onChange={setCollegeFilter}
          defaultLabel="All Colleges"
          options={colleges}
        />

        <Filter
          label="Corporate"
          value={companyFilter}
          onChange={setCompanyFilter}
          defaultLabel="All Corporates"
          options={companies}
        />

        <Filter
          label="Candidate Status"
          value={statusFilter}
          onChange={setStatusFilter}
          defaultLabel="All Status"
          options={STATUS_OPTIONS}
        />

        <button
          className="reset"
          type="button"
          onClick={resetFilters}
        >
          Reset
        </button>
      </section>

      <section className="kpi-grid">
        <KpiCard
          icon="👥"
          label="Total Candidates"
          value={totalCandidates}
          helper="Current filtered view"
        />

        <KpiCard
          icon="🏢"
          label="Corporate Requirements"
          value={filteredRequirements.length}
          helper={`${activeRequirements} active`}
        />

        <KpiCard
          icon="📤"
          label="Candidates Shared"
          value={totalShared}
          helper="With corporate clients"
        />

        <KpiCard
          icon="🎯"
          label="Selected"
          value={
            selectedCandidates + totalCorporateSelected
          }
          helper={`${selectedCandidates} candidate status selected`}
        />

        <KpiCard
          icon="✓"
          label="Joined"
          value={joinedCandidates}
          helper="Final joining status"
        />
      </section>

      <main className="dashboard-grid">
        <section className="card monthly-card">
          <CardHeading
            title="Monthly Recruitment Activity"
            subtitle="College candidates and candidates shared with corporates"
          />

          <div className="legend">
            <span>
              <i className="legend-college" />
              College
            </span>

            <span>
              <i className="legend-shared" />
              Corporate Shared
            </span>
          </div>

          {monthlyData.length === 0 ? (
            <EmptyState message="No monthly recruitment data available." />
          ) : (
            <div className="bar-chart">
              {monthlyData.map((item) => {
                const collegeValue = Number(
                  item.college || 0,
                );

                const sharedValue = Number(
                  item.shared || 0,
                );

                const collegeHeight =
                  (collegeValue / maxMonthlyValue) * 100;

                const sharedHeight =
                  (sharedValue / maxMonthlyValue) * 100;

                return (
                  <div
                    className="bar-column"
                    key={item.id || item.month}
                  >
                    <div className="bars">
                      <div
                        className="bar college-bar"
                        style={{
                          height: `${collegeHeight}%`,
                        }}
                        title={`College: ${collegeValue}`}
                      />

                      <div
                        className="bar shared-bar"
                        style={{
                          height: `${sharedHeight}%`,
                        }}
                        title={`Shared: ${sharedValue}`}
                      />
                    </div>

                    <span>{item.month}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <CardHeading
            title="Recruitment Pipeline"
            subtitle="Current candidate journey"
          />

          <PipelineRow
            label="Sourced"
            value={totalCandidates}
            width={getPipelineWidth(totalCandidates)}
            tone="first"
          />

          <PipelineRow
            label="Shortlisted"
            value={shortlistedCandidates}
            width={getPipelineWidth(shortlistedCandidates)}
            tone="second"
          />

          <PipelineRow
            label="Interview"
            value={interviewCandidates}
            width={getPipelineWidth(interviewCandidates)}
            tone="third"
          />

          <PipelineRow
            label="Selected"
            value={selectedCandidates}
            width={getPipelineWidth(selectedCandidates)}
            tone="fourth"
          />

          <PipelineRow
            label="Joined"
            value={joinedCandidates}
            width={getPipelineWidth(joinedCandidates)}
            tone="fifth"
          />
        </section>

        <section className="card corporate-card">
          <CardHeading
            title="Corporate Candidate Supply"
            subtitle="Requirements and suitable candidate movement"
            action={
              <span className="count-badge">
                {filteredRequirements.length} Requirements
              </span>
            }
          />

          <div className="corporate-stats">
            <MiniStat
              label="Active"
              value={activeRequirements}
            />

            <MiniStat
              label="Fulfilled"
              value={fulfilledRequirements}
            />

            <MiniStat
              label="Pending"
              value={pendingRequirements}
            />

            <MiniStat
              label="Selected"
              value={totalCorporateSelected}
            />
          </div>

          <div className="mini-table">
            <div className="mini-row heading">
              <span>Corporate</span>
              <span>Profile</span>
              <span>Status</span>
              <span>Selected</span>
            </div>

            {filteredRequirements.length === 0 ? (
              <EmptyTableRow message="No requirements found." />
            ) : (
              filteredRequirements.map((item) => (
                <div className="mini-row" key={item.id}>
                  <span>{item.company || "—"}</span>
                  <span>{item.profile || "—"}</span>

                  <span>
                    <em
                      className={`status ${String(
                        item.status || "",
                      ).toLowerCase()}`}
                    >
                      {item.status || "Unknown"}
                    </em>
                  </span>

                  <strong>{item.selected || 0}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <CardHeading
            title="Job Profile Analysis"
            subtitle="Candidate distribution by specialization"
          />

          {profiles.length === 0 ? (
            <EmptyState message="No job profiles available." />
          ) : (
            <div className="profile-list">
              {profiles.map((profile) => {
                const count = filteredCandidates.filter(
                  (candidate) =>
                    candidate.profile === profile,
                ).length;

                const percentage =
                  (count /
                    Math.max(filteredCandidates.length, 1)) *
                  100;

                return (
                  <div
                    className="profile-item"
                    key={profile}
                  >
                    <div className="profile-top">
                      <span>{profile}</span>
                      <strong>{count}</strong>
                    </div>

                    <div className="profile-progress">
                      <div
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card full-width">
          <CardHeading
            title="Performance Analysis"
            subtitle="Switch between different management views"
          />

          <div className="tabs">
            <button
              type="button"
              className={view === "college" ? "active" : ""}
              onClick={() => setView("college")}
            >
              College
            </button>

            <button
              type="button"
              className={
                view === "corporate" ? "active" : ""
              }
              onClick={() => setView("corporate")}
            >
              Corporate
            </button>

            <button
              type="button"
              className={view === "profile" ? "active" : ""}
              onClick={() => setView("profile")}
            >
              Job Profile
            </button>
          </div>

          {view === "college" && (
            <CollegeAnalysis
              colleges={colleges}
              candidates={filteredCandidates}
            />
          )}

          {view === "corporate" && (
            <CorporateAnalysis
              requirements={filteredRequirements}
            />
          )}

          {view === "profile" && (
            <ProfileAnalysis
              profiles={profiles}
              candidates={filteredCandidates}
            />
          )}
        </section>

        <section className="card full-width action-card">
          <CardHeading
            title="Action Required"
            subtitle="Items that may need administrator attention"
          />

          <div className="action-grid">
            <ActionItem
              value={pendingRequirements}
              title="Pending Corporate Requirements"
              description="Requirements waiting for suitable candidates"
            />

            <ActionItem
              value={interviewCandidates}
              title="Candidates in Interview"
              description="Candidates currently at interview stage"
            />

            <ActionItem
              value={shortlistedCandidates}
              title="Shortlisted Candidates"
              description="Candidates requiring next-stage movement"
            />

            <ActionItem
              value={activeRequirements}
              title="Active Corporate Requirements"
              description="Currently open requirements"
            />
          </div>
        </section>
      </main>

      <footer>
        Saarthi Admin Dashboard • Management Overview
      </footer>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  defaultLabel,
  options,
}) {
  return (
    <div className="filter">
      <label>{label}</label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value={defaultLabel}>
          {defaultLabel}
        </option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function KpiCard({ icon, label, value, helper }) {
  return (
    <div className="kpi-card">
      <div className="kpi-symbol">{icon}</div>

      <div>
        <span>{label}</span>
        <h2>{value}</h2>
        <small>{helper}</small>
      </div>
    </div>
  );
}

function CardHeading({
  title,
  subtitle,
  action,
}) {
  return (
    <div className="card-heading">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      {action}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PipelineRow({
  label,
  value,
  width,
  tone,
}) {
  return (
    <div className="pipeline-row">
      <div className="pipeline-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="pipeline-track">
        <div
          className={`pipeline-fill ${tone}`}
          style={{ width }}
        />
      </div>
    </div>
  );
}

function CollegeAnalysis({
  colleges,
  candidates,
}) {
  if (colleges.length === 0) {
    return <EmptyState message="No college data available." />;
  }

  return (
    <div className="analysis-grid">
      {colleges.map((college) => {
        const total = candidates.filter(
          (candidate) =>
            candidate.college === college,
        ).length;

        const joined = candidates.filter(
          (candidate) =>
            candidate.college === college &&
            candidate.status === "Joined",
        ).length;

        return (
          <div
            className="analysis-box"
            key={college}
          >
            <span>{college}</span>
            <strong>{total}</strong>
            <small>{joined} joined</small>
          </div>
        );
      })}
    </div>
  );
}

function CorporateAnalysis({
  requirements,
}) {
  if (requirements.length === 0) {
    return (
      <EmptyState message="No corporate requirement data available." />
    );
  }

  return (
    <div className="analysis-grid">
      {requirements.map((requirement) => (
        <div
          className="analysis-box"
          key={requirement.id}
        >
          <span>{requirement.company || "—"}</span>
          <strong>
            {requirement.candidates_shared || 0}
          </strong>
          <small>
            {requirement.selected || 0} selected
          </small>
        </div>
      ))}
    </div>
  );
}

function ProfileAnalysis({
  profiles,
  candidates,
}) {
  if (profiles.length === 0) {
    return (
      <EmptyState message="No profile data available." />
    );
  }

  return (
    <div className="analysis-grid">
      {profiles.map((profile) => {
        const candidateCount = candidates.filter(
          (candidate) =>
            candidate.profile === profile,
        ).length;

        const selected = candidates.filter(
          (candidate) =>
            candidate.profile === profile &&
            candidate.status === "Selected",
        ).length;

        return (
          <div
            className="analysis-box"
            key={profile}
          >
            <span>{profile}</span>
            <strong>{candidateCount}</strong>
            <small>{selected} selected</small>
          </div>
        );
      })}
    </div>
  );
}

function ActionItem({
  value,
  title,
  description,
}) {
  return (
    <div className="action-item">
      <div className="action-number">{value}</div>

      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="admin-empty-state">
      <span>◌</span>
      <p>{message}</p>
    </div>
  );
}

function EmptyTableRow({ message }) {
  return (
    <div className="mini-row empty-table-row">
      <span>{message}</span>
    </div>
  );
}

export default AdminDashboard;