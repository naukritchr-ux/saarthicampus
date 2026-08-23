<<<<<<< HEAD
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
=======
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
} from "recharts";
import "./Dashboard.css";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/* =========================================================
   DASHBOARD DATA (Recruiter Dashboard)
========================================================= */

const dashboardData = {
  "In-house": {
    "Last 6 Months": {
      kpis: { candidates: 190, positions: 24, interviews: 54, selected: 24 },
      trend: [
        { month: "Jan", candidates: 82, interviews: 35, selected: 12 },
        { month: "Feb", candidates: 105, interviews: 42, selected: 17 },
        { month: "Mar", candidates: 120, interviews: 51, selected: 21 },
        { month: "Apr", candidates: 145, interviews: 64, selected: 27 },
        { month: "May", candidates: 168, interviews: 72, selected: 31 },
        { month: "Jun", candidates: 190, interviews: 84, selected: 38 },
      ],
      sources: [
        { name: "LinkedIn", value: 38 },
        { name: "Naukri", value: 27 },
        { name: "Referral", value: 18 },
        { name: "Website", value: 11 },
        { name: "Other", value: 6 },
      ],
      status: [
        { name: "Applied", value: 190 },
        { name: "Shortlisted", value: 82 },
        { name: "Interview", value: 54 },
        { name: "Selected", value: 31 },
        { name: "Hired", value: 24 },
      ],
      funnel: [
        { label: "Applied", value: 190, percentage: 100 },
        { label: "Shortlisted", value: 82, percentage: 43 },
        { label: "Interview", value: 54, percentage: 28 },
        { label: "Selected", value: 31, percentage: 16 },
        { label: "Hired", value: 24, percentage: 13 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 18 },
        { name: "Recruiter B", description: "Strong interview conversion", value: 15 },
        { name: "Recruiter C", description: "Good candidate pipeline", value: 12 },
        { name: "Recruiter D", description: "Growing performance", value: 9 },
      ],
    },
    "This Month": {
      kpis: { candidates: 42, positions: 8, interviews: 16, selected: 7 },
      trend: [
        { month: "Week 1", candidates: 8, interviews: 3, selected: 1 },
        { month: "Week 2", candidates: 17, interviews: 6, selected: 2 },
        { month: "Week 3", candidates: 29, interviews: 11, selected: 5 },
        { month: "Week 4", candidates: 42, interviews: 16, selected: 7 },
      ],
      sources: [
        { name: "LinkedIn", value: 14 },
        { name: "Naukri", value: 12 },
        { name: "Referral", value: 8 },
        { name: "Website", value: 5 },
        { name: "Other", value: 3 },
      ],
      status: [
        { name: "Applied", value: 42 },
        { name: "Shortlisted", value: 19 },
        { name: "Interview", value: 16 },
        { name: "Selected", value: 7 },
        { name: "Hired", value: 5 },
      ],
      funnel: [
        { label: "Applied", value: 42, percentage: 100 },
        { label: "Shortlisted", value: 19, percentage: 45 },
        { label: "Interview", value: 16, percentage: 38 },
        { label: "Selected", value: 7, percentage: 17 },
        { label: "Hired", value: 5, percentage: 12 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 7 },
        { name: "Recruiter B", description: "Strong pipeline", value: 5 },
        { name: "Recruiter C", description: "Good conversion", value: 4 },
        { name: "Recruiter D", description: "Growing performance", value: 2 },
      ],
    },
    "Last 3 Months": {
      kpis: { candidates: 125, positions: 16, interviews: 37, selected: 16 },
      trend: [
        { month: "Apr", candidates: 35, interviews: 14, selected: 6 },
        { month: "May", candidates: 42, interviews: 18, selected: 7 },
        { month: "Jun", candidates: 48, interviews: 21, selected: 9 },
      ],
      sources: [
        { name: "LinkedIn", value: 31 },
        { name: "Naukri", value: 25 },
        { name: "Referral", value: 15 },
        { name: "Website", value: 8 },
        { name: "Other", value: 5 },
      ],
      status: [
        { name: "Applied", value: 125 },
        { name: "Shortlisted", value: 55 },
        { name: "Interview", value: 37 },
        { name: "Selected", value: 16 },
        { name: "Hired", value: 12 },
      ],
      funnel: [
        { label: "Applied", value: 125, percentage: 100 },
        { label: "Shortlisted", value: 55, percentage: 44 },
        { label: "Interview", value: 37, percentage: 30 },
        { label: "Selected", value: 16, percentage: 13 },
        { label: "Hired", value: 12, percentage: 10 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 12 },
        { name: "Recruiter B", description: "Strong conversion", value: 10 },
        { name: "Recruiter C", description: "Good pipeline", value: 8 },
        { name: "Recruiter D", description: "Growing performance", value: 6 },
      ],
    },
    "This Year": {
      kpis: { candidates: 365, positions: 42, interviews: 108, selected: 49 },
      trend: [
        { month: "Jan", candidates: 48, interviews: 18, selected: 7 },
        { month: "Feb", candidates: 52, interviews: 20, selected: 8 },
        { month: "Mar", candidates: 56, interviews: 21, selected: 9 },
        { month: "Apr", candidates: 60, interviews: 24, selected: 11 },
        { month: "May", candidates: 69, interviews: 25, selected: 12 },
        { month: "Jun", candidates: 80, interviews: 28, selected: 13 },
      ],
      sources: [
        { name: "LinkedIn", value: 76 },
        { name: "Naukri", value: 61 },
        { name: "Referral", value: 44 },
        { name: "Website", value: 29 },
        { name: "Other", value: 15 },
      ],
      status: [
        { name: "Applied", value: 365 },
        { name: "Shortlisted", value: 152 },
        { name: "Interview", value: 108 },
        { name: "Selected", value: 55 },
        { name: "Hired", value: 49 },
      ],
      funnel: [
        { label: "Applied", value: 365, percentage: 100 },
        { label: "Shortlisted", value: 152, percentage: 42 },
        { label: "Interview", value: 108, percentage: 30 },
        { label: "Selected", value: 55, percentage: 15 },
        { label: "Hired", value: 49, percentage: 13 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 28 },
        { name: "Recruiter B", description: "Strong conversion", value: 24 },
        { name: "Recruiter C", description: "Good pipeline", value: 20 },
        { name: "Recruiter D", description: "Growing performance", value: 15 },
      ],
    },
  },

  Corporate: {
    "Last 6 Months": {
      kpis: { candidates: 245, positions: 31, interviews: 72, selected: 32 },
      trend: [
        { month: "Jan", candidates: 95, interviews: 39, selected: 14 },
        { month: "Feb", candidates: 118, interviews: 48, selected: 19 },
        { month: "Mar", candidates: 139, interviews: 57, selected: 23 },
        { month: "Apr", candidates: 164, interviews: 69, selected: 28 },
        { month: "May", candidates: 205, interviews: 79, selected: 34 },
        { month: "Jun", candidates: 245, interviews: 92, selected: 42 },
      ],
      sources: [
        { name: "LinkedIn", value: 52 },
        { name: "Naukri", value: 36 },
        { name: "Referral", value: 24 },
        { name: "Website", value: 15 },
        { name: "Other", value: 8 },
      ],
      status: [
        { name: "Applied", value: 245 },
        { name: "Shortlisted", value: 104 },
        { name: "Interview", value: 72 },
        { name: "Selected", value: 42 },
        { name: "Hired", value: 32 },
      ],
      funnel: [
        { label: "Applied", value: 245, percentage: 100 },
        { label: "Shortlisted", value: 104, percentage: 42 },
        { label: "Interview", value: 72, percentage: 29 },
        { label: "Selected", value: 42, percentage: 17 },
        { label: "Hired", value: 32, percentage: 13 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 24 },
        { name: "Recruiter B", description: "Strong conversion", value: 21 },
        { name: "Recruiter C", description: "Good candidate pipeline", value: 17 },
        { name: "Recruiter D", description: "Growing performance", value: 13 },
      ],
    },
    "This Month": {
      kpis: { candidates: 58, positions: 11, interviews: 21, selected: 10 },
      trend: [
        { month: "Week 1", candidates: 12, interviews: 4, selected: 2 },
        { month: "Week 2", candidates: 24, interviews: 9, selected: 4 },
        { month: "Week 3", candidates: 40, interviews: 15, selected: 7 },
        { month: "Week 4", candidates: 58, interviews: 21, selected: 10 },
      ],
      sources: [
        { name: "LinkedIn", value: 21 },
        { name: "Naukri", value: 16 },
        { name: "Referral", value: 10 },
        { name: "Website", value: 7 },
        { name: "Other", value: 4 },
      ],
      status: [
        { name: "Applied", value: 58 },
        { name: "Shortlisted", value: 25 },
        { name: "Interview", value: 21 },
        { name: "Selected", value: 10 },
        { name: "Hired", value: 8 },
      ],
      funnel: [
        { label: "Applied", value: 58, percentage: 100 },
        { label: "Shortlisted", value: 25, percentage: 43 },
        { label: "Interview", value: 21, percentage: 36 },
        { label: "Selected", value: 10, percentage: 17 },
        { label: "Hired", value: 8, percentage: 14 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 9 },
        { name: "Recruiter B", description: "Strong pipeline", value: 7 },
        { name: "Recruiter C", description: "Good conversion", value: 5 },
        { name: "Recruiter D", description: "Growing performance", value: 3 },
      ],
    },
    "Last 3 Months": {
      kpis: { candidates: 165, positions: 23, interviews: 48, selected: 22 },
      trend: [
        { month: "Apr", candidates: 48, interviews: 16, selected: 7 },
        { month: "May", candidates: 54, interviews: 18, selected: 8 },
        { month: "Jun", candidates: 63, interviews: 21, selected: 10 },
      ],
      sources: [
        { name: "LinkedIn", value: 37 },
        { name: "Naukri", value: 28 },
        { name: "Referral", value: 18 },
        { name: "Website", value: 11 },
        { name: "Other", value: 6 },
      ],
      status: [
        { name: "Applied", value: 165 },
        { name: "Shortlisted", value: 71 },
        { name: "Interview", value: 48 },
        { name: "Selected", value: 22 },
        { name: "Hired", value: 17 },
      ],
      funnel: [
        { label: "Applied", value: 165, percentage: 100 },
        { label: "Shortlisted", value: 71, percentage: 43 },
        { label: "Interview", value: 48, percentage: 29 },
        { label: "Selected", value: 22, percentage: 13 },
        { label: "Hired", value: 17, percentage: 10 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 16 },
        { name: "Recruiter B", description: "Strong conversion", value: 13 },
        { name: "Recruiter C", description: "Good pipeline", value: 10 },
        { name: "Recruiter D", description: "Growing performance", value: 8 },
      ],
    },
    "This Year": {
      kpis: { candidates: 472, positions: 57, interviews: 146, selected: 64 },
      trend: [
        { month: "Jan", candidates: 61, interviews: 21, selected: 9 },
        { month: "Feb", candidates: 70, interviews: 25, selected: 11 },
        { month: "Mar", candidates: 74, interviews: 27, selected: 12 },
        { month: "Apr", candidates: 82, interviews: 30, selected: 14 },
        { month: "May", candidates: 91, interviews: 32, selected: 15 },
        { month: "Jun", candidates: 94, interviews: 35, selected: 17 },
      ],
      sources: [
        { name: "LinkedIn", value: 101 },
        { name: "Naukri", value: 82 },
        { name: "Referral", value: 61 },
        { name: "Website", value: 43 },
        { name: "Other", value: 27 },
      ],
      status: [
        { name: "Applied", value: 472 },
        { name: "Shortlisted", value: 201 },
        { name: "Interview", value: 146 },
        { name: "Selected", value: 74 },
        { name: "Hired", value: 64 },
      ],
      funnel: [
        { label: "Applied", value: 472, percentage: 100 },
        { label: "Shortlisted", value: 201, percentage: 43 },
        { label: "Interview", value: 146, percentage: 31 },
        { label: "Selected", value: 74, percentage: 16 },
        { label: "Hired", value: 64, percentage: 14 },
      ],
      recruiters: [
        { name: "Recruiter A", description: "Highest selections", value: 35 },
        { name: "Recruiter B", description: "Strong conversion", value: 31 },
        { name: "Recruiter C", description: "Good pipeline", value: 25 },
        { name: "Recruiter D", description: "Growing performance", value: 20 },
      ],
    },
  },
};

