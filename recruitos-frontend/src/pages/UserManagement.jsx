import { useEffect, useState, useCallback, useMemo } from "react";
import { Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const ROLES = ["admin", "recruiter", "candidate", "corporate"];
const PAGE_SIZE = 7;

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const AVATAR_COLORS = ["#7C3AED", "#06B6D4", "#EC4899", "#F59E0B", "#10B981", "#6366F1"];
function avatarColor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

const emptyNewUser = { name: "", email: "", password: "", role: "recruiter" };

function iconBtnStyle(bg, color, border) {
  return {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${border}`,
    background: bg,
    color,
    borderRadius: 7,
    cursor: "pointer",
    transition: "opacity 0.15s",
    flexShrink: 0,
  };
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState(null);
  const [pendingRole, setPendingRole] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [actingId, setActingId] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/auth/users`,
      { headers: { "x-user-id": userId } },
    );
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [userId]);

        useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("profiles-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function onRoleChange(id, role) {
    setPendingRole((prev) => ({ ...prev, [id]: role }));
  }

  async function saveRole(id) {
    const role = pendingRole[id];
    if (!role) return;
    setSavingId(id);
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/users/${id}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ role }),
    });
    setSavingId(null);
    setPendingRole((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    load();
  }

  async function approve(id) {
    setActingId(id);
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/approve/${id}`, {
      method: "POST",
      headers: { "x-user-id": userId },
    });
    setActingId(null);
    load();
  }

  async function reject(id) {
    if (!window.confirm("Deny this request?")) return;
    setActingId(id);
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/reject/${id}`, {
      method: "POST",
      headers: { "x-user-id": userId },
    });
    setActingId(null);
    load();
  }

  async function deleteUser(u) {
    if (!window.confirm(`Delete "${u.name}" (${u.email})? This cannot be undone.`)) return;
    setActingId(u.id);
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/users/${u.id}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
    });
    setActingId(null);
    load();
  }

  function openEdit(u) {
    setEditUser(u);
    setEditForm({ name: u.name || "", email: u.email || "" });
    setEditError("");
  }

  async function submitEdit(e) {
    e.preventDefault();
    setEditError("");
    setEditSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update user");
      setEditUser(null);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function submitAddUser(e) {
    e.preventDefault();
    setAddError("");
    setAddSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create user");
      setShowAddModal(false);
      setNewUser(emptyNewUser);
      load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.approved).length;
    const pending = users.filter((u) => !u.approved && u.status !== "denied").length;
    const blocked = users.filter((u) => u.status === "denied").length;
    return { total, active, pending, blocked };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (tab === "pending" && (u.approved || u.status === "denied")) return false;

      const q = search.trim().toLowerCase();
      if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;

      if (roleFilter !== "All Roles" && u.role !== roleFilter.toLowerCase()) return false;

      if (statusFilter !== "All Status") {
        const status = u.status === "denied" ? "Blocked" : u.approved ? "Active" : "Pending";
        if (status !== statusFilter) return false;
      }

      return true;
    });
  }, [users, tab, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function clearFilters() {
    setSearch("");
    setRoleFilter("All Roles");
    setStatusFilter("All Status");
    setPage(1);
  }

  return (
    <div className="page active">
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p>Manage users, roles and access across the platform</p>
        </div>
        <button className="btn-outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Total Users", value: stats.total, sub: "All registered users", color: "#7C3AED", bg: "#EDE9FE" },
          { label: "Active Users", value: stats.active, sub: "Currently active", color: "#10B981", bg: "#D1FAE5" },
          { label: "Pending Approvals", value: stats.pending, sub: "Awaiting approval", color: "#F59E0B", bg: "#FEF3C7" },
          { label: "Blocked Users", value: stats.blocked, sub: "Inactive or blocked", color: "#EF4444", bg: "#FEE2E2" },
        ].map((c) => (
          <div key={c.label} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 2px" }}>{c.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{c.sub}</div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: c.bg,
                color: c.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              👤
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 22, borderBottom: "1px solid var(--border-default)" }}>
          {[
            { key: "all", label: "All Users" },
            { key: "pending", label: `Pending Approvals (${stats.pending})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              style={{
                background: "none",
                border: "none",
                padding: "8px 2px 12px",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                color: tab === t.key ? "var(--brand-purple, #7C3AED)" : "var(--text-muted)",
                borderBottom: tab === t.key ? "2px solid var(--brand-purple, #7C3AED)" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn-gold" onClick={() => setShowAddModal(true)}>
          + Add New User
        </button>
      </div>

      {/* Filters */}
      <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email..."
          style={{ flex: 1, minWidth: 200, border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px", fontSize: 13.5 }}
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          style={{ padding: "8px 10px", borderRadius: 8, fontSize: 13 }}
        >
          <option>All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r.charAt(0).toUpperCase() + r.slice(1)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          style={{ padding: "8px 10px", borderRadius: 8, fontSize: 13 }}
        >
          <option>All Status</option>
          <option>Active</option>
          <option>Pending</option>
          <option>Blocked</option>
        </select>
        <button className="btn-outline" onClick={clearFilters}>
          ⨯ Clear Filters
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "980px", width: "100%" }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined On</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    Loading…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((u) => {
                  const selectedRole = pendingRole[u.id] ?? u.role ?? "recruiter";
                  const isDirty = pendingRole[u.id] && pendingRole[u.id] !== u.role;
                  const status = u.status === "denied" ? "Blocked" : u.approved ? "Active" : "Pending";
                  const statusColors = {
                    Active: { bg: "#dcfce7", color: "#16653f" },
                    Pending: { bg: "#fef3c7", color: "#92400e" },
                    Blocked: { bg: "#fee2e2", color: "#991b1b" },
                  }[status];

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: avatarColor(u.id),
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {initials(u.name)}
                          </div>
                          <span style={{ fontWeight: 700 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{u.email}</td>
                      <td>
                        <select
                          value={selectedRole}
                          onChange={(e) => onRoleChange(u.id, e.target.value)}
                          style={{ padding: "5px 8px", borderRadius: 6, fontSize: 13 }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontWeight: 700,
                            background: statusColors.bg,
                            color: statusColors.color,
                          }}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{formatDate(u.created_at)}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{timeAgo(u.last_sign_in_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {status === "Pending" && tab === "pending" && (
                            <>
                              <button
                                title="Approve"
                                onClick={() => approve(u.id)}
                                disabled={actingId === u.id}
                                style={iconBtnStyle("#f0fdf4", "#16a34a", "#bbf7d0")}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                title="Reject"
                                onClick={() => reject(u.id)}
                                disabled={actingId === u.id}
                                style={iconBtnStyle("#fef2f2", "#dc2626", "#fecaca")}
                              >
                                <XIcon size={15} />
                              </button>
                            </>
                          )}
                          {isDirty && (
                            <button
                              className="btn-outline"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              disabled={savingId === u.id}
                              onClick={() => saveRole(u.id)}
                            >
                              {savingId === u.id ? "…" : "Save Role"}
                            </button>
                          )}
                          <button
                            title="Edit user"
                            onClick={() => openEdit(u)}
                            disabled={actingId === u.id}
                            style={iconBtnStyle("#eff6ff", "#2563eb", "#bfdbfe")}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            title="Delete user"
                            onClick={() => deleteUser(u)}
                            disabled={actingId === u.id}
                            style={iconBtnStyle("#fef2f2", "#dc2626", "#fecaca")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid var(--border-default)",
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            <span>
              Showing {(pageSafe - 1) * PAGE_SIZE + 1} to {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} users
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-outline" style={{ padding: "4px 10px" }} disabled={pageSafe === 1} onClick={() => setPage(pageSafe - 1)}>
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={n === pageSafe ? "btn-gold" : "btn-outline"}
                  style={{ padding: "4px 10px" }}
                >
                  {n}
                </button>
              ))}
              <button
                className="btn-outline"
                style={{ padding: "4px 10px" }}
                disabled={pageSafe === totalPages}
                onClick={() => setPage(pageSafe + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add New User modal */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
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
            style={{ width: 420, maxWidth: "90%", borderRadius: 12 }}
          >
            <h2 style={{ marginTop: 0 }}>Add New User</h2>
            <form onSubmit={submitAddUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label>Full Name</label>
                <input
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-default)", marginTop: 4 }}
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-default)", marginTop: 4 }}
                />
              </div>
              <div>
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-default)", marginTop: 4 }}
                />
              </div>
              <div>
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, marginTop: 4 }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {addError && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{addError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)} disabled={addSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-gold" disabled={addSaving}>
                  {addSaving ? "Creating…" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User modal */}
      {editUser && (
        <div
          onClick={() => setEditUser(null)}
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
            style={{ width: 420, maxWidth: "90%", borderRadius: 12 }}
          >
            <h2 style={{ marginTop: 0 }}>Edit User</h2>
            <form onSubmit={submitEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label>Full Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-default)", marginTop: 4 }}
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-default)", marginTop: 4 }}
                />
              </div>
              {editError && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{editError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn-outline" onClick={() => setEditUser(null)} disabled={editSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-gold" disabled={editSaving}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}