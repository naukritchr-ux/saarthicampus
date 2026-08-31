import campusBg from "../assets/campus-bg.png";
import logoImg from "../assets/saarthi-logo-transparent.png";
import {
  Briefcase,
  Building2,
  ShieldCheck,
  ClipboardCheck,
  ListChecks,
  CalendarClock,
  BarChart3,
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCog,
  Settings,
  Activity,
  Database,
  Cpu,
  TrendingUp,
  Layers,
  ArrowRight,
} from "lucide-react";

const cards = [
  {
    role: "Recruiter",
    icon: Briefcase,
    path: "/login/recruiter",
    ringColor: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    buttonColor: "linear-gradient(90deg, #7C3AED, #9333EA)",
    desc: "Post jobs, review candidates and manage your hiring pipeline.",
    features: [
      { icon: ClipboardCheck, label: "Post & Manage Jobs" },
      { icon: Users, label: "Review Candidates" },
      { icon: ListChecks, label: "Track Applications" },
      { icon: CalendarClock, label: "Schedule Interviews" },
      { icon: BarChart3, label: "Analytics & Reports" },
    ],
    featureColor: "#8B5CF6",
  },
  {
    role: "Corporate",
    icon: Building2,
    path: "/login/corporate",
    ringColor: "linear-gradient(135deg, #22B8CF, #0E7C99)",
    buttonColor: "linear-gradient(90deg, #0E7C99, #22B8CF)",
    desc: "Manage company profile, jobs, and recruitment activities.",
    features: [
      { icon: LayoutDashboard, label: "Company Dashboard" },
      { icon: ClipboardList, label: "Manage Job Postings" },
      { icon: ClipboardCheck, label: "View Applications" },
      { icon: UserCog, label: "Team Management" },
      { icon: BarChart3, label: "Reports & Analytics" },
    ],
    featureColor: "#0E7C99",
  },
  {
    role: "Admin",
    icon: ShieldCheck,
    path: "/login/admin",
    ringColor: "linear-gradient(135deg, #F0508B, #E11D74)",
    buttonColor: "linear-gradient(90deg, #E11D74, #F0508B)",
    desc: "Manage platform users, roles, permissions and system settings.",
    features: [
      { icon: Users, label: "User Management" },
      { icon: ShieldCheck, label: "Role & Permissions" },
      { icon: Settings, label: "System Settings" },
      { icon: Activity, label: "Activity Logs" },
      { icon: Database, label: "Data & Reports" },
    ],
    featureColor: "#E11D74",
  },
];

const trustItems = [
  { icon: ShieldCheck, title: "Secure & Compliant", sub: "Enterprise-grade security", color: "#8B5CF6" },
  { icon: Cpu, title: "AI Powered", sub: "Smart matching & insights", color: "#22B8CF" },
  { icon: TrendingUp, title: "Real-time Analytics", sub: "Data-driven decisions", color: "#F0508B" },
  { icon: Layers, title: "Scalable Platform", sub: "Built for your growth", color: "#8B5CF6" },
];

export default function SaarthiCampusLanding() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundImage: `url(${campusBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "local",
        backgroundColor: "#eeecfb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1280 }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 56 }}>
          <img
            src={logoImg}
            alt="Saarthi Campus"
            style={{
              display: "block",
              height: 72,
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        {/* heading + cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,2.6fr)",
            gap: 40,
            alignItems: "start",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 44, fontWeight: 800, lineHeight: 1.15, color: "#0f172a" }}>
              Welcome to
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #7C3AED, #3B82F6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Saarthi Campus
              </span>
            </h1>
            <div style={{ marginTop: 16, height: 4, width: 64, borderRadius: 999, background: "linear-gradient(90deg, #7C3AED, #3B82F6)" }} />
            <p style={{ marginTop: 24, fontSize: 16, color: "#475569", lineHeight: 1.6 }}>
              Smart recruitment. Better connections.
              <br />
              One platform for all your hiring needs.
            </p>
            <p style={{ marginTop: 32, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
              Choose your login to continue
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 24,
            }}
          >
            {cards.map(({ role, icon: Icon, path, ringColor, buttonColor, desc, features, featureColor }) => (
              <div
                key={role}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 18,
                  background: "#fff",
                  padding: 28,
                  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: ringColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                    marginBottom: 18,
                  }}
                >
                  <Icon size={28} />
                </div>
                <h3 style={{ margin: "0 0 10px", fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
                  {role} Login
                </h3>
                <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>
                  {desc}
                </p>
                <div style={{ borderTop: "1px dashed #e2e8f0", margin: "0 0 18px" }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", flex: 1 }}>
                  {features.map(({ icon: FIcon, label }) => (
                    <li key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#334155", padding: "6px 0" }}>
                      <FIcon size={17} color={featureColor} style={{ flexShrink: 0 }} />
                      {label}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => { window.location.href = path; }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 12,
                    border: "none",
                    padding: "14px 16px",
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: "#fff",
                    background: buttonColor,
                    cursor: "pointer",
                  }}
                >
                  Login as {role}
                  <ArrowRight size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* trust strip */}
        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            borderRadius: 18,
            background: "rgba(255,255,255,0.95)",
            padding: "26px 28px",
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          }}
        >
          {trustItems.map(({ icon: Icon, title, sub, color }, i) => (
            <div
              key={title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderLeft: i === 0 ? "none" : "1px solid #f1f5f9",
                paddingLeft: i === 0 ? 0 : 24,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${color}1A`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color,
                  flexShrink: 0,
                }}
              >
                <Icon size={21} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 40, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
          © 2026 Saarthi Campus. All rights reserved.
        </p>
      </div>
    </div>
  );
}