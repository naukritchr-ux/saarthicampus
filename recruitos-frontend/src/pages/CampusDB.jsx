import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { sanitizePhone } from "../lib/phone";
import { isValidEmail } from "../lib/email";
import AIImport from "../components/AIImport";

const courses = [
  "All",
  "Engineering",
  "MBA",
  "BCA",
  "BSc IT",
  "MCA",
  "Pharmacy",
  "Law",
  "Commerce",
  "Arts",
  "Medical",
  "Polytechnic",
  "Others",
];

const statusColors = {
  Interested: {
    bg: "#0fae72",
    text: "#ffffff",
  },
  "Follow-up Due": {
    bg: "#f2b705",
    text: "#513c04",
  },
  "Not Interested": {
    bg: "#e5e7eb",
    text: "#4b5563",
  },
};

const emptyForm = {
  name: "",
  city: "",
  course: "",
  tpo: "",
  website: "",
  strength: "",
  last_contact: "",
  status: "Interested",
  institution_type: "",
  courses_available: "",
};

export default function CampusDB() {
  const [activeCourse, setActiveCourse] = useState("All");
  const [customCourseText, setCustomCourseText] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Status");

  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add/Edit college popup
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Excel import
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Placement coordinators
  const [coordinatorsByCollege, setCoordinatorsByCollege] = useState({});
  const [loadingCoordinators, setLoadingCoordinators] = useState(false);

  // Coordinator add form inside Edit College popup
  const [showCoordinatorForm, setShowCoordinatorForm] = useState(false);
  const [coordForm, setCoordForm] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [showImport, setShowImport] = useState(false);
  const [savingCoord, setSavingCoord] = useState(false);

  // --------------------------------------------------
  // FETCH ALL COLLEGES
  // --------------------------------------------------

  async function fetchAllColleges() {
    const pageSize = 1000;
    let from = 0;
    let allRows = [];

    while (true) {
      const { data, error } = await supabase
        .from("colleges")
        .select("*")
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        throw error;
      }

      allRows = allRows.concat(data ?? []);

      if (!data || data.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return allRows;
  }

  async function loadColleges() {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchAllColleges();
      setColleges(data);
    } catch (err) {
      console.error("Failed to load colleges:", err);
      setError("Could not load colleges. Check your Supabase connection.");
    }

    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchAllColleges();

        if (ignore) return;

        setColleges(data);
      } catch (err) {
        if (ignore) return;

        console.error("Failed to load colleges:", err);

        setError("Could not load colleges. Check your Supabase connection.");
      }

      if (!ignore) {
        setLoading(false);
      }
    }

    init();

    return () => {
      ignore = true;
    };
  }, []);

  // --------------------------------------------------
  // FILTERING
  // --------------------------------------------------

  const filtered = colleges.filter((c) => {
    const courseValue = (c.course ?? "").toLowerCase().trim();
    const coursesAvailableValue = (c.courses_available ?? "").toLowerCase();

    let matchCourse;

    if (activeCourse === "All") {
      matchCourse = true;
    } else if (activeCourse === "Others") {
      const typed = customCourseText.toLowerCase().trim();
      // With nothing typed yet, "Others" shows colleges whose course
      // doesn't match any of the preset course names.
      const presetLower = courses
        .filter((c) => c !== "All" && c !== "Others")
        .map((c) => c.toLowerCase());
      matchCourse =
        typed === ""
          ? !presetLower.some(
              (p) => courseValue.includes(p) || coursesAvailableValue.includes(p),
            )
          : courseValue.includes(typed) || coursesAvailableValue.includes(typed);
    } else {
      const activeCourseValue = activeCourse.toLowerCase().trim();
      matchCourse =
        courseValue.includes(activeCourseValue) ||
        coursesAvailableValue.includes(activeCourseValue);
    }

    const q = search.toLowerCase().trim();

    const matchSearch =
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      (c.tpo ?? "").toLowerCase().includes(q);

    const matchStatus =
      activeFilter === "All Status" || c.status === activeFilter;

    return matchCourse && matchSearch && matchStatus;
  });

  // --------------------------------------------------
  // COLLEGE FORM
  // --------------------------------------------------

  function startEdit(c) {
    setEditingId(c.id);

    setForm({
      name: c.name || "",
      city: c.city || "",
      course: c.course || "",
      tpo: c.tpo || "",
      website: c.website || "",
      strength: c.strength ?? "",
      last_contact: c.last_contact || "",
      status: c.status || "Interested",
      institution_type: c.institution_type || "",
      courses_available: c.courses_available || "",
    });

    setShowCoordinatorForm(false);

    setCoordForm({
      name: "",
      phone: "",
      email: "",
    });

    setShowForm(true);

    // Load coordinators for this college
    loadCoordinators(c.id);
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);

    setShowCoordinatorForm(false);

    setCoordForm({
      name: "",
      phone: "",
      email: "",
    });

    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);

    setShowCoordinatorForm(false);

    setCoordForm({
      name: "",
      phone: "",
      email: "",
    });
  }

  async function handleSaveCollege(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter college name.");
      return;
    }

    if (form.tpo && form.tpo.trim() === "") {
      alert("Please enter a valid TPO name.");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      city: form.city?.trim() || null,
      course: form.course || null,
      tpo: form.tpo?.trim() || null,
      website: form.website?.trim() || null,
      strength: form.strength ? parseInt(form.strength, 10) : null,
      last_contact: form.last_contact || null,
      status: form.status,
      institution_type: form.institution_type?.trim() || null,
      courses_available: form.courses_available?.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("colleges")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.error("Failed to update college:", error);

        alert("Could not update college. Check console for details.");
      } else {
        await loadColleges();

        // Keep popup open after update so coordinator
        // section can still be used.
        setForm((prev) => ({
          ...prev,
          ...payload,
          strength: form.strength,
        }));
      }
    } else {
      const { data, error } = await supabase
        .from("colleges")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("Failed to add college:", error);

        alert("Could not add college. Check console for details.");
      } else {
        await loadColleges();

        if (data?.id) {
          setEditingId(data.id);
          await loadCoordinators(data.id);
        }

        alert("College added successfully.");
      }
    }

    setSaving(false);
  }

  // --------------------------------------------------
  // STATUS
  // --------------------------------------------------

  async function handleStatusChange(id, newStatus) {
    setColleges((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: newStatus,
            }
          : c,
      ),
    );

    const { error } = await supabase
      .from("colleges")
      .update({
        status: newStatus,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to update status:", error);

      alert("Could not update status. Check console for details.");

      await loadColleges();
    }
  }

  // --------------------------------------------------
  // DELETE COLLEGE
  // --------------------------------------------------

  async function handleDeleteCollege(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from("colleges").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete college:", error);

      alert("Could not delete college. Check console for details.");
    } else {
      await loadColleges();
    }
  }

  // --------------------------------------------------
  // EXCEL IMPORT
  // --------------------------------------------------

  const VALID_STATUSES = ["Interested", "Follow-up Due", "Not Interested"];

  function normalizeStatus(raw) {
    const trimmed = (raw || "").toString().trim();

    return VALID_STATUSES.includes(trimmed) ? trimmed : "Interested";
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];

    if (!file) return;

    setImportResult(null);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, {
          type: "binary",
        });

        const sheet = wb.Sheets[wb.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        });

        const mapped = rows
          .map((r) => ({
            name: r.name || r.Name || r.College || r.college || "",

            city: r.city || r.City || "",

            course: r.course || r.Course || "",

            tpo: r.tpo || r.TPO || r.Tpo || "",

            strength: r.strength || r.Strength || "",

            status: normalizeStatus(r.status || r.Status),

            website: r.website || r.Website || "",

            institution_type: r.institution_type || r["Institution Type"] || "",

            courses_available:
              r.courses_available || r["Courses Available"] || "",
          }))
          .filter((r) => r.name);

        setImportRows(mapped);
      } catch (err) {
        console.error("Excel parsing failed:", err);

        alert("Could not read this Excel file.");
      }
    };

    reader.readAsBinaryString(file);
  }

  async function handleConfirmImport() {
    if (!importRows || importRows.length === 0) {
      return;
    }

    setImporting(true);

    let success = 0;
    let failed = 0;

    const firstErrors = [];

    const records = importRows.map((row) => ({
      name: row.name,
      city: row.city || null,
      course: row.course || null,
      tpo: row.tpo || null,

      strength: row.strength ? parseInt(row.strength, 10) : null,

      status: row.status || "Interested",

      institution_type: row.institution_type || null,

      courses_available: row.courses_available || null,

      website: row.website || null,
    }));

    const chunkSize = 500;

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);

      const { error } = await supabase.from("colleges").insert(chunk);

      if (error) {
        failed += chunk.length;

        if (firstErrors.length < 3) {
          firstErrors.push(error.message);
        }

        console.error("Failed to import chunk:", error);
      } else {
        success += chunk.length;
      }
    }

    setImporting(false);

    setImportResult({
      success,
      failed,
      firstErrors,
    });

    setImportRows(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await loadColleges();
  }

  function cancelImport() {
    setImportRows(null);
    setImportResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // --------------------------------------------------
  // COORDINATORS
  // --------------------------------------------------

  async function loadCoordinators(collegeId) {
    setLoadingCoordinators(true);

    const { data, error } = await supabase
      .from("placement_coordinators")
      .select("*")
      .eq("college_id", collegeId)
      .order("is_current", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Failed to load coordinators:", error);

      alert(
        "Could not load placement coordinators. Check console for details.",
      );
    } else {
      setCoordinatorsByCollege((prev) => ({
        ...prev,
        [collegeId]: data ?? [],
      }));
    }

    setLoadingCoordinators(false);
  }

  async function reloadCoordinators(collegeId) {
    const { data, error } = await supabase
      .from("placement_coordinators")
      .select("*")
      .eq("college_id", collegeId)
      .order("is_current", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Failed to reload coordinators:", error);
      return;
    }

    setCoordinatorsByCollege((prev) => ({
      ...prev,
      [collegeId]: data ?? [],
    }));
  }

  function openCoordinatorForm() {
    if (!editingId) {
      alert("Please save the college first before adding a coordinator.");
      return;
    }

    setCoordForm({
      name: "",
      phone: "",
      email: "",
    });

    setShowCoordinatorForm(true);
  }

  function cancelCoordinatorForm() {
    setShowCoordinatorForm(false);

    setCoordForm({
      name: "",
      phone: "",
      email: "",
    });
  }

  async function handleAddCoordinator(e) {
    e.preventDefault();

    if (!editingId) {
      alert("Please save the college first.");
      return;
    }

    if (!coordForm.name.trim()) {
      alert("Please enter coordinator name.");
      return;
    }

    if (coordForm.email && !isValidEmail(coordForm.email)) {
      alert("Please enter a valid coordinator email address.");
      return;
    }

    setSavingCoord(true);

    try {
      // Archive existing current coordinators
      // before making the new coordinator current.
      const { error: archiveError } = await supabase
        .from("placement_coordinators")
        .update({
          is_current: false,
          ended_at: new Date().toISOString(),
        })
        .eq("college_id", editingId)
        .eq("is_current", true);

      if (archiveError) {
        console.error("Failed to archive previous coordinator:", archiveError);

        alert(
          "Could not archive previous coordinator. Check console for details.",
        );

        return;
      }

      // Add new current coordinator
      const { error: insertError } = await supabase
        .from("placement_coordinators")
        .insert([
          {
            college_id: editingId,

            name: coordForm.name.trim(),

            phone: coordForm.phone || null,

            email: coordForm.email || null,

            is_current: true,
          },
        ]);

      if (insertError) {
        console.error("Failed to add coordinator:", insertError);

        alert("Could not add coordinator. Check console for details.");

        return;
      }

      // Keep the main colleges.tpo column
      // synchronized with current coordinator.
      await supabase
        .from("colleges")
        .update({
          tpo: coordForm.name.trim(),
        })
        .eq("id", editingId);

      setForm((prev) => ({
        ...prev,
        tpo: coordForm.name.trim(),
      }));

      await reloadCoordinators(editingId);

      await loadColleges();

      setShowCoordinatorForm(false);

      setCoordForm({
        name: "",
        phone: "",
        email: "",
      });
    } finally {
      setSavingCoord(false);
    }
  }

  async function handleRetireCoordinator(coord) {
    if (
      !window.confirm(
        `Mark "${coord.name}" as no longer the current coordinator?`,
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("placement_coordinators")
      .update({
        is_current: false,
        ended_at: new Date().toISOString(),
      })
      .eq("id", coord.id);

    if (error) {
      console.error("Failed to retire coordinator:", error);

      alert("Could not update coordinator. Check console for details.");
    } else {
      await reloadCoordinators(coord.college_id);
    }
  }

  async function handleDeleteCoordinator(coord) {
    if (
      !window.confirm(
        `Permanently delete "${coord.name}" from records? This cannot be undone.`,
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("placement_coordinators")
      .delete()
      .eq("id", coord.id);

    if (error) {
      console.error("Failed to delete coordinator:", error);

      alert("Could not delete coordinator. Check console for details.");
    } else {
      await reloadCoordinators(coord.college_id);
    }
  }

  // --------------------------------------------------
  // CURRENT COLLEGE COORDINATORS
  // --------------------------------------------------

  const currentCollegeCoordinators = editingId
    ? (coordinatorsByCollege[editingId] ?? [])
    : [];

  const currentCoordinator = currentCollegeCoordinators.find(
    (coord) => coord.is_current,
  );

  const pastCoordinators = currentCollegeCoordinators.filter(
    (coord) => !coord.is_current,
  );

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="page active" id="page-campusdb">
      {/* PAGE HEADER */}

      <div className="page-head">
        <div>
          <h1>Campus Database</h1>

          <p>
            {loading ? "Loading…" : `${colleges.length} colleges`}
            {" · "}
            filter by course, city or status
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            style={{
              display: "none",
            }}
            onChange={handleFileSelect}
          />

          <button
            className="btn-outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Import Excel
          </button>

          <button className="btn-gold" onClick={startAdd}>
  + Add College
</button>

<button
  className="btn-outline"
  onClick={() => setShowImport((v) => !v)}
>
  {showImport ? "✕ Close Import" : "🤖 AI Import Excel/PDF"}
</button>
        </div>
      </div>

      {showImport && (
        <div className="panel">
          <div className="panel-title">AI Import — Campus Database</div>
          <div className="panel-sub">
            Upload any Excel or PDF with college data — AI will read and format
            it automatically
          </div>
          <AIImport
            type="campus"
            onImported={() => {
              setShowImport(false);
              window.location.reload();
            }}
          />
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div
          className="panel"
          style={{
            color: "crimson",
          }}
        >
          {error}
        </div>
      )}

      {/* IMPORT RESULT */}

      {importResult && (
        <div className="panel">
          <p>
            Import done: <b>{importResult.success}</b> added,{" "}
            <b>{importResult.failed}</b> failed.
          </p>

          {importResult.failed > 0 && importResult.firstErrors?.length > 0 && (
            <div
              style={{
                color: "crimson",
                fontSize: 13,
                marginTop: 8,
              }}
            >
              <p>Error details:</p>

              <ul>
                {importResult.firstErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn-outline" onClick={() => setImportResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* IMPORT PREVIEW */}

      {importRows && (
        <div className="panel">
          <div className="panel-title">
            Preview — {importRows.length} rows found
          </div>

          <table>
            <tbody>
              <tr>
                <th>College</th>
                <th>City</th>
                <th>Course</th>
                <th>TPO</th>
                <th>Strength</th>
                <th>Status</th>
              </tr>

              {importRows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>

                  <td>{r.city}</td>

                  <td>{r.course}</td>

                  <td>{r.tpo}</td>

                  <td>{r.strength}</td>

                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {importRows.length > 10 && (
            <p>...and {importRows.length - 10} more rows</p>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              className="btn-gold"
              onClick={handleConfirmImport}
              disabled={importing}
            >
              {importing
                ? "Importing…"
                : `Import ${importRows.length} Colleges`}
            </button>

            <button className="btn-outline" onClick={cancelImport}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MAIN TABLE */}

      <div className="panel">
        {/* COURSE FILTERS */}

        <div>
          {courses.map((c) => (
            <span
              key={c}
              className={`course-chip ${activeCourse === c ? "sel" : ""}`}
              onClick={() => {
                setActiveCourse(c);
                if (c !== "Others") setCustomCourseText("");
              }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* CUSTOM "OTHERS" COURSE INPUT */}

        {activeCourse === "Others" && (
          <div style={{ marginTop: 10 }}>
            <input
              className="search-box"
              style={{ maxWidth: 320 }}
              placeholder="Type a course name (e.g. BDes, BArch...)"
              value={customCourseText}
              onChange={(e) => setCustomCourseText(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* SEARCH + STATUS FILTER */}

        <div
          className="toolbar"
          style={{
            marginTop: 16,
          }}
        >
          <input
            className="search-box"
            placeholder="Search college, city, TPO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {["All Status", "Interested", "Follow-up Due", "Not Interested"].map(
            (f) => (
              <span
                key={f}
                className={`filter-chip ${activeFilter === f ? "sel" : ""}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </span>
            ),
          )}
        </div>

        {/* TABLE */}

        <table>
          <tbody>
            <tr>
              <th>College</th>
              <th>Institution Type</th>
              <th>City</th>
              <th>Website</th>
              <th>Courses Available</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>

            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    padding: 24,
                  }}
                >
                  Loading…
                </td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map((c) => (
                <tr key={c.id}>
                  {/* COLLEGE */}

                  <td>{c.name}</td>

                  {/* INSTITUTION TYPE */}

                  <td
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {c.institution_type || "—"}
                  </td>

                  {/* CITY */}

                  <td>{c.city || "—"}</td>

                  {/* WEBSITE */}

                  <td>
                    {c.website ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "var(--primary)",
                        }}
                      >
                        Visit ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* COURSES */}

                  <td
                    style={{
                      maxWidth: 260,
                      fontSize: 11.5,
                      color: "var(--text-muted)",
                    }}
                    title={c.courses_available}
                  >
                    {c.courses_available
                      ? c.courses_available.length > 60
                        ? c.courses_available.slice(0, 60) + "…"
                        : c.courses_available
                      : "—"}
                  </td>

                  {/* STATUS */}

                  <td>
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                      }}
                    >
                      <select
                        value={c.status || "Interested"}
                        onChange={(e) =>
                          handleStatusChange(c.id, e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          border: "none",
                          outline: "none",
                          boxShadow: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 11.5,
                          appearance: "none",
                          WebkitAppearance: "none",
                          MozAppearance: "none",
                          borderRadius: 999,
                          padding: "3px 16px 3px 8px",
                          lineHeight: 1.3,
                          backgroundColor:
                            statusColors[c.status]?.bg ??
                            statusColors["Interested"].bg,
                          color:
                            statusColors[c.status]?.text ??
                            statusColors["Interested"].text,
                        }}
                      >
                        <option
                          value="Interested"
                          style={{
                            backgroundColor: "#ffffff",
                            color: "#111827",
                          }}
                        >
                          Interested
                        </option>

                        <option
                          value="Follow-up Due"
                          style={{
                            backgroundColor: "#ffffff",
                            color: "#111827",
                          }}
                        >
                          Follow-up Due
                        </option>

                        <option
                          value="Not Interested"
                          style={{
                            backgroundColor: "#ffffff",
                            color: "#111827",
                          }}
                        >
                          Not Interested
                        </option>
                      </select>

                      <span
                        style={{
                          position: "absolute",
                          right: 5,
                          top: "50%",
                          transform: "translateY(-55%)",
                          pointerEvents: "none",
                          fontSize: 9,
                          lineHeight: 1,
                          opacity: 0.85,
                          color:
                            statusColors[c.status]?.text ??
                            statusColors["Interested"].text,
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </td>

                  {/* ACTIONS */}

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn-outline"
                        style={{
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                        onClick={() => startEdit(c)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn-outline"
                        style={{
                          padding: "4px 10px",
                          fontSize: 12,
                          color: "crimson",
                        }}
                        onClick={() => handleDeleteCollege(c.id, c.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    color: "var(--slate-light)",
                    padding: 24,
                  }}
                >
                  No colleges found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ==================================================
          ADD / EDIT COLLEGE POPUP
         ================================================== */}

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
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* POPUP HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div
                className="panel-title"
                style={{
                  margin: 0,
                }}
              >
                {editingId ? "Edit College" : "Add New College"}
              </div>

              <button
                onClick={cancelForm}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>

            {/* COLLEGE FORM */}

            <form
              onSubmit={handleSaveCollege}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 16,
              }}
            >
              <input
                className="search-box"
                placeholder="College name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />

              <input
                className="search-box"
                placeholder="City"
                value={form.city}
                onChange={(e) =>
                  setForm({
                    ...form,
                    city: e.target.value,
                  })
                }
              />

              {form.course === "Others" || (form.course && !courses.includes(form.course)) ? (
                <input
                  className="search-box"
                  placeholder="Type course name"
                  value={form.course === "Others" ? "" : form.course}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      course: e.target.value,
                    })
                  }
                  autoFocus
                />
              ) : (
                <select
                  className="search-box"
                  value={form.course}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      course: e.target.value,
                    })
                  }
                >
                  <option value="">— No course —</option>

                  {courses
                    .filter((c) => c !== "Unassigned" && c !== "All")
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              )}

              <input
                className="search-box"
                placeholder="TPO name"
                value={form.tpo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tpo: e.target.value,
                  })
                }
              />

              <input
                className="search-box"
                placeholder="Website (https://...)"
                value={form.website}
                onChange={(e) =>
                  setForm({
                    ...form,
                    website: e.target.value,
                  })
                }
              />

              <input
                className="search-box"
                placeholder="Strength"
                type="number"
                value={form.strength}
                onChange={(e) =>
                  setForm({
                    ...form,
                    strength: e.target.value,
                  })
                }
              />

              <input
                className="search-box"
                placeholder="Institution Type (e.g. Engineering)"
                value={form.institution_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    institution_type: e.target.value,
                  })
                }
              />

              <input
                className="search-box"
                placeholder="Courses Available (comma separated)"
                value={form.courses_available}
                onChange={(e) =>
                  setForm({
                    ...form,
                    courses_available: e.target.value,
                  })
                }
              />

              <input
                className="search-box"
                type="date"
                value={form.last_contact}
                onChange={(e) =>
                  setForm({
                    ...form,
                    last_contact: e.target.value,
                  })
                }
              />

              <select
                className="search-box"
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
                  })
                }
              >
                <option value="Interested">Interested</option>

                <option value="Follow-up Due">Follow-up Due</option>

                <option value="Not Interested">Not Interested</option>
              </select>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button className="btn-gold" type="submit" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Update College"
                      : "Save College"}
                </button>

                <button
                  className="btn-outline"
                  type="button"
                  onClick={cancelForm}
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* ==================================================
                PLACEMENT COORDINATORS
               ================================================== */}

            {editingId && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border-default, #e5e7eb)",
                }}
              >
                {/* SECTION HEADER */}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          height: 20,
                          borderRadius: 4,
                          background: "var(--primary, #7c3aed)",
                          display: "inline-block",
                        }}
                      />
                      Placement Coordinators
                    </div>

                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-muted)",
                        marginTop: 3,
                      }}
                    >
                      Manage current and previous coordinators
                    </div>
                  </div>

                  {/* + ADD COORDINATOR */}

                  <button
                    type="button"
                    className="btn-gold"
                    onClick={openCoordinatorForm}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                    }}
                  >
                    + Add Coordinator
                  </button>
                </div>

                {/* ADD COORDINATOR FORM */}

                {showCoordinatorForm && (
                  <form
                    onSubmit={handleAddCoordinator}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      padding: 10,
                      marginBottom: 12,
                      border: "1px dashed var(--border-default, #ddd)",
                      borderRadius: 8,
                    }}
                  >
                    <input
                      className="search-box"
                      placeholder="Coordinator Name *"
                      required
                      value={coordForm.name}
                      onChange={(e) =>
                        setCoordForm({
                          ...coordForm,
                          name: e.target.value,
                        })
                      }
                    />

                    <input
                      className="search-box"
                      placeholder="Phone"
                      value={coordForm.phone}
                      onChange={(e) =>
                        setCoordForm({
                          ...coordForm,
                          phone: sanitizePhone(e.target.value),
                        })
                      }
                      inputMode="numeric"
                      maxLength={10}
                    />

                    <input
                      className="search-box"
                      placeholder="Email"
                      type="email"
                      value={coordForm.email}
                      onChange={(e) =>
                        setCoordForm({
                          ...coordForm,
                          email: e.target.value,
                        })
                      }
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <button
                        className="btn-gold"
                        type="submit"
                        disabled={savingCoord}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                        }}
                      >
                        {savingCoord ? "Saving…" : "Save Coordinator"}
                      </button>

                      <button
                        type="button"
                        className="btn-outline"
                        onClick={cancelCoordinatorForm}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* CURRENT COORDINATOR */}

                {loadingCoordinators ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      padding: "8px 0",
                    }}
                  >
                    Loading coordinators…
                  </div>
                ) : (
                  <>
                    {currentCoordinator && (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "var(--bg-soft, #FAFAFC)",
                          border: "1px solid var(--border-default, #eee)",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            marginBottom: 4,
                          }}
                        >
                          Current Coordinator
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {currentCoordinator.name}
                            </div>

                            <div
                              style={{
                                fontSize: 11.5,
                                color: "var(--text-secondary)",
                                marginTop: 3,
                              }}
                            >
                              {[
                                currentCoordinator.phone,
                                currentCoordinator.email,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>

                          <span className="badge green">Current</span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginTop: 8,
                          }}
                        >
                          <button
                            type="button"
                            className="btn-outline"
                            style={{
                              padding: "4px 10px",
                              fontSize: 11.5,
                            }}
                            onClick={() =>
                              handleRetireCoordinator(currentCoordinator)
                            }
                          >
                            Mark as Left
                          </button>

                          <button
                            type="button"
                            className="btn-outline"
                            style={{
                              padding: "4px 10px",
                              fontSize: 11.5,
                              color: "crimson",
                            }}
                            onClick={() =>
                              handleDeleteCoordinator(currentCoordinator)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PAST COORDINATORS */}

                    {pastCoordinators.length > 0 && (
                      <div
                        style={{
                          marginTop: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            marginBottom: 7,
                          }}
                        >
                          Previous Coordinators
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {pastCoordinators.map((coord) => (
                            <div
                              key={coord.id}
                              style={{
                                padding: "8px 10px",
                                borderLeft:
                                  "2px solid var(--border-default, #ddd)",
                                background: "var(--bg-soft, #FAFAFC)",
                                opacity: 0.75,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: 12.5,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {coord.name}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 11.5,
                                      color: "var(--text-secondary)",
                                      marginTop: 2,
                                    }}
                                  >
                                    {[coord.phone, coord.email]
                                      .filter(Boolean)
                                      .join(" · ") || "—"}
                                  </div>
                                </div>

                                <span className="badge gray">Past</span>
                              </div>

                              <div
                                style={{
                                  marginTop: 6,
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn-outline"
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: 11,
                                    color: "crimson",
                                  }}
                                  onClick={() => handleDeleteCoordinator(coord)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}