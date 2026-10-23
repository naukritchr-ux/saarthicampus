import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getCoordinatorRegistrations,
  approveCoordinatorRegistration,
  rejectCoordinatorRegistration,
} from "../lib/api";

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

export default function CoordinatorReview({ onPendingCountChange }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const copyPublicLink = () => {
    const origin = window.location.origin;
    const url = `${origin}/placement-coordinator/register`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleApprove = async (reg) => {
    const confirmMsg = reg.suggested_college
      ? `Approve registration for ${reg.full_name} and link to existing college "${reg.suggested_college.name}"?`
      : `Approve registration for ${reg.full_name} and create new college "${reg.college_name}" in database?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(reg.id);
    try {
      await approveCoordinatorRegistration(reg.id, {
        target_college_id: reg.suggested_college?.id || undefined,
      });
      await loadData();
    } catch (err) {
      alert("Approval failed: " + err.message);
    } finally {
      setActionLoadingId(null);
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
            Review and approve public onboarding submissions from college placement coordinators (TPOs).
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
          <div style={{ fontSize: 11.5, color: "#047857" }}>Active coordinators</div>
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
                <th style={{ padding: "12px 16px" }}>College Matching</th>
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
                        ) : reg.suggested_college ? (
                          <span
                            title={`College ID: ${reg.suggested_college.id}`}
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
                            🏢 Matches: {reg.suggested_college.name}
                          </span>
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
                              onClick={() => handleApprove(reg)}
                              disabled={isActing}
                              title={reg.suggested_college ? "Approve & Link to existing college" : "Approve & Create new college"}
                              style={{
                                background: "#16a34a",
                                color: "#fff",
                                border: "none",
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: isActing ? "not-allowed" : "pointer",
                                opacity: isActing ? 0.7 : 1,
                              }}
                            >
                              {isActing ? "…" : "Approve"}
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