/* =========================================================
   SAMPLE CANDIDATE DATA
========================================================= */

const candidates = [
  { id: 1, name: "Aarav Sharma", position: "Business Analyst", source: "LinkedIn", experience: "2 Years", stage: "Interview", status: "Interview", recruiter: "Recruiter A", email: "aarav.sharma@example.com", phone: "+91 98765 43210", location: "Mumbai" },
  { id: 2, name: "Priya Mehta", position: "Data Analyst", source: "Naukri", experience: "1 Year", stage: "Shortlisted", status: "Shortlisted", recruiter: "Recruiter B", email: "priya.mehta@example.com", phone: "+91 98765 12345", location: "Pune" },
  { id: 3, name: "Rahul Patil", position: "HR Executive", source: "Referral", experience: "3 Years", stage: "Selected", status: "Selected", recruiter: "Recruiter A", email: "rahul.patil@example.com", phone: "+91 98234 56789", location: "Mumbai" },
  { id: 4, name: "Sneha Joshi", position: "Business Analyst", source: "Website", experience: "2 Years", stage: "Applied", status: "Applied", recruiter: "Recruiter C", email: "sneha.joshi@example.com", phone: "+91 98123 45678", location: "Thane" },
  { id: 5, name: "Rohan Shah", position: "Data Analyst", source: "LinkedIn", experience: "4 Years", stage: "Hired", status: "Selected", recruiter: "Recruiter B", email: "rohan.shah@example.com", phone: "+91 98989 12345", location: "Mumbai" },
];

/* =========================================================
   ACTIVITY DATA
========================================================= */

const activityData = [
  { icon: "👤", title: "New candidate added", description: "Aarav Sharma applied for Business Analyst", time: "10 min ago" },
  { icon: "📅", title: "Interview scheduled", description: "Priya Mehta has an interview today", time: "35 min ago" },
  { icon: "✓", title: "Candidate selected", description: "Rahul Patil was selected for HR Executive", time: "1 hour ago" },
  { icon: "📄", title: "Application received", description: "New application received from LinkedIn", time: "2 hours ago" },
];

const COLORS = ["#743bf1", "#d83da9", "#239ddd", "#079b6d", "#f59e0b"];

export default function Dashboard() {
  const [workspace, setWorkspace] = useState("In-house");
  const [dateFilter, setDateFilter] = useState("Last 6 Months");
  const [activeChart, setActiveChart] = useState("trend");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [recruiterFilter, setRecruiterFilter] = useState("All");
  const [tableSearch, setTableSearch] = useState("");
  const [showTableView, setShowTableView] = useState(false);
  const [funnelStage, setFunnelStage] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const rowsPerPage = 5;

  // Safe lookup: falls back instead of crashing if workspace/dateFilter combo is missing
  const currentData =
    dashboardData[workspace]?.[dateFilter] ??
    dashboardData["In-house"]["Last 6 Months"];

<<<<<<< HEAD
  const greeting = getGreeting();
=======
      try {
        const userId = user?.id;

        if (!userId) {
          throw new Error("No logged-in user found.");
        }
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df

  const filteredCandidates = useMemo(() => {
    const search = candidateSearch.toLowerCase().trim();
    return candidates.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search) || c.position.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [candidateSearch, statusFilter]);

<<<<<<< HEAD
  const tableCandidates = useMemo(() => {
    const search = tableSearch.toLowerCase().trim();
    return candidates.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search) || c.position.toLowerCase().includes(search) || c.email.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      const matchesStage = stageFilter === "All" || c.stage === stageFilter;
      const matchesSource = sourceFilter === "All" || c.source === sourceFilter;
      const matchesRecruiter = recruiterFilter === "All" || c.recruiter === recruiterFilter;
      return matchesSearch && matchesStatus && matchesStage && matchesSource && matchesRecruiter;
    });
  }, [tableSearch, statusFilter, stageFilter, sourceFilter, recruiterFilter]);

  const totalPages = Math.max(1, Math.ceil(tableCandidates.length / rowsPerPage));
  const paginatedCandidates = tableCandidates.slice((tablePage - 1) * rowsPerPage, tablePage * rowsPerPage);

  React.useEffect(() => {
    setTablePage(1);
  }, [tableSearch, statusFilter, stageFilter, sourceFilter, recruiterFilter]);

  const renderRecruitmentChart = () => {
    if (activeChart === "trend") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={currentData.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeaf3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9995ae" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9995ae" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="candidates" name="Candidates" stroke="#743bf1" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="interviews" name="Interviews" stroke="#239ddd" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="selected" name="Selected" stroke="#079b6d" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );
=======
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
    }
    if (activeChart === "sources") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={currentData.sources}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeaf3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9995ae" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9995ae" />
            <Tooltip />
            <Bar dataKey="value" name="Candidates" fill="#743bf1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={currentData.status} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={3} label>
            {currentData.status.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const funnelCandidates = funnelStage ? candidates.filter((c) => c.stage === funnelStage) : [];

  return (
<<<<<<< HEAD
    <div className="page active" id="page-dashboard">
      <section className="content">
        <div className="greeting">
          <div>
            <div className="greeting-small">RECRUITMENT OVERVIEW</div>
            <h2>{greeting}</h2>
            <p>Track recruitment activity, candidate progress and hiring performance from one dashboard.</p>
          </div>
          <div className="greeting-icon">📊</div>
        </div>

        <div className="dashboard-controls">
          <div className="workspace-switcher">
            <button className={workspace === "In-house" ? "active" : ""} onClick={() => setWorkspace("In-house")}>In-house</button>
            <button className={workspace === "Corporate" ? "active" : ""} onClick={() => setWorkspace("Corporate")}>Corporate</button>
          </div>
          <select className="chart-filter" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option>Last 6 Months</option>
            <option>This Month</option>
            <option>Last 3 Months</option>
            <option>This Year</option>
          </select>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-top">👥<span>+12.5%</span></div>
            <h3>{currentData.kpis.candidates}</h3>
            <p>Total Candidates</p>
          </div>
          <div className="stat-card">
            <div className="stat-top">💼<span>+8.2%</span></div>
            <h3>{currentData.kpis.positions}</h3>
            <p>Open Positions</p>
          </div>
          <div className="stat-card">
            <div className="stat-top">📅<span>+15.4%</span></div>
            <h3>{currentData.kpis.interviews}</h3>
            <p>Interviews</p>
          </div>
          <div className="stat-card">
            <div className="stat-top">✓<span>+9.8%</span></div>
            <h3>{currentData.kpis.selected}</h3>
            <p>Selected / Hired</p>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3>Recruitment Analytics</h3>
              <p>{workspace} recruitment performance • {dateFilter}</p>
            </div>
          </div>
          <div className="workspace-switcher">
            <button className={activeChart === "trend" ? "active" : ""} onClick={() => setActiveChart("trend")}>Trend</button>
            <button className={activeChart === "sources" ? "active" : ""} onClick={() => setActiveChart("sources")}>Sources</button>
            <button className={activeChart === "status" ? "active" : ""} onClick={() => setActiveChart("status")}>Status</button>
          </div>
          <div className="chart-container">{renderRecruitmentChart()}</div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <h3>Recruitment Funnel</h3>
                <p>Candidate movement through hiring stages</p>
              </div>
            </div>
            {currentData.funnel.map((item) => (
              <div className="funnel-row" key={item.label}>
                <span>{item.label}</span>
                <div className="progress"><div className="progress-fill" style={{ width: `${item.percentage}%` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
            <div style={{ marginTop: "15px", textAlign: "right" }}>
              <button className="candidate-view-btn" onClick={() => setFunnelStage("Applied")}>View Details</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3>Recruitment Performance</h3>
                <p>Recruiter-wise overview</p>
              </div>
            </div>
            {currentData.recruiters.map((r) => (
              <div className="performance-row" key={r.name}>
                <div><strong>{r.name}</strong><span>{r.description}</span></div>
                <div className="performance-value">{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: "16px" }}>
          <div className="card-header">
            <div><h3>Candidate Overview</h3><p>Recent candidates</p></div>
            <button className="candidate-view-btn" onClick={() => setShowTableView(true)}>Table View</button>
          </div>
          <div className="candidate-table-container">
            <table className="candidate-table">
              <thead>
                <tr><th>Candidate</th><th>Position</th><th>Source</th><th>Stage</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filteredCandidates.slice(0, 5).map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.position}</td>
                    <td>{c.source}</td>
                    <td>{c.stage}</td>
                    <td><span className={`candidate-status ${c.status.toLowerCase().replace(" ", "-")}`}>{c.status}</span></td>
                    <td><button className="candidate-view-btn" onClick={() => setSelectedCandidate(c)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: "16px" }}>
          <div className="card-header"><div><h3>Recent Activity</h3><p>Latest recruitment updates</p></div></div>
          {activityData.map((a, i) => (
            <div className="activity-item" key={i}>
              <div className="activity-icon">{a.icon}</div>
              <div><strong>{a.title}</strong><p>{a.description}</p></div>
              <span>{a.time}</span>
            </div>
=======
    <div
      className="dashboard-page"
      id="page-recruiter-dashboard"
    >
      <StarticleBackground />

      <header className="dashboard-header">
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

      <section className="dashboard-panel pipeline-panel">
        <div className="dashboard-panel-title">
          My Recruitment Pipeline
        </div>

        <div className="dashboard-panel-subtitle">
          JD → Resumes → Assessments → Interviews →
          Selection → Joining
        </div>

        <div className="pipeline-track">
          {pipeline.map((stage, index) => (
            <button
              type="button"
              className="pipeline-step"
              key={stage.label}
              onClick={() => navigate(stage.route)}
              aria-label={`Open ${stage.label}`}
            >
              <span>
                {String(index + 1).padStart(2, "0")}
              </span>

              <strong>{stage.label}</strong>
            </button>
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
          ))}
        </div>
      </section>

<<<<<<< HEAD
      {/* ===================== TABLE VIEW MODAL ===================== */}
      {showTableView && (
        <div className="candidate-modal-overlay" onClick={() => setShowTableView(false)}>
          <div className="candidate-modal" style={{ width: "95%", maxWidth: "1200px", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="candidate-modal-header">
              <div>
                <h3>Candidate Table</h3>
                <div className="candidate-modal-label">Complete candidate overview</div>
              </div>
              <button className="candidate-modal-close" onClick={() => setShowTableView(false)}>×</button>
=======
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
            </div>

<<<<<<< HEAD
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
              <input
                type="text"
                placeholder="Search name, position or email..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{ flex: 1, minWidth: "220px", padding: "10px 12px", border: "1px solid #e3e0eb", borderRadius: "8px", outline: "none", fontSize: "12px" }}
              />
              <select className="chart-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All Status</option>
                <option value="Applied">Applied</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interview">Interview</option>
                <option value="Selected">Selected</option>
              </select>
              <select className="chart-filter" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="All">All Stages</option>
                <option value="Applied">Applied</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interview">Interview</option>
                <option value="Selected">Selected</option>
                <option value="Hired">Hired</option>
              </select>
              <select className="chart-filter" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="All">All Sources</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Naukri">Naukri</option>
                <option value="Referral">Referral</option>
                <option value="Website">Website</option>
              </select>
              <select className="chart-filter" value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)}>
                <option value="All">All Recruiters</option>
                <option value="Recruiter A">Recruiter A</option>
                <option value="Recruiter B">Recruiter B</option>
                <option value="Recruiter C">Recruiter C</option>
                <option value="Recruiter D">Recruiter D</option>
              </select>
=======
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
            </div>

<<<<<<< HEAD
            <div className="candidate-table-container">
              <table className="candidate-table">
                <thead>
                  <tr>
                    <th>Candidate</th><th>Position</th><th>Source</th><th>Experience</th><th>Stage</th><th>Status</th><th>Recruiter</th><th>Action</th>
=======
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

          <span className="section-icon">↗</span>
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
                  </tr>
                </thead>
                <tbody>
                  {paginatedCandidates.length > 0 ? (
                    paginatedCandidates.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.position}</td>
                        <td>{c.source}</td>
                        <td>{c.experience}</td>
                        <td>{c.stage}</td>
                        <td><span className={`candidate-status ${c.status.toLowerCase().replace(" ", "-")}`}>{c.status}</span></td>
                        <td>{c.recruiter}</td>
                        <td><button className="candidate-view-btn" onClick={() => setSelectedCandidate(c)}>View</button></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "30px", color: "#9995ae" }}>No candidates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: "#77738a" }}>
                Showing{" "}
                {tableCandidates.length === 0 ? 0 : (tablePage - 1) * rowsPerPage + 1}
                {" - "}
                {Math.min(tablePage * rowsPerPage, tableCandidates.length)}
                {" of "}
                {tableCandidates.length}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="candidate-view-btn" disabled={tablePage === 1} onClick={() => setTablePage((p) => Math.max(1, p - 1))}>←</button>
                <span style={{ padding: "7px 10px", fontSize: "12px" }}>{tablePage} / {totalPages}</span>
                <button className="candidate-view-btn" disabled={tablePage === totalPages} onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}>→</button>
              </div>
            </div>

            <div className="candidate-modal-footer">
              <button className="candidate-close-btn" onClick={() => setShowTableView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

<<<<<<< HEAD
      {/* ===================== FUNNEL DETAILS MODAL ===================== */}
      {funnelStage && (
        <div className="candidate-modal-overlay" onClick={() => setFunnelStage(null)}>
          <div className="candidate-modal" style={{ width: "90%", maxWidth: "900px", maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="candidate-modal-header">
              <div>
                <h3>{funnelStage} Candidates</h3>
                <div className="candidate-modal-label">Candidates currently in this stage</div>
              </div>
              <button className="candidate-modal-close" onClick={() => setFunnelStage(null)}>×</button>
            </div>

            <div className="workspace-switcher" style={{ marginBottom: "15px", flexWrap: "wrap" }}>
              {currentData.funnel.map((stage) => (
                <button key={stage.label} className={funnelStage === stage.label ? "active" : ""} onClick={() => setFunnelStage(stage.label)}>
                  {stage.label}
                </button>
              ))}
            </div>
=======
function StatCard({ value, label, helper, tone = "purple" }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-decoration" />

      <div className="stat-icon" aria-hidden="true">
        {tone === "purple"
          ? "✦"
          : tone === "cyan"
            ? "↗"
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df

            <div className="candidate-table-container">
              <table className="candidate-table">
                <thead>
                  <tr><th>Candidate</th><th>Position</th><th>Source</th><th>Recruiter</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {funnelCandidates.length > 0 ? (
                    funnelCandidates.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.position}</td>
                        <td>{c.source}</td>
                        <td>{c.recruiter}</td>
                        <td>{c.status}</td>
                        <td><button className="candidate-view-btn" onClick={() => setSelectedCandidate(c)}>View</button></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "30px", color: "#9995ae" }}>No sample candidates are available for this stage.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

<<<<<<< HEAD
            <div className="candidate-modal-footer">
              <button className="candidate-close-btn" onClick={() => setFunnelStage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CANDIDATE DETAILS MODAL ===================== */}
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
              <div className="candidate-detail-item"><strong>POSITION</strong><span>{selectedCandidate.position}</span></div>
              <div className="candidate-detail-item"><strong>EXPERIENCE</strong><span>{selectedCandidate.experience}</span></div>
              <div className="candidate-detail-item"><strong>SOURCE</strong><span>{selectedCandidate.source}</span></div>
              <div className="candidate-detail-item"><strong>STAGE</strong><span>{selectedCandidate.stage}</span></div>
              <div className="candidate-detail-item"><strong>RECRUITER</strong><span>{selectedCandidate.recruiter}</span></div>
              <div className="candidate-detail-item"><strong>LOCATION</strong><span>{selectedCandidate.location}</span></div>
              <div className="candidate-detail-item"><strong>EMAIL</strong><span>{selectedCandidate.email}</span></div>
              <div className="candidate-detail-item"><strong>PHONE</strong><span>{selectedCandidate.phone}</span></div>
            </div>

            <div className="candidate-modal-footer">
              <button className="candidate-close-btn" onClick={() => setSelectedCandidate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
=======
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
>>>>>>> 373eaeb8177807b19e77cf59e0c722729185e2df
    </div>
  );
}