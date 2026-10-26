import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getCoordinatorRegistrations,
  approveCoordinatorRegistration,
  rejectCoordinatorRegistration,
} from "../lib/api";
import { supabase } from "../lib/supabaseClient";

function formatDate(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function CoordinatorReview({ onPendingCountChange, onCollegeUpdated, onViewCollege }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState(null);

  // Approval modal states
  const [approvalModalReg, setApprovalModalReg] = useState(null);
  const [approvalType, setApprovalType] = useState("matched"); // 'matched' | 'select' | 'new'
  const [selectedTargetCollegeId, setSelectedTargetCollegeId] = useState("");
  const [allCollegesList, setAllCollegesList] = useState([]);
  const [collegeSearchFilter, setCollegeSearchFilter] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCoordinatorRegistrations({ status: statusFilter, search });
      setRegistrations(Array.isArray(data) ? data : []);
      if (onPendingCountChange) {
        const pending = (data || []).filter((r) => r.status === "pending").length;
        onPendingCountChange(pending);
      }
    } catch (err) {
      console.error("Load registrations error:", err);
      setError(err.message || "Failed to load coordinator registrations");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, onPendingCountChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load all colleges for manual selection option in approval modal
  useEffect(() => {
    supabase
      .from("colleges")
      .select("id, name, city, state")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setAllCollegesList(data);
      });
  }, []);

  const copyPublicLink = () => {
    const origin = window.location.origin;
    const url = `${origin}/placement-coordinator/register`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const openApproveModal = (reg) => {
    setApprovalModalReg(reg);
    setModalError("");
    setCollegeSearchFilter("");

    const topMatch = reg.suggested_college || reg.potential_matches?.[0];
    if (topMatch) {
      setApprovalType("matched");
      setSelectedTargetCollegeId(topMatch.id);
    } else {
      setApprovalType("new");
      setSelectedTargetCollegeId("");
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvalModalReg) return;
    setModalSubmitting(true);
    setModalError("");

    try {
      let targetCollegeId = undefined;
      let createNew = false;

      if (approvalType === "matched") {
        targetCollegeId = selectedTargetCollegeId || approvalModalReg.suggested_college?.id;
      } else if (approvalType === "select") {
        if (!selectedTargetCollegeId) {
          throw new Error("Please select an existing college from the list.");
        }
        targetCollegeId = selectedTargetCollegeId;
      } else if (approvalType === "new") {
        createNew = true;
      }

      const res = await approveCoordinatorRegistration(approvalModalReg.id, {
        target_college_id: targetCollegeId,
        create_new: createNew,
      });

      setSuccessBanner(
        res.is_new_college
          ? `✓ Approved ${approvalModalReg.full_name} and created new college record for "${approvalModalReg.college_name}" in the Colleges Directory!`
          : `✓ Approved ${approvalModalReg.full_name} and linked to existing college directory record!`
      );
      setTimeout(() => setSuccessBanner(""), 6000);

      setApprovalModalReg(null);
      await loadData();
      if (onCollegeUpdated) onCollegeUpdated();
    } catch (err) {
      setModalError(err.message || "Approval failed");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleReject = async (reg) => {
    const reason = window.prompt(
      `Reject registration for ${reg.full_name} (${reg.college_name})?\nEnter reason (optional):`
    );
    if (reason === null) return; // user cancelled

    setActionLoadingId(reg.id);
    try {
      await rejectCoordinatorRegistration(reg.id, { reason: reason.trim() });
      setSuccessBanner(`Coordinator registration for ${reg.full_name} rejected.`);
      setTimeout(() => setSuccessBanner(""), 5000);
      await loadData();
    } catch (err) {
      alert("Rejection failed: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = registrations.length;
    const pending = registrations.filter((r) => r.status === "pending").length;
    const approved = registrations.filter((r) => r.status === "approved").length;
    const rejected = registrations.filter((r) => r.status === "rejected").length;
    return { total, pending, approved, rejected };
  }, [registrations]);

  // Filtered rows
  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      return true;
    });
  }, [registrations, categoryFilter]);

  const categories = useMemo(() => {
    return [
      "all",
      ...new Set(registrations.map((r) => r.category).filter(Boolean)),
    ];
  }, [registrations]);

  const filteredCollegesForDropdown = useMemo(() => {
    if (!collegeSearchFilter.trim()) return allCollegesList.slice(0, 50);
    const q = collegeSearchFilter.toLowerCase().trim();
    return allCollegesList
      .filter((c) => c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allCollegesList, collegeSearchFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Banner & Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          background: "#f8fafc",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            Placement Coordinator Registration Requests
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
            Review, verify, and connect public coordinator onboarding submissions with the Colleges Directory.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={copyPublicLink}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid #c7d2fe",
              background: copiedLink ? "#dcfce7" : "#eef2ff",
              color: copiedLink ? "#16a34a" : "#4338ca",
              cursor: "pointer",
            }}
          >
            {copiedLink ? "✓ Public Link Copied!" : "🔗 Copy Public Registration Link"}
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn-outline"
            style={{ padding: "7px 12px", fontSize: 12.5 }}
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            border: "1px solid #86efac",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner("")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#166534" }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div className="panel" style={{ padding: "14px 18px", margin: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
            Total Submissions
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", margin: "4px 0" }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>All registered TPOs</div>
        </div>

        <div className="panel" style={{ padding: "14px 18px", margin: 0, borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: 11.5, color: "#b45309", fontWeight: 700, textTransform: "uppercase" }}>
            Pending Review
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#b45309", margin: "4px 0" }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: 11.5, color: "#b45309" }}>Requires verification</div>
        </div>

        <div className="panel" style={{ padding: "14px 18px", margin: 0, borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: 11.5, color: "#047857", fontWeight: 700, textTransform: "uppercase" }}>
            Approved & Linked
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#047857", margin: "4px 0" }}>
            {stats.approved}
          </div>
          <div style={{ fontSize: 11.5, color: "#047857" }}>Active in Colleges Directory</div>
        </div>

        <div className="panel" style={{ padding: "14px 18px", margin: 0, borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: 11.5, color: "#b91c1c", fontWeight: 700, textTransform: "uppercase" }}>
            Rejected
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#b91c1c", margin: "4px 0" }}>
            {stats.rejected}
          </div>
          <div style={{ fontSize: 11.5, color: "#b91c1c" }}>Not onboarded</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        className="panel"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px 16px",
          margin: 0,
        }}
      >
        <div style={{ flex: "1 1 240px" }}>
          <input
            type="text"
            placeholder="Search by coordinator name, college, email, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 12px", borderRadius: 8, fontSize: 13, border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, fontSize: 13, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Only ({stats.pending})</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, fontSize: 13, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px" }}>Coordinator</th>
                <th style={{ padding: "12px 16px" }}>College & Category</th>
                <th style={{ padding: "12px 16px" }}>Contact Details</th>
                <th style={{ padding: "12px 16px" }}>Location</th>
                <th style={{ padding: "12px 16px" }}>Directory Matching</th>
                <th style={{ padding: "12px 16px" }}>Submitted At</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                    Loading registrations…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                    No coordinator registrations match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((reg) => {
                  const statusColors = {
                    pending: { bg: "#fef3c7", text: "#92400e", label: "Pending Review" },
                    approved: { bg: "#dcfce7", text: "#166534", label: "Approved" },
                    rejected: { bg: "#fee2e2", text: "#991b1b", label: "Rejected" },
                  }[reg.status] || { bg: "#f1f5f9", text: "#475569", label: reg.status };

                  const isActing = actionLoadingId === reg.id;

                  return (
                    <tr key={reg.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                      {/* Coordinator */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{reg.full_name}</div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          {reg.designation}
                        </div>
                      </td>

                      {/* College & Category */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{reg.college_name}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                          <span
                            style={{
                              fontSize: 11,
                              background: "#ede9fe",
                              color: "#6d28d9",
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontWeight: 600,
                            }}
                          >
                            {reg.category}
                          </span>
                          {reg.website && (
                            <a
                              href={reg.website.startsWith("http") ? reg.website : `https://${reg.website}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 11.5, color: "#2563eb", textDecoration: "underline" }}
                            >
                              Website ↗
                            </a>
                          )}
                        </div>
                        {reg.courses_available && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                            {reg.courses_available.split(/[;,]/).map((c, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 10.5,
                                  background: "#f1f5f9",
                                  color: "#334155",
                                  border: "1px solid #e2e8f0",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  fontWeight: 500,
                                }}
                              >
                                {c.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td style={{ padding: "12px 16px" }}>
                        <div>
                          <a
                            href={`mailto:${reg.official_email}`}
                            style={{ color: "#0284c7", textDecoration: "none", fontWeight: 500 }}
                          >
                            {reg.official_email}
                          </a>
                        </div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                          <a href={`tel:${reg.phone}`} style={{ color: "#475569", textDecoration: "none" }}>
                            📞 {reg.phone}
                          </a>
                        </div>
                      </td>

                      {/* Location */}
                      <td style={{ padding: "12px 16px", color: "#334155" }}>
                        <div>{reg.city}</div>
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>{reg.state}</div>
                      </td>

                      {/* Matching College */}
                      <td style={{ padding: "12px 16px" }}>
                        {reg.status === "approved" && reg.colleges ? (
                          <div>
                            <span
                              style={{
                                fontSize: 11.5,
                                color: "#166534",
                                background: "#dcfce7",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontWeight: 600,
                                display: "inline-block",
                              }}
                            >
                              🏢 Linked: {reg.colleges.name}
                            </span>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                              {reg.colleges.city || reg.city}
                            </div>
                          </div>
                        ) : reg.suggested_college ? (
                          <div>
                            <span
                              title={reg.suggested_college.match_reason || `Matched: ${reg.suggested_college.name}`}
                              style={{
                                fontSize: 11.5,
                                color: "#0369a1",
                                background: "#e0f2fe",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontWeight: 600,
                                display: "inline-block",
                              }}
                            >
                              🏢 Match: {reg.suggested_college.name}
                            </span>
                            <div style={{ fontSize: 11, color: "#0284c7", marginTop: 2 }}>
                              {reg.suggested_college.match_reason || `${reg.suggested_college.score}% confidence`}
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: 11.5,
                              color: "#6b7280",
                              background: "#f3f4f6",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 500,
                              display: "inline-block",
                            }}
                          >
                            ✨ New College Record
                          </span>
                        )}
                        {reg.remarks && (
                          <button
                            type="button"
                            onClick={() => setSelectedRemarks({ name: reg.full_name, remarks: reg.remarks })}
                            style={{
                              display: "block",
                              marginTop: 4,
                              fontSize: 11,
                              color: "#6327BD",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              textDecoration: "underline",
                            }}
                          >
                            View Remarks
                          </button>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                        {formatDate(reg.created_at)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: 12,
                            background: statusColors.bg,
                            color: statusColors.text,
                            display: "inline-block",
                          }}
                        >
                          {statusColors.label}
                        </span>
                        {reg.rejection_reason && (
                          <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 4, maxWidth: 160 }}>
                            Reason: {reg.rejection_reason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px" }}>
                        {reg.status === "pending" ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => openApproveModal(reg)}
                              disabled={isActing}
                              style={{
                                background: "#16a34a",
                                color: "#fff",
                                border: "none",
                                padding: "5px 12px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: isActing ? "not-allowed" : "pointer",
                                opacity: isActing ? 0.7 : 1,
                              }}
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReject(reg)}
                              disabled={isActing}
                              title="Reject registration"
                              style={{
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "1px solid #fca5a5",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: isActing ? "not-allowed" : "pointer",
                                opacity: isActing ? 0.7 : 1,
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : reg.status === "approved" && reg.colleges && onViewCollege ? (
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => onViewCollege(reg.colleges.id, reg.colleges.name)}
                            style={{
                              padding: "4px 9px",
                              fontSize: 11.5,
                              color: "#4338ca",
                              borderColor: "#c7d2fe",
                              background: "#eef2ff",
                            }}
                          >
                            View in Directory ↗
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVAL MODAL */}
      {approvalModalReg && (
        <div
          onClick={() => !modalSubmitting && setApprovalModalReg(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: 580,
              maxWidth: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e2e8f0",
              padding: "24px 28px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                  Approve Placement Coordinator
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                  Verify institution linkage to keep the Colleges Directory accurate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !modalSubmitting && setApprovalModalReg(null)}
                style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Coordinator Details Card */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 18,
                fontSize: 13,
                color: "#334155",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={{ color: "#64748b", fontSize: 11.5, display: "block" }}>COORDINATOR</span>
                  <strong style={{ color: "#0f172a" }}>{approvalModalReg.full_name}</strong>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{approvalModalReg.designation}</div>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: 11.5, display: "block" }}>CONTACT</span>
                  <div>✉️ {approvalModalReg.official_email}</div>
                  <div>📞 {approvalModalReg.phone}</div>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: 11.5, display: "block" }}>SUBMITTED COLLEGE</span>
                  <strong style={{ color: "#0f172a" }}>{approvalModalReg.college_name}</strong>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {approvalModalReg.city}, {approvalModalReg.state}
                  </div>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: 11.5, display: "block" }}>CATEGORY & WEBSITE</span>
                  <div>{approvalModalReg.category}</div>
                  <div style={{ fontSize: 12, color: "#2563eb" }}>
                    {approvalModalReg.website ? (
                      <a href={approvalModalReg.website} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                        {approvalModalReg.website} ↗
                      </a>
                    ) : (
                      "No website provided"
                    )}
                  </div>
                </div>
                {approvalModalReg.courses_available && (
                  <div style={{ gridColumn: "1 / -1", marginTop: 4, paddingTop: 8, borderTop: "1px dashed #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontSize: 11.5, display: "block" }}>COURSES OFFERED</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                      {approvalModalReg.courses_available.split(/[;,]/).map((c, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            background: "#ede9fe",
                            color: "#6d28d9",
                            padding: "2px 7px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {c.trim()}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      ℹ On approval, courses will be merged with the college directory record without duplicates.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Matching Options */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
                College Directory Action:
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Option A: Suggested Matches */}
                {(approvalModalReg.potential_matches || []).length > 0 && (
                  <div
                    style={{
                      border: approvalType === "matched" ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                      background: approvalType === "matched" ? "#eff6ff" : "#ffffff",
                      borderRadius: 10,
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setApprovalType("matched");
                      if (!selectedTargetCollegeId && approvalModalReg.potential_matches[0]) {
                        setSelectedTargetCollegeId(approvalModalReg.potential_matches[0].id);
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name="approval_type"
                        checked={approvalType === "matched"}
                        onChange={() => setApprovalType("matched")}
                      />
                      <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13.5 }}>
                        Link to Matched Existing College
                      </span>
                    </div>

                    <div style={{ marginTop: 8, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 6 }}>
                      {approvalModalReg.potential_matches.map((m) => (
                        <label
                          key={m.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: selectedTargetCollegeId === m.id ? "#dbeafe" : "#f8fafc",
                            cursor: "pointer",
                            fontSize: 12.5,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="radio"
                              name="matched_candidate"
                              value={m.id}
                              checked={selectedTargetCollegeId === m.id}
                              onChange={() => {
                                setApprovalType("matched");
                                setSelectedTargetCollegeId(m.id);
                              }}
                            />
                            <strong>{m.name}</strong> ({m.city || "No city"})
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#1d4ed8",
                              background: "#bfdbfe",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {m.score}% Match
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Option B: Choose Other College from Directory */}
                <div
                  style={{
                    border: approvalType === "select" ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                    background: approvalType === "select" ? "#eff6ff" : "#ffffff",
                    borderRadius: 10,
                    padding: "12px 14px",
                    cursor: "pointer",
                  }}
                  onClick={() => setApprovalType("select")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="radio"
                      name="approval_type"
                      checked={approvalType === "select"}
                      onChange={() => setApprovalType("select")}
                    />
                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13.5 }}>
                      Search & Link to Another College in Directory
                    </span>
                  </div>

                  {approvalType === "select" && (
                    <div style={{ marginTop: 10, paddingLeft: 24 }}>
                      <input
                        type="text"
                        placeholder="Type to filter directory colleges…"
                        value={collegeSearchFilter}
                        onChange={(e) => setCollegeSearchFilter(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          marginBottom: 6,
                          boxSizing: "border-box",
                        }}
                      />
                      <select
                        size={5}
                        value={selectedTargetCollegeId}
                        onChange={(e) => setSelectedTargetCollegeId(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          background: "#fff",
                          boxSizing: "border-box",
                        }}
                      >
                        {filteredCollegesForDropdown.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.city ? `(${c.city})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Option C: Confirm Institution is Genuinely New */}
                <div
                  style={{
                    border: approvalType === "new" ? "2px solid #10b981" : "1px solid #e2e8f0",
                    background: approvalType === "new" ? "#f0fdf4" : "#ffffff",
                    borderRadius: 10,
                    padding: "12px 14px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setApprovalType("new");
                    setSelectedTargetCollegeId("");
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="radio"
                      name="approval_type"
                      checked={approvalType === "new"}
                      onChange={() => {
                        setApprovalType("new");
                        setSelectedTargetCollegeId("");
                      }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13.5 }}>
                        Confirm Institution is Genuinely New
                      </span>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Create one new record in Colleges Directory for "{approvalModalReg.college_name}"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {modalError && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  marginBottom: 16,
                }}
              >
                ⚠️ {modalError}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setApprovalModalReg(null)}
                disabled={modalSubmitting}
                style={{ padding: "8px 16px", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={modalSubmitting}
                style={{
                  background: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: modalSubmitting ? "not-allowed" : "pointer",
                  opacity: modalSubmitting ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {modalSubmitting ? "Approving & Linking…" : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remarks Modal */}
      {selectedRemarks && (
        <div
          onClick={() => setSelectedRemarks(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{ width: 440, maxWidth: "90%", borderRadius: 12 }}
          >
            <h3 style={{ marginTop: 0 }}>Remarks from {selectedRemarks.name}</h3>
            <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {selectedRemarks.remarks}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setSelectedRemarks(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
