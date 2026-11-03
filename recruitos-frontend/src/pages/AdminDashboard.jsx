import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import "./AdminDashboard.css";

// Canonical recruitment workflow statuses supported by SaarthiCampus
const CANONICAL_STATUS_OPTIONS = [
  "Shortlisted",
  "Interview",
  "Selected",
  "Joined",
  "Rejected",
  "Aptitude",
  "GD",
  "Resume Review",
];

// Platform Adoption targets — from the 3-month promotion/adoption plan.
// These are TARGETS to compare against, not values to hardcode as achieved.
const ADOPTION_TARGETS = {
  institutes: 300,
  corporates: 150,
  candidates: 15000,
};

function AdminDashboard() {
  const [profileFilter, setProfileFilter] = useState("All Profiles");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [companyFilter, setCompanyFilter] = useState("All Corporates");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const [view, setView] = useState("college");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [candidates, setCandidates] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [jobProfiles, setJobProfiles] = useState([]);
  const [collegesList, setCollegesList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function fetchDashboardData() {
      setLoading(true);
      setError("");

      try {
        const results = await Promise.allSettled([
          supabase
            .from("candidates")
            .select("*, colleges(id, name)")
            .order("created_at", { ascending: false }),

          supabase
            .from("requirements")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase
            .from("monthly_recruitment")
            .select("*")
            .order("month_order", { ascending: true }),

          supabase
            .from("job_profiles")
            .select("id, title, company")
            .order("title", { ascending: true }),

          supabase
            .from("colleges")
            .select("id, name, city")
            .order("name", { ascending: true }),

          supabase
            .from("companies")
            .select("id, name, sector")
            .order("name", { ascending: true }),

          supabase
            .from("applications")
            .select("id, candidate_id, stage, job_profiles(id, title, company)"),
        ]);

        const [candRes, reqRes, monthRes, jobRes, colRes, compRes, appRes] = results;

        if (!ignore) {
          if (candRes.status === "fulfilled" && !candRes.value.error) {
            setCandidates(candRes.value.data || []);
          } else if (candRes.status === "rejected" || candRes.value?.error) {
            console.warn("Candidates load failed:", candRes.reason || candRes.value?.error);
          }

          if (reqRes.status === "fulfilled" && !reqRes.value.error) {
            setRequirements(reqRes.value.data || []);
          } else if (reqRes.status === "rejected" || reqRes.value?.error) {
            console.warn("Requirements load failed:", reqRes.reason || reqRes.value?.error);
          }

          if (monthRes.status === "fulfilled" && !monthRes.value.error) {
            setMonthlyData(monthRes.value.data || []);
          }

          if (jobRes.status === "fulfilled" && !jobRes.value.error) {
            setJobProfiles(jobRes.value.data || []);
          } else if (jobRes.status === "rejected" || jobRes.value?.error) {
            console.warn("Job profiles load failed:", jobRes.reason || jobRes.value?.error);
          }

          if (colRes.status === "fulfilled" && !colRes.value.error) {
            setCollegesList(colRes.value.data || []);
          } else if (colRes.status === "rejected" || colRes.value?.error) {
            console.warn("Colleges load failed:", colRes.reason || colRes.value?.error);
          }

          if (compRes.status === "fulfilled" && !compRes.value.error) {
            setCompaniesList(compRes.value.data || []);
          } else if (compRes.status === "rejected" || compRes.value?.error) {
            console.warn("Companies load failed:", compRes.reason || compRes.value?.error);
          }

          if (appRes.status === "fulfilled" && !appRes.value.error) {
            setApplications(appRes.value.data || []);
          } else if (appRes.status === "rejected" || appRes.value?.error) {
            console.warn("Applications load failed:", appRes.reason || appRes.value?.error);
          }
        }
      } catch (fetchError) {
        console.error("Admin dashboard fetch error:", fetchError);

        if (!ignore) {
          setError(
            fetchError?.message || "Could not load dashboard data.",
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

  // Map candidate applications to link candidates to jobs, companies, and stages
  const candidateAppMap = useMemo(() => {
    const map = {};
    applications.forEach((app) => {
      const candId = app.candidate_id;
      if (!candId) return;
      if (!map[candId]) {
        map[candId] = {
          profiles: [],
          companies: [],
          stages: [],
        };
      }
      if (app.job_profiles?.title) {
        map[candId].profiles.push(app.job_profiles.title);
      }
      if (app.job_profiles?.company) {
        map[candId].companies.push(app.job_profiles.company);
      }
      if (app.stage) {
        map[candId].stages.push(app.stage);
      }
    });
    return map;
  }, [applications]);

  // 1. Dynamic Job Profiles (deduplicated from job_profiles, requirements, candidates, and applications)
  const profiles = useMemo(() => {
    const map = new Map();
    const add = (val) => {
      if (!val || typeof val !== "string") return;
      const trimmed = val.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, trimmed);
      }
    };

    jobProfiles.forEach((j) => {
      add(j.title);
      add(j.profile);
    });
    requirements.forEach((r) => {
      add(r.profile);
    });
    candidates.forEach((c) => {
      add(c.profile);
    });
    applications.forEach((a) => {
      add(a.job_profiles?.title);
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [jobProfiles, requirements, candidates, applications]);

  // 2. Dynamic Colleges (deduplicated from colleges table, candidates)
  const colleges = useMemo(() => {
    const map = new Map();
    const add = (val) => {
      if (!val || typeof val !== "string") return;
      const trimmed = val.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, trimmed);
      }
    };

    collegesList.forEach((c) => {
      add(c.name);
    });
    candidates.forEach((c) => {
      add(c.college);
      add(c.college_other);
      if (c.colleges?.name) add(c.colleges.name);
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [collegesList, candidates]);

  // 3. Dynamic Corporates (deduplicated from companies table, requirements, job_profiles, candidates, applications)
  const companies = useMemo(() => {
    const map = new Map();
    const add = (val) => {
      if (!val || typeof val !== "string") return;
      const trimmed = val.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, trimmed);
      }
    };

    companiesList.forEach((c) => {
      add(c.name);
    });
    requirements.forEach((r) => {
      add(r.company);
    });
    jobProfiles.forEach((j) => {
      add(j.company);
    });
    candidates.forEach((c) => {
      add(c.company);
    });
    applications.forEach((a) => {
      add(a.job_profiles?.company);
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [companiesList, requirements, jobProfiles, candidates, applications]);

  // 4. Candidate Status options (canonical recruitment workflow + candidate records)
  const statusOptions = useMemo(() => {
    const seen = new Set(CANONICAL_STATUS_OPTIONS.map((s) => s.toLowerCase()));
    const extras = [];

    candidates.forEach((c) => {
      if (c.status && typeof c.status === "string") {
        const trimmed = c.status.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          extras.push(trimmed);
        }
      }
    });

    return [...CANONICAL_STATUS_OPTIONS, ...extras.sort((a, b) => a.localeCompare(b))];
  }, [candidates]);

  // Strict AND filtering across all four criteria for Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      // 1. Profile filter
      let matchesProfile = profileFilter === "All Profiles";
      if (!matchesProfile) {
        const targetProf = profileFilter.trim().toLowerCase();
        const candProf = (candidate.profile || "").trim().toLowerCase();
        const appProfs = (candidateAppMap[candidate.id]?.profiles || []).map(
          (p) => p.trim().toLowerCase(),
        );
        matchesProfile =
          candProf === targetProf || appProfs.includes(targetProf);
      }

      // 2. College filter
      let matchesCollege = collegeFilter === "All Colleges";
      if (!matchesCollege) {
        const targetCollege = collegeFilter.trim().toLowerCase();
        const candCollege = (
          candidate.colleges?.name ||
          candidate.college ||
          candidate.college_other ||
          ""
        ).trim().toLowerCase();
        matchesCollege = candCollege === targetCollege;
      }

      // 3. Corporate filter
      let matchesCompany = companyFilter === "All Corporates";
      if (!matchesCompany) {
        const targetComp = companyFilter.trim().toLowerCase();
        const candComp = (candidate.company || "").trim().toLowerCase();
        const appComps = (candidateAppMap[candidate.id]?.companies || []).map(
          (c) => c.trim().toLowerCase(),
        );
        matchesCompany =
          candComp === targetComp ||
          appComps.includes(targetComp) ||
          (candComp && (candComp.includes(targetComp) || targetComp.includes(candComp))) ||
          appComps.some(
            (c) => c && (c.includes(targetComp) || targetComp.includes(c)),
          );
      }

      // 4. Candidate Status filter
      let matchesStatus = statusFilter === "All Status";
      if (!matchesStatus) {
        const targetStatus = statusFilter.trim().toLowerCase().replace(/_/g, " ");
        const candStatus = (candidate.status || "").trim().toLowerCase().replace(/_/g, " ");
        const appStages = (candidateAppMap[candidate.id]?.stages || []).map(
          (s) => s.trim().toLowerCase().replace(/_/g, " "),
        );
        matchesStatus =
          candStatus === targetStatus || appStages.includes(targetStatus);
      }

      return (
        matchesProfile &&
        matchesCollege &&
        matchesCompany &&
        matchesStatus
      );
    });
  }, [
    candidates,
    profileFilter,
    collegeFilter,
    companyFilter,
    statusFilter,
    candidateAppMap,
  ]);

  // AND filtering for Requirements (profile and corporate)
  const filteredRequirements = useMemo(() => {
    return requirements.filter((requirement) => {
      let matchesProfile = profileFilter === "All Profiles";
      if (!matchesProfile) {
        const targetProf = profileFilter.trim().toLowerCase();
        const reqProf = (requirement.profile || requirement.title || "").trim().toLowerCase();
        matchesProfile = reqProf === targetProf;
      }

      let matchesCompany = companyFilter === "All Corporates";
      if (!matchesCompany) {
        const targetComp = companyFilter.trim().toLowerCase();
        const reqComp = (requirement.company || "").trim().toLowerCase();
        matchesCompany =
          reqComp === targetComp ||
          reqComp.includes(targetComp) ||
          targetComp.includes(reqComp);
      }

      return matchesProfile && matchesCompany;
    });
  }, [requirements, profileFilter, companyFilter]);

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

  // ---- Platform Adoption (Institutes / Corporates / Candidates) ----
  // Uses registered database counts where available, falling back to distinct items in records.
  const totalInstitutes = Math.max(collegesList.length, colleges.length);

  const activeInstitutes = useMemo(() => {
    return colleges.filter((college) =>
      candidates.some(
        (candidate) =>
          candidate.college === college &&
          candidate.status &&
          candidate.status !== "Inactive",
      ),
    ).length;
  }, [colleges, candidates]);

  const totalCorporates = Math.max(companiesList.length, companies.length);

  const verifiedCorporates = useMemo(() => {
    return companies.filter((company) =>
      requirements.some(
        (requirement) =>
          requirement.company === company &&
          (requirement.verification_status === "Verified" ||
            requirement.verification_status === "Active"),
      ),
    ).length;
  }, [companies, requirements]);

  const activeCorporates = useMemo(() => {
    return companies.filter((company) =>
      requirements.some(
        (requirement) =>
          requirement.company === company &&
          requirement.status === "Active",
      ),
    ).length;
  }, [companies, requirements]);

  const totalCandidatesOverall = candidates.length;

  const profileCompletedCandidates = useMemo(() => {
    return candidates.filter(
      (candidate) => candidate.profile_completion >= 100,
    ).length;
  }, [candidates]);

  const inactiveInstitutesCount = Math.max(0, totalInstitutes - activeInstitutes);

  const unverifiedCorporatesCount = Math.max(0, totalCorporates - verifiedCorporates);

  const incompleteProfilesCount = Math.max(
    0,
    totalCandidatesOverall - profileCompletedCandidates,
  );

  const isAnyFilterActive =
    profileFilter !== "All Profiles" ||
    collegeFilter !== "All Colleges" ||
    companyFilter !== "All Corporates" ||
    statusFilter !== "All Status";

  function getAdoptionPercent(actual, target) {
    if (!target) return 0;
    return Math.min(100, Math.round((actual / target) * 100));
  }

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
        </div>
      </header>

      <section className="filters">
        <SearchableFilter
          label="Job Profile"
          value={profileFilter}
          onChange={setProfileFilter}
          defaultLabel="All Profiles"
          options={profiles}
        />

        <SearchableFilter
          label="College"
          value={collegeFilter}
          onChange={setCollegeFilter}
          defaultLabel="All Colleges"
          options={colleges}
        />

        <SearchableFilter
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
          options={statusOptions}
        />

        <button
          className={`reset ${isAnyFilterActive ? "has-active" : ""}`}
          type="button"
          onClick={resetFilters}
          title={isAnyFilterActive ? "Reset all 4 filters" : "All filters at default"}
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
        <section className="card full-width adoption-card">
          <CardHeading
            title="Platform Adoption"
            subtitle="Registered vs. 3-month activation targets across the three-sided platform"
          />

          <div className="adoption-grid">
            <AdoptionCard
              icon="🏫"
              label="Institutes"
              actual={totalInstitutes}
              target={ADOPTION_TARGETS.institutes}
              percent={getAdoptionPercent(
                totalInstitutes,
                ADOPTION_TARGETS.institutes,
              )}
              breakdown={[
                { label: "Active", value: activeInstitutes },
              ]}
            />

            <AdoptionCard
              icon="🏢"
              label="Corporates"
              actual={totalCorporates}
              target={ADOPTION_TARGETS.corporates}
              percent={getAdoptionPercent(
                totalCorporates,
                ADOPTION_TARGETS.corporates,
              )}
              breakdown={[
                { label: "Verified", value: verifiedCorporates },
                { label: "Active", value: activeCorporates },
              ]}
            />

            <AdoptionCard
              icon="🎓"
              label="Candidates"
              actual={totalCandidatesOverall}
              target={ADOPTION_TARGETS.candidates}
              percent={getAdoptionPercent(
                totalCandidatesOverall,
                ADOPTION_TARGETS.candidates,
              )}
              breakdown={[
                {
                  label: "Profile Completed",
                  value: profileCompletedCandidates,
                },
              ]}
            />
          </div>
        </section>

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

        <section className="card pipeline-card">
          <CardHeading
            title="Recruitment Pipeline"
            subtitle="Current candidate journey"
            action={
              <span className="count-badge">
                {totalCandidates} Candidates
              </span>
            }
          />

          {totalCandidates === 0 ? (
            <div className="pipeline-empty-hint">
              No candidates match the selected filters.
            </div>
          ) : (
            <>
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
            </>
          )}
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
              <EmptyTableRow message="No corporate requirements match the selected filters." />
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

          {filteredCandidates.length === 0 ? (
            <EmptyState
              message="No candidates match the selected filters."
              onReset={resetFilters}
            />
          ) : (
            <div className="profile-list">
              {profiles
                .filter((profile) =>
                  filteredCandidates.some(
                    (candidate) =>
                      (candidate.profile || "").toLowerCase() ===
                      profile.toLowerCase(),
                  ),
                )
                .map((profile) => {
                  const count = filteredCandidates.filter(
                    (candidate) =>
                      (candidate.profile || "").toLowerCase() ===
                      profile.toLowerCase(),
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
              onReset={resetFilters}
            />
          )}

          {view === "corporate" && (
            <CorporateAnalysis
              requirements={filteredRequirements}
              onReset={resetFilters}
            />
          )}

          {view === "profile" && (
            <ProfileAnalysis
              profiles={profiles}
              candidates={filteredCandidates}
              onReset={resetFilters}
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

            <ActionItem
              value={inactiveInstitutesCount}
              title="Inactive Institutes"
              description="Institutes with no recent activity"
            />

            <ActionItem
              value={unverifiedCorporatesCount}
              title="Unverified Corporates"
              description="Corporate accounts awaiting verification"
            />

            <ActionItem
              value={incompleteProfilesCount}
              title="Incomplete Candidate Profiles"
              description="Candidates yet to complete their profile"
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

function SearchableFilter({
  label,
  value,
  onChange,
  defaultLabel,
  options = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, search]);

  const isFiltered = value !== defaultLabel;

  function handleSelect(val) {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div
      className={`filter searchable-filter ${isFiltered ? "active-filter" : ""}`}
      ref={dropdownRef}
    >
      <label>{label}</label>

      <button
        type="button"
        className="searchable-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="trigger-text">{value}</span>
        <span
          className="trigger-arrow"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="searchable-popover" role="listbox">
          <div className="searchable-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="searchable-input"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                } else if (e.key === "Enter" && filteredOptions.length > 0) {
                  e.preventDefault();
                  handleSelect(filteredOptions[0]);
                }
              }}
            />
          </div>

          <div className="searchable-options">
            {(!search.trim() ||
              defaultLabel.toLowerCase().includes(search.trim().toLowerCase())) && (
              <div
                className={`searchable-option ${
                  value === defaultLabel ? "selected" : ""
                }`}
                onClick={() => handleSelect(defaultLabel)}
              >
                {defaultLabel}
              </div>
            )}

            {filteredOptions.map((opt) => (
              <div
                key={opt}
                className={`searchable-option ${
                  value === opt ? "selected" : ""
                }`}
                onClick={() => handleSelect(opt)}
                title={opt}
              >
                {opt}
              </div>
            ))}

            {filteredOptions.length === 0 && search.trim() && (
              <div className="searchable-empty">
                No matching {label.toLowerCase()}
              </div>
            )}
          </div>
        </div>
      )}
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
  const isFiltered = value !== defaultLabel;

  return (
    <div className={`filter ${isFiltered ? "active-filter" : ""}`}>
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

function AdoptionCard({
  icon,
  label,
  actual,
  target,
  percent,
  breakdown,
}) {
  return (
    <div className="adoption-item">
      <div className="adoption-item-top">
        <div className="adoption-symbol">{icon}</div>
        <span>{label}</span>
      </div>

      <div className="adoption-value">
        <strong>{actual.toLocaleString()}</strong>
        <small> / {target.toLocaleString()}+</small>
      </div>

      <div className="adoption-progress">
        <div
          className="adoption-progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="adoption-percent">{percent}% of target</div>

      {breakdown && breakdown.length > 0 && (
        <div className="adoption-breakdown">
          {breakdown.map((row) => (
            <span key={row.label}>
              {row.label}: <strong>{row.value}</strong>
            </span>
          ))}
        </div>
      )}
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
  onReset,
}) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        message="No college candidate data matches the selected filters."
        onReset={onReset}
      />
    );
  }

  const activeColleges = colleges.filter((col) =>
    candidates.some(
      (c) =>
        (c.college || c.college_other || c.colleges?.name || "").toLowerCase() ===
        col.toLowerCase(),
    ),
  );

  const displayList = activeColleges.length > 0 ? activeColleges : colleges;

  return (
    <div className="analysis-grid">
      {displayList.map((college) => {
        const total = candidates.filter(
          (candidate) =>
            (candidate.college || candidate.college_other || candidate.colleges?.name || "").toLowerCase() ===
            college.toLowerCase(),
        ).length;

        const joined = candidates.filter(
          (candidate) =>
            (candidate.college || candidate.college_other || candidate.colleges?.name || "").toLowerCase() ===
              college.toLowerCase() &&
            (candidate.status || "").toLowerCase() === "joined",
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
  onReset,
}) {
  if (requirements.length === 0) {
    return (
      <EmptyState
        message="No corporate requirement data matches the selected filters."
        onReset={onReset}
      />
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
  onReset,
}) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        message="No candidate profile data matches the selected filters."
        onReset={onReset}
      />
    );
  }

  const activeProfiles = profiles.filter((prof) =>
    candidates.some(
      (c) => (c.profile || "").toLowerCase() === prof.toLowerCase(),
    ),
  );

  const displayProfiles = activeProfiles.length > 0 ? activeProfiles : profiles;

  return (
    <div className="analysis-grid">
      {displayProfiles.map((profile) => {
        const candidateCount = candidates.filter(
          (candidate) =>
            (candidate.profile || "").toLowerCase() === profile.toLowerCase(),
        ).length;

        const selected = candidates.filter(
          (candidate) =>
            (candidate.profile || "").toLowerCase() === profile.toLowerCase() &&
            (candidate.status || "").toLowerCase() === "selected",
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

function EmptyState({ message, onReset }) {
  return (
    <div className="admin-empty-state">
      <span>◌</span>
      <p>{message}</p>
      {onReset && (
        <button type="button" onClick={onReset}>
          Reset Filters
        </button>
      )}
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
