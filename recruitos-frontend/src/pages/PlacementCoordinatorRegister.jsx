import { useState, useEffect, useRef } from "react";
import SaarthiLogo from "../components/SaarthiLogo";
import { sanitizePhone } from "../lib/phone";
import { isValidEmail } from "../lib/email";
import { supabase } from "../lib/supabaseClient";

const COURSE_OPTIONS = [
  "MBA",
  "BBA",
  "BCA",
  "B.Tech",
  "MCA",
  "LLB",
  "Other",
];

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
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [otherCourseText, setOtherCourseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [copied, setCopied] = useState(false);

  // College search & selection state
  const [collegeSearch, setCollegeSearch] = useState("");
  const [collegeResults, setCollegeResults] = useState([]);
  const [searchingColleges, setSearchingColleges] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [isAddingNewCollege, setIsAddingNewCollege] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Debounced search for colleges (Requires at least 2 characters)
  useEffect(() => {
    let cancel = false;
    const term = collegeSearch.trim();

    if (term.length < 2) {
      setCollegeResults([]);
      setSearchingColleges(false);
      setSearchPerformed(false);
      setSearchError(null);
      return;
    }

    setSearchingColleges(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
        const res = await fetch(`${backendUrl}/api/colleges/public-search?q=${encodeURIComponent(term)}`);
        if (!cancel && res.ok) {
          const data = await res.json();
          setCollegeResults(Array.isArray(data) ? data : []);
          setSearchPerformed(true);
        } else if (!cancel) {
          // Client fallback to Supabase query
          const { data, error } = await supabase
            .from("colleges")
            .select("id, name, city, state, course, website")
            .or(`name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`)
            .limit(20);
          if (!cancel) {
            if (error) {
              setSearchError(error.message);
            } else {
              setCollegeResults(data || []);
            }
            setSearchPerformed(true);
          }
        }
      } catch {
        if (!cancel) {
          try {
            const { data, error } = await supabase
              .from("colleges")
              .select("id, name, city, state, course, website")
              .or(`name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`)
              .limit(20);
            if (!cancel) {
              if (error) {
                setSearchError(error.message);
              } else {
                setCollegeResults(data || []);
              }
              setSearchPerformed(true);
            }
          } catch {
            if (!cancel) {
              setCollegeResults([]);
              setSearchError("Unable to search colleges. You can add your institution manually.");
              setSearchPerformed(true);
            }
          }
        }
      } finally {
        if (!cancel) setSearchingColleges(false);
      }
    }, 250);

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [collegeSearch]);

  function handleSelectCollege(college) {
    setSelectedCollege(college);
    setIsAddingNewCollege(false);
    setShowDropdown(false);
    setCollegeSearch("");
    setCollegeResults([]);
    setSearchPerformed(false);
    setSearchError(null);
    setForm((prev) => ({
      ...prev,
      college_name: college.name,
      city: college.city || prev.city || "",
      state: college.state || prev.state || "",
      website: college.website || prev.website || "",
      category: college.course || prev.category,
    }));
  }

  function handleStartAddNewCollege() {
    setIsAddingNewCollege(true);
    setSelectedCollege(null);
    setShowDropdown(false);
    setForm((prev) => ({
      ...prev,
      college_name: collegeSearch.trim() || prev.college_name,
    }));
  }

  function handleClearSelectedCollege() {
    setSelectedCollege(null);
    setIsAddingNewCollege(false);
    setCollegeSearch("");
    setCollegeResults([]);
    setSearchPerformed(false);
    setSearchError(null);
    setShowDropdown(false);
    setForm((prev) => ({
      ...prev,
      college_name: "",
    }));
  }

  function handlePhoneChange(e) {
    setForm({ ...form, phone: sanitizePhone(e.target.value) });
  }

  function toggleCourse(course) {
    setSelectedCourses((prev) =>
      prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course]
    );
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
      setError("Please search and select your College, or choose 'Add your institution'.");
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
      setError("Please enter your institution's City.");
      return;
    }
    if (!form.state.trim()) {
      setError("Please select your institution's State.");
      return;
    }
    if (!form.category.trim()) {
      setError("Please select your College Category.");
      return;
    }

    const coursesList = selectedCourses
      .map((c) => (c === "Other" && otherCourseText.trim() ? otherCourseText.trim() : c))
      .filter(Boolean);

    const coursesAvailableStr = coursesList.length > 0 ? coursesList.join(", ") : null;

    setLoading(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const payload = {
        ...form,
        selected_college_id: selectedCollege ? selectedCollege.id : null,
        courses_available: coursesAvailableStr,
      };

      const res = await fetch(`${backendUrl}/api/placement-coordinator/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit registration. Please try again.");
      }

      setSubmittedData({
        name: form.full_name,
        college: form.college_name,
        email: form.official_email,
        courses: coursesAvailableStr,
        isExisting: Boolean(selectedCollege),
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
    maxWidth: 640,
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
              color: "#166534",
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
            {submittedData?.courses && (
              <div>• Courses Offered: <strong>{submittedData.courses}</strong></div>
            )}
            <div>
              • Institution: <strong>{submittedData?.college}</strong>{" "}
              {submittedData?.isExisting ? (
                <span style={{ color: "#16a34a", fontWeight: 700 }}>(Linked to Existing College)</span>
              ) : (
                <span style={{ color: "#2563eb", fontWeight: 700 }}>(New Institution Record Pending Verification)</span>
              )}
            </div>
            <div>• Status: <span style={{ color: "#d97706", fontWeight: 700 }}>Pending Admin Review</span></div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setForm(emptyForm);
                setSelectedCourses([]);
                setOtherCourseText("");
                setSelectedCollege(null);
                setIsAddingNewCollege(false);
                setCollegeSearch("");
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
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid #c7d2fe",
              background: copied ? "#dcfce7" : "#eef2ff",
              color: copied ? "#16a34a" : "#4338ca",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {copied ? "✓ Link Copied" : "🔗 Share Link"}
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
            Placement Coordinator Onboarding
          </h1>
          <p style={{ fontSize: 13.5, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            Register your institution's placement cell with Saarthi Campus to unlock AI-driven campus recruitment drives.
          </p>
        </div>

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

          {/* College Name Selection & Search */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              College / University Name *
            </label>

            {selectedCollege ? (
              /* State A: Existing College Selected */
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  borderRadius: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    ✓ Linked Existing Institution
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                    {selectedCollege.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>
                    📍 {[selectedCollege.city, selectedCollege.state].filter(Boolean).join(", ") || "Location on record"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelectedCollege}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Change
                </button>
              </div>
            ) : isAddingNewCollege ? (
              /* State B: Adding New Institution */
              <div
                style={{
                  padding: "16px",
                  background: "#f8fafc",
                  border: "1.5px dashed #cbd5e1",
                  borderRadius: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                      Enter Institution Details
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Please provide your institution's name and location for verification and directory onboarding.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewCollege(false);
                      setCollegeSearch("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6327BD",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    ← Search Directory
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    College / University Name *
                  </label>
                  <input
                    type="text"
                    value={form.college_name}
                    onChange={(e) => setForm({ ...form, college_name: e.target.value })}
                    placeholder="e.g. Apex Institute of Management & Technology"
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13.5,
                      boxSizing: "border-box",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                      City *
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="e.g. Mumbai, Pune, Lucknow"
                      required
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 13.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
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
              </div>
            ) : (
              /* State C: Search Input with Dropdown */
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={collegeSearch}
                    onChange={(e) => {
                      setCollegeSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => {
                      if (collegeSearch.trim().length >= 2) {
                        setShowDropdown(true);
                      }
                    }}
                    placeholder="Search existing college directory by name, city..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      paddingRight: searchingColleges ? 90 : (collegeSearch ? 36 : 12),
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13.5,
                      boxSizing: "border-box",
                    }}
                  />
                  {searchingColleges && (
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 12,
                        color: "#6327BD",
                        fontWeight: 600,
                      }}
                    >
                      Searching…
                    </span>
                  )}
                  {!searchingColleges && collegeSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCollegeSearch("");
                        setShowDropdown(false);
                        setCollegeResults([]);
                        setSearchPerformed(false);
                      }}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        fontSize: 13,
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: 4,
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Direct action helper row below input (accessible without popup covering fields) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 6,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  <span>Type at least 2 characters to search</span>
                  <button
                    type="button"
                    onClick={handleStartAddNewCollege}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6327BD",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    College not found? Add your institution
                  </button>
                </div>

                {/* Dropdown Menu - only displayed after user enters >= 2 chars */}
                {showDropdown && collegeSearch.trim().length >= 2 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      background: "#ffffff",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                      zIndex: 100,
                      maxHeight: 260,
                      overflowY: "auto",
                    }}
                  >
                    {/* 1. Loading State */}
                    {searchingColleges && (
                      <div
                        style={{
                          padding: "14px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: "#6327BD",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>⏳</span>
                        Searching directory for "{collegeSearch.trim()}"…
                      </div>
                    )}

                    {/* 2. Error State */}
                    {!searchingColleges && searchError && (
                      <div>
                        <div style={{ padding: "12px 14px", fontSize: 13, color: "#b91c1c", background: "#fef2f2" }}>
                          ⚠️ {searchError}
                        </div>
                        <div
                          onClick={handleStartAddNewCollege}
                          style={{
                            padding: "12px 14px",
                            background: "#faf5ff",
                            borderTop: "1px solid #f3e8ff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 16 }}>➕</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#6327BD" }}>
                              College not found? Add your institution
                            </div>
                            <div style={{ fontSize: 11.5, color: "#7c3aed" }}>
                              Enter institution details manually
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Matching Colleges Found */}
                    {!searchingColleges && !searchError && searchPerformed && collegeResults.length > 0 && (
                      <>
                        <div
                          style={{
                            padding: "8px 14px",
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "#64748b",
                            background: "#f8fafc",
                            borderBottom: "1px solid #f1f5f9",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Matching Colleges ({collegeResults.length})
                        </div>
                        {collegeResults.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCollege(c)}
                            style={{
                              padding: "10px 14px",
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                          >
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                              📍 {[c.city, c.state].filter(Boolean).join(", ") || "Location on record"}
                            </div>
                          </div>
                        ))}

                        <div
                          onClick={handleStartAddNewCollege}
                          style={{
                            padding: "11px 14px",
                            background: "#faf5ff",
                            borderTop: "1.5px solid #f1f5f9",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f3e8ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#faf5ff")}
                        >
                          <span style={{ fontSize: 15 }}>➕</span>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6327BD" }}>
                              College not found? Add your institution
                            </div>
                            <div style={{ fontSize: 11, color: "#7c3aed" }}>
                              Not in this list? Enter details manually
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* 4. No Matches Found (only after search finished) */}
                    {!searchingColleges && !searchError && searchPerformed && collegeResults.length === 0 && (
                      <>
                        <div style={{ padding: "14px 16px", textAlign: "center", background: "#f8fafc" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#334155", marginBottom: 2 }}>
                            No matching colleges found
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            No institutions found matching "{collegeSearch.trim()}"
                          </div>
                        </div>

                        <div
                          onClick={handleStartAddNewCollege}
                          style={{
                            padding: "12px 16px",
                            background: "#faf5ff",
                            borderTop: "1.5px solid #e9d5ff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f3e8ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#faf5ff")}
                        >
                          <span style={{ fontSize: 16 }}>➕</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#6327BD" }}>
                              College not found? Add your institution
                            </div>
                            <div style={{ fontSize: 11.5, color: "#7c3aed" }}>
                              Enter details to submit your institution for review
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
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

          {/* City & State (shown when an existing college is selected or before selection, but disabled if selected) */}
          {selectedCollege && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                  City *
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="City"
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
          )}

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

          {/* Courses Available Multi-Select */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Courses Available <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b" }}>(Optional - select degree programs offered)</span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: selectedCourses.includes("Other") ? 8 : 0 }}>
              {COURSE_OPTIONS.map((course) => {
                const isSelected = selectedCourses.includes(course);
                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => toggleCourse(course)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? "1.5px solid #6327BD" : "1px solid #cbd5e1",
                      background: isSelected ? "#ede9fe" : "#f8fafc",
                      color: isSelected ? "#6327BD" : "#334155",
                      cursor: "pointer",
                      transition: "all 0.15s ease-in-out",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {isSelected ? "✓" : "+"} {course}
                  </button>
                );
              })}
            </div>

            {selectedCourses.includes("Other") && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  value={otherCourseText}
                  onChange={(e) => setOtherCourseText(e.target.value)}
                  placeholder="Specify other courses (e.g. B.Com, M.Tech, Pharmacy, B.Des)..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #a78bfa",
                    background: "#faf5ff",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
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
        </form>
      </div>
    </div>
  );
}
