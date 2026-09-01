import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import CampusDB from "./pages/CampusDB";
import CorpDB from "./pages/CorpDB";
import Jobs from "./pages/Jobs";
import Resume from "./pages/Resume";
import Aptitude from "./pages/Aptitude";
import Interview from "./pages/Interview";
import Offers from "./pages/Offers";
import Joining from "./pages/Joining";
import Comm from "./pages/Comm";
import Reports from "./pages/Reports";
import Apply from "./pages/Apply";
import Pipeline from "./pages/Pipeline";
import GDAdmin from "./pages/GDAdmin";
import GDRoom from "./pages/GDRoom";
import AIInterview from "./pages/AIInterview";
import ThemeToggle from "./components/ThemeToggle";
import AptitudeTest from "./pages/Aptitude";
import UserManagement from "./pages/UserManagement";
import AuthPanel from "./components/AuthPanel";
import CallRecord from "./pages/CallRecord";
import SaarthiLogo from "./components/SaarthiLogo";
import LoginSelect from "./pages/LoginSelect";
import CorporateDashboard from "./pages/CorporateDashboard";
import Notifications from "./pages/Notifications";
import CalendarTasks from "./pages/CalendarTasks";
import BidPortal from "./pages/BidPortal";
import CandidateDB from "./pages/CandidateDB";
import Approvals from "./pages/Approvals";
import Documents from "./pages/Documents";
import AdminDashboard from "./pages/AdminDashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import CompanyProfile from "./pages/CompanyProfile";
import CandidateSearch from "./pages/CandidateSearch";
import HiringAnalytics from "./pages/HiringAnalytics";
import RecruiterReports from "./pages/RecruiterReports";
import CorporateReports from "./pages/CorporateReports";

// Pages available to admin
const pages = {
  dashboard: Dashboard,
  adminDashboard: AdminDashboard,
  campusdb: CampusDB,
  corpdb: CorpDB,
  candidatedb: CandidateDB,
  jobs: Jobs,
  resume: Resume,
  aptitude: Aptitude,
  gd: GDAdmin,
  interview: Interview,
  offers: Offers,
  joining: Joining,
  comm: Comm,
  reports: Reports,
  pipeline: Pipeline,
  gdadmin: GDAdmin,
  gdroom: GDRoom,
  usermanagement: UserManagement,
  callrecords: CallRecord,
  notifications: Notifications,
  calendartasks: CalendarTasks,
  bidportal: BidPortal,
};

// Pages available to recruiter
const recruiterPages = {
  recruiterDashboard: RecruiterDashboard,
  campusdb: CampusDB,
  corpdb: CorpDB,
  jobs: Jobs,
  resume: Resume,
  aptitude: Aptitude,
  gd: GDAdmin,
  interview: Interview,
  offers: Offers,
  joining: Joining,
  pipeline: Pipeline,
  candidatedb: CandidateDB,
  comm: Comm,
  reports: Reports,          // ← ye line
  notifications: Notifications,
  calendartasks: CalendarTasks,
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileApproved, setProfileApproved] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkApproval = async () => {
      if (!session) {
        setProfileApproved(null);
        setUserRole(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("approved, role")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Could not check approval status:", error.message);
        setProfileApproved(false);
        setUserRole(null);
        return;
      }

      setProfileApproved(data?.approved === true);
      setUserRole(data?.role || "user");

      let initialPage = "dashboard";
      if (data?.role === "corporate") initialPage = "corporateDashboard";
      else if (data?.role === "admin") initialPage = "adminDashboard";
      else if (data?.role === "recruiter") initialPage = "recruiterDashboard";

      // Use replaceState (not pushState) here since this is the initial
      // landing page for the session, not a user-driven navigation —
      // we don't want a "back" press to just re-land on the same page.
      window.history.replaceState({ activePage: initialPage }, "");
      setActivePage(initialPage);
    };

    checkApproval();
  }, [session]);

  // Unread notification count — refreshes on session change and on
  // every navigation (so it clears once the Notifications page is
  // opened, since that page marks everything as read).
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!session) {
        setUnreadCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("read", false);

      if (!error) {
        setUnreadCount(count || 0);
      }
    };

    loadUnreadCount();
  }, [session, activePage]);

  // Keep `activePage` in sync with the browser's back/forward buttons.
  // Every call to handleSetActivePage() below pushes a history entry,
  // so pressing back/forward fires this popstate handler and restores
  // whichever page was active at that point in history.
  useEffect(() => {
    function handlePopState(e) {
      if (e.state?.activePage) {
        setActivePage(e.state.activePage);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Lock background scroll while the mobile sidebar drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  if (window.location.pathname.startsWith("/gd/")) {
    return <GDRoom />;
  }

  if (window.location.pathname === "/apply") {
    return <Apply />;
  }

  if (window.location.pathname.startsWith("/interview/")) {
    return <AIInterview />;
  }

  if (window.location.pathname.startsWith("/aptitude-test/")) {
    return <AptitudeTest />;
  }

  if (window.location.pathname === "/login") {
    return <LoginSelect />;
  }
  if (window.location.pathname === "/login/recruiter") {
    return <AuthPanel role="recruiter" />;
  }
  if (window.location.pathname === "/login/admin") {
    return <AuthPanel role="admin" />;
  }
  if (window.location.pathname === "/login/corporate") {
    return <AuthPanel role="corporate" />;
  }

  const currentPath = window.location.pathname;

  if (currentPath === "/app/campusdb") {
    return <CampusDB />;
  }

  if (currentPath === "/app/requirements") {
    return <Pipeline />;
  }

  if (currentPath === "/app/jobs") {
    return <Jobs />;
  }

  if (currentPath === "/app/resume") {
    return <Resume />;
  }

  if (currentPath === "/app/aptitude") {
    return <Aptitude />;
  }

  if (currentPath === "/app/interview") {
    return <Interview />;
  }

  if (currentPath === "/app/offers") {
    return <Offers />;
  }

  if (currentPath === "/app/joining") {
    return <Joining />;
  }

  const isAppRoute = window.location.pathname.startsWith("/app");

  if (window.location.pathname === "/") {
    return <LoginSelect />;
  }

  if (isAppRoute) {
    if (loading) {
      return null;
    }

    if (!session) {
      return <LoginSelect />;
    }

    if (profileApproved === null) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Checking approval status...
        </div>
      );
    }

    if (profileApproved === false) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div>
            <h2>Awaiting Approval</h2>
            <p style={{ color: "var(--text-muted)" }}>
              Your account is pending admin approval.
            </p>
            <button
              className="logout-link"
              onClick={() => supabase.auth.signOut()}
            >
              Log out
            </button>
          </div>
        </div>
      );
    }

    // Corporate-only pages
  
    // Corporate-only pages
    const corporatePages = {
      corporateDashboard: CorporateDashboard,
      companyProfile: CompanyProfile,
      jobs: Jobs,
      candidateSearch: CandidateSearch,
      hiringAnalytics: CorporateReports, 
      pipeline: Pipeline,
      resume: Resume,
      interview: Interview,
      offers: Offers,
      joining: Joining,
      approvals: Approvals,
      documents: Documents,
      notifications: Notifications,
    };

    let PageComponent;
    const sidebarRole =
      userRole === "corporate"
        ? "corporate"
        : userRole === "recruiter"
          ? "recruiter"
          : "admin";

    if (userRole === "corporate") {
      PageComponent =
        corporatePages[activePage] || corporatePages.corporateDashboard;
    } else if (userRole === "recruiter") {
      PageComponent = recruiterPages[activePage] || RecruiterDashboard;
    } else if (userRole === "admin") {
      PageComponent = pages[activePage] || AdminDashboard;
    } else {
      PageComponent = pages[activePage] || Dashboard;
    }

    // Every user-driven navigation pushes a new history entry so the
    // browser's back/forward buttons move between previously visited
    // pages within the app (see the popstate handler above).
    function handleSetActivePage(page) {
      window.history.pushState({ activePage: page }, "");
      setActivePage(page);
      setSidebarOpen(false);
    }

    return (
      <div id="screen-app" style={{ display: "block" }}>
        <div className="topbar">
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div
            className="brand"
            style={{
              display: "flex",
              alignItems: "center",
              height: "150%",
              minWidth: 170,
            }}
          >
            <SaarthiLogo
              size={75}
              className="theme-adaptive-logo"
              style={{
                transform: "scale(1.2)",
                transformOrigin: "left center",
              }}
            />
          </div>
          <div className="top-actions">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => handleSetActivePage("notifications")}
              aria-label="Notifications"
              style={{
                position: "relative",
                background: "rgba(124,58,237,0.08)",
                border: "none",
                borderRadius: 10,
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    minWidth: 16,
                    height: 16,
                    padding: "0 3px",
                    borderRadius: 999,
                    background: "#ef4444",
                    border: "2px solid #fff",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <span className="pill">Talent Corner Workspace</span>
            <span>{session.user.email}</span>
            <span
              className="logout-link"
              onClick={() => supabase.auth.signOut()}
            >
              Log out
            </span>
            <div className="avatar">SC</div>
          </div>
        </div>
        <div className="app">
          <div
            className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar
            activePage={activePage}
            setActivePage={handleSetActivePage}
            role={sidebarRole}
            className={sidebarOpen ? "open" : ""}
          />
          <div className="main">
            <PageComponent setActivePage={setActivePage} user={session.user} />
          </div>
        </div>
      </div>
    );
  }

  return <LoginSelect />;
}