import { useEffect, useState } from "react";
import { Plus, Search, Filter, X } from "lucide-react";
import { getCallRecords, addCallRecord, updateCallRecord, deleteCallRecord } from "../lib/api";

export default function CallRecord() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [callRecords, setCallRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    contact: "",
    organization: "",
    phone: "",
    type: "College",
    status: "Completed",
    date: "",
    duration: "",
    note: ""
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);

  function todayISO() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDuration(mins) {
    if (mins === "" || mins === null || mins === undefined) return "";
    const total = parseInt(mins, 10);
    if (isNaN(total)) return "";
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  }

    useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const data = await getCallRecords();
        
        if (isMounted) {
          setCallRecords(data || []);
          setError("");
        }
      } catch (err) {
        console.error("Failed to load call records:", err);
        
        if (isMounted) {
          setError(err.message || "Failed to load call records.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  function validateForm(values) {
    const errs = {};

    if (!values.contact.trim()) {
      errs.contact = "Contact name is required.";
    } else if (values.contact.trim().length < 2) {
      errs.contact = "Name must be at least 2 characters.";
    } else if (!/^[A-Za-z\s.'-]+$/.test(values.contact.trim())) {
      errs.contact = "Name can only contain letters and spaces.";
    }

    if (values.organization.trim() && values.organization.trim().length < 2) {
      errs.organization = "Organization name looks too short.";
    }

    if (!values.phone.trim()) {
      errs.phone = "Phone number is required.";
    } else if (!/^[6-9]\d{9}$/.test(values.phone.trim())) {
      errs.phone = "Enter a valid 10-digit mobile number.";
    }

    if (!values.date) {
      errs.date = "Date is required.";
    } else if (values.date > todayISO()) {
      errs.date = "Date cannot be in the future.";
    }

    if (values.duration !== "" && values.duration !== null && values.duration !== undefined) {
      const durNum = Number(values.duration);
      if (!Number.isInteger(durNum) || durNum <= 0) {
        errs.duration = "Duration must be a whole number of minutes.";
      } else if (durNum > 600) {
        errs.duration = "Duration seems too long (max 600 min).";
      }
    }

    if (values.note.trim().length > 200) {
      errs.note = "Note cannot exceed 200 characters.";
    }

    return errs;
  }

  const filtered = callRecords.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.contact_name, c.organization, c.phone, c.entity_type, c.notes]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const stats = {
    total: callRecords.length,
    completed: callRecords.filter((c) => c.status === "Completed").length,
    followUps: callRecords.filter((c) => c.status === "Follow Up").length,
    today: callRecords.filter((c) => c.call_date === todayISO()).length,
  };

  function openAddModal() {
    setForm({ ...emptyForm, date: todayISO() });
    setErrors({});
    setEditingId(null);
    setShowModal(true);
  }

  function openEditModal(record) {
    setForm({
      contact: record.contact_name || "",
      organization: record.organization || "",
      phone: record.phone || "",
      type: record.entity_type || "College",
      status: record.status || "Completed",
      date: record.call_date || "",
      duration: record.duration || "",
      note: record.notes || ""
    });
    setErrors({});
    setEditingId(record.id);
    setShowModal(true);
  }

  async function handleDelete(id) {
    const record = callRecords.find((c) => c.id === id);
    const ok = window.confirm(
      `Delete call record for "${record ? record.contact_name : "this contact"}"? This cannot be undone.`
    );
    if (!ok) return;

    try {
      await deleteCallRecord(id);
      setCallRecords((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete call record:", err);
      alert(err.message || "Failed to delete call record.");
    }
  }

  async function handleStatusChange(id, newStatus) {
    const record = callRecords.find((c) => c.id === id);
    if (!record) return;

    try {
      await updateCallRecord(id, {
        contact_name: record.contact_name,
        organization: record.organization,
        phone: record.phone,
        entity_type: record.entity_type,
        call_date: record.call_date,
        duration: record.duration,
        status: newStatus,
        notes: record.notes,
      });
      setCallRecords((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err.message || "Failed to update status.");
    }
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: digitsOnly }));
      return;
    }

    if (name === "contact") {
      const lettersOnly = value.replace(/[^A-Za-z\s.'-]/g, "");
      setForm((prev) => ({ ...prev, contact: lettersOnly }));
      return;
    }

    if (name === "duration") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 3);
      setForm((prev) => ({ ...prev, duration: digitsOnly }));
      return;
    }

    if (name === "note") {
      setForm((prev) => ({ ...prev, note: value.slice(0, 200) }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

    async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const payload = {
      contact_name: form.contact.trim(),
      organization: form.organization.trim(),
      phone: form.phone.trim(),
      entity_type: form.type,
      status: form.status,
      call_date: form.date,
      duration: form.duration,
      notes: form.note.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateCallRecord(editingId, payload);
      } else {
        await addCallRecord(payload);
      }

      // Reload records after saving
      try {
        const data = await getCallRecords();
        setCallRecords(data || []);
        setError("");
      } catch (err) {
        console.error("Failed to reload records:", err);
      }

      setShowModal(false);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save call record:", err);
      alert(err.message || "Failed to save call record.");
    } finally {
      setSaving(false);
    }
  }
  function getStatusColor(status) {
    const colors = {
      "Completed": { bg: "#16a34a", text: "#fff" },
      "Follow Up": { bg: "#d97706", text: "#fff" },
      "Cancelled": { bg: "#dc2626", text: "#fff" }
    };
    return colors[status] || { bg: "#e5e7eb", text: "#111" };
  }

  if (loading) {
    return (
      <div className="page active">
        <div className="panel">
          <p style={{ color: "var(--text-muted)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page active">
        <div className="panel">
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page active">

      {/* Page header */}
      <div className="page-head">
        <div>
          <h1>Call Records</h1>
          <p>Track every call with colleges, companies and candidates</p>
        </div>

        <button className="btn-gold" onClick={openAddModal}>
          <Plus size={16} />
          Add Call Record
        </button>
      </div>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="num">{stats.total}</div>
          <div className="lbl">Total Calls</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.completed}</div>
          <div className="lbl">Completed Calls</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.followUps}</div>
          <div className="lbl">Follow Ups</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.today}</div>
          <div className="lbl">Today's Calls</div>
        </div>
      </div>

      {/* Search + Filter toolbar */}
      <div className="toolbar">
        <div className="search-box" style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
          <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calls..."
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              width: "100%",
              fontSize: "13.5px",
              fontFamily: "var(--font-body)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <button className="btn-outline">
          <Filter size={16} />
          Filters
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "1200px" }}>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Organization</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Note</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    {callRecords.length === 0
                      ? "No call records yet. Click \"Add Call Record\" to log one."
                      : `No calls match "${search}".`}
                  </td>
                </tr>
              ) : (
                filtered.map((call) => (
                  <tr key={call.id}>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{call.contact_name}</td>
                    <td>{call.organization}</td>
                    <td>{call.phone}</td>
                    <td>{call.entity_type}</td>
                    <td>{call.call_date}</td>
                    <td>{formatDuration(call.duration)}</td>
                    <td>{call.notes}</td>
                    <td>
                      <select
                        value={call.status}
                        onChange={(e) => handleStatusChange(call.id, e.target.value)}
                        style={{
                          ...getStatusColor(call.status),
                          cursor: "pointer",
                          fontWeight: 700,
                          fontFamily: "var(--font-body)",
                          fontSize: "12px",
                          outline: "none",
                          border: "none",
                          borderRadius: "20px",
                          padding: "5px 10px"
                        }}
                      >
                        <option value="Completed" style={optionStyle}>Completed</option>
                        <option value="Follow Up" style={optionStyle}>Follow Up</option>
                        <option value="Cancelled" style={optionStyle}>Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => openEditModal(call)}
                          className="btn-outline"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(call.id)}
                          style={{
                            padding: "4px 10px",
                            fontSize: "12px",
                            border: "1px solid #e33",
                            color: "#e33",
                            background: "transparent",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Call Record modal */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{
              width: "480px",
              maxWidth: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              background: "var(--bg-panel, #fff)",
              borderRadius: "12px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0 }}>{editingId ? "Edit Call Record" : "Add Call Record"}</h2>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label>Contact Name *</label>
                <input
                  name="contact"
                  value={form.contact}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  maxLength={50}
                  style={{ ...inputStyle, borderColor: errors.contact ? "#e33" : undefined }}
                  required
                />
                {errors.contact && <p style={errorStyle}>{errors.contact}</p>}
              </div>

              <div>
                <label>Organization</label>
                <input
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="e.g. MIT Pune"
                  maxLength={60}
                  style={{ ...inputStyle, borderColor: errors.organization ? "#e33" : undefined }}
                />
                {errors.organization && <p style={errorStyle}>{errors.organization}</p>}
              </div>

              <div>
                <label>Phone Number *</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  style={{ ...inputStyle, borderColor: errors.phone ? "#e33" : undefined }}
                  required
                />
                {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label>Type</label>
                  <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
                    <option value="College">College</option>
                    <option value="Company">Company</option>
                    <option value="Candidate">Candidate</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label>Status</label>
                  <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
                    <option value="Completed">Completed</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  max={todayISO()}
                  style={{ ...inputStyle, borderColor: errors.date ? "#e33" : undefined }}
                  required
                />
                {errors.date && <p style={errorStyle}>{errors.date}</p>}
              </div>

              <div>
                <label>Duration (minutes)</label>
                <input
                  name="duration"
                  value={form.duration}
                  onChange={handleChange}
                  placeholder="e.g. 15"
                  inputMode="numeric"
                  maxLength={3}
                  style={{ ...inputStyle, borderColor: errors.duration ? "#e33" : undefined }}
                />
                {errors.duration && <p style={errorStyle}>{errors.duration}</p>}
              </div>

              <div>
                <label>Note</label>
                <textarea
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  placeholder="Any notes about the call"
                  rows={3}
                  maxLength={200}
                  style={{ ...inputStyle, resize: "vertical", borderColor: errors.note ? "#e33" : undefined }}
                />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {errors.note ? <p style={errorStyle}>{errors.note}</p> : <span />}
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {form.note.length}/200
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-gold" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Call Record" : "Save Call Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const optionStyle = {
  color: "#111",
  background: "#fff",
  fontWeight: 500
};

const errorStyle = {
  color: "#e33",
  fontSize: "12px",
  margin: "4px 0 0"
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border-color, #ddd)",
  borderRadius: "6px",
  fontSize: "13.5px",
  fontFamily: "var(--font-body)",
  marginTop: "4px",
  outline: "none",
  boxSizing: "border-box"
};
