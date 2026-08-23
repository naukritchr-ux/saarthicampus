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
    ringColor: "linear-gradient(135deg, #34D399, #059669)",
    buttonColor: "linear-gradient(90deg, #059669, #10B981)",
    desc: "Manage company profile, jobs, and recruitment activities.",
    features: [
      { icon: LayoutDashboard, label: "Company Dashboard" },
      { icon: ClipboardList, label: "Manage Job Postings" },
      { icon: ClipboardCheck, label: "View Applications" },
      { icon: UserCog, label: "Team Management" },
      { icon: BarChart3, label: "Reports & Analytics" },
    ],
    featureColor: "#059669",
  },
  {
    role: "Admin",
    icon: ShieldCheck,
    path: "/login/admin",
    ringColor: "linear-gradient(135deg, #FB923C, #EA580C)",
    buttonColor: "linear-gradient(90deg, #EA580C, #F97316)",
    desc: "Manage platform users, roles, permissions and system settings.",
    features: [
      { icon: Users, label: "User Management" },
      { icon: ShieldCheck, label: "Role & Permissions" },
      { icon: Settings, label: "System Settings" },
      { icon: Activity, label: "Activity Logs" },
      { icon: Database, label: "Data & Reports" },
    ],
    featureColor: "#EA580C",
  },
];

const trustItems = [
  { icon: ShieldCheck, title: "Secure & Compliant", sub: "Enterprise-grade security", color: "#8B5CF6" },
  { icon: Cpu, title: "AI Powered", sub: "Smart matching & insights", color: "#2563EB" },
  { icon: TrendingUp, title: "Real-time Analytics", sub: "Data-driven decisions", color: "#059669" },
  { icon: Layers, title: "Scalable Platform", sub: "Built for your growth", color: "#EA580C" },
];

export default function SaarthiCampusLanding() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundImage: `url(${campusBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1280 }}>
        {/* top bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <img
              src={logoImg}
              alt="Saarthi Logo"
              style={{
                display: "block",
                alignSelf: "center",
                height: 90,
                width: "auto",
                objectFit: "contain",
              }}
            />
            {/* <span style={{ fontSize: 22, fontWeight: 800, color: "#6c4e07" }}>Saarthi</span>
            <span
              style={{
                borderRadius: 999,
                background: "linear-gradient(90deg, #7C3AED, #4F46E5)",
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "#693906",
              }}
            >
              CAMPUS
            </span> */}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f3f8" }}>
              Powering Connections. Building Futures.
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              AI-Powered Campus Recruitment Platform
            </p>
          </div>
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
                  background: "linear-gradient(90deg, #320a4e40, #3e105f4e)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Saarthi Campus
              </span>
            </h1>
            <div style={{ marginTop: 16, height: 4, width: 64, borderRadius: 999, background: "linear-gradient(90deg, #7C3AED, #3B82F6)" }} />
            <p style={{ marginTop: 24, fontSize: 16, color: "#07090d", lineHeight: 1.6 }}>
              Smart recruitment. Better connections.
              <br />
              One platform for all your hiring needs.
            </p>
            <p style={{ marginTop: 32, fontSize: 14, fontWeight: 700, color: "#000000" }}>
              Choose your login to continue
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 20,
            }}
          >
            {cards.map(({ role, icon: Icon, path, ringColor, buttonColor, desc, features, featureColor }) => (
              <div
                key={role}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 16,
                  border: "1px solid #f1f5f9",
                  background: "#fff",
                  padding: 20,
                  boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
                }}
              >
                <div
                  style={{
                    margin: "0 auto",
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: ringColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                  }}
                >
                  <Icon size={28} />
                </div>
                <h3 style={{ marginTop: 16, marginBottom: 8, fontSize: 18, fontWeight: 800, textAlign: "center", color: "#0f172a" }}>
                  {role} Login
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.6, textAlign: "center", color: "#64748b", minHeight: 58 }}>
                  {desc}
                </p>
                <div style={{ borderTop: "1px dashed #e2e8f0", margin: "0 0 16px" }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", flex: 1 }}>
                  {features.map(({ icon: FIcon, label }) => (
                    <li key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", padding: "5px 0" }}>
                      <FIcon size={16} color={featureColor} style={{ flexShrink: 0 }} />
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
                    borderRadius: 10,
                    border: "none",
                    padding: "12px 16px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#fff",
                    background: buttonColor,
                    cursor: "pointer",
                  }}
                >
                  Login as {role}
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* trust strip */}
        <div
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 24,
            borderRadius: 16,
            border: "1px solid #f1f5f9",
            background: "rgba(255,255,255,0.92)",
            padding: 24,
            boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
          }}
        >
          {trustItems.map(({ icon: Icon, title, sub, color }) => (
            <div key={title} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color,
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{title}</p>
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