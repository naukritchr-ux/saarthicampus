import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { getCandidates, uploadPhoto, uploadResume, openSecureDocument } from "../lib/api";
import { sanitizePhone } from "../lib/phone";
import { isValidEmail } from "../lib/email";
import AIImport from "../components/AIImport";
import CandidateAvatar from "../components/CandidateAvatar";

const degrees = ["All", "B.Tech", "BCA", "B.Sc", "MBA", "MCA"];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  college_other: "",
  degree: "",
  branch: "",
  cgpa: "",
  passing_year: "",
  active_backlogs: false,
  tenth_percentage: "",
  twelfth_percentage: "",
};

export default function CandidateDB() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [activeDegree, setActiveDegree] = useState("All");
  const [customDegree, setCustomDegree] = useState("");
  const [backlogFilter, setBacklogFilter] = useState("All");

  // Add candidate popup
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [resume, setResume] = useState(null);

  // Excel import
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const [showImport, setShowImport] = useState(false);

  // --------------------------------------------------
  // LOAD CANDIDATES
  // --------------------------------------------------

  async function loadCandidates() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCandidates();
      setCandidates(data || []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
      setError("Could not load candidates. Check your Supabase connection.");
    }
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCandidates();
        if (!ignore) setCandidates(data || []);
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load candidates:", err);
          setError("Could not load candidates. Check your Supabase connection.");
        }
      }
      if (!ignore) setLoading(false);
    }

    init();
    return () => { ignore = true; };
  }, []);

  // --------------------------------------------------
  // FILTERING
  // --------------------------------------------------

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase().trim();

    const matchSearch =
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.branch ?? "").toLowerCase().includes(q) ||
      (c.colleges?.name ?? c.college_other ?? "").toLowerCase().includes(q);

    const matchDegree =
      activeDegree === "All"
        ? true
        : activeDegree === "Other"
        ? customDegree.trim() === "" ||
          (c.degree ?? "").toLowerCase().includes(customDegree.toLowerCase().trim())
        : c.degree === activeDegree;

    const matchBacklog =
      backlogFilter === "All" ||
      (backlogFilter === "Yes" && c.active_backlogs) ||
      (backlogFilter === "No" && !c.active_backlogs);

    return matchSearch && matchDegree && matchBacklog;
  });

  // --------------------------------------------------
  // ADD CANDIDATE FORM
  // --------------------------------------------------

  function startAdd() {
    setForm(emptyForm);
    setPhoto(null);
    setResume(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setForm(emptyForm);
    setPhoto(null);
    setResume(null);
  }

  async function handleSaveCandidate(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter candidate name.");
      return;
    }
    if (!isValidEmail(form.email)) {
      alert("Please enter a valid email.");
      return;
    }

    setSaving(true);
    try {
      let photo_url = null;
      if (photo) photo_url = await uploadPhoto(photo);

      let resume_url = null;
      if (resume) resume_url = await uploadResume(resume);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || null,
        college_other: form.college_other || null,
        degree: form.degree || null,
        branch: form.branch || null,
        cgpa: form.cgpa ? Number(form.cgpa) : null,
        passing_year: form.passing_year ? Number(form.passing_year) : null,
        active_backlogs: !!form.active_backlogs,
        tenth_percentage: form.tenth_percentage ? Number(form.tenth_percentage) : null,
        twelfth_percentage: form.twelfth_percentage ? Number(form.twelfth_percentage) : null,
        photo_url,
        resume_url,
      };

      const { error } = await supabase.from("candidates").insert([payload]);
      if (error) throw error;

      await loadCandidates();
      cancelForm();
    } catch (err) {
      console.error("Failed to add candidate:", err);
      alert("Could not add candidate: " + err.message);
    }
    setSaving(false);
  }

  // --------------------------------------------------
  // DELETE CANDIDATE
  // --------------------------------------------------

  async function handleDeleteCandidate(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete candidate:", error);
      alert("Could not delete candidate. Check console for details.");
    } else {
      await loadCandidates();
    }
  }

  // --------------------------------------------------
  // EXCEL IMPORT
  // --------------------------------------------------

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const mapped = rows
          .map((r) => ({
            name: r.name || r.Name || "",
            email: r.email || r.Email || "",
            phone: r.phone || r.Phone || "",
            degree: r.degree || r.Degree || "",
            branch: r.branch || r.Branch || "",
            cgpa: r.cgpa || r.CGPA || "",
            passing_year: r.passing_year || r["Passing Year"] || "",
            college_other: r.college || r.College || "",
          }))
          .filter((r) => r.name && r.email);

        setImportRows(mapped);
      } catch (err) {
        console.error("Excel parsing failed:", err);
        alert("Could not read this Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleConfirmImport() {
    if (!importRows || importRows.length === 0) return;
    setImporting(true);

    let success = 0;
    let failed = 0;

    const records = importRows.map((row) => ({
      name: row.name,
      email: row.email,
      phone: row.phone || null,
      degree: row.degree || null,
      branch: row.branch || null,
      cgpa: row.cgpa ? Number(row.cgpa) : null,
      passing_year: row.passing_year ? Number(row.passing_year) : null,
      college_other: row.college_other || null,
    }));

    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase.from("candidates").insert(chunk);
      if (error) {
        failed += chunk.length;
        console.error("Failed to import chunk:", error);
      } else {
        success += chunk.length;
      }
    }

    setImporting(false);
    setImportResult({ success, failed });
    setImportRows(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await loadCandidates();
  }

  function cancelImport() {
    setImportRows(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="page active" id="page-candidatedb">
      {/* PAGE HEADER */}
      <div className="page-head">
        <div>
          <h1>Candidate Database</h1>
          <p>
            {loading ? "Loading…" : `${candidates.length} candidates`}
            {" · "}
            filter by degree, backlog status or search
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <button className="btn-outline" onClick={() => fileInputRef.current?.click()}>
            Import Excel
          </button>

          <button className="btn-outline" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "✕ Close Import" : "🤖 AI Import Excel/PDF"}
          </button>

          <button className="btn-gold" onClick={startAdd}>
            + Add Candidate
          </button>
        </div>
      </div>

      {/* AI IMPORT PANEL */}
      {showImport && (
        <div className="panel">
          <div className="panel-title">AI Import — Candidate Database</div>
          <div className="panel-sub">
            Upload any Excel or PDF with candidate data — AI will read and format it automatically
          </div>
          <AIImport
            type="candidate"
            onImported={() => {
              setShowImport(false);
              window.location.reload();
            }}
          />
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="panel" style={{ color: "crimson" }}>
          {error}
        </div>
      )}

      {/* IMPORT RESULT */}
      {importResult && (
        <div className="panel">
          <p>
            Import done: <b>{importResult.success}</b> added, <b>{importResult.failed}</b> failed.
          </p>
          <button className="btn-outline" onClick={() => setImportResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* IMPORT PREVIEW */}
      {importRows && (
        <div className="panel">
          <div className="panel-title">Preview — {importRows.length} rows found</div>
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Degree</th>
                <th>Branch</th>
              </tr>
              {importRows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.phone}</td>
                  <td>{r.degree}</td>
                  <td>{r.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {importRows.length > 10 && <p>...and {importRows.length - 10} more rows</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn-gold" onClick={handleConfirmImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${importRows.length} Candidates`}
            </button>
            <button className="btn-outline" onClick={cancelImport}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="panel">
        {/* DEGREE FILTERS */}
        <div>
          {degrees.map((d) => (
            <span
              key={d}
              className={`course-chip ${activeDegree === d ? "sel" : ""}`}
              onClick={() => setActiveDegree(d)}
            >
              {d}
            </span>
          ))}
          <span
            className={`course-chip ${activeDegree === "Other" ? "sel" : ""}`}
            onClick={() => setActiveDegree("Other")}
          >
            Other
          </span>
        </div>

        {activeDegree === "Other" && (
          <input
            className="search-box"
            placeholder="Type degree to search (e.g. B.Arch, M.Tech)..."
            value={customDegree}
            onChange={(e) => setCustomDegree(e.target.value)}
            style={{ marginTop: 10, maxWidth: 320 }}
          />
        )}

        {/* SEARCH + BACKLOG FILTER */}
        <div className="toolbar" style={{ marginTop: 16 }}>
          <input
            className="search-box"
            placeholder="Search name, email, branch, college..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {["All", "Yes", "No"].map((f) => (
            <span
              key={f}
              className={`filter-chip ${backlogFilter === f ? "sel" : ""}`}
              onClick={() => setBacklogFilter(f)}
            >
              {f === "All" ? "All Backlogs" : f === "Yes" ? "Has Backlog" : "No Backlog"}
            </span>
          ))}
        </div>

        {/* TABLE */}
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="data-table" style={{ width: "100%", minWidth: 1200 }}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>College</th>
                <th>Degree</th>
                <th>Branch</th>
                <th>CGPA</th>
                <th>Passing Year</th>
                <th>Backlogs</th>
                <th>10th %</th>
                <th>12th %</th>
                <th>Resume</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: "center", padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <CandidateAvatar photoUrl={c.photo_url} name={c.name} size={34} />
                    </td>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.email}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.colleges?.name || c.college_other || "—"}</td>
                    <td>{c.degree || "—"}</td>
                    <td>{c.branch || "—"}</td>
                    <td>{c.cgpa ?? "—"}</td>
                    <td>{c.passing_year || "—"}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: c.active_backlogs ? "#FDECEC" : "#E8F7EE",
                          color: c.active_backlogs ? "#c0392b" : "#16803A",
                        }}
                      >
                        {c.active_backlogs ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>{c.tenth_percentage ?? "—"}</td>
                    <td>{c.twelfth_percentage ?? "—"}</td>
                    <td>
                      {c.resume_url ? (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => openSecureDocument(c.resume_url)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "var(--primary)",
                            cursor: "pointer",
                            textDecoration: "underline",
                            font: "inherit",
                          }}
                        >
                          View
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-outline"
                        style={{ padding: "4px 10px", fontSize: 12, color: "crimson" }}
                        onClick={() => handleDeleteCandidate(c.id, c.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={14} style={{ textAlign: "center", color: "var(--slate-light)", padding: 24 }}>
                    No candidates found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD CANDIDATE POPUP */}
      {showForm && (
        <div
          onClick={cancelForm}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div className="panel-title" style={{ margin: 0 }}>Add New Candidate</div>
              <button
                onClick={cancelForm}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <input
                className="search-box"
                placeholder="Full Name *"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="search-box"
                placeholder="Email *"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="search-box"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })}
                inputMode="numeric"
                maxLength={10}
              />
              <input
                className="search-box"
                placeholder="College"
                value={form.college_other}
                onChange={(e) => setForm({ ...form, college_other: e.target.value })}
              />
              <select
                className="search-box"
                value={form.degree}
                onChange={(e) => setForm({ ...form, degree: e.target.value })}
              >
                <option value="">— Select Degree —</option>
                <option value="B.Tech">B.Tech</option>
                <option value="BCA">BCA</option>
                <option value="B.Sc">B.Sc</option>
                <option value="MBA">MBA</option>
                <option value="MCA">MCA</option>
                <option value="Other">Other</option>
              </select>
              <input
                className="search-box"
                placeholder="Branch"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              />
              <input
                className="search-box"
                placeholder="CGPA / %"
                type="number"
                step="0.01"
                value={form.cgpa}
                onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
              />
              <input
                className="search-box"
                placeholder="Passing Year"
                type="number"
                value={form.passing_year}
                onChange={(e) => setForm({ ...form, passing_year: e.target.value })}
              />
              <input
                className="search-box"
                placeholder="10th %"
                type="number"
                step="0.01"
                value={form.tenth_percentage}
                onChange={(e) => setForm({ ...form, tenth_percentage: e.target.value })}
              />
              <input
                className="search-box"
                placeholder="12th %"
                type="number"
                step="0.01"
                value={form.twelfth_percentage}
                onChange={(e) => setForm({ ...form, twelfth_percentage: e.target.value })}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active_backlogs}
                  onChange={(e) => setForm({ ...form, active_backlogs: e.target.checked })}
                  style={{ width: "auto" }}
                />
                <label style={{ margin: 0, fontSize: 12.5 }}>Has active backlogs</label>
              </div>

              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Photo</label>
                <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Resume (PDF)</label>
                <input type="file" accept=".pdf" onChange={(e) => setResume(e.target.files[0])} />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-gold" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Candidate"}
                </button>
                <button className="btn-outline" type="button" onClick={cancelForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}