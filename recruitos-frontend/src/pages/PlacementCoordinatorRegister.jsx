import { useState } from "react";
import SaarthiLogo from "../components/SaarthiLogo";
import { sanitizePhone } from "../lib/phone";
import { isValidEmail } from "../lib/email";

const CATEGORIES = [
  "MBA/Management",
  "Engineering/Tech",
  "IT/Computer Applications",
  "Law",
  "Pharmacy",
  "Commerce/Arts",
  "Medical/Health Sciences",
  "Polytechnic/Diploma",
  "Other",
];

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi NCR", "Chandigarh", "Other Union Territory"
];

const emptyForm = {
  full_name: "",
  designation: "",
  college_name: "",
  official_email: "",
  phone: "",
  city: "",
  state: "",
  category: "MBA/Management",
  website: "",
  remarks: "",
};

export default function PlacementCoordinatorRegister() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [copied, setCopied] = useState(false);

  function handlePhoneChange(e) {
    setForm({ ...form, phone: sanitizePhone(e.target.value) });
  }

  function copyShareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Field-level validations
    if (!form.full_name.trim()) {
      setError("Please enter your Full Name.");
      return;
    }
    if (!form.designation.trim()) {
      setError("Please enter your Designation.");
      return;
    }
    if (!form.college_name.trim()) {
      setError("Please enter your College Name.");
      return;
    }
    if (!isValidEmail(form.official_email)) {
      setError("Please enter a valid Official Email address.");
      return;
    }
    if (!form.phone || form.phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!form.city.trim()) {
      setError("Please enter your City.");
      return;
    }
    if (!form.state.trim()) {
      setError("Please select your State.");
      return;
    }
    if (!form.category.trim()) {
      setError("Please select your College Category.");
      return;
    }

    setLoading(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/api/placement-coordinator/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit registration. Please try again.");
      }

      setSubmittedData({
        name: form.full_name,
        college: form.college_name,
        email: form.official_email,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const pageContainerStyle = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 620,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
  };

  // SUCCESS CONFIRMATION VIEW
  if (submitted) {
    return (
      <div style={pageContainerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 32px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 20px",
            }}
          >
            ✓
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", margin: "0 0 10px" }}>
            Registration Submitted!
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748b", lineHeight: 1.6, margin: "0 0 24px" }}>
            Thank you, <strong style={{ color: "#0f172a" }}>{submittedData?.name}</strong>.
            Your placement coordinator details for <strong style={{ color: "#0f172a" }}>{submittedData?.college}</strong> have been received.
          </p>

          <div
            style={{
              background: "#f1f5f9",
              borderRadius: 10,
              padding: "16px 20px",
              textAlign: "left",
              fontSize: 13,
              color: "#334155",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            <div>• Confirmation email sent to: <strong>{submittedData?.email}</strong></div>
            <div>• Our campus relations team will verify your institution and connect with you.</div>
            <div>• Status: <span style={{ color: "#d97706", fontWeight: 700 }}>Pending Admin Review</span></div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setForm(emptyForm);
                setSubmitted(false);
              }}
              style={{
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              + Submit Another Registration
            </button>

            <a
              href="/login"
              style={{
                background: "#6327BD",
                color: "#ffffff",
                padding: "10px 22px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Back to Home / Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // REGISTRATION FORM VIEW
  return (
    <div style={pageContainerStyle}>
      <div style={cardStyle}>
        {/* Header Branding */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SaarthiLogo size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e1b4b" }}>Saarthi Campus</div>
              <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Campus Placement Network
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={copyShareLink}
            title="Copy public link to share with other coordinators"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid #c7d2fe",
              background: copied ? "#dcfce7" : "#eef2ff",
              color: copied ? "#16a34a" : "#4338ca",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? "✓ Copied Link" : "🔗 Copy Form Link"}
          </button>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
          Placement Coordinator Registration
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px", lineHeight: 1.5 }}>
          Register your college Training & Placement Cell to connect your graduating students with corporate recruiters, schedule campus drives, and manage placements.
        </p>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "12px 16px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name & Designation */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Full Name *
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Dr. / Prof. / Mr. / Ms."
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Designation *
              </label>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. Head - TPO / Placement Officer"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* College Name */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              College / University Name *
            </label>
            <input
              type="text"
              value={form.college_name}
              onChange={(e) => setForm({ ...form, college_name: e.target.value })}
              placeholder="e.g. Indian Institute of Management / Technology"
              required
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13.5,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Email & Phone */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Official Email Address *
              </label>
              <input
                type="email"
                value={form.official_email}
                onChange={(e) => setForm({ ...form, official_email: e.target.value })}
                placeholder="tpo@college.edu.in"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Mobile / Contact Number *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={handlePhoneChange}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* City & State */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                City *
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Mumbai, Lucknow, Bhubaneswar"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                State *
              </label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              >
                <option value="">-- Select State --</option>
                {STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Website */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                College Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                College Website (optional)
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.college.edu.in"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Remarks / Placement Requirements (optional)
            </label>
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Number of students in graduating batch, preferred sectors/companies, upcoming drive timelines..."
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13.5,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {/* Submit Button */}
          <div style={{ marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#a78bfa" : "#6327BD",
                color: "#ffffff",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                boxShadow: "0 4px 12px rgba(99, 39, 189, 0.25)",
              }}
            >
              {loading ? "Submitting Registration…" : "Submit Coordinator Registration"}
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Already have an active coordinator account?{" "}
            <a href="/login" style={{ color: "#6327BD", fontWeight: 600, textDecoration: "none" }}>
              Sign In
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
