import campusBg from "../assets/campus-bg.png";
import logoImg from "../assets/saarthi-logo-transparent.png";
import "./LoginSelect.css";
import {
  Building2,
  ShieldCheck,
  Briefcase,
  Search,
  CheckSquare,
  Users,
  BarChart3,
  Shield,
  Settings,
  Activity,
  FileSpreadsheet,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export default function SaarthiCampusLanding() {
  return (
    <div
      className="sc-page-root"
      style={{ backgroundImage: `url(${campusBg})` }}
    >
      <div className="sc-content-container">
        {/* Top Header / Logo */}
        <header className="sc-brand-header">
          <img
            src={logoImg}
            alt="Saarthi Campus Logo"
            className="sc-brand-logo"
          />
        </header>

        {/* Main Hero Row: Left Welcome + Right Cards */}
        <main className="sc-hero-row">
          {/* Left Column: Heading, Bar, 2-line Subtitle */}
          <section className="sc-hero-left">
            <h1 className="sc-hero-title-black">Welcome to</h1>
            <h1 className="sc-hero-title-purple">Saarthi Campus</h1>
            <div className="sc-hero-bar" />
            <p className="sc-hero-subtitle">
              Smart recruitment. Better connections.
              <br />
              One platform for all your hiring needs.
            </p>
          </section>

          {/* Right Column: Corporate Login & Admin Login Cards */}
          <section className="sc-cards-deck">
            {/* Corporate Login Card */}
            <div className="sc-portal-card">
              <div className="sc-portal-icon-circle sc-icon-teal">
                <Building2 size={26} strokeWidth={2.2} />
              </div>
              <h2 className="sc-portal-title">Corporate Login</h2>
              <p className="sc-portal-desc">
                Manage company profile, jobs, and recruitment activities.
              </p>

              <ul className="sc-features-stack">
                <li className="sc-feature-row">
                  <Briefcase size={16} className="sc-feature-icon-teal" />
                  <span>Post & Manage Jobs</span>
                </li>
                <li className="sc-feature-row">
                  <Search size={16} className="sc-feature-icon-teal" />
                  <span>Candidate Search & Discovery</span>
                </li>
                <li className="sc-feature-row">
                  <CheckSquare size={16} className="sc-feature-icon-teal" />
                  <span>Group Discussion Management</span>
                </li>
                <li className="sc-feature-row">
                  <Users size={16} className="sc-feature-icon-teal" />
                  <span>Aptitude & Interviews</span>
                </li>
                <li className="sc-feature-row">
                  <BarChart3 size={16} className="sc-feature-icon-teal" />
                  <span>Reports & Analytics</span>
                </li>
              </ul>

              <a
                href="/login/corporate"
                className="sc-portal-button sc-btn-teal"
              >
                <span>Login as Corporate</span>
                <ArrowRight size={16} />
              </a>
            </div>

            {/* Admin Login Card */}
            <div className="sc-portal-card">
              <div className="sc-portal-icon-circle sc-icon-pink">
                <ShieldCheck size={26} strokeWidth={2.2} />
              </div>
              <h2 className="sc-portal-title">Admin Login</h2>
              <p className="sc-portal-desc">
                Manage platform users, roles, permissions and system settings.
              </p>

              <ul className="sc-features-stack">
                <li className="sc-feature-row">
                  <Users size={16} className="sc-feature-icon-pink" />
                  <span>User Management</span>
                </li>
                <li className="sc-feature-row">
                  <Shield size={16} className="sc-feature-icon-pink" />
                  <span>Role & Permissions</span>
                </li>
                <li className="sc-feature-row">
                  <Settings size={16} className="sc-feature-icon-pink" />
                  <span>System Settings</span>
                </li>
                <li className="sc-feature-row">
                  <Activity size={16} className="sc-feature-icon-pink" />
                  <span>Activity Logs</span>
                </li>
                <li className="sc-feature-row">
                  <FileSpreadsheet size={16} className="sc-feature-icon-pink" />
                  <span>Data & Reports</span>
                </li>
              </ul>

              <a
                href="/login/admin"
                className="sc-portal-button sc-btn-pink"
              >
                <span>Login as Admin</span>
                <ArrowRight size={16} />
              </a>
            </div>
          </section>
        </main>

        {/* Bottom Strip: Placement Coordinator Register & Student Apply */}
        <section className="sc-bottom-pill-bar">
          <a
            href="/placement-coordinator/register"
            className="sc-bottom-link-box"
          >
            <div className="sc-bottom-circle-icon sc-circle-purple">
              <Users size={22} />
            </div>
            <div className="sc-bottom-text-group">
              <span className="sc-bottom-title">College Placement Coordinator?</span>
              <span className="sc-bottom-action-purple">Register Here →</span>
            </div>
          </a>

          <div className="sc-bottom-bar-divider" />

          <a
            href="/apply"
            className="sc-bottom-link-box"
          >
            <div className="sc-bottom-circle-icon sc-circle-teal">
              <UserCheck size={22} />
            </div>
            <div className="sc-bottom-text-group">
              <span className="sc-bottom-title">Student / Candidate?</span>
              <span className="sc-bottom-action-purple">Apply for Jobs Here →</span>
            </div>
          </a>
        </section>

        {/* Subtle Minimal Footer */}
        <footer className="sc-simple-footer">
          © 2026 Saarthi Campus. A Talent Corner HR Services Platform.
        </footer>
      </div>
    </div>
  );
}
