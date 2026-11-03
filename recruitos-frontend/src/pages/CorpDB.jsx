import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { sanitizePhone } from "../lib/phone";
import { isValidEmail } from "../lib/email";
import AIImport from "../components/AIImport";

const emptyForm = {
  name: "",
  sector: "",
  hr_name: "",
  hq_location: "",
  hiring_status: "Active",
  city: "",
  hr_phone: "",
  hr_email: "",
  website: "",
  gst_no: "",
  industry: "",
  sub_industry: "",
};

const emptyHrForm = {
  name: "",
  title: "",
  phone: "",
  email: "",
};

export default function CorpDB() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Company popup
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const activeCompaniesCount = useMemo(
    () => companies.filter((c) => (c.hiring_status || "").toLowerCase() === "active").length,
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.sector ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.sub_industry ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.hq_location ?? "").toLowerCase().includes(q) ||
        (c.hr_name ?? "").toLowerCase().includes(q) ||
        (c.hr_email ?? "").toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "All" ||
        (c.hiring_status || "").toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [companies, search, statusFilter]);

  // HR inside company popup
  const [showHrForm, setShowHrForm] = useState(false);
  const [hrForm, setHrForm] = useState(emptyHrForm);
  const [savingHr, setSavingHr] = useState(false);

  // Excel import
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const [showImport, setShowImport] = useState(false);

  async function loadCompanies() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load companies:", error);
      setError("Could not load companies. Check your Supabase connection.");
      setCompanies([]);
    } else {
      setCompanies(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });

      if (ignore) return;

      if (error) {
        console.error("Failed to load companies:", error);
        setError("Could not load companies. Check your Supabase connection.");
        setCompanies([]);
      } else {
        setCompanies(data || []);
      }

      setLoading(false);
    }

    init();

    return () => {
      ignore = true;
    };
  }, []);

  // ---------------------------------------------------------
  // COMPANY FORM
  // ---------------------------------------------------------

  function startAddCompany() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setHrForm({ ...emptyHrForm });
    setShowHrForm(false);
    setShowForm(true);
  }

  function startEdit(c) {
    setEditingId(c.id);

    setForm({
      name: c.name || "",
      sector: c.sector || "",
      hr_name: c.hr_name || "",
      hq_location: c.hq_location || "",
      hiring_status: c.hiring_status || "Active",
      city: c.city || "",
      hr_phone: c.hr_phone || "",
      hr_email: c.hr_email || "",
      website: c.website || "",
      gst_no: c.gst_no || "",
      industry: c.industry || "",
      sub_industry: c.sub_industry || "",
    });

    setHrForm({
      name: "",
      title: "",
      phone: "",
      email: "",
    });

    setShowHrForm(false);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setHrForm({ ...emptyHrForm });
    setShowHrForm(false);
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // ---------------------------------------------------------
  // SAVE COMPANY
  // ---------------------------------------------------------

  async function handleSaveCompany(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter company name.");
      return;
    }

    if (form.hr_email && !isValidEmail(form.hr_email)) {
      alert("Please enter a valid HR email address.");
      return;
    }

    setSaving(true);

    const companyData = {
      name: form.name.trim(),
      sector: form.sector || null,
      hr_name: form.hr_name || null,
      hq_location: form.hq_location || null,
      hiring_status: form.hiring_status || "Active",
      city: form.city || null,
      hr_phone: form.hr_phone || null,
      hr_email: form.hr_email || null,
      website: form.website || null,
      gst_no: form.gst_no || null,
      industry: form.industry || null,
      sub_industry: form.sub_industry || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", editingId);

      if (error) {
        console.error("Failed to update company:", error);
        alert("Could not update company. Check console for details.");
      } else {
        cancelForm();
        await loadCompanies();
      }
    } else {
      const { error } = await supabase.from("companies").insert([companyData]);

      if (error) {
        console.error("Failed to add company:", error);
        alert("Could not add company. Check console for details.");
      } else {
        cancelForm();
        await loadCompanies();
      }
    }

    setSaving(false);
  }

  // ---------------------------------------------------------
  // DELETE COMPANY
  // ---------------------------------------------------------

  async function handleDeleteCompany(id, name) {
    if (!window.confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from("companies").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete company:", error);
      alert("Could not delete company. Check console for details.");
      return;
    }

    await loadCompanies();
  }

  // ---------------------------------------------------------
  // ADD HR FROM EDIT POPUP
  // ---------------------------------------------------------

  function openAddHrForm() {
    if (!editingId) {
      alert("Please save the company first before adding an HR.");
      return;
    }

    setHrForm({
      name: "",
      title: "",
      phone: "",
      email: "",
    });

    setShowHrForm(true);
  }

  function cancelHrForm() {
    setShowHrForm(false);
    setHrForm({ ...emptyHrForm });
  }

  async function handleAddHr(e) {
    e.preventDefault();

    if (!editingId) {
      alert("Company ID is missing.");
      return;
    }

    if (!hrForm.name.trim()) {
      alert("Please enter HR name.");
      return;
    }

    if (hrForm.email && !isValidEmail(hrForm.email)) {
      alert("Please enter a valid HR email address.");
      return;
    }

    setSavingHr(true);

    try {
      // Archive current HR
      const { error: archiveError } = await supabase
        .from("company_hr_contacts")
        .update({
          is_current: false,
          ended_at: new Date().toISOString(),
        })
        .eq("company_id", editingId)
        .eq("is_current", true);

      if (archiveError) {
        console.error("Failed to archive previous HR:", archiveError);

        alert("Could not archive previous HR. Check console for details.");

        setSavingHr(false);
        return;
      }

      // Insert new HR
      const { error: insertError } = await supabase
        .from("company_hr_contacts")
        .insert([
          {
            company_id: editingId,
            name: hrForm.name.trim(),
            title: hrForm.title.trim() || null,
            phone: hrForm.phone || null,
            email: hrForm.email || null,
            is_current: true,
          },
        ]);

      if (insertError) {
        console.error("Failed to add HR contact:", insertError);

        alert("Could not add new HR. Check console for details.");

        setSavingHr(false);
        return;
      }

      // Update current HR in companies table
      const { error: companyUpdateError } = await supabase
        .from("companies")
        .update({
          hr_name: hrForm.name.trim(),
          hr_phone: hrForm.phone || null,
          hr_email: hrForm.email || null,
        })
        .eq("id", editingId);

      if (companyUpdateError) {
        console.error(
          "HR added but company HR fields could not be updated:",
          companyUpdateError,
        );

        alert("HR was added, but company HR details could not be updated.");
      }

      // Update popup form immediately
      setForm((prev) => ({
        ...prev,
        hr_name: hrForm.name.trim(),
        hr_phone: hrForm.phone || "",
        hr_email: hrForm.email || "",
      }));

      setHrForm({ ...emptyHrForm });
      setShowHrForm(false);

      await loadCompanies();
    } catch (err) {
      console.error("Unexpected HR error:", err);
      alert("Something went wrong while adding HR.");
    }

    setSavingHr(false);
  }

  // ---------------------------------------------------------
  // EXCEL IMPORT
  // ---------------------------------------------------------

  function handleFileSelect(e) {
    const file = e.target.files?.[0];

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
            name: r.name || r.Name || r.Company || r.company || "",

            sector: r.sector || r.Sector || "",

            hr_name: r.hr_name || r["HR Name"] || r.hr || "",

            hq_location: r.hq_location || r["HQ Location"] || r.hq || "",

            hiring_status: r.hiring_status || r["Hiring Status"] || "Active",

            city: r.city || r.City || "",

            hr_phone:
              r.hr_phone || r["HR Phone"] || r["Mobile No"] || r.mobile || "",

            hr_email: r.hr_email || r["HR Email"] || r.email || "",

            website: r.website || r.Website || "",

            gst_no: r.gst_no || r["GST No"] || r.GST || "",

            industry: r.industry || r.Industry || "",

            sub_industry: r.sub_industry || r["Sub Industry"] || "",
          }))
          .filter((r) => r.name);

        setImportRows(mapped);
      } catch (err) {
        console.error("Excel import error:", err);
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

    for (const row of importRows) {
      const { error } = await supabase.from("companies").insert([
        {
          name: row.name,
          sector: row.sector || null,
          hr_name: row.hr_name || null,
          hq_location: row.hq_location || null,
          hiring_status: row.hiring_status || "Active",
          city: row.city || null,
          hr_phone: row.hr_phone || null,
          hr_email: row.hr_email || null,
          website: row.website || null,
          gst_no: row.gst_no || null,
          industry: row.industry || null,
          sub_industry: row.sub_industry || null,
        },
      ]);

      if (error) {
        console.error("Import row failed:", error);
        failed += 1;
      } else {
        success += 1;
      }
    }

    setImporting(false);

    setImportResult({
      success,
      failed,
    });

    setImportRows(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await loadCompanies();
  }

  function cancelImport() {
    setImportRows(null);
    setImportResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="page active" id="page-corpdb">
      {/* PAGE HEADER */}
      <div className="page-head">
        <div>
          <h1>Corporate Database</h1>

          <p>
            {loading
              ? "Loading…"
              : `${activeCompaniesCount} hiring active · ${companies.length} total client companies`}
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
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <button
            className="btn-outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Import Excel
          </button>

          <button className="btn-gold" onClick={startAddCompany}>
  + Add Company
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
          <div className="panel-title">AI Import — Corporate Database</div>
          <div className="panel-sub">
            Upload any Excel or PDF with company data — AI will read and format
            it automatically
          </div>
          <AIImport
            type="corporate"
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
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* IMPORT RESULT */}
      {importResult && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
          }}
        >
          <p>
            Import done: <b>{importResult.success}</b> added,{" "}
            <b>{importResult.failed}</b> failed.
          </p>

          <button className="btn-outline" onClick={() => setImportResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* IMPORT PREVIEW */}
      {importRows && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
          }}
        >
          <div className="panel-title">
            Preview — {importRows.length} rows found
          </div>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Sector</th>
                  <th>HR Name</th>
                  <th>HQ</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {importRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.sector || "—"}</td>
                    <td>{r.hr_name || "—"}</td>
                    <td>{r.hq_location || "—"}</td>
                    <td>{r.hiring_status || "Active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                : `Import ${importRows.length} Companies`}
            </button>

            <button className="btn-outline" onClick={cancelImport}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* COMPANY ADD / EDIT POPUP */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 850,
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            {/* POPUP HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                  }}
                >
                  {editingId ? "Edit Company" : "Add New Company"}
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  {editingId
                    ? "Update company information and HR details."
                    : "Enter company information."}
                </p>
              </div>

              <button
                type="button"
                className="btn-outline"
                onClick={cancelForm}
                style={{
                  padding: "5px 10px",
                }}
              >
                ✕
              </button>
            </div>

            {/* COMPANY FORM */}
            <form onSubmit={handleSaveCompany}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <input
                  className="search-box"
                  placeholder="Company name *"
                  required
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="Sector (e.g. IT Services)"
                  value={form.sector}
                  onChange={(e) => handleFormChange("sector", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="Industry"
                  value={form.industry}
                  onChange={(e) => handleFormChange("industry", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="Sub Industry"
                  value={form.sub_industry}
                  onChange={(e) =>
                    handleFormChange("sub_industry", e.target.value)
                  }
                />

                <input
                  className="search-box"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => handleFormChange("city", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="HQ location"
                  value={form.hq_location}
                  onChange={(e) =>
                    handleFormChange("hq_location", e.target.value)
                  }
                />

                <input
                  className="search-box"
                  placeholder="HR Manager name"
                  value={form.hr_name}
                  onChange={(e) => handleFormChange("hr_name", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="HR mobile no."
                  value={form.hr_phone}
                  onChange={(e) =>
                    handleFormChange("hr_phone", sanitizePhone(e.target.value))
                  }
                  inputMode="numeric"
                  maxLength={10}
                />

                <input
                  className="search-box"
                  placeholder="HR email ID"
                  type="email"
                  value={form.hr_email}
                  onChange={(e) => handleFormChange("hr_email", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="Website (https://...)"
                  value={form.website}
                  onChange={(e) => handleFormChange("website", e.target.value)}
                />

                <input
                  className="search-box"
                  placeholder="GST No."
                  value={form.gst_no}
                  onChange={(e) => handleFormChange("gst_no", e.target.value)}
                />

                <select
                  className="search-box"
                  value={form.hiring_status}
                  onChange={(e) =>
                    handleFormChange("hiring_status", e.target.value)
                  }
                >
                  <option value="Active">Hiring: Active</option>

                  <option value="Paused">Hiring: Paused</option>
                </select>
              </div>

              {/* ADD HR BUTTON ONLY IN EDIT MODE */}
              {editingId && (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-default, #eee)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        HR Contact
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        Add a new HR contact for this company.
                      </div>
                    </div>

                    {!showHrForm && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={openAddHrForm}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                        }}
                      >
                        + Add HR
                      </button>
                    )}
                  </div>

                  {/* HR FORM */}
                  {showHrForm && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 14,
                        borderRadius: 8,
                        border: "1px dashed var(--border-default, #ddd)",
                        background: "var(--bg-soft, #fafafc)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          marginBottom: 10,
                        }}
                      >
                        Add New HR
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 10,
                        }}
                      >
                        <input
                          className="search-box"
                          placeholder="HR Name *"
                          required
                          value={hrForm.name}
                          onChange={(e) =>
                            setHrForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />

                        <input
                          className="search-box"
                          placeholder="Title (e.g. HR Manager)"
                          value={hrForm.title}
                          onChange={(e) =>
                            setHrForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                        />

                        <input
                          className="search-box"
                          placeholder="Phone"
                          value={hrForm.phone}
                          onChange={(e) =>
                            setHrForm((prev) => ({
                              ...prev,
                              phone: sanitizePhone(e.target.value),
                            }))
                          }
                          inputMode="numeric"
                          maxLength={10}
                        />

                        <input
                          className="search-box"
                          placeholder="Email"
                          type="email"
                          value={hrForm.email}
                          onChange={(e) =>
                            setHrForm((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        <button
                          type="button"
                          className="btn-gold"
                          onClick={handleAddHr}
                          disabled={savingHr}
                          style={{
                            padding: "6px 14px",
                            fontSize: 12,
                          }}
                        >
                          {savingHr ? "Saving…" : "Save HR"}
                        </button>

                        <button
                          type="button"
                          className="btn-outline"
                          onClick={cancelHrForm}
                          style={{
                            padding: "6px 14px",
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FORM BUTTONS */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 20,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border-default, #eee)",
                }}
              >
                <button
                  type="button"
                  className="btn-outline"
                  onClick={cancelForm}
                >
                  Cancel
                </button>

                <button className="btn-gold" type="submit" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Update Company"
                      : "Save Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          CORPORATE TABLE
          ===================================================== */}

      <div
        className="panel"
        style={{
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--border-default, #eee)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Companies
          </div>

          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Corporate companies and their current HR contact details.
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            Loading…
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            {companies.length === 0 ? "No companies found." : "No companies match the selected search or filter."}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              overflowX: "auto",
            }}
          >
            <table
              className="data-table"
              style={{
                width: "100%",
                minWidth: 1200,
              }}
            >
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Sector</th>
                  <th>Industry</th>
                  <th>City</th>
                  <th>HQ Location</th>
                  <th>HR Name</th>
                  <th>HR Phone</th>
                  <th>HR Email</th>
                  <th>Hiring</th>
                  <th>Website</th>
                  <th>GST No.</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCompanies.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>

                    <td>{c.sector || "—"}</td>

                    <td>
                      {c.industry || c.sub_industry
                        ? [c.industry, c.sub_industry]
                            .filter(Boolean)
                            .join(" / ")
                        : "—"}
                    </td>

                    <td>{c.city || "—"}</td>

                    <td>{c.hq_location || "—"}</td>

                    <td>{c.hr_name || "Not assigned"}</td>

                    <td>{c.hr_phone || "—"}</td>

                    <td>{c.hr_email || "—"}</td>

                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            c.hiring_status === "Active"
                              ? "#E8F7EE"
                              : "#FFF3E0",
                          color:
                            c.hiring_status === "Active"
                              ? "#16803A"
                              : "#A15C00",
                        }}
                      >
                        {c.hiring_status || "—"}
                      </span>
                    </td>

                    <td>
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "var(--primary)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Visit ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>{c.gst_no || "—"}</td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          type="button"
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
                          type="button"
                          className="btn-outline"
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            color: "crimson",
                          }}
                          onClick={() => handleDeleteCompany(c.id, c.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
