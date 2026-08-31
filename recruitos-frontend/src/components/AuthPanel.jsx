import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import loginBg from "../assets/login-bg.png";
import SaarthiLogo from "./SaarthiLogo";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  BrainCircuit,
  TrendingUp,
} from "lucide-react";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Secure & Compliant",
    sub: "Enterprise-grade security for your data",
    bg: "linear-gradient(135deg, #A78BFA, #7C3AED)",
  },
  {
    icon: BrainCircuit,
    title: "AI Powered",
    sub: "Smart matching & insights",
    bg: "linear-gradient(135deg, #7DD3FC, #3B82F6)",
  },
  {
    icon: TrendingUp,
    title: "Real-time Analytics",
    sub: "Data-driven decisions for better hiring",
    bg: "linear-gradient(135deg, #86EFAC, #22C55E)",
  },
];

export default function AuthPanel({ role = "recruiter" }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [regForm, setRegForm] = useState({ name: "", email: "", password: "" });
  const [regStatus, setRegStatus] = useState("idle");
  const [regError, setRegError] = useState("");

  const roleLabel =
    role === "candidate"
      ? "Candidate"
      : role === "corporate"
        ? "Corporate"
        : role === "admin"
          ? "Admin"
          : "Recruiter";

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });

    if (error) {
      setLoginError(error.message);
      setLoggingIn(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, approved")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      setLoginError(profileError.message);
      setLoggingIn(false);
      return;
    }

    const actualRole = profile?.role;

    if (actualRole && actualRole !== role) {
      await supabase.auth.signOut();
      setLoginError(
        `This account is registered as "${actualRole}", not "${role}". Please log in from the ${actualRole} login page instead.`,
      );
      setLoggingIn(false);
      return;
    }

    window.location.href = "/app";
  }

  async function handleRegister(event) {
    event.preventDefault();
    setRegError("");
    setRegStatus("loading");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...regForm, role }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setRegStatus("done");
    } catch (error) {
      console.error("Registration error:", error);
      setRegError(error.message || "Registration failed");
      setRegStatus("idle");
    }
  }

  function resetRegistration() {
    setRegStatus("idle");
    setRegError("");
    setRegForm({ name: "", email: "", password: "" });
    setMode("login");
  }

  return (
    <div
      className="auth-hero-bg"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "100%",
        backgroundPosition: "left bottom",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#eef0fb",
      }}
    >
      <style>{`
        @media (max-width: 900px) {
          .auth-hero-bg {
            background-image: linear-gradient(160deg, #EEF0FB, #E0E7FF) !important;
          }
          .auth-left-col, .auth-right-col {
            padding: 32px 24px !important;
          }
          .auth-left-col {
            text-align: center;
            align-items: center !important;
          }
          .auth-right-col {
            justify-content: center !important;
          }
        }
        @media (max-width: 520px) {
          .auth-left-col, .auth-right-col {
            padding: 24px 16px !important;
          }
        }
      `}</style>
      <div style={{ display: "flex", flexWrap: "wrap", minHeight: "600px", flex: 1 }}>
      {/* left side */}
      <div
        className="auth-left-col"
        style={{
          flex: "1 1 480px",
          minWidth: 320,
          padding: "56px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          boxSizing: "border-box",
        }}
      >
        <div style={{ marginBottom: 40 }}>
          <SaarthiLogo size={72} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            width: "fit-content",
            background: "rgba(124,58,237,0.1)",
            color: "#7C3AED",
            fontWeight: 700,
            fontSize: 13.5,
            padding: "7px 16px",
            borderRadius: 999,
            marginBottom: 20,
          }}
        >
          Welcome to <Sparkles size={14} />
        </div>

        <h1 style={{ margin: 0, fontSize: 46, fontWeight: 800, lineHeight: 1.1, color: "#0f172a" }}>
          Saarthi
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #7C3AED, #4F46E5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Campus
          </span>
        </h1>
        <div style={{ marginTop: 18, height: 4, width: 64, borderRadius: 999, background: "linear-gradient(90deg, #7C3AED, #3B82F6)" }} />
        <p
          style={{
            marginTop: 24,
            fontSize: 16,
            fontWeight: 600,
            color: "#1e293b",
            lineHeight: 1.6,
            maxWidth: 380,
            width: "fit-content",
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(4px)",
            padding: "10px 16px",
            borderRadius: 12,
          }}
        >
          Smart recruitment. Better connections.
          <br />
          One platform for all your hiring needs.
        </p>
      </div>

      {/* right side — floating card */}
      <div
        className="auth-right-col"
        style={{
          flex: "1 1 420px",
          minWidth: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "56px 40px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(10px)",
            borderRadius: 24,
            padding: "48px 44px",
            width: "100%",
            maxWidth: 500,
            boxShadow: "0 30px 70px rgba(76,29,149,0.14)",
          }}
        >
          {mode === "login" && (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: "rgba(124,58,237,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={30} color="#7C3AED" />
                </div>
              </div>

              <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#0f172a", textAlign: "center" }}>
                {roleLabel} Login
              </h2>
              <div style={{ margin: "0 auto 12px", height: 3, width: 44, borderRadius: 999, background: "linear-gradient(90deg, #7C3AED, #3B82F6)" }} />
              <p style={{ margin: "0 0 28px", fontSize: 14, color: "#64748b", textAlign: "center" }}>
                Log in to continue to your workspace
              </p>

              <form onSubmit={handleLogin}>
                <label
                  htmlFor="login-email"
                  style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}
                >
                  Email Address
                </label>
                <div style={{ position: "relative", marginBottom: 20 }}>
                  <Mail size={17} color="#94a3b8" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 16px 14px 46px",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 14.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <label
                  htmlFor="login-password"
                  style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}
                >
                  Password
                </label>
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <Lock size={17} color="#94a3b8" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 46px 14px 46px",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 14.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                      display: "flex",
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: "#7C3AED", width: 15, height: 15 }} />
                    Remember me
                  </label>
                  <a href="#" style={{ fontSize: 13.5, color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}>
                    Forgot password?
                  </a>
                </div>

                {loginError && (
                  <p style={{ color: "#dc2626", fontSize: 12.5, marginBottom: 14 }} role="alert">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loggingIn}
                  style={{
                    width: "100%",
                    padding: "15px 0",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(90deg, #7C3AED, #4F46E5)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: loggingIn ? "default" : "pointer",
                    opacity: loggingIn ? 0.75 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 10px 24px rgba(124,58,237,0.3)",
                  }}
                >
                  {loggingIn ? "Checking..." : "Log In"}
                  {!loggingIn && <ArrowRight size={18} />}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setMode("register")}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  marginTop: 22,
                  background: "none",
                  border: "none",
                  fontSize: 13.5,
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                New here? <span style={{ color: "#7C3AED", fontWeight: 700 }}>Create an account</span>
              </button>
            </>
          )}

          {mode === "register" && (
            <>
              {regStatus === "done" ? (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "#DCFCE7",
                      color: "#16A34A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      margin: "0 auto 18px",
                    }}
                  >
                    ✓
                  </div>
                  <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                    {role === "candidate" ? "Account Created!" : "Request Submitted"}
                  </h2>
                  <p style={{ margin: "0 0 26px", fontSize: 14, color: "#64748b" }}>
                    {role === "candidate"
                      ? "You're registered. You can now log in."
                      : "An admin has been notified. You'll be able to log in once approved."}
                  </p>
                  <button
                    type="button"
                    onClick={resetRegistration}
                    style={{
                      width: "100%",
                      padding: "15px 0",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(90deg, #7C3AED, #4F46E5)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: "pointer",
                    }}
                  >
                    Go to Login
                  </button>
                </div>
              ) : (
                <>
                  <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#0f172a", textAlign: "center" }}>
                    {roleLabel} Sign Up
                  </h2>
                  <p style={{ margin: "0 0 28px", fontSize: 14, color: "#64748b", textAlign: "center" }}>
                    Submit your details for admin review
                  </p>

                  <form onSubmit={handleRegister}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={regForm.name}
                      onChange={(event) => setRegForm({ ...regForm, name: event.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 14.5,
                        boxSizing: "border-box",
                        marginBottom: 18,
                      }}
                    />

                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={regForm.email}
                      onChange={(event) => setRegForm({ ...regForm, email: event.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 14.5,
                        boxSizing: "border-box",
                        marginBottom: 18,
                      }}
                    />

                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      value={regForm.password}
                      onChange={(event) => setRegForm({ ...regForm, password: event.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 14.5,
                        boxSizing: "border-box",
                        marginBottom: 8,
                      }}
                    />

                    {regError && (
                      <p style={{ color: "#dc2626", fontSize: 12.5, marginTop: 6, marginBottom: 6 }} role="alert">
                        {regError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={regStatus === "loading"}
                      style={{
                        width: "100%",
                        marginTop: 14,
                        padding: "15px 0",
                        borderRadius: 12,
                        border: "none",
                        background: "linear-gradient(90deg, #7C3AED, #4F46E5)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: regStatus === "loading" ? "default" : "pointer",
                        opacity: regStatus === "loading" ? 0.75 : 1,
                        boxShadow: "0 10px 24px rgba(124,58,237,0.3)",
                      }}
                    >
                      {regStatus === "loading" ? "Submitting..." : "Create Account"}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "center",
                      marginTop: 22,
                      background: "none",
                      border: "none",
                      fontSize: 13.5,
                      color: "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    Already have an account? <span style={{ color: "#7C3AED", fontWeight: 700 }}>Log in</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      </div>

      {/* trust strip — full-width white bar, always clear of the artwork */}
      <div
        style={{
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(6px)",
          padding: "22px 48px",
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          justifyContent: "center",
        }}
      >
        {trustItems.map(({ icon: Icon, title, sub, bg }) => (
          <div key={title} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
                boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
              }}
            >
              <Icon size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>{title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}