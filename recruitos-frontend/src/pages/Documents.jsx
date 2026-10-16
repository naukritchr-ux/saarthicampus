import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  sanitizeFileName,
  validateUploadFile,
  getDocumentSignedUrl,
  updateApplicationDocument,
} from "../lib/api";

const DOC_FIELDS = [
  { key: "id_proof", label: "ID Proof" },
  { key: "marksheet", label: "Marksheet" },
  { key: "offer_letter", label: "Offer Letter" },
];

const STATUS_OPTIONS = ["Pending", "Submitted", "Verified", "Rejected"];

const statusColors = {
  Pending: { bg: "#FFF3E0", text: "#A15C00" },
  Submitted: { bg: "#E3F2FD", text: "#1565C0" },
  Verified: { bg: "#E8F7EE", text: "#16803A" },
  Rejected: { bg: "#FDECEC", text: "#c0392b" },
};

export default function Documents() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [uploadingKey, setUploadingKey] = useState(null);

  async function loadApprovedCandidates() {
    setLoading(true);
    setError(null);

    const { data: profile } = await supabase.auth.getUser();
    const userId = profile?.user?.id;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (!profileRow?.company_id) {
      setError("No company linked to this account.");
      setLoading(false);
      return;
    }

    const { data: myJobs } = await supabase
      .from("job_profiles")
      .select("id, title")
      .eq("company_id", profileRow.company_id);

    const jobIds = (myJobs || []).map((j) => j.id);
    if (jobIds.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("applications")
      .select(
        `
        id, stage,
        id_proof_url, marksheet_url, offer_letter_url,
        id_proof_status, marksheet_status, offer_letter_status,
        candidates ( id, name, email, resume_url ),
        job_profiles ( title )
      `,
      )
      .in("job_id", jobIds)
      .eq("stage", "Selected")
      .order("created_at", { ascending: false });

    if (error) {
      setError("Could not load approved candidates.");
    } else {
      setApplications(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function init() {
      await loadApprovedCandidates(ignore);
    }

    init();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleOpenDoc(url) {
    if (!url) return;
    try {
      const signedUrl = await getDocumentSignedUrl({ url });
      window.open(signedUrl, "_blank", "noreferrer");
    } catch {
      window.open(url, "_blank", "noreferrer");
    }
  }

  async function handleFileUpload(appId, docKey, file) {
    if (!file) return;
    setUploadingKey(`${appId}-${docKey}`);

    try {
      validateUploadFile(file, {
        allowedTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxSize: 10 * 1024 * 1024,
        typeLabel: "Document",
      });

      const timestamp = Date.now();
      const safeName = sanitizeFileName(file.name);
      const fileName = `${appId}_${docKey}_${timestamp}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("candidate-documents")
        .upload(fileName, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("candidate-documents")
        .getPublicUrl(fileName);

      await updateApplicationDocument(appId, docKey, urlData.publicUrl);

      await loadApprovedCandidates();
    } catch (err) {
      console.error("Document upload failed:", err);
      alert("Could not upload document: " + err.message);
    }
    setUploadingKey(null);
  }

  async function handleStatusChange(appId, docKey, newStatus) {
    const { error } = await supabase
      .from("applications")
      .update({ [`${docKey}_status`]: newStatus })
      .eq("id", appId);

    if (error) {
      alert("Could not update status.");
    } else {
      await loadApprovedCandidates();
    }
  }

  const overallStatus = (app) => {
    const statuses = DOC_FIELDS.map((d) => app[`${d.key}_status`] || "Pending");
    if (statuses.every((s) => s === "Verified")) return "Verified";
    if (statuses.some((s) => s === "Rejected")) return "Rejected";
    if (statuses.some((s) => s === "Submitted")) return "Submitted";
    return "Pending";
  };

  const filtered = applications.filter((a) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      a.candidates?.name?.toLowerCase().includes(q) ||
      a.job_profiles?.title?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "All" || overallStatus(a) === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="page active" id="page-documents">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>
            {loading
              ? "Loading…"
              : `${applications.length} approved candidates`}
            {" · "}
            required documents from selected candidates
          </p>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ color: "crimson" }}>
          {error}
        </div>
      )}

      <div className="panel">
        {/* SEARCH + STATUS FILTER */}
        <div className="toolbar">
          <input
            className="search-box"
            placeholder="Search candidate or job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {["All", ...STATUS_OPTIONS].map((f) => (
            <span
              key={f}
              className={`filter-chip ${statusFilter === f ? "sel" : ""}`}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </span>
          ))}
        </div>

        {/* TABLE */}
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table
            className="data-table"
            style={{ width: "100%", minWidth: 1100 }}
          >
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Resume</th>
                <th>ID Proof</th>
                <th>Marksheet</th>
                <th>Offer Letter</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <strong>{app.candidates?.name}</strong>
                      <div
                        style={{ fontSize: 11.5, color: "var(--text-muted)" }}
                      >
                        {app.candidates?.email}
                      </div>
                    </td>
                    <td>{app.job_profiles?.title || "—"}</td>
                    <td>
                      {app.candidates?.resume_url ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDoc(app.candidates.resume_url)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "var(--primary)",
                            cursor: "pointer",
                            textDecoration: "underline",
                            font: "inherit",
                            fontSize: 12,
                          }}
                        >
                          View
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>

                    {DOC_FIELDS.map((doc) => {
                      const url = app[`${doc.key}_url`];
                      const status = app[`${doc.key}_status`] || "Pending";
                      const isUploading =
                        uploadingKey === `${app.id}-${doc.key}`;

                      return (
                        <td key={doc.key}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              minWidth: 130,
                            }}
                          >
                            {url ? (
                              <button
                                type="button"
                                onClick={() => handleOpenDoc(url)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: "var(--primary)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  textDecoration: "underline",
                                  font: "inherit",
                                  fontSize: 11.5,
                                }}
                              >
                                View File
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                }}
                              >
                                {isUploading ? "Uploading…" : "Not uploaded"}
                              </span>
                            )}

                            <input
                              type="file"
                              onChange={(e) =>
                                handleFileUpload(
                                  app.id,
                                  doc.key,
                                  e.target.files[0],
                                )
                              }
                              style={{ fontSize: 10.5 }}
                            />

                            <select
                              value={status}
                              onChange={(e) =>
                                handleStatusChange(
                                  app.id,
                                  doc.key,
                                  e.target.value,
                                )
                              }
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                border: "none",
                                borderRadius: 6,
                                padding: "2px 6px",
                                cursor: "pointer",
                                background: statusColors[status]?.bg,
                                color: statusColors[status]?.text,
                              }}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      );
                    })}

                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: statusColors[overallStatus(app)]?.bg,
                          color: statusColors[overallStatus(app)]?.text,
                        }}
                      >
                        {overallStatus(app)}
                      </span>
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
                    No approved candidates yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
