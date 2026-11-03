import { useEffect, useMemo, useState, useRef } from "react";
import { RotateCw } from "lucide-react";
import { getAdminDashboardData } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import "./AdminDashboard.css";

// Canonical recruitment workflow stages supported by SaarthiCampus
const STAGE_OPTIONS = [
  "All stages",
  "Resume Review",
  "Aptitude",
  "GD",
  "Interview",
  "Selected",
  "Joined",
  "Rejected",
];

const DATE_RANGE_OPTIONS = [
  "All time",
  "Today",
  "This week",
  "This month",
  "Last 3 months",
  "This year",
  "Custom",
];

// Platform Adoption Targets (3-month business activation targets)
const ADOPTION_TARGETS = {
  institutes: 300,
  corporates: 150,
  candidates: 15000,
};

export default function AdminDashboard({ setActivePage, user }) {
  // Global Filters
  const [profileFilter, setProfileFilter] = useState("All profiles");
  const [companyFilter, setCompanyFilter] = useState("All corporates");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [dateRangeFilter, setDateRangeFilter] = useState("All time");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Active Hiring Drives Table Controls
  // Default: "All drives" when <= 10 drives, "With applications" when > 10
  const [driveScope, setDriveScope] = useState("all");
  const [driveSort, setDriveSort] = useState("apps");
  const [showAllDrives, setShowAllDrives] = useState(false);
  const [drivesPage, setDrivesPage] = useState(1);
  const DRIVES_PAGE_SIZE = 10;

  // Performance Analysis Table Controls
  const [perfTab, setPerfTab] = useState("college");
  const [cityFilter, setCityFilter] = useState("All cities");
  const [perfSearch, setPerfSearch] = useState("");
  const [perfSortKey, setPerfSortKey] = useState("apps");
  const [perfSortAsc, setPerfSortAsc] = useState(false);
  const [perfPage, setPerfPage] = useState(1);
  const PERF_PAGE_SIZE = 10;

  // Pipeline Info Tooltip
  const [showPipelineTooltip, setShowPipelineTooltip] = useState(false);

  // Loading, Refreshing & Timestamp States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [error, setError] = useState("");

  // Raw Database Data
  const [candidates, setCandidates] = useState([]);
  const [jobProfiles, setJobProfiles] = useState([]);
  const [collegesList, setCollegesList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [applications, setApplications] = useState([]);
  const [offersList, setOffersList] = useState([]);
  const [joiningList, setJoiningList] = useState([]);
  const [interviewsList, setInterviewsList] = useState([]);
  const [gdSessionsList, setGdSessionsList] = useState([]);

  // Cancellation ref to discard stale responses when controls change quickly
  const activeRequestRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Fetch Dashboard Data
  async function loadData(isRefresh = false) {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const requestId = ++activeRequestRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      let data = null;
      try {
        data = await getAdminDashboardData();
      } catch (apiErr) {
        console.warn(
          "Backend /api/admin/dashboard call failed, falling back to direct Supabase query:",
          apiErr
        );
      }

      if (activeRequestRef.current !== requestId) return;

      if (data) {
        setCandidates(data.candidates || []);
        const loadedJobs = data.jobs || [];
        setJobProfiles(loadedJobs);
        setCompaniesList(data.companies || []);
        setCollegesList(data.colleges || []);
        setApplications(data.applications || []);
        setOffersList(data.offers || []);
        setJoiningList(data.joining || []);
        setInterviewsList(data.interviews || []);
        setGdSessionsList(data.gdSessions || []);
        setRefreshError("");

        if (loadedJobs.length > 10) {
          setDriveScope("with_apps");
        } else {
          setDriveScope("all");
        }
        return;
      }

      // Fallback directly to Supabase client
      const results = await Promise.allSettled([
        supabase
          .from("candidates")
          .select(
            "id, name, email, phone, college_id, college_other, degree, branch, cgpa, passing_year, active_backlogs, tenth_percentage, twelfth_percentage, skills, location, experience_years, resume_url, created_at, colleges(id, name, city)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("job_profiles")
          .select(
            "id, title, company, company_id, location, salary_range, experience, skills, qualification, employment_type, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("colleges")
          .select("id, name, city, course, tpo, strength, status, created_at")
          .order("name", { ascending: true }),
        supabase
          .from("companies")
          .select(
            "id, name, sector, hiring_status, verification_status, created_at"
          )
          .order("name", { ascending: true }),
        supabase
          .from("applications")
          .select(
            "id, candidate_id, job_id, stage, resume_score, created_at, job_profiles(id, title, company, company_id), candidates(id, name, college_id, college_other, colleges(id, name))"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("offers")
          .select("id, candidate_id, job_id, ctc, status, sent_on, created_at"),
        supabase
          .from("joining")
          .select(
            "id, candidate_id, job_id, company_id, joining_date, status, created_at"
          ),
        supabase
          .from("interviews")
          .select("id, candidate_id, job_id, type, created_at"),
        supabase
          .from("gd_sessions")
          .select("id, topic, status, scheduled_at, created_at"),
      ]);

      if (activeRequestRef.current !== requestId) return;

      const [cand, jobs, cols, comps, apps, offs, joins, ints, gds] = results;

      if (cand.status === "fulfilled" && !cand.value.error)
        setCandidates(cand.value.data || []);
      const fbJobs =
        jobs.status === "fulfilled" && !jobs.value.error
          ? jobs.value.data || []
          : [];
      setJobProfiles(fbJobs);
      if (cols.status === "fulfilled" && !cols.value.error)
        setCollegesList(cols.value.data || []);
      if (comps.status === "fulfilled" && !comps.value.error)
        setCompaniesList(comps.value.data || []);
      if (apps.status === "fulfilled" && !apps.value.error)
        setApplications(apps.value.data || []);
      if (offs.status === "fulfilled" && !offs.value.error)
        setOffersList(offs.value.data || []);
      if (joins.status === "fulfilled" && !joins.value.error)
        setJoiningList(joins.value.data || []);
      if (ints.status === "fulfilled" && !ints.value.error)
        setInterviewsList(ints.value.data || []);
      if (gds.status === "fulfilled" && !gds.value.error)
        setGdSessionsList(gds.value.data || []);

      if (fbJobs.length > 10) {
        setDriveScope("with_apps");
      } else {
        setDriveScope("all");
      }
      setRefreshError("");
    } catch (err) {
      if (activeRequestRef.current === requestId) {
        console.error("Error fetching admin dashboard data:", err);
        if (isRefresh) {
          setRefreshError("Could not refresh data. Retaining existing values.");
        } else {
          setError(err.message || "Failed to load dashboard data.");
        }
      }
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  

  // Filter Option Lists (Job Profiles & Corporates)
  const profiles = useMemo(() => {
    const set = new Set();
    jobProfiles.forEach((j) => j.title && set.add(j.title.trim()));
    applications.forEach(
      (a) => a.job_profiles?.title && set.add(a.job_profiles.title.trim())
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobProfiles, applications]);

  const companies = useMemo(() => {
    const set = new Set();
    companiesList.forEach((c) => c.name && set.add(c.name.trim()));
    jobProfiles.forEach((j) => j.company && set.add(j.company.trim()));
    applications.forEach(
      (a) => a.job_profiles?.company && set.add(a.job_profiles.company.trim())
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [companiesList, jobProfiles, applications]);

  // Distinct Verified College Cities for the Location Filter
  const collegeCities = useMemo(() => {
    const set = new Set();
    collegesList.forEach((c) => {
      if (c.city && typeof c.city === "string" && c.city.trim()) {
        set.add(c.city.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [collegesList]);

  // Date Check Helper
  const isWithinDate = (dateStr) => {
    if (!dateStr || dateRangeFilter === "All time") return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();

    if (dateRangeFilter === "Today") {
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      return d >= today;
    }
    if (dateRangeFilter === "This week") {
      const day = now.getDay();
      const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - day
      );
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek;
    }
    if (dateRangeFilter === "This month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= startOfMonth;
    }
    if (dateRangeFilter === "Last 3 months") {
      const threeMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 3,
        now.getDate()
      );
      return d >= threeMonthsAgo;
    }
    if (dateRangeFilter === "This year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return d >= startOfYear;
    }
    if (dateRangeFilter === "Custom") {
      if (customStart && d < new Date(customStart)) return false;
      if (customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    }
    return true;
  };

  // 1. Globally Filtered Job Profiles
  const filteredJobProfiles = useMemo(() => {
    return jobProfiles.filter((job) => {
      if (
        profileFilter !== "All profiles" &&
        job.title !== profileFilter
      )
        return false;
      if (companyFilter !== "All corporates") {
        const matchName = job.company === companyFilter;
        const comp = companiesList.find((c) => c.name === companyFilter);
        const matchId = comp && job.company_id === comp.id;
        if (!matchName && !matchId) return false;
      }
      return true;
    });
  }, [jobProfiles, profileFilter, companyFilter, companiesList]);

  // 2. Globally Filtered Applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (profileFilter !== "All profiles") {
        const title = app.job_profiles?.title;
        if (title !== profileFilter) return false;
      }
      if (companyFilter !== "All corporates") {
        const compName = app.job_profiles?.company;
        const comp = companiesList.find((c) => c.name === companyFilter);
        const matchId = comp && app.job_profiles?.company_id === comp.id;
        if (compName !== companyFilter && !matchId) return false;
      }
      if (stageFilter !== "All stages" && app.stage !== stageFilter)
        return false;
      if (!isWithinDate(app.created_at)) return false;
      return true;
    });
  }, [
    applications,
    profileFilter,
    companyFilter,
    stageFilter,
    dateRangeFilter,
    customStart,
    customEnd,
    companiesList,
  ]);

  // 3. Globally Filtered Candidates
  const filteredCandidates = useMemo(() => {
    const isAppFilterActive =
      profileFilter !== "All profiles" ||
      companyFilter !== "All corporates" ||
      stageFilter !== "All stages";

    if (isAppFilterActive) {
      const matchingCandIds = new Set(
        filteredApplications.map((a) => a.candidate_id)
      );
      return candidates.filter((c) => matchingCandIds.has(c.id));
    }

    return candidates.filter((c) => isWithinDate(c.created_at));
  }, [
    candidates,
    filteredApplications,
    profileFilter,
    companyFilter,
    stageFilter,
    dateRangeFilter,
    customStart,
    customEnd,
  ]);

  // Five Main KPI Calculations
  const totalCandidatesCount = filteredCandidates.length;
  const activeJobOpeningsCount = filteredJobProfiles.length;
  const candidatesSharedCount = useMemo(() => {
    return new Set(filteredApplications.map((a) => a.candidate_id)).size;
  }, [filteredApplications]);

  const selectedCount = useMemo(() => {
    return new Set(
      filteredApplications
        .filter((a) => a.stage === "Selected")
        .map((a) => a.candidate_id)
    ).size;
  }, [filteredApplications]);

  const joinedCount = useMemo(() => {
    const appJoinedIds = new Set(
      filteredApplications
        .filter((a) => a.stage === "Joined")
        .map((a) => a.candidate_id)
    );
    joiningList.forEach((j) => {
      if (j.status === "Joined" || j.status === "Completed") {
        if (isWithinDate(j.joining_date || j.created_at)) {
          if (filteredCandidates.some((c) => c.id === j.candidate_id)) {
            appJoinedIds.add(j.candidate_id);
          }
        }
      }
    });
    return appJoinedIds.size;
  }, [
    filteredApplications,
    joiningList,
    filteredCandidates,
    dateRangeFilter,
    customStart,
    customEnd,
  ]);

  // Needs Your Attention (Admin-owned items)

  const incompleteProfiles = useMemo(() => {
    return candidates.filter(
      (c) => !c.resume_url || !c.degree || !c.branch || !c.cgpa
    ).length;
  }, [candidates]);

  const unverifiedCorporates = useMemo(() => {
    return companiesList.filter(
      (c) =>
        c.verification_status !== "Verified" && c.hiring_status !== "Active"
    ).length;
  }, [companiesList]);

  const awaitingJoining = useMemo(() => {
    const selectedCandIds = new Set(
      applications
        .filter((a) => a.stage === "Selected")
        .map((a) => a.candidate_id)
    );
    const joinedCandIds = new Set(
      joiningList
        .filter((j) => j.status === "Joined" || j.status === "Completed")
        .map((j) => j.candidate_id)
    );
    let count = 0;
    selectedCandIds.forEach((id) => {
      if (!joinedCandIds.has(id)) count++;
    });
    return count;
  }, [applications, joiningList]);

  const attentionItems = useMemo(() => {
    const list = [];
    if (incompleteProfiles > 0) {
      list.push({
        id: "incomplete-profiles",
        count: incompleteProfiles,
        label: "Incomplete candidate profiles",
        targetPage: "candidatedb",
      });
    }
    if (unverifiedCorporates > 0) {
      list.push({
        id: "unverified-corporates",
        count: unverifiedCorporates,
        label: "Unverified corporates",
        targetPage: "corpdb",
      });
    }
    if (awaitingJoining > 0) {
      list.push({
        id: "awaiting-joining",
        count: awaitingJoining,
        label: "Awaiting joining confirmation",
        targetPage: "joining",
      });
    }
    return list;
  }, [incompleteProfiles, unverifiedCorporates, awaitingJoining]);

  // Recruitment Pipeline
  const totalAppsCount = filteredApplications.length;
  const PIPELINE_STAGES = [
    "Resume Review",
    "Aptitude",
    "GD",
    "Interview",
    "Selected",
    "Joined",
  ];

  const pipelineStats = useMemo(() => {
    return PIPELINE_STAGES.map((stg, idx) => {
      const count = filteredApplications.filter((a) => a.stage === stg).length;
      let conversionRate = null;
      if (idx > 0) {
        const prevStage = PIPELINE_STAGES[idx - 1];
        const prevCount = filteredApplications.filter((a) => a.stage === prevStage).length;
        if (prevCount >= 10) {
          conversionRate = Math.round((count / prevCount) * 100);
        }
      }
      return { stage: stg, count, conversionRate };
    });
  }, [filteredApplications]);

  // Monthly Recruitment Activity (Whole number Y-axis ticks, exact hover tooltips)
  const monthlyActivity = useMemo(() => {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("en-US", { month: "short" });
      const fullLabel = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      months[key] = {
        month: key,
        fullLabel,
        apps: 0,
        cands: 0,
      };
    }

    candidates.forEach((c) => {
      if (!c.created_at || !isWithinDate(c.created_at)) return;
      const d = new Date(c.created_at);
      const key = d.toLocaleString("en-US", { month: "short" });
      if (months[key]) months[key].cands++;
    });

    applications.forEach((a) => {
      if (!a.created_at || !isWithinDate(a.created_at)) return;
      const d = new Date(a.created_at);
      const key = d.toLocaleString("en-US", { month: "short" });
      if (months[key]) months[key].apps++;
    });

    return Object.values(months);
  }, [candidates, applications, dateRangeFilter, customStart, customEnd]);

  const maxMonthlyVal = useMemo(() => {
    return Math.max(1, ...monthlyActivity.map((m) => Math.max(m.apps, m.cands)));
  }, [monthlyActivity]);

  const yTicks = useMemo(() => {
    if (maxMonthlyVal <= 1) return [1, 0];
    if (maxMonthlyVal <= 4) return [maxMonthlyVal, Math.ceil(maxMonthlyVal / 2), 0];
    const step = Math.ceil(maxMonthlyVal / 3);
    return [step * 3, step * 2, step, 0];
  }, [maxMonthlyVal]);

  const chartCeiling = yTicks[0];

  // ---------------- ACTIVE HIRING DRIVES DATA & CONTROLS ----------------
  const drivesData = useMemo(() => {
    return filteredJobProfiles.map((job) => {
      const jobApps = filteredApplications.filter((a) => a.job_id === job.id);
      const jobInts = interviewsList.filter((i) => i.job_id === job.id).length;
      const jobSel = jobApps.filter((a) => a.stage === "Selected").length;
      return {
        id: job.id,
        company: job.company || "—",
        title: job.title || "—",
        apps: jobApps.length,
        interviews: jobInts,
        selected: jobSel,
        created_at: job.created_at,
      };
    });
  }, [filteredJobProfiles, filteredApplications, interviewsList]);

  // Scoped by toggle: "With applications" / "All drives"
  const scopedDrives = useMemo(() => {
    if (driveScope === "with_apps") {
      return drivesData.filter((d) => d.apps > 0);
    }
    return drivesData;
  }, [drivesData, driveScope]);

  // Sorted by selector: Applications / Interviews / Newest
  const sortedDrives = useMemo(() => {
    const list = [...scopedDrives];
    if (driveSort === "apps") {
      list.sort((a, b) => {
        if (b.apps !== a.apps) return b.apps - a.apps;
        return a.title.localeCompare(b.title);
      });
    } else if (driveSort === "interviews") {
      list.sort((a, b) => {
        if (b.interviews !== a.interviews) return b.interviews - a.interviews;
        return b.apps - a.apps || a.title.localeCompare(b.title);
      });
    } else if (driveSort === "newest") {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return list;
  }, [scopedDrives, driveSort]);

  const maxDriveApps = useMemo(() => {
    return Math.max(1, ...sortedDrives.map((d) => d.apps));
  }, [sortedDrives]);

  const totalDrivesPages = Math.max(1, Math.ceil(sortedDrives.length / DRIVES_PAGE_SIZE));

  // Displayed drives: top 5 by default, or paginated 10/page when expanded
  const displayedDrives = useMemo(() => {
    if (!showAllDrives) {
      return sortedDrives.slice(0, 5);
    }
    const start = (drivesPage - 1) * DRIVES_PAGE_SIZE;
    return sortedDrives.slice(start, start + DRIVES_PAGE_SIZE);
  }, [sortedDrives, showAllDrives, drivesPage]);

  // ---------------- PERFORMANCE ANALYSIS DATA & CONTROLS ----------------
  const collegesSummaryText = useMemo(() => {
    const totalCols = collegesList.length;
    const appCandIds = new Set(filteredApplications.map((a) => a.candidate_id));
    const colsWithApps = collegesList.filter((col) => {
      const colCands = candidates.filter(
        (c) =>
          c.college_id === col.id ||
          (c.college_other &&
            c.college_other.toLowerCase() === col.name.toLowerCase())
      );
      return colCands.some((c) => appCandIds.has(c.id));
    });

    const withAppsCount = colsWithApps.length;
    const inactiveCount = totalCols - withAppsCount;

    if (withAppsCount > 0) {
      let maxApp = 0;
      let topName = "";
      colsWithApps.forEach((col) => {
        const colCands = candidates.filter(
          (c) =>
            c.college_id === col.id ||
            (c.college_other &&
              c.college_other.toLowerCase() === col.name.toLowerCase())
        );
        const candSet = new Set(colCands.map((c) => c.id));
        const apps = filteredApplications.filter((a) =>
          candSet.has(a.candidate_id)
        ).length;
        if (apps > maxApp) {
          maxApp = apps;
          topName = col.name;
        }
      });

      return `${withAppsCount} of ${totalCols} colleges have applications · Top: ${topName} (${maxApp} ${
        maxApp === 1 ? "application" : "applications"
      }) · ${inactiveCount} inactive`;
    }

    return `0 of ${totalCols} colleges have applications · ${totalCols} inactive`;
  }, [collegesList, candidates, filteredApplications]);

  const corporatesSummaryText = useMemo(() => {
    const totalCorps = companiesList.length;
    const corpsWithJobs = companiesList.filter((comp) =>
      jobProfiles.some(
        (j) => j.company_id === comp.id || j.company === comp.name
      )
    ).length;
    const jobIdsWithApps = new Set(filteredApplications.map((a) => a.job_id));
    const corpsWithApps = companiesList.filter((comp) => {
      const compJobs = jobProfiles.filter(
        (j) => j.company_id === comp.id || j.company === comp.name
      );
      return compJobs.some((j) => jobIdsWithApps.has(j.id));
    }).length;

    return `${corpsWithJobs} of ${totalCorps} corporates have open jobs · ${corpsWithApps} ${
      corpsWithApps === 1 ? "has" : "have"
    } applications`;
  }, [companiesList, jobProfiles, filteredApplications]);

  // Filtered & Sorted Performance Rows
  const allPerfData = useMemo(() => {
    const searchLower = perfSearch.trim().toLowerCase();

    if (perfTab === "college") {
      let rows = collegesList.map((col) => {
        const colCands = candidates.filter(
          (c) =>
            c.college_id === col.id ||
            (c.college_other &&
              c.college_other.toLowerCase() === col.name.toLowerCase())
        );
        const candIds = new Set(colCands.map((c) => c.id));
        const colApps = applications.filter((a) =>
          candIds.has(a.candidate_id)
        );
        const selected = colApps.filter((a) => a.stage === "Selected").length;
        const joined = colApps.filter((a) => a.stage === "Joined").length;
        return {
          id: col.id,
          name: col.name,
          location: col.city || "Campus",
          registered: colCands.length,
          apps: colApps.length,
          selected,
          joined,
        };
      });

      // "No college linked" row for candidates without a college
      const matchedCandIds = new Set();
      collegesList.forEach((col) => {
        candidates.forEach((c) => {
          if (
            c.college_id === col.id ||
            (c.college_other &&
              c.college_other.toLowerCase() === col.name.toLowerCase())
          ) {
            matchedCandIds.add(c.id);
          }
        });
      });
      const unlinkedCands = candidates.filter((c) => !matchedCandIds.has(c.id));
      if (unlinkedCands.length > 0) {
        const unlinkedIds = new Set(unlinkedCands.map((c) => c.id));
        const unlinkedApps = applications.filter((a) =>
          unlinkedIds.has(a.candidate_id)
        );
        const selected = unlinkedApps.filter((a) => a.stage === "Selected").length;
        const joined = unlinkedApps.filter((a) => a.stage === "Joined").length;
        rows.push({
          id: "unlinked-college",
          name: "No college linked",
          location: "Direct registration",
          registered: unlinkedCands.length,
          apps: unlinkedApps.length,
          selected,
          joined,
        });
      }

      // City Filter
      if (cityFilter !== "All cities") {
        rows = rows.filter(
          (r) => r.location.toLowerCase() === cityFilter.toLowerCase()
        );
      }

      // Search Filter
      if (searchLower) {
        rows = rows.filter(
          (r) =>
            r.name.toLowerCase().includes(searchLower) ||
            r.location.toLowerCase().includes(searchLower)
        );
      }

      // Sort: Default apps descending, then registered descending
      return rows.sort((a, b) => {
        if (perfSortKey === "apps" && !perfSortAsc) {
          return b.apps !== a.apps
            ? b.apps - a.apps
            : b.registered - a.registered;
        }
        if (typeof a[perfSortKey] === "string") {
          return perfSortAsc
            ? a[perfSortKey].localeCompare(b[perfSortKey])
            : b[perfSortKey].localeCompare(a[perfSortKey]);
        }
        return perfSortAsc
          ? a[perfSortKey] - b[perfSortKey]
          : b[perfSortKey] - a[perfSortKey];
      });
    }

    // Corporate Tab
    let rows = companiesList.map((comp) => {
      const compJobs = jobProfiles.filter(
        (j) => j.company_id === comp.id || j.company === comp.name
      );
      const jobIds = new Set(compJobs.map((j) => j.id));
      const compApps = applications.filter((a) => jobIds.has(a.job_id));
      const selected = compApps.filter((a) => a.stage === "Selected").length;
      const joined = compApps.filter((a) => a.stage === "Joined").length;
      return {
        id: comp.id,
        name: comp.name,
        location: comp.sector || comp.industry || "Corporate",
        registered: compJobs.length, // Open jobs
        apps: compApps.length,
        selected,
        joined,
      };
    });

    if (searchLower) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          r.location.toLowerCase().includes(searchLower)
      );
    }

    return rows.sort((a, b) => {
      if (perfSortKey === "apps" && !perfSortAsc) {
        return b.apps !== a.apps
          ? b.apps - a.apps
          : b.registered - a.registered;
      }
      if (typeof a[perfSortKey] === "string") {
        return perfSortAsc
          ? a[perfSortKey].localeCompare(b[perfSortKey])
          : b[perfSortKey].localeCompare(a[perfSortKey]);
      }
      return perfSortAsc
        ? a[perfSortKey] - b[perfSortKey]
        : b[perfSortKey] - a[perfSortKey];
    });
  }, [
    perfTab,
    cityFilter,
    perfSearch,
    collegesList,
    candidates,
    applications,
    companiesList,
    jobProfiles,
    perfSortKey,
    perfSortAsc,
  ]);

  const totalPerfPages = Math.max(
    1,
    Math.ceil(allPerfData.length / PERF_PAGE_SIZE)
  );

  const pagedPerfData = useMemo(() => {
    const start = (perfPage - 1) * PERF_PAGE_SIZE;
    return allPerfData.slice(start, start + PERF_PAGE_SIZE);
  }, [allPerfData, perfPage]);

  // Recent Activity Feed (Grouped same-day job postings from same corporate)
  const recentActivities = useMemo(() => {
    const list = [];
    const jobGroups = {};
    jobProfiles.forEach((j) => {
      const comp = j.company || "Corporate Partner";
      const dateStr = j.created_at
        ? new Date(j.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "Recent";
      const key = `${comp}__${dateStr}`;
      if (!jobGroups[key]) {
        jobGroups[key] = {
          company: comp,
          count: 0,
          dateStr,
          time: j.created_at,
        };
      }
      jobGroups[key].count++;
    });

    Object.values(jobGroups).forEach((jg, idx) => {
      if (jg.count > 1) {
        list.push({
          id: `job-grp-${idx}`,
          title: `${jg.count} new job postings by ${jg.company}`,
          timeText: jg.dateStr,
          rawTime: jg.time,
        });
      } else {
        list.push({
          id: `job-single-${idx}`,
          title: `New job posting by ${jg.company}`,
          timeText: jg.dateStr,
          rawTime: jg.time,
        });
      }
    });

    applications.forEach((a) => {
      const comp = a.job_profiles?.company || "Company";
      const title = a.job_profiles?.title || "Job";
      const dateStr = a.created_at
        ? new Date(a.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "Recent";
      list.push({
        id: "app-" + a.id,
        title: `Application submitted for ${title} (${comp})`,
        timeText: dateStr,
        rawTime: a.created_at,
      });
    });

    list.sort((a, b) => new Date(b.rawTime || 0) - new Date(a.rawTime || 0));
    return list;
  }, [jobProfiles, applications]);

  // Lifetime Platform Adoption Actuals
  const totalCollegesLifetime = collegesList.length;
  const totalCompaniesLifetime = companiesList.length;
  const totalCandidatesLifetime = candidates.length;

  // Upcoming Events (Only if scheduled events exist)
  const upcomingEvents = useMemo(() => {
    const list = [];
    gdSessionsList.forEach((gd) => {
      if (gd.scheduled_at && new Date(gd.scheduled_at) >= new Date()) {
        list.push({
          id: "gd-" + gd.id,
          title: gd.title || "Group discussion session",
          subtitle: `Job: ${gd.job_profiles?.title || "General"} · ${
            gd.status
          }`,
          date: new Date(gd.scheduled_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
    });
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    return list;
  }, [gdSessionsList]);

  // Reset all global filters
  const resetFilters = () => {
    setProfileFilter("All profiles");
    setCompanyFilter("All corporates");
    setStageFilter("All stages");
    setDateRangeFilter("All time");
    setCustomStart("");
    setCustomEnd("");
  };

  const isAnyFilterActive =
    profileFilter !== "All profiles" ||
    companyFilter !== "All corporates" ||
    stageFilter !== "All stages" ||
    dateRangeFilter !== "All time";

  // Navigation Helper
  const navigateTo = (pageKey) => {
    if (typeof setActivePage === "function") {
      setActivePage(pageKey);
    }
  };

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
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
          <button
            type="button"
            className="reset-btn active"
            onClick={() => loadData(false)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* 1. TITLE + REFRESH */}
      <header className="header-bar">
        <div className="header-title-block">
          <h1>Saarthi Admin Dashboard</h1>
        </div>
        <div className="header-status">
          {refreshError && (
            <span className="refresh-error-toast" role="alert">
              {refreshError}
            </span>
          )}
          <button
            type="button"
            className="refresh-btn"
            disabled={refreshing || loading}
            onClick={() => loadData(true)}
            aria-label="Refresh dashboard"
          >
            <RotateCw
              className={`refresh-icon ${refreshing ? "spinning" : ""}`}
              size={13}
            />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* 2. GLOBAL FILTERS & REMOVABLE CHIPS */}
      <section className="filters-section">
        <div className="filters-row">
          <DropdownFilter
            label="Job profile"
            value={profileFilter}
            onChange={setProfileFilter}
            defaultLabel="All profiles"
            options={profiles}
            searchable
          />

          <DropdownFilter
            label="Corporate"
            value={companyFilter}
            onChange={setCompanyFilter}
            defaultLabel="All corporates"
            options={companies}
            searchable
          />

          <DropdownFilter
            label="Application stage"
            value={stageFilter}
            onChange={setStageFilter}
            defaultLabel="All stages"
            options={STAGE_OPTIONS.filter((s) => s !== "All stages")}
          />

          <DropdownFilter
            label="Date range"
            value={dateRangeFilter}
            onChange={setDateRangeFilter}
            defaultLabel="All time"
            options={DATE_RANGE_OPTIONS.filter((d) => d !== "All time")}
          />

          <button
            type="button"
            className={`reset-btn ${isAnyFilterActive ? "active" : ""}`}
            onClick={resetFilters}
            title="Reset all filters"
          >
            Reset filters
          </button>
        </div>

        {dateRangeFilter === "Custom" && (
          <div className="custom-date-inputs">
            <div className="date-field">
              <label>Start date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="date-field">
              <label>End date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {isAnyFilterActive && (
          <div className="filter-chips-row">
            <span className="chips-label">Active filters:</span>
            {profileFilter !== "All profiles" && (
              <span className="filter-chip">
                Profile: {profileFilter}
                <button
                  type="button"
                  onClick={() => setProfileFilter("All profiles")}
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            )}
            {companyFilter !== "All corporates" && (
              <span className="filter-chip">
                Corporate: {companyFilter}
                <button
                  type="button"
                  onClick={() => setCompanyFilter("All corporates")}
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            )}
            {stageFilter !== "All stages" && (
              <span className="filter-chip">
                Stage: {stageFilter}
                <button
                  type="button"
                  onClick={() => setStageFilter("All stages")}
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            )}
            {dateRangeFilter !== "All time" && (
              <span className="filter-chip">
                Range: {dateRangeFilter}
                <button
                  type="button"
                  onClick={() => setDateRangeFilter("All time")}
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </section>

      {/* 3. NEEDS YOUR ATTENTION: Slim Single Row (Only rendered when items exist) */}
      {attentionItems.length > 0 && (
        <section className="attention-section">
          <div className="attention-bar">
            <span className="attention-label">Needs your attention:</span>
            <div className="attention-chips">
              {attentionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="attention-chip"
                  onClick={() => navigateTo(item.targetPage)}
                >
                  <strong className="attention-count">{item.count}</strong>
                  <span className="attention-title">{item.label}</span>
                  <span className="attention-action">Review →</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. FIVE KPI CARDS */}
      <section className="kpi-grid">
        <CompactKpiCard
          label="Total candidates"
          value={totalCandidatesCount}
          helper="Distinct registered candidates"
          onClick={() => navigateTo("candidatedb")}
        />
        <CompactKpiCard
          label="Active job openings"
          value={activeJobOpeningsCount}
          helper="Verified hiring profiles"
          onClick={() => navigateTo("jobs")}
        />
        <CompactKpiCard
          label="Candidates shared"
          value={candidatesSharedCount}
          helper="Candidates with applications"
          onClick={() => navigateTo("pipeline")}
        />
        <CompactKpiCard
          label="Selected"
          value={selectedCount}
          helper="Reached selected stage"
          onClick={() => navigateTo("joining")}
        />
        <CompactKpiCard
          label="Joined"
          value={joinedCount}
          helper="Confirmed joining status"
          onClick={() => navigateTo("joining")}
        />
      </section>

      {/* 5. RECRUITMENT PIPELINE + MONTHLY RECRUITMENT ACTIVITY */}
      <div className="two-col-grid">
        {/* RECRUITMENT PIPELINE */}
        <section className="card pipeline-card">
          <div className="card-header-row">
            <div className="header-title-group">
              <h3>Recruitment pipeline</h3>
              <button
                type="button"
                className="info-help-btn"
                onClick={() => setShowPipelineTooltip(!showPipelineTooltip)}
                title="How this is calculated"
              >
                ⓘ
              </button>
            </div>
            <span className="badge-count">
              {totalAppsCount} {totalAppsCount === 1 ? "application" : "applications"}
            </span>
          </div>

          {showPipelineTooltip && (
            <div className="pipeline-explainer">
              <strong>ⓘ How this is calculated:</strong> Stages show current
              active applications. Conversion rate is shown between stages
              once the prior stage processes at least 10 applications.
            </div>
          )}

          <div className="pipeline-track-list">
            {pipelineStats.map((item) => (
              <div className="pipeline-stage-row" key={item.stage}>
                <span className="pipeline-stage-name">{item.stage}</span>
                <div className="pipeline-bar-track">
                  <div
                    className="pipeline-bar-fill"
                    style={{
                      width: `${
                        totalAppsCount > 0 && item.count > 0
                          ? Math.round(
                              (item.count / totalAppsCount) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="pipeline-stage-metrics">
                  <strong>{item.count}</strong>
                  {item.conversionRate !== null && (
                    <small>{item.conversionRate}%</small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MONTHLY RECRUITMENT ACTIVITY */}
        <section className="card monthly-card">
          <div className="card-header-row">
            <h3>Monthly recruitment activity</h3>
            <div className="chart-legend-single">
              <span className="legend-item">
                <i className="legend-dot legend-cands" /> Candidates
              </span>
              <span className="legend-item">
                <i className="legend-dot legend-apps" /> Applications
              </span>
            </div>
          </div>

          <div className="chart-container">
            <div className="y-ticks">
              {yTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>

            <div className="chart-bars-wrap">
              {monthlyActivity.map((m) => {
                const candHeight =
                  chartCeiling > 0 ? (m.cands / chartCeiling) * 100 : 0;
                const appHeight =
                  chartCeiling > 0 ? (m.apps / chartCeiling) * 100 : 0;
                return (
                  <div className="month-column" key={m.month}>
                    <div className="bar-pair">
                      <div
                        className="activity-bar bar-cand"
                        style={{ height: `${candHeight}%` }}
                        title={`${m.fullLabel}: ${m.cands} candidate registrations`}
                      />
                      <div
                        className="activity-bar bar-app"
                        style={{ height: `${appHeight}%` }}
                        title={`${m.fullLabel}: ${m.apps} applications submitted`}
                      />
                    </div>
                    <span className="month-label">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 6. ACTIVE HIRING DRIVES (With Table Controls) */}
      <section className="card full-width hiring-drives-merged-card">
        <div className="card-header-row drives-header">
          <div>
            <h3>Active hiring drives</h3>
            <p className="card-subhead">
              Applications, interview rounds, and selections per open drive
            </p>
          </div>

          <div className="drives-controls">
            {/* Segmented Toggle: "With applications" / "All drives" */}
            <div className="segmented-toggle">
              <button
                type="button"
                className={`toggle-option ${
                  driveScope === "with_apps" ? "active" : ""
                }`}
                onClick={() => {
                  setDriveScope("with_apps");
                  setDrivesPage(1);
                }}
              >
                With applications
              </button>
              <button
                type="button"
                className={`toggle-option ${
                  driveScope === "all" ? "active" : ""
                }`}
                onClick={() => {
                  setDriveScope("all");
                  setDrivesPage(1);
                }}
              >
                All drives
              </button>
            </div>

            {/* Compact Sort Selector: Applications / Interviews / Newest */}
            <div className="compact-sort-selector">
              <label className="sort-label">Sort:</label>
              <select
                className="sort-dropdown-inline"
                value={driveSort}
                onChange={(e) => {
                  setDriveSort(e.target.value);
                  setDrivesPage(1);
                }}
              >
                <option value="apps">Applications</option>
                <option value="interviews">Interviews</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-table drives-table">
            <thead>
              <tr>
                <th style={{ minWidth: 170 }}>Corporate</th>
                <th style={{ minWidth: 180 }}>Job title</th>
                <th style={{ minWidth: 160 }}>Applications</th>
                <th style={{ textAlign: "center", width: 100 }}>Interviews</th>
                <th style={{ textAlign: "center", width: 100 }}>Selected</th>
              </tr>
            </thead>
            <tbody>
              {sortedDrives.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No applications yet. Share drives with colleges.
                  </td>
                </tr>
              ) : (
                displayedDrives.map((drive) => (
                  <tr
                    key={drive.id}
                    className="clickable-row"
                    tabIndex={0}
                    role="button"
                    onClick={() => navigateTo("pipeline")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateTo("pipeline");
                      }
                    }}
                  >
                    <td>
                      <strong className="cell-corp">{drive.company}</strong>
                    </td>
                    <td>
                      <span className="cell-title">{drive.title}</span>
                    </td>
                    <td>
                      <div className="app-bar-cell">
                        <span
                          className={
                            drive.apps > 0 ? "count-active" : "count-zero"
                          }
                        >
                          {drive.apps}
                        </span>
                        <div className="app-bar-track">
                          <div
                            className="app-bar-fill"
                            style={{
                              width: `${(drive.apps / maxDriveApps) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={
                          drive.interviews > 0 ? "count-active" : "count-zero"
                        }
                      >
                        {drive.interviews}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={
                          drive.selected > 0 ? "count-active" : "count-zero"
                        }
                      >
                        {drive.selected}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Expansion / Pagination Bar for Drives */}
        {sortedDrives.length > 5 && (
          <div className="drives-footer-bar">
            {!showAllDrives ? (
              <button
                type="button"
                className="text-toggle-btn"
                onClick={() => {
                  setShowAllDrives(true);
                  setDrivesPage(1);
                }}
              >
                View all {sortedDrives.length} {sortedDrives.length === 1 ? "drive" : "drives"}
              </button>
            ) : (
              <div className="pagination-bar drives-pagination">
                <span className="page-summary">
                  Showing {(drivesPage - 1) * DRIVES_PAGE_SIZE + 1}–
                  {Math.min(
                    drivesPage * DRIVES_PAGE_SIZE,
                    sortedDrives.length
                  )}{" "}
                  of {sortedDrives.length} {sortedDrives.length === 1 ? "drive" : "drives"}
                </span>
                <div className="page-nav">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={drivesPage === 1}
                    onClick={() => setDrivesPage((p) => Math.max(1, p - 1))}
                  >
                    ‹ Previous
                  </button>
                  <span className="page-indicator">
                    {drivesPage} / {totalDrivesPages}
                  </span>
                  <button
                    type="button"
                    className="page-btn"
                    disabled={drivesPage === totalDrivesPages}
                    onClick={() =>
                      setDrivesPage((p) => Math.min(totalDrivesPages, p + 1))
                    }
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    className="text-toggle-btn ml-12"
                    onClick={() => setShowAllDrives(false)}
                  >
                    Show top 5
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 7. PERFORMANCE ANALYSIS (With Table Controls & Summary Line) */}
      <section className="card full-width performance-card">
        <div className="card-header-row perf-header">
          <div>
            <h3>Performance analysis</h3>
            <p className="card-subhead">
              Talent acquisition and corporate placement breakdown
            </p>
          </div>

          <div className="perf-controls">
            {/* Colleges / Corporates Tabs */}
            <div className="tab-pills">
              <button
                type="button"
                className={`tab-pill ${
                  perfTab === "college" ? "active" : ""
                }`}
                onClick={() => {
                  setPerfTab("college");
                  setPerfSortKey("apps");
                  setPerfSortAsc(false);
                  setPerfPage(1);
                }}
              >
                Colleges
              </button>
              <button
                type="button"
                className={`tab-pill ${
                  perfTab === "corporate" ? "active" : ""
                }`}
                onClick={() => {
                  setPerfTab("corporate");
                  setPerfSortKey("apps");
                  setPerfSortAsc(false);
                  setPerfPage(1);
                }}
              >
                Corporates
              </button>
            </div>

            

            {/* Location (City) Dropdown for Colleges tab */}
            {perfTab === "college" && (
              <DropdownFilter
                label="City"
                value={cityFilter}
                onChange={(c) => {
                  setCityFilter(c);
                  setPerfPage(1);
                }}
                defaultLabel="All cities"
                options={collegeCities}
                searchable
              />
            )}

            {/* Search Input */}
            <input
              type="text"
              className="search-input"
              placeholder={`Search ${
                perfTab === "college" ? "colleges" : "corporates"
              }...`}
              value={perfSearch}
              onChange={(e) => {
                setPerfSearch(e.target.value);
                setPerfPage(1);
              }}
            />
          </div>
        </div>

        {/* Real Summary Line Above Table */}
        <div className="perf-summary-line">
          {perfTab === "college"
            ? collegesSummaryText
            : corporatesSummaryText}
        </div>

        <div className="table-responsive">
          <table className="admin-table compact">
            <thead>
              <tr>
                <th
                  onClick={() => {
                    setPerfSortKey("name");
                    setPerfSortAsc(!perfSortAsc);
                  }}
                  style={{ cursor: "pointer", minWidth: 200 }}
                >
                  {perfTab === "college" ? "College" : "Corporate"}{" "}
                  {perfSortKey === "name"
                    ? perfSortAsc
                      ? "▲"
                      : "▼"
                    : "⇅"}
                </th>
                <th
                  onClick={() => {
                    setPerfSortKey("registered");
                    setPerfSortAsc(!perfSortAsc);
                  }}
                  style={{ cursor: "pointer", textAlign: "center" }}
                >
                  {perfTab === "college" ? "Registered" : "Open jobs"}{" "}
                  {perfSortKey === "registered"
                    ? perfSortAsc
                      ? "▲"
                      : "▼"
                    : "⇅"}
                </th>
                <th
                  onClick={() => {
                    setPerfSortKey("apps");
                    setPerfSortAsc(!perfSortAsc);
                  }}
                  style={{ cursor: "pointer", textAlign: "center" }}
                >
                  Applications{" "}
                  {perfSortKey === "apps"
                    ? perfSortAsc
                      ? "▲"
                      : "▼"
                    : "⇅"}
                </th>
                <th
                  onClick={() => {
                    setPerfSortKey("selected");
                    setPerfSortAsc(!perfSortAsc);
                  }}
                  style={{ cursor: "pointer", textAlign: "center" }}
                >
                  Selected{" "}
                  {perfSortKey === "selected"
                    ? perfSortAsc
                      ? "▲"
                      : "▼"
                    : "⇅"}
                </th>
                <th
                  onClick={() => {
                    setPerfSortKey("joined");
                    setPerfSortAsc(!perfSortAsc);
                  }}
                  style={{ cursor: "pointer", textAlign: "center" }}
                >
                  Joined{" "}
                  {perfSortKey === "joined"
                    ? perfSortAsc
                      ? "▲"
                      : "▼"
                    : "⇅"}
                </th>
              </tr>
            </thead>
            <tbody>
              {allPerfData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    <p>
                      {perfTab === "college"
                        ? "No colleges found matching the current search/filter."
                        : "No corporates found matching the current search."}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedPerfData.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="entity-cell">
                        <strong>{row.name}</strong>
                        <span className="entity-sub">{row.location}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={
                          row.registered > 0 ? "count-active" : "count-zero"
                        }
                      >
                        {row.registered}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={
                          row.apps > 0 ? "count-active" : "count-zero"
                        }
                      >
                        {row.apps}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={
                          row.selected > 0 ? "count-active" : "count-zero"
                        }
                      >
                        {row.selected}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={
                          row.joined > 0 ? "count-active" : "count-zero"
                        }
                      >
                        {row.joined}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {allPerfData.length > PERF_PAGE_SIZE && (
          <div className="pagination-bar">
            <span className="page-summary">
              Showing {(perfPage - 1) * PERF_PAGE_SIZE + 1}–
              {Math.min(perfPage * PERF_PAGE_SIZE, allPerfData.length)} of{" "}
              {allPerfData.length}
            </span>
            <div className="page-nav">
              <button
                type="button"
                className="page-btn"
                disabled={perfPage === 1}
                onClick={() => setPerfPage((p) => Math.max(1, p - 1))}
              >
                ‹ Previous
              </button>
              <span className="page-indicator">
                {perfPage} / {totalPerfPages}
              </span>
              <button
                type="button"
                className="page-btn"
                disabled={perfPage === totalPerfPages}
                onClick={() =>
                  setPerfPage((p) => Math.min(totalPerfPages, p + 1))
                }
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 8. RECENT ACTIVITY + PLATFORM ADOPTION (Side by Side) */}
      <div className="two-col-grid">
        {/* RECENT ACTIVITY */}
        <section className="card recent-activity-card">
          <div className="card-header-row">
            <h3>Recent activity</h3>
            {recentActivities.length > 5 && (
              <button
                type="button"
                className="text-toggle-btn"
                onClick={() => navigateTo("activity")}
              >
                View more →
              </button>
            )}
          </div>

          <div className="activity-list">
            {recentActivities.length === 0 ? (
              <p className="empty-hint">No recent activity records.</p>
            ) : (
              recentActivities.slice(0, 5).map((act) => (
                <div className="activity-row" key={act.id}>
                  <span className="activity-dot" />
                  <span className="activity-text">{act.title}</span>
                  <span className="activity-time">{act.timeText}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* PLATFORM ADOPTION */}
        <section className="card adoption-card">
          <div className="card-header-row">
            <div>
              <h3>Platform adoption</h3>
              <p className="card-subhead">
                Lifetime registrations vs 3-month activation target
              </p>
            </div>
          </div>

          <div className="adoption-list">
            <AdoptionRow
              label="Institutes"
              actual={totalCollegesLifetime}
              target={ADOPTION_TARGETS.institutes}
            />
            <AdoptionRow
              label="Corporates"
              actual={totalCompaniesLifetime}
              target={ADOPTION_TARGETS.corporates}
            />
            <AdoptionRow
              label="Candidates"
              actual={totalCandidatesLifetime}
              target={ADOPTION_TARGETS.candidates}
            />
          </div>
        </section>
      </div>

      {/* 9. UPCOMING EVENTS (Rendered ONLY when scheduled events exist) */}
      {upcomingEvents.length > 0 && (
        <section className="card full-width upcoming-events-card">
          <div className="card-header-row">
            <h3>Upcoming events</h3>
            <span className="badge-count">
              {upcomingEvents.length} scheduled
            </span>
          </div>

          <div className="events-grid">
            {upcomingEvents.map((evt) => (
              <div className="event-card" key={evt.id}>
                <strong>{evt.title}</strong>
                <span className="event-meta">{evt.subtitle}</span>
                <span className="event-date">{evt.date}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------- SUB-COMPONENTS ----------------

function CompactKpiCard({ label, value, helper, onClick }) {
  return (
    <div
      className="kpi-card-compact clickable"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick && onClick();
        }
      }}
    >
      <span className="kpi-label">{label}</span>
      <strong className="kpi-number">
        {Number(value || 0).toLocaleString()}
      </strong>
      <span className="kpi-subtitle">{helper}</span>
    </div>
  );
}

function AdoptionRow({ label, actual, target }) {
  const percent = target
    ? Math.min(100, Math.round((actual / target) * 100))
    : 0;
  return (
    <div className="adoption-row">
      <div className="adoption-header">
        <span className="adoption-name">{label}</span>
        <span className="adoption-stats">
          <strong>{actual.toLocaleString()}</strong> of{" "}
          {target.toLocaleString()} · {percent}%
        </span>
      </div>
      <div className="adoption-track">
        <div className="adoption-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// Unified Dropdown Filter Component (with Search, Esc, Click-Outside)
function DropdownFilter({
  label,
  value,
  onChange,
  defaultLabel,
  options,
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
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
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, search, searchable]);

  return (
    <div className="dropdown-filter-container" ref={ref}>
      <label className="filter-field-label">{label}</label>
      <button
        type="button"
        className={`filter-dropdown-btn ${
          value !== defaultLabel ? "has-active-value" : ""
        }`}
        onClick={() => setOpen(!open)}
      >
        <span className="filter-val-text">{value}</span>
        <span className="caret-symbol">▾</span>
      </button>

      {open && (
        <div className="dropdown-popover">
          {searchable && (
            <input
              type="text"
              className="popover-search-input"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          )}
          <div className="popover-scroll-list">
            <div
              className={`popover-option-item ${
                value === defaultLabel ? "selected" : ""
              }`}
              onClick={() => {
                onChange(defaultLabel);
                setOpen(false);
                setSearch("");
              }}
            >
              {defaultLabel}
            </div>
            {filteredOptions.length === 0 ? (
              <div className="popover-empty-notice">No matches found</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt}
                  className={`popover-option-item ${
                    value === opt ? "selected" : ""
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
