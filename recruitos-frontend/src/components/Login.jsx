import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import campusBg from "../assets/campus-bg.png";
import {
  Briefcase,
  User,
  Building2,
  ShieldCheck,
  Search,
  ClipboardCheck,
  ListChecks,
  CalendarClock,
  BarChart3,
  Bell,
  LayoutDashboard,
  FileSpreadsheet,
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
  ArrowLeft,
} from "lucide-react";

const cards = [
  {
    role: "Recruiter",
    icon: Briefcase,
    ringColor: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    buttonColor: "linear-gradient(90deg, #7C3AED, #9333EA)",
    desc: "Post jobs, review candidates and manage your hiring pipeline.",
    tagline: "One platform to run every campus and corporate hiring drive, end to end.",
    meta: "From job profile to joining day — post roles, review candidates, schedule interviews, and track your pipeline, unified for Talent Corner.",
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
    role: "Candidate",
    icon: User,
    ringColor: "linear-gradient(135deg, #60A5FA, #2563EB)",
    buttonColor: "linear-gradient(90deg, #2563EB, #3B82F6)",
    desc: "Find opportunities, track applications and advance your career.",
    tagline: "Your next role, one application away.",
    meta: "Browse open positions, track your application status, and stay updated at every stage of your recruitment journey.",
    features: [
      { icon: Search, label: "Browse Jobs" },
      { icon: ListChecks, label: "Track Applications" },
      { icon: CalendarClock, label: "Interview Updates" },
      { icon: FileSpreadsheet, label: "Profile & Resume" },
      { icon: Bell, label: "Job Alerts" },
    ],
    featureColor: "#2563EB",
  },
  {
    role: "Corporate",
    icon: Building2,
    ringColor: "linear-gradient(135deg, #34D399, #059669)",
    buttonColor: "linear-gradient(90deg, #059669, #10B981)",
    desc: "Manage company profile, jobs, and recruitment activities.",
    tagline: "Your hiring pipeline, fully in your control.",
    meta: "Manage your company profile, post job openings, and review applications from candidates across campuses.",
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
    ringColor: "linear-gradient(135deg, #FB923C, #EA580C)",
    buttonColor: "linear-gradient(90deg, #EA580C, #F97316)",
    desc: "Manage platform users, roles, permissions and system settings.",
    tagline: "Full control over the Saarthi Campus platform.",
    meta: "Manage users, roles, permissions, and monitor activity across the entire recruitment platform.",
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

function ResponsiveStyles() {
  return (
    <style>{`
      .saarthi-layout-grid {
        display: grid;
        grid-template-columns: minmax(0,1fr) minmax(0,2.6fr);
        gap: 40px;
        align-items: start;
      }
      .saarthi-cards-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 20px;
      }
      .saarthi-trust-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 24px;
      }
      @media (max-width: 900px) {
        .saarthi-layout-grid {
          grid-template-columns: 1fr;
        }
        .saarthi-cards-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .saarthi-trust-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 520px) {
        .saarthi-cards-grid {
          grid-template-columns: 1fr;
        }
        .saarthi-trust-grid {
          grid-template-columns: 1fr;
        }
        .login-brand-side, .login-form-side {
          min-width: 100% !important;
        }
      }
    `}</style>
  );
}

function LoginForm({ card, onBack }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'register'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const Icon = card.icon;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, role: card.role.toLowerCase() } },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setMessage("Account created! Please check your email to confirm, then sign in.");
      }
    }
  }

  return (
    <>
      <ResponsiveStyles />
      <div id="screen-login" style={{ minHeight: "100vh", width: "100%", display: "flex", flexWrap: "wrap" }}>
        <div
          className="login-brand-side"
          style={{
            flex: 1,
            minWidth: 320,
            backgroundImage: `linear-gradient(135deg, rgba(15,10,40,0.82), rgba(15,10,40,0.72)), url(${campusBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: "#fff",
            padding: "48px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              fontSize: 12.5,
              cursor: "pointer",
              marginBottom: 32,
              padding: "7px 14px",
              borderRadius: 999,
              width: "fit-content",
            }}
          >
            <ArrowLeft size={14} /> Back to role selection
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: card.ringColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
              }}
            >
              <Icon size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Saarthi Campus</div>
              <div style={{ fontSize: 10.5, color: "#c4b5fd", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {card.role} Portal
              </div>
            </div>
          </div>

          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, maxWidth: 420 }}>
            {card.tagline}
          </div>
          <div style={{ fontSize: 14, color: "#d8d2f0", lineHeight: 1.7, maxWidth: 400, marginBottom: 36 }}>
            {card.meta}
          </div>

          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {card.features.slice(0, 3).map(({ icon: FIcon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#e5e0fa" }}>
                <FIcon size={16} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          className="login-form-side"
          style={{
            flex: 1,
            minWidth: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            className="login-card"
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "40px 36px",
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 28 }}>
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); setMessage(""); }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: mode === "signin" ? "#fff" : "transparent",
                  color: mode === "signin" ? "#0f172a" : "#64748b",
                  boxShadow: mode === "signin" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setMessage(""); }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: mode === "register" ? "#fff" : "transparent",
                  color: mode === "register" ? "#0f172a" : "#64748b",
                  boxShadow: mode === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Register
              </button>
            </div>

            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              {mode === "signin" ? `Welcome back, ${card.role}` : `Create your ${card.role} account`}
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "#64748b" }}>
              {mode === "signin"
                ? "Sign in to the Talent Corner workspace"
                : "Register to get started with Saarthi Campus"}
            </p>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {error && (
                <p style={{ color: "#d64545", fontSize: 12.5, marginTop: 6, marginBottom: 6 }}>{error}</p>
              )}
              {message && (
                <p style={{ color: "#059669", fontSize: 12.5, marginTop: 6, marginBottom: 6 }}>{message}</p>
              )}

              <button
                className="btn-primary"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "12px 0",
                  borderRadius: 10,
                  border: "none",
                  background: card.buttonColor,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14.5,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading
                  ? mode === "signin" ? "Signing in…" : "Creating account…"
                  : mode === "signin" ? `Login as ${card.role}` : "Create Account"}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 16 }}>
              {card.role} access only
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Login() {
  const [selectedRole, setSelectedRole] = useState(null);

  const selectedCard = cards.find((c) => c.role === selectedRole);
  if (selectedCard) {
    return <LoginForm card={selectedCard} onBack={() => setSelectedRole(null)} />;
  }

  return (
    <>
      <ResponsiveStyles />
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
                  <path d="M12 2 3 7l9 5 9-5-9-5Zm0 7L3 14v3l9 5 9-5v-3l-9 5-9-5V9Z" />
                </svg>
              </div>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Saarthi</span>
              <span
                style={{
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #7C3AED, #4F46E5)",
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "#fff",
                }}
              >
                CAMPUS
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                Powering Connections. Building Futures.
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                AI-Powered Campus Recruitment Platform
              </p>
            </div>
          </div>

          {/* heading + cards */}
          <div className="saarthi-layout-grid">
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
              <p style={{ marginTop: 32, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                Choose your login to continue
              </p>
            </div>

            <div className="saarthi-cards-grid">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.role}
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
                        background: card.ringColor,
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
                      {card.role} Login
                    </h3>
                    <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.6, textAlign: "center", color: "#64748b", minHeight: 58 }}>
                      {card.desc}
                    </p>
                    <div style={{ borderTop: "1px dashed #e2e8f0", margin: "0 0 16px" }} />
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", flex: 1 }}>
                      {card.features.map(({ icon: FIcon, label }) => (
                        <li key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", padding: "5px 0" }}>
                          <FIcon size={16} color={card.featureColor} style={{ flexShrink: 0 }} />
                          {label}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setSelectedRole(card.role)}
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
                        background: card.buttonColor,
                        cursor: "pointer",
                      }}
                    >
                      Login as {card.role}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* trust strip */}
          <div
            className="saarthi-trust-grid"
            style={{
              marginTop: 48,
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
    </>
  );
}