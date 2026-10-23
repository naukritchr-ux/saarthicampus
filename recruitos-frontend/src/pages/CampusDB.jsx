import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { sanitizePhone } from "../lib/phone";
import { isValidEmail } from "../lib/email";
import AIImport from "../components/AIImport";
import CoordinatorReview from "../components/CoordinatorReview";

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

const todayDateStr = () => new Date().toISOString().split("T")[0];

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

const createInitialCoordinator = () => ({
  name: "",
  phone: "",
  email: "",
  effective_from: todayDateStr(),
});

const emptyCoordForm = {
  name: "",
  phone: "",
  email: "",
  effective_from: todayDateStr(),
};

function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoDate) {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export default function CampusDB({ user }) {
  const [activeCourse, setActiveCourse] = useState("All");
  const [customCourseText, setCustomCourseText] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Status");
  const [activeTab, setActiveTab] = useState("colleges"); // "colleges" | "coordinators"
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);

  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add/Edit college popup
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newCoordinators, setNewCoordinators] = useState([createInitialCoordinator()]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [newCoordErrors, setNewCoordErrors] = useState({});

  // Excel import
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Placement coordinators
  const [coordinatorsByCollege, setCoordinatorsByCollege] = useState({});
  const [loadingCoordinators, setLoadingCoordinators] = useState(false);

  // Coordinator add / replace form
  const [showCoordinatorForm, setShowCoordinatorForm] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replacingTargetCoord, setReplacingTargetCoord] = useState(null);
  const [coordForm, setCoordForm] = useState(emptyCoordForm);
  const [savingCoord, setSavingCoord] = useState(false);

  // Edit existing coordinator details
  const [editingCoord, setEditingCoord] = useState(null);
  const [editCoordForm, setEditCoordForm] = useState({
    name: "",
    phone: "",
    email: "",
    effective_from: "",
  });
  const [savingEditCoord, setSavingEditCoord] = useState(false);

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [selectedHistoryCoordId, setSelectedHistoryCoordId] = useState(null);

  const [showImport, setShowImport] = useState(false);

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

        supabase
          .from("coordinator_registrations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .then(({ count }) => {
            if (!ignore && typeof count === "number") setPendingRegistrationsCount(count);
          });
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

    setFormErrors({});
    setNewCoordErrors({});
    setNewCoordinators([createInitialCoordinator()]);
    setShowCoordinatorForm(false);
    setIsReplacing(false);
    setReplacingTargetCoord(null);
    setCoordForm(emptyCoordForm);
    setEditingCoord(null);
    setShowHistoryModal(false);

    setShowForm(true);

    // Load coordinators for this college
    loadCoordinators(c.id);
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setNewCoordErrors({});
    setNewCoordinators([createInitialCoordinator()]);

    setShowCoordinatorForm(false);
    setIsReplacing(false);
    setReplacingTargetCoord(null);
    setCoordForm(emptyCoordForm);
    setEditingCoord(null);
    setShowHistoryModal(false);

    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setNewCoordErrors({});
    setNewCoordinators([createInitialCoordinator()]);

    setShowCoordinatorForm(false);
    setIsReplacing(false);
    setReplacingTargetCoord(null);
    setCoordForm(emptyCoordForm);
    setEditingCoord(null);
    setShowHistoryModal(false);
  }

  function handleNewCoordinatorChange(index, field, value) {
    setNewCoordinators((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

    if (newCoordErrors[index]?.[field]) {
      setNewCoordErrors((prev) => {
        const next = { ...prev };
        if (next[index]) {
          const nextRow = { ...next[index] };
          delete nextRow[field];
          if (Object.keys(nextRow).length === 0) {
            delete next[index];
          } else {
            next[index] = nextRow;
          }
        }
        return next;
      });
    }
  }

  function handleAddCoordinatorField() {
    setNewCoordinators((prev) => [...prev, createInitialCoordinator()]);
  }

  function handleRemoveCoordinatorField(index) {
    setNewCoordinators((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });

    setNewCoordErrors((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => {
        const ki = parseInt(k, 10);
        if (ki < index) next[ki] = prev[ki];
        else if (ki > index) next[ki - 1] = prev[ki];
      });
      return next;
    });
  }

  // Client-side helper fallback to aggregate ALL active coordinators into colleges.tpo
  async function syncCollegeTpoClientFallback(collegeId) {
    if (!collegeId) return;
    try {
      const { data: activeCoords, error } = await supabase
        .from("placement_coordinators")
        .select("name, created_at")
        .eq("college_id", collegeId)
        .eq("is_current", true)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Could not query active coordinators for tpo sync fallback:", error);
        return;
      }

      const names = [];
      (activeCoords || []).forEach((c) => {
        const trimmed = (c.name || "").trim();
        if (trimmed && !names.includes(trimmed)) {
          names.push(trimmed);
        }
      });

      const combined = names.length > 0 ? names.join(", ") : null;
      await supabase
        .from("colleges")
        .update({ tpo: combined })
        .eq("id", collegeId);

      setForm((prev) => ({
        ...prev,
        tpo: combined || "",
      }));

      return combined;
    } catch (e) {
      console.warn("Error in syncCollegeTpoClientFallback:", e);
    }
  }

  async function handleSaveCollege(e) {
    e.preventDefault();

    const errors = {};
    const coordErrors = {};
    let hasCoordErrors = false;
    let firstInvalidTargetId = null;

    if (!form.name.trim()) {
      errors.name = "Please enter college name.";
      firstInvalidTargetId = "college-name-input";
    }

    if (!editingId) {
      for (let i = 0; i < newCoordinators.length; i++) {
        const c = newCoordinators[i];
        const rowErr = {};

        // 1. Placement Coordinator Name (Mandatory)
        if (!c.name?.trim()) {
          rowErr.name = "Placement Coordinator Name is required.";
          if (!firstInvalidTargetId) {
            firstInvalidTargetId = `coord-name-${i}`;
          }
        }

        // 2. Contact Number (Mandatory, 10 digits)
        const cleanPhone = (c.phone || "").trim();
        if (!cleanPhone) {
          rowErr.phone = "Contact Number is required.";
          if (!firstInvalidTargetId) {
            firstInvalidTargetId = `coord-phone-${i}`;
          }
        } else if (cleanPhone.length !== 10) {
          rowErr.phone = "Please enter a valid 10-digit Contact Number.";
          if (!firstInvalidTargetId) {
            firstInvalidTargetId = `coord-phone-${i}`;
          }
        }

        // 3. Email Address (Mandatory, valid email format)
        const cleanEmail = (c.email || "").trim();
        if (!cleanEmail) {
          rowErr.email = "Email Address is required.";
          if (!firstInvalidTargetId) {
            firstInvalidTargetId = `coord-email-${i}`;
          }
        } else if (!isValidEmail(cleanEmail)) {
          rowErr.email = "Please enter a valid Email Address.";
          if (!firstInvalidTargetId) {
            firstInvalidTargetId = `coord-email-${i}`;
          }
        }

        // 4. Effective From Date (Mandatory, valid date)
        if (!c.effective_from || isNaN(new Date(c.effective_from).getTime())) {
          rowErr.effective_from = "Please enter a valid Effective From Date.";
          if (!firstInvalidTargetId) {
            firstInvalidTargetId = `coord-date-${i}`;
          }
        }

        if (Object.keys(rowErr).length > 0) {
          coordErrors[i] = rowErr;
          hasCoordErrors = true;
        }
      }
    }

    if (Object.keys(errors).length > 0 || hasCoordErrors) {
      setFormErrors(errors);
      setNewCoordErrors(coordErrors);

      if (firstInvalidTargetId) {
        setTimeout(() => {
          const el = document.getElementById(firstInvalidTargetId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            if (typeof el.focus === "function") {
              el.focus();
            }
          }
        }, 50);
      }
      return;
    }

    setSaving(true);

    const validCoordinators = !editingId
      ? newCoordinators.map((c) => ({
          name: c.name.trim(),
          phone: c.phone.trim(),
          email: c.email.trim(),
          effective_from: c.effective_from || todayDateStr(),
        }))
      : [];

    // Consistent formatting rule: Comma-separated list of ALL active placement coordinator names
    const combinedTpo = !editingId
      ? (validCoordinators.length > 0
          ? validCoordinators.map((c) => c.name).filter(Boolean).join(", ")
          : (form.tpo?.trim() || null))
      : (form.tpo?.trim() || null);

    const payload = {
      name: form.name.trim(),
      city: form.city?.trim() || null,
      course: form.course || null,
      tpo: combinedTpo,
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
      // Atomic RPC creation for college, coordinators, and audit history
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "create_college_with_coordinators",
          {
            p_college: payload,
            p_coordinators: validCoordinators,
          }
        );

        if (rpcError) {
          if (isRpcMissingError(rpcError)) {
            throw new Error(
              "The atomic database RPC 'create_college_with_coordinators' is not installed in Supabase. " +
              "Please run the database migration before creating colleges."
            );
          }
          throw new Error(rpcError.message || "Failed to create college");
        }

        const newCollegeId = rpcData?.college?.id;
        await loadColleges();

        if (newCollegeId) {
          setEditingId(newCollegeId);
          await loadCoordinators(newCollegeId);
        }

        const countMsg = validCoordinators.length > 0
          ? ` and ${validCoordinators.length} placement coordinator(s)`
          : "";
        alert(`College${countMsg} saved successfully.`);
      } catch (err) {
        console.error("Failed to add college:", err);
        alert(err.message || "Could not add college. Check console for details.");
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
  // COORDINATORS & AUDIT HISTORY
  // --------------------------------------------------

  async function getCurrentUserDisplay() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentAuthUser = authData?.user || user;
      if (!currentAuthUser) {
        return { id: null, name: "Staff", email: null };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", currentAuthUser.id)
        .single();

      const resolvedName =
        profile?.name ||
        currentAuthUser.user_metadata?.name ||
        currentAuthUser.user_metadata?.full_name ||
        currentAuthUser.email?.split("@")[0] ||
        "Staff";

      return {
        id: currentAuthUser.id,
        name: resolvedName,
        email: profile?.email || currentAuthUser.email || null,
      };
    } catch {
      return { id: user?.id || null, name: "Staff", email: user?.email || null };
    }
  }

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

  function openCoordinatorForm(replace = false, targetCoord = null) {
    if (!editingId) {
      alert("Please save the college first before adding a coordinator.");
      return;
    }

    setIsReplacing(replace);
    setReplacingTargetCoord(targetCoord);
    setCoordForm(emptyCoordForm);
    setShowCoordinatorForm(true);
  }

  function cancelCoordinatorForm() {
    setShowCoordinatorForm(false);
    setIsReplacing(false);
    setReplacingTargetCoord(null);
    setCoordForm(emptyCoordForm);
  }

  function openEditCoordinatorModal(coord) {
    setEditingCoord(coord);
    setEditCoordForm({
      name: coord.name || "",
      phone: coord.phone || "",
      email: coord.email || "",
      effective_from: coord.effective_from
        ? coord.effective_from.split("T")[0]
        : todayDateStr(),
    });
  }

  function cancelEditCoordinatorModal() {
    setEditingCoord(null);
    setEditCoordForm({
      name: "",
      phone: "",
      email: "",
      effective_from: "",
    });
  }

  async function openHistoryModal(coordId = null) {
    if (!editingId) return;
    setSelectedHistoryCoordId(coordId);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      let query = supabase
        .from("placement_coordinator_history")
        .select("*")
        .eq("college_id", editingId)
        .order("changed_at", { ascending: false });

      if (coordId) {
        query = query.eq("coordinator_id", coordId);
      }

      const { data, error: histError } = await query;
      if (histError) {
        console.warn("Could not load from placement_coordinator_history:", histError);
        setHistoryList([]);
      } else {
        setHistoryList(data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistoryModal() {
    setShowHistoryModal(false);
    setSelectedHistoryCoordId(null);
    setHistoryList([]);
  }

  function isRpcMissingError(err) {
    if (!err) return false;
    const msg = (err.message || "").toLowerCase();
    const code = err.code || "";
    return (
      code === "PGRST202" ||
      code === "42883" ||
      msg.includes("function") ||
      msg.includes("not found") ||
      msg.includes("schema cache")
    );
  }

  // Fallback for Add/Replace if RPC function is not yet deployed
  async function fallbackAddOrReplaceCoordinator(currentCoord) {
    const userInfo = await getCurrentUserDisplay();
    const nowIso = new Date().toISOString();

    // 1. Archive previous current coordinator
    if (currentCoord) {
      const { error: archErr } = await supabase
        .from("placement_coordinators")
        .update({
          is_current: false,
          ended_at: nowIso,
          updated_at: nowIso,
          updated_by: userInfo.id,
          updated_by_name: userInfo.name,
        })
        .eq("id", currentCoord.id);

      if (archErr) throw archErr;

      // History insertion MUST succeed
      const { error: histArchErr } = await supabase.from("placement_coordinator_history").insert([
        {
          college_id: editingId,
          coordinator_id: currentCoord.id,
          action: "REPLACED",
          previous_values: {
            name: currentCoord.name,
            phone: currentCoord.phone,
            email: currentCoord.email,
            is_current: true,
            effective_from: currentCoord.effective_from,
          },
          new_values: {
            is_current: false,
            ended_at: nowIso,
            replaced_by: coordForm.name.trim(),
          },
          changed_at: nowIso,
          changed_by: userInfo.id,
          changed_by_name: userInfo.name,
          changed_by_email: userInfo.email,
        },
      ]);

      if (histArchErr) {
        throw new Error("Failed to record outgoing coordinator in audit history: " + histArchErr.message);
      }
    }

    // 2. Insert new coordinator
    const { data: newCoordRows, error: insertError } = await supabase
      .from("placement_coordinators")
      .insert([
        {
          college_id: editingId,
          name: coordForm.name.trim(),
          phone: coordForm.phone || null,
          email: coordForm.email || null,
          is_current: true,
          effective_from: coordForm.effective_from || todayDateStr(),
          created_at: nowIso,
          updated_at: nowIso,
          created_by: userInfo.id,
          created_by_name: userInfo.name,
          updated_by: userInfo.id,
          updated_by_name: userInfo.name,
        },
      ])
      .select();

    if (insertError) throw insertError;

    const newCoordId = newCoordRows?.[0]?.id;

    // 3. Log history for new coordinator - MUST succeed
    const { error: histCreateErr } = await supabase.from("placement_coordinator_history").insert([
      {
        college_id: editingId,
        coordinator_id: newCoordId,
        action: "CREATED",
        previous_values: null,
        new_values: {
          name: coordForm.name.trim(),
          phone: coordForm.phone || null,
          email: coordForm.email || null,
          is_current: true,
          effective_from: coordForm.effective_from || todayDateStr(),
        },
        changed_at: nowIso,
        changed_by: userInfo.id,
        changed_by_name: userInfo.name,
        changed_by_email: userInfo.email,
      },
    ]);

    if (histCreateErr) {
      throw new Error("Failed to record new coordinator in audit history: " + histCreateErr.message);
    }

    // 4. Synchronize colleges.tpo with all active coordinators
    await syncCollegeTpoClientFallback(editingId);
  }

  // Fallback for adding a coordinator without retiring existing coordinators
  async function fallbackAddCoordinatorWithoutRetiring() {
    const userInfo = await getCurrentUserDisplay();
    const nowIso = new Date().toISOString();

    const { data: newCoordRows, error: insertError } = await supabase
      .from("placement_coordinators")
      .insert([
        {
          college_id: editingId,
          name: coordForm.name.trim(),
          phone: coordForm.phone || null,
          email: coordForm.email || null,
          is_current: true,
          effective_from: coordForm.effective_from || todayDateStr(),
          created_at: nowIso,
          updated_at: nowIso,
          created_by: userInfo.id,
          created_by_name: userInfo.name,
          updated_by: userInfo.id,
          updated_by_name: userInfo.name,
        },
      ])
      .select();

    if (insertError) throw insertError;

    const newCoordId = newCoordRows?.[0]?.id;

    const { error: histCreateErr } = await supabase.from("placement_coordinator_history").insert([
      {
        college_id: editingId,
        coordinator_id: newCoordId,
        action: "CREATED",
        previous_values: null,
        new_values: {
          name: coordForm.name.trim(),
          phone: coordForm.phone || null,
          email: coordForm.email || null,
          is_current: true,
          effective_from: coordForm.effective_from || todayDateStr(),
        },
        changed_at: nowIso,
        changed_by: userInfo.id,
        changed_by_name: userInfo.name,
        changed_by_email: userInfo.email,
      },
    ]);

    if (histCreateErr) {
      throw new Error("Failed to record new coordinator in audit history: " + histCreateErr.message);
    }

    // Synchronize colleges.tpo with all active coordinators
    await syncCollegeTpoClientFallback(editingId);
  }

  async function handleAddOrReplaceCoordinator(e) {
    e.preventDefault();

    if (!editingId) {
      alert("Please save the college first.");
      return;
    }

    const trimmedName = coordForm.name.trim();
    if (!trimmedName) {
      alert("Placement Coordinator Name is required.");
      return;
    }

    const cleanPhone = sanitizePhone ? sanitizePhone(coordForm.phone || "") : (coordForm.phone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      alert("Contact Number is required.");
      return;
    }
    if (cleanPhone.length !== 10) {
      alert("Please enter a valid 10-digit Contact Number.");
      return;
    }

    const cleanEmail = (coordForm.email || "").trim();
    if (!cleanEmail) {
      alert("Email Address is required.");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      alert("Please enter a valid Email Address.");
      return;
    }

    const effectiveDate = (coordForm.effective_from || "").trim();
    if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || isNaN(new Date(effectiveDate + "T00:00:00").getTime())) {
      alert("Please enter a valid Effective From Date.");
      return;
    }

    const currentList = coordinatorsByCollege[editingId] || [];
    const activeList = currentList.filter((c) => c.is_current);

    if (isReplacing && activeList.length > 1 && !replacingTargetCoord) {
      alert("College has multiple active coordinators. Please select which coordinator you want to replace.");
      return;
    }

    setSavingCoord(true);

    try {
      if (isReplacing) {
        // Find targeted coordinator to replace
        const targetCoord = replacingTargetCoord || (activeList.length === 1 ? activeList[0] : null);

        const { error: rpcError } = await supabase.rpc(
          "replace_placement_coordinator",
          {
            p_college_id: editingId.toString(),
            p_name: trimmedName,
            p_phone: cleanPhone,
            p_email: cleanEmail,
            p_effective_from: effectiveDate,
            p_target_coordinator_id: targetCoord?.id ? targetCoord.id.toString() : null,
          },
        );

        if (rpcError) {
          if (isRpcMissingError(rpcError)) {
            console.warn("replace_placement_coordinator RPC unavailable, using fallback:", rpcError);
            await fallbackAddOrReplaceCoordinator(targetCoord);
          } else {
            throw new Error(rpcError.message || "Failed to replace coordinator");
          }
        }
      } else {
        // Add new coordinator without retiring existing coordinators
        const { error: rpcError } = await supabase.rpc(
          "add_placement_coordinator",
          {
            p_college_id: editingId.toString(),
            p_name: trimmedName,
            p_phone: cleanPhone,
            p_email: cleanEmail,
            p_effective_from: effectiveDate,
          },
        );

        if (rpcError) {
          if (isRpcMissingError(rpcError)) {
            console.warn("add_placement_coordinator RPC unavailable, using fallback:", rpcError);
            await fallbackAddCoordinatorWithoutRetiring();
          } else {
            throw new Error(rpcError.message || "Failed to add coordinator");
          }
        }
      }

      await reloadCoordinators(editingId);
      await loadColleges();

      // Refresh form.tpo with newly synchronized all active coordinator names
      const { data: updatedCollegeRow } = await supabase
        .from("colleges")
        .select("tpo")
        .eq("id", editingId)
        .maybeSingle();

      if (updatedCollegeRow) {
        setForm((prev) => ({
          ...prev,
          tpo: updatedCollegeRow.tpo || "",
        }));
      }

      setShowCoordinatorForm(false);
      setIsReplacing(false);
      setReplacingTargetCoord(null);
      setCoordForm(emptyCoordForm);
    } catch (err) {
      console.error("Failed to add or replace coordinator:", err);
      alert("Could not save coordinator: " + (err.message || "Check console for details"));
    } finally {
      setSavingCoord(false);
    }
  }

  // Fallback for updating coordinator details if RPC function is not yet deployed
  async function fallbackUpdateCoordinatorDetails() {
    const userInfo = await getCurrentUserDisplay();
    const nowIso = new Date().toISOString();

    const prevVals = {
      name: editingCoord.name,
      phone: editingCoord.phone,
      email: editingCoord.email,
      effective_from: editingCoord.effective_from,
    };

    const newVals = {
      name: editCoordForm.name.trim(),
      phone: editCoordForm.phone || null,
      email: editCoordForm.email || null,
      effective_from: editCoordForm.effective_from || editingCoord.effective_from,
    };

    const { error: updateError } = await supabase
      .from("placement_coordinators")
      .update({
        name: newVals.name,
        phone: newVals.phone,
        email: newVals.email,
        effective_from: newVals.effective_from,
        updated_at: nowIso,
        updated_by: userInfo.id,
        updated_by_name: userInfo.name,
      })
      .eq("id", editingCoord.id);

    if (updateError) throw updateError;

    // Log history - MUST succeed
    const { error: histUpdateErr } = await supabase.from("placement_coordinator_history").insert([
      {
        college_id: editingId,
        coordinator_id: editingCoord.id,
        action: "UPDATED",
        previous_values: prevVals,
        new_values: newVals,
        changed_at: nowIso,
        changed_by: userInfo.id,
        changed_by_name: userInfo.name,
        changed_by_email: userInfo.email,
      },
    ]);

    if (histUpdateErr) {
      throw new Error("Failed to record update in audit history: " + histUpdateErr.message);
    }

    if (editingCoord.is_current) {
      await syncCollegeTpoClientFallback(editingId);
    }
  }

  async function handleUpdateCoordinatorDetails(e) {
    e.preventDefault();

    if (!editingCoord) return;

    const trimmedName = editCoordForm.name.trim();
    if (!trimmedName) {
      alert("Placement Coordinator Name is required.");
      return;
    }

    const cleanPhone = sanitizePhone ? sanitizePhone(editCoordForm.phone || "") : (editCoordForm.phone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      alert("Contact Number is required.");
      return;
    }
    if (cleanPhone.length !== 10) {
      alert("Please enter a valid 10-digit Contact Number.");
      return;
    }

    const cleanEmail = (editCoordForm.email || "").trim();
    if (!cleanEmail) {
      alert("Email Address is required.");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      alert("Please enter a valid Email Address.");
      return;
    }

    const effectiveDate = (editCoordForm.effective_from || "").trim();
    if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || isNaN(new Date(effectiveDate + "T00:00:00").getTime())) {
      alert("Please enter a valid Effective From Date.");
      return;
    }

    setSavingEditCoord(true);

    try {
      // Attempt PostgreSQL atomic RPC
      const { error: rpcError } = await supabase.rpc(
        "update_placement_coordinator_details",
        {
          p_coordinator_id: editingCoord.id.toString(),
          p_name: trimmedName,
          p_phone: cleanPhone,
          p_email: cleanEmail,
          p_effective_from: effectiveDate,
        },
      );

      if (rpcError) {
        if (isRpcMissingError(rpcError)) {
          console.warn("update_placement_coordinator_details RPC unavailable, using fallback:", rpcError);
          await fallbackUpdateCoordinatorDetails();
        } else {
          throw new Error(rpcError.message || "Failed to update coordinator");
        }
      }

      await reloadCoordinators(editingId);
      await loadColleges();

      // Refresh form.tpo with newly synchronized all active coordinator names
      const { data: updatedCollegeRow } = await supabase
        .from("colleges")
        .select("tpo")
        .eq("id", editingId)
        .maybeSingle();

      if (updatedCollegeRow) {
        setForm((prev) => ({
          ...prev,
          tpo: updatedCollegeRow.tpo || "",
        }));
      }

      setEditingCoord(null);
    } catch (err) {
      console.error("Failed to update coordinator details:", err);
      alert("Could not update coordinator: " + (err.message || "Check console for details"));
    } finally {
      setSavingEditCoord(false);
    }
  }

  async function fallbackRetireCoordinator(coord) {
    const userInfo = await getCurrentUserDisplay();
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("placement_coordinators")
      .update({
        is_current: false,
        ended_at: nowIso,
        updated_at: nowIso,
        updated_by: userInfo.id,
        updated_by_name: userInfo.name,
      })
      .eq("id", coord.id);

    if (error) throw error;

    const { error: histRetireErr } = await supabase.from("placement_coordinator_history").insert([
      {
        college_id: coord.college_id,
        coordinator_id: coord.id,
        action: "RETIRED",
        previous_values: {
          name: coord.name,
          phone: coord.phone,
          email: coord.email,
          is_current: true,
          effective_from: coord.effective_from,
          ended_at: coord.ended_at,
        },
        new_values: {
          is_current: false,
          ended_at: nowIso,
        },
        changed_at: nowIso,
        changed_by: userInfo.id,
        changed_by_name: userInfo.name,
        changed_by_email: userInfo.email,
      },
    ]);

    if (histRetireErr) {
      throw new Error("Failed to record retirement in audit history: " + histRetireErr.message);
    }

    // Recalculate colleges.tpo to contain only remaining active coordinators
    await syncCollegeTpoClientFallback(coord.college_id);
  }

  async function handleRetireCoordinator(coord) {
    if (
      !window.confirm(
        `Mark "${coord.name}" as no longer the current coordinator?\nThis safely archives the coordinator and preserves complete history.`,
      )
    ) {
      return;
    }

    try {
      const { error: rpcError } = await supabase.rpc(
        "retire_placement_coordinator",
        {
          p_coordinator_id: coord.id.toString(),
        },
      );

      if (rpcError) {
        if (isRpcMissingError(rpcError)) {
          console.warn("retire_placement_coordinator RPC unavailable, using fallback:", rpcError);
          await fallbackRetireCoordinator(coord);
        } else {
          throw new Error(rpcError.message || "Failed to retire coordinator");
        }
      }

      await reloadCoordinators(coord.college_id);
      await loadColleges();

      if (editingId && editingId.toString() === coord.college_id.toString()) {
        const { data: updatedCollegeRow } = await supabase
          .from("colleges")
          .select("tpo")
          .eq("id", coord.college_id)
          .maybeSingle();

        if (updatedCollegeRow) {
          setForm((prev) => ({
            ...prev,
            tpo: updatedCollegeRow.tpo || "",
          }));
        }
      }
    } catch (err) {
      console.error("Failed to retire coordinator:", err);
      alert("Could not update coordinator: " + (err.message || "Check console for details"));
    }
  }

  // --------------------------------------------------
  // CURRENT COLLEGE COORDINATORS
  // --------------------------------------------------

  const currentCollegeCoordinators = editingId
    ? (coordinatorsByCollege[editingId] ?? [])
    : [];

  const currentCoordinators = currentCollegeCoordinators.filter(
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

      {/* SECTION TABS */}
      <div style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--border-default)", marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => setActiveTab("colleges")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "colleges" ? "3px solid #6327BD" : "3px solid transparent",
            padding: "8px 4px 12px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "colleges" ? "#6327BD" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          🏫 Colleges Directory ({colleges.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("coordinators")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "coordinators" ? "3px solid #6327BD" : "3px solid transparent",
            padding: "8px 4px 12px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "coordinators" ? "#6327BD" : "var(--text-muted)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          📋 Placement Coordinator Requests
          {pendingRegistrationsCount > 0 && (
            <span
              style={{
                fontSize: 11,
                background: "#fef3c7",
                color: "#b45309",
                border: "1px solid #fde68a",
                padding: "1px 7px",
                borderRadius: 12,
                fontWeight: 800,
              }}
            >
              {pendingRegistrationsCount} pending
            </span>
          )}
        </button>
      </div>

      {activeTab === "coordinators" ? (
        <CoordinatorReview onPendingCountChange={setPendingRegistrationsCount} />
      ) : (
        <>

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
                <th>Placement Coordinators</th>
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
            placeholder="Search college, city, placement coordinators..."
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
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              overflow: "hidden",
            }}
          >
            {/* POPUP HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px 12px 20px",
                borderBottom: "1px solid var(--border-default, #e5e7eb)",
                flexShrink: 0,
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

            {/* SCROLLABLE BODY */}
            <div
              style={{
                padding: "16px 20px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {/* COLLEGE FORM */}

              <form
                id="college-form"
                onSubmit={handleSaveCollege}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <input
                    id="college-name-input"
                    className="search-box"
                    placeholder="College name *"
                    required
                    value={form.name}
                    style={formErrors.name ? { borderColor: "crimson", width: "100%" } : { width: "100%" }}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        name: e.target.value,
                      });
                      if (formErrors.name) {
                        setFormErrors((prev) => ({ ...prev, name: null }));
                      }
                    }}
                  />
                  {formErrors.name && (
                    <div style={{ color: "crimson", fontSize: 11, marginTop: 3 }}>
                      {formErrors.name}
                    </div>
                  )}
                </div>

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

                {editingId && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: 2,
                      }}
                    >
                      Placement Coordinators (Active)
                    </label>
                    <input
                      className="search-box"
                      placeholder="No active placement coordinators"
                      value={form.tpo || ""}
                      readOnly
                      title="Automatically synchronized from all active placement coordinators"
                      style={{
                        backgroundColor: "var(--bg-soft, #f8fafc)",
                        color: "var(--text-secondary, #475569)",
                        cursor: "default",
                        width: "100%",
                      }}
                    />
                  </div>
                )}

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

                {!editingId && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      marginTop: 4,
                      paddingTop: 12,
                      borderTop: "1px dashed var(--border-default, #e2e8f0)",
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
                            fontSize: 13,
                            color: "var(--text-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              width: 3,
                              height: 14,
                              borderRadius: 3,
                              background: "var(--primary, #7c3aed)",
                              display: "inline-block",
                            }}
                          />
                          Placement Coordinators
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          Add one or more coordinators. All active coordinator names will be synchronized.
                        </div>
                      </div>
                    </div>

                    {newCoordinators.map((coord, idx) => (
                      <div
                        key={idx}
                        id={`coordinator-card-${idx}`}
                        style={{
                          border: newCoordErrors[idx]
                            ? "1px solid #f87171"
                            : "1px solid var(--border-default, #e2e8f0)",
                          borderRadius: 8,
                          padding: "10px 12px",
                          background: "var(--bg-soft, #f8fafc)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--text-primary)",
                            }}
                          >
                            Placement Coordinator {idx + 1}
                          </div>

                          {newCoordinators.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCoordinatorField(idx)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "crimson",
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: "2px 6px",
                              }}
                            >
                              ✕ Remove coordinator
                            </button>
                          )}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                          }}
                        >
                          <div>
                            <input
                              id={`coord-name-${idx}`}
                              className="search-box"
                              placeholder="Placement Coordinator Name *"
                              value={coord.name}
                              style={newCoordErrors[idx]?.name ? { borderColor: "crimson", width: "100%" } : { width: "100%" }}
                              onChange={(e) =>
                                handleNewCoordinatorChange(
                                  idx,
                                  "name",
                                  e.target.value,
                                )
                              }
                            />
                            {newCoordErrors[idx]?.name && (
                              <div style={{ color: "crimson", fontSize: 11, marginTop: 3 }}>
                                {newCoordErrors[idx].name}
                              </div>
                            )}
                          </div>

                          <div>
                            <input
                              id={`coord-phone-${idx}`}
                              className="search-box"
                              placeholder="Contact Number *"
                              value={coord.phone}
                              style={newCoordErrors[idx]?.phone ? { borderColor: "crimson", width: "100%" } : { width: "100%" }}
                              onChange={(e) =>
                                handleNewCoordinatorChange(
                                  idx,
                                  "phone",
                                  sanitizePhone(e.target.value),
                                )
                              }
                              inputMode="numeric"
                              maxLength={10}
                            />
                            {newCoordErrors[idx]?.phone && (
                              <div style={{ color: "crimson", fontSize: 11, marginTop: 3 }}>
                                {newCoordErrors[idx].phone}
                              </div>
                            )}
                          </div>

                          <div>
                            <input
                              id={`coord-email-${idx}`}
                              className="search-box"
                              placeholder="Email Address *"
                              type="email"
                              value={coord.email}
                              style={newCoordErrors[idx]?.email ? { borderColor: "crimson", width: "100%" } : { width: "100%" }}
                              onChange={(e) =>
                                handleNewCoordinatorChange(
                                  idx,
                                  "email",
                                  e.target.value,
                                )
                              }
                            />
                            {newCoordErrors[idx]?.email && (
                              <div style={{ color: "crimson", fontSize: 11, marginTop: 3 }}>
                                {newCoordErrors[idx].email}
                              </div>
                            )}
                          </div>

                          <div>
                            <input
                              id={`coord-date-${idx}`}
                              className="search-box"
                              type="date"
                              value={coord.effective_from}
                              title="Effective From Date"
                              placeholder="Effective From Date *"
                              style={newCoordErrors[idx]?.effective_from ? { width: "100%", borderColor: "crimson" } : { width: "100%" }}
                              onChange={(e) =>
                                handleNewCoordinatorChange(
                                  idx,
                                  "effective_from",
                                  e.target.value,
                                )
                              }
                            />
                            {newCoordErrors[idx]?.effective_from && (
                              <div style={{ color: "crimson", fontSize: 11, marginTop: 3 }}>
                                {newCoordErrors[idx].effective_from}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={handleAddCoordinatorField}
                        style={{
                          fontSize: 12,
                          padding: "5px 12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 600,
                        }}
                      >
                        + Add Another Placement Coordinator
                      </button>
                    </div>
                  </div>
                )}
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
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
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
                      Manage current and previous coordinators with full change history
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => openHistoryModal(null)}
                      title="View all coordinator change events for this college"
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span>📜</span> Change History
                    </button>

                    <button
                      type="button"
                      className="btn-gold"
                      onClick={() => openCoordinatorForm(false)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      + Add Another Placement Coordinator
                    </button>
                  </div>
                </div>

                {/* ADD / REPLACE COORDINATOR FORM */}

                {showCoordinatorForm && (
                  <form
                    onSubmit={handleAddOrReplaceCoordinator}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: 12,
                      marginBottom: 14,
                      border: "1px solid var(--border-default, #e2e8f0)",
                      borderRadius: 10,
                      background: "var(--bg-soft, #f8fafc)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                      {isReplacing && replacingTargetCoord ? (
                        <div style={{ color: "#b45309", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>⚠️</span>
                          <span>
                            Appointing a replacement coordinator will archive{" "}
                            <b>{replacingTargetCoord.name}</b> and preserve all history.
                          </span>
                        </div>
                      ) : (
                        "Add Placement Coordinator"
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <input
                        className="search-box"
                        placeholder="Coordinator Full Name *"
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
                        placeholder="Mobile Number"
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
                        placeholder="Email Address"
                        type="email"
                        value={coordForm.email}
                        onChange={(e) =>
                          setCoordForm({
                            ...coordForm,
                            email: e.target.value,
                          })
                        }
                      />

                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            marginBottom: 2,
                          }}
                        >
                          Effective-From Date *
                        </label>
                        <input
                          className="search-box"
                          type="date"
                          required
                          value={coordForm.effective_from}
                          onChange={(e) =>
                            setCoordForm({
                              ...coordForm,
                              effective_from: e.target.value,
                            })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <button
                        className="btn-gold"
                        type="submit"
                        disabled={savingCoord}
                        style={{
                          padding: "6px 14px",
                          fontSize: 12,
                        }}
                      >
                        {savingCoord
                          ? "Saving…"
                          : isReplacing
                            ? "Confirm Replacement"
                            : "Save Coordinator"}
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
                    {currentCoordinators.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        {currentCoordinators.map((coord, idx) => (
                          <div
                            key={coord.id}
                            style={{
                              padding: "12px 14px",
                              borderRadius: 10,
                              background: "var(--bg-soft, #FAFAFC)",
                              border: "1px solid var(--border-default, #e2e8f0)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifySpace: "space-between",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 10,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    marginBottom: 3,
                                  }}
                                >
                                  {currentCoordinators.length > 1
                                    ? `Placement Coordinator ${idx + 1}`
                                    : "Current Placement Coordinator"}
                                </div>

                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 14,
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {coord.name}
                                </div>

                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--text-secondary)",
                                    marginTop: 3,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "6px 12px",
                                  }}
                                >
                                  {coord.phone && (
                                    <span>📞 {coord.phone}</span>
                                  )}
                                  {coord.email && (
                                    <span>✉️ {coord.email}</span>
                                  )}
                                  {!coord.phone && !coord.email && (
                                    <span>No contact details recorded</span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--text-muted)",
                                    marginTop: 6,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "4px 12px",
                                  }}
                                >
                                  <span>
                                    <b>Effective from:</b> {formatDate(coord.effective_from)}
                                  </span>
                                  <span>
                                    <b>Last updated:</b>{" "}
                                    {formatDateTime(coord.updated_at || coord.created_at)}
                                    {coord.updated_by_name || coord.created_by_name
                                      ? ` by ${coord.updated_by_name || coord.created_by_name}`
                                      : ""}
                                  </span>
                                </div>
                              </div>

                              <span className="badge green" style={{ flexShrink: 0 }}>
                                Current
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                marginTop: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="btn-outline"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 11.5,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                onClick={() => openEditCoordinatorModal(coord)}
                              >
                                <span>✏️</span> Edit Details
                              </button>

                              <button
                                type="button"
                                className="btn-outline"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 11.5,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                onClick={() => openCoordinatorForm(true, coord)}
                              >
                                <span>🔄</span> Replace
                              </button>

                              <button
                                type="button"
                                className="btn-outline"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 11.5,
                                  color: "#b45309",
                                }}
                                onClick={() => handleRetireCoordinator(coord)}
                              >
                                Mark as Left
                              </button>

                              <button
                                type="button"
                                className="btn-outline"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 11.5,
                                  marginLeft: "auto",
                                }}
                                onClick={() => openHistoryModal(coord.id)}
                              >
                                📜 History
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          background: "var(--bg-soft, #FAFAFC)",
                          border: "1px dashed var(--border-default, #ddd)",
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginBottom: 10,
                          textAlign: "center",
                        }}
                      >
                        No active placement coordinator assigned to this college yet.
                      </div>
                    )}

                    {/* PAST COORDINATORS */}

                    {pastCoordinators.length > 0 && (
                      <div
                        style={{
                          marginTop: 14,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            marginBottom: 8,
                          }}
                        >
                          Previous Coordinators ({pastCoordinators.length})
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {pastCoordinators.map((coord) => (
                            <div
                              key={coord.id}
                              style={{
                                padding: "10px 12px",
                                borderLeft: "3px solid #94a3b8",
                                background: "var(--bg-soft, #FAFAFC)",
                                borderRadius: "0 8px 8px 0",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 10,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "var(--text-primary)",
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
                                    {[coord.phone && `📞 ${coord.phone}`, coord.email && `✉️ ${coord.email}`]
                                      .filter(Boolean)
                                      .join(" · ") || "No contact info"}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: "var(--text-muted)",
                                      marginTop: 4,
                                    }}
                                  >
                                    <b>Tenure:</b> {formatDate(coord.effective_from)} —{" "}
                                    {coord.ended_at ? formatDate(coord.ended_at) : "Ended"}
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span className="badge gray">Past</span>

                                  <button
                                    type="button"
                                    className="btn-outline"
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: 11,
                                    }}
                                    onClick={() => openHistoryModal(coord.id)}
                                    title="View change history for this coordinator"
                                  >
                                    📜 History
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* EDIT COORDINATOR MODAL */}

                {editingCoord && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.55)",
                      zIndex: 1050,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 16,
                    }}
                    onClick={cancelEditCoordinatorModal}
                  >
                    <div
                      className="panel"
                      style={{
                        maxWidth: 480,
                        width: "100%",
                        background: "#fff",
                        borderRadius: 12,
                        padding: 20,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div className="panel-title" style={{ margin: 0 }}>
                            Edit Coordinator Details
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                            {editingCoord.name} ({editingCoord.is_current ? "Current" : "Past"})
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={cancelEditCoordinatorModal}
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

                      <form
                        onSubmit={handleUpdateCoordinatorDetails}
                        style={{ display: "flex", flexDirection: "column", gap: 10 }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            Coordinator Name *
                          </label>
                          <input
                            className="search-box"
                            placeholder="Full Name"
                            required
                            value={editCoordForm.name}
                            onChange={(e) =>
                              setEditCoordForm({
                                ...editCoordForm,
                                name: e.target.value,
                              })
                            }
                            style={{ width: "100%" }}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--text-muted)",
                                marginBottom: 3,
                              }}
                            >
                              Mobile Number
                            </label>
                            <input
                              className="search-box"
                              placeholder="Mobile"
                              value={editCoordForm.phone}
                              onChange={(e) =>
                                setEditCoordForm({
                                  ...editCoordForm,
                                  phone: sanitizePhone(e.target.value),
                                })
                              }
                              inputMode="numeric"
                              maxLength={10}
                              style={{ width: "100%" }}
                            />
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--text-muted)",
                                marginBottom: 3,
                              }}
                            >
                              Effective-From Date
                            </label>
                            <input
                              className="search-box"
                              type="date"
                              value={editCoordForm.effective_from}
                              onChange={(e) =>
                                setEditCoordForm({
                                  ...editCoordForm,
                                  effective_from: e.target.value,
                                })
                              }
                              style={{ width: "100%" }}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            Email Address
                          </label>
                          <input
                            className="search-box"
                            type="email"
                            placeholder="Email"
                            value={editCoordForm.email}
                            onChange={(e) =>
                              setEditCoordForm({
                                ...editCoordForm,
                                email: e.target.value,
                              })
                            }
                            style={{ width: "100%" }}
                          />
                        </div>

                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          ℹ️ All edits to name, phone, email, and effective date are preserved in the permanent change history.
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 10,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={cancelEditCoordinatorModal}
                            disabled={savingEditCoord}
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            className="btn-gold"
                            disabled={savingEditCoord}
                          >
                            {savingEditCoord ? "Saving…" : "Save Changes"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* AUDIT HISTORY MODAL */}

                {showHistoryModal && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.6)",
                      zIndex: 1100,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 16,
                    }}
                    onClick={closeHistoryModal}
                  >
                    <div
                      className="panel"
                      style={{
                        maxWidth: 620,
                        width: "100%",
                        maxHeight: "85vh",
                        overflowY: "auto",
                        background: "#fff",
                        borderRadius: 14,
                        padding: 22,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 16,
                          borderBottom: "1px solid var(--border-default, #eee)",
                          paddingBottom: 10,
                        }}
                      >
                        <div>
                          <div className="panel-title" style={{ margin: 0, fontSize: 16 }}>
                            📜 Placement Coordinator History
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                            {form.name} — complete chronological record of all changes
                          </div>
                          {selectedHistoryCoordId && (
                            <div style={{ marginTop: 6 }}>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ fontSize: 11, padding: "2px 8px" }}
                                onClick={() => openHistoryModal(null)}
                              >
                                Filtered by coordinator ✕ Show All
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={closeHistoryModal}
                          style={{
                            background: "none",
                            border: "none",
                            fontSize: 22,
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      {historyLoading ? (
                        <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                          Loading history entries…
                        </div>
                      ) : historyList.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: 32,
                            color: "var(--text-muted)",
                            background: "var(--bg-soft, #f8fafc)",
                            borderRadius: 10,
                            fontSize: 13,
                          }}
                        >
                          No history events recorded yet for this college.
                          <div style={{ fontSize: 11.5, marginTop: 4 }}>
                            Changes made to coordinators will automatically appear here with exact timestamps and author details.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {historyList.map((item) => {
                            const badgeClass =
                              item.action === "CREATED"
                                ? "green"
                                : item.action === "UPDATED"
                                  ? "blue"
                                  : item.action === "REPLACED"
                                    ? "gold"
                                    : "gray";

                            const prev = item.previous_values || {};
                            const next = item.new_values || {};

                            return (
                              <div
                                key={item.id}
                                style={{
                                  padding: "12px 14px",
                                  borderRadius: 10,
                                  background: "var(--bg-soft, #f8fafc)",
                                  border: "1px solid var(--border-default, #e2e8f0)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 6,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className={`badge ${badgeClass}`}>
                                      {item.action}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                                      {item.changed_by_name || item.changed_by_email || "Authorized User"}
                                    </span>
                                  </div>

                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {formatDateTime(item.changed_at)}
                                  </span>
                                </div>

                                {/* FIELD LEVEL DIFF DETAILS */}
                                {item.action === "UPDATED" && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 3,
                                      marginTop: 6,
                                      paddingLeft: 8,
                                      borderLeft: "2px solid #3b82f6",
                                    }}
                                  >
                                    {prev.name !== next.name && (
                                      <div>
                                        <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Name:</span>{" "}
                                        <span style={{ textDecoration: "line-through", color: "#64748b" }}>
                                          {prev.name || "—"}
                                        </span>{" "}
                                        → <span style={{ fontWeight: 600, color: "#0f172a" }}>{next.name}</span>
                                      </div>
                                    )}

                                    {prev.phone !== next.phone && (
                                      <div>
                                        <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Phone:</span>{" "}
                                        <span style={{ textDecoration: "line-through", color: "#64748b" }}>
                                          {prev.phone || "—"}
                                        </span>{" "}
                                        → <span style={{ fontWeight: 600, color: "#0f172a" }}>{next.phone || "—"}</span>
                                      </div>
                                    )}

                                    {prev.email !== next.email && (
                                      <div>
                                        <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Email:</span>{" "}
                                        <span style={{ textDecoration: "line-through", color: "#64748b" }}>
                                          {prev.email || "—"}
                                        </span>{" "}
                                        → <span style={{ fontWeight: 600, color: "#0f172a" }}>{next.email || "—"}</span>
                                      </div>
                                    )}

                                    {prev.effective_from !== next.effective_from && (
                                      <div>
                                        <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Effective From:</span>{" "}
                                        <span style={{ textDecoration: "line-through", color: "#64748b" }}>
                                          {formatDate(prev.effective_from)}
                                        </span>{" "}
                                        → <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(next.effective_from)}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {item.action === "CREATED" && (
                                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                    Appointed coordinator <b>{next.name}</b>
                                    {next.phone ? ` (Phone: ${next.phone})` : ""}
                                    {next.email ? ` (Email: ${next.email})` : ""}
                                    {next.effective_from ? ` starting ${formatDate(next.effective_from)}` : ""}.
                                  </div>
                                )}

                                {item.action === "REPLACED" && (
                                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                    Coordinator <b>{prev.name}</b> was retired and replaced
                                    {next.replaced_by ? (
                                      <span> by <b>{next.replaced_by}</b></span>
                                    ) : (
                                      ""
                                    )}.
                                  </div>
                                )}

                                {item.action === "RETIRED" && (
                                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                    Coordinator <b>{prev.name || "Coordinator"}</b> marked as left / role ended.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                        <button type="button" className="btn-outline" onClick={closeHistoryModal}>
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* STICKY FOOTER ACTIONS */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-default, #e5e7eb)",
                background: "var(--bg-panel, #ffffff)",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexShrink: 0,
                zIndex: 10,
              }}
            >
              <button
                className="btn-gold"
                type="submit"
                form="college-form"
                disabled={saving}
              >
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
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}