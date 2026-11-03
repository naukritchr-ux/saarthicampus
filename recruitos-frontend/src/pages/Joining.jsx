import { useEffect, useState, useMemo } from 'react';
import { getJoiningStatus, updateJoiningRecord } from '../lib/api';

const STATUS_BADGE = {
  Awaiting: 'gray',
  Accepted: 'gold',
  Joined: 'green',
  'No Show': 'red',
};

const STATUS_OPTIONS = ['Awaiting', 'Accepted', 'Joined', 'No Show'];

export default function Joining() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getJoiningStatus();
      setRows(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load joining records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await updateJoiningRecord(id, { status: newStatus });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      alert('Could not update status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDateChange = async (id, newDate) => {
    setUpdatingId(id);
    try {
      await updateJoiningRecord(id, { joining_date: newDate });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, joining_date: newDate } : r))
      );
    } catch (err) {
      alert('Could not update joining date: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const candidateName = r.candidates?.name?.toLowerCase() || '';
      const campus = (r.candidates?.colleges?.name || '').toLowerCase();
      const company = (r.offers?.job_profiles?.company || '').toLowerCase();

      const matchesSearch = !q || candidateName.includes(q) || campus.includes(q) || company.includes(q);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="page active" id="page-joining">
      <div className="page-head">
        <div>
          <h1>Joining Tracker</h1>
          <p>Live joining status and date management for selected candidates</p>
        </div>
        <button className="btn-outline" onClick={loadData}>
          ↻ Refresh
        </button>
      </div>

      {/* Toolbar with Search and Status Filter */}
      <div className="toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="search-box"
          placeholder="Search by candidate, campus, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="search-box"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="All">All Statuses ({rows.length})</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st} ({rows.filter((r) => r.status === st).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Campus</th>
                <th>Company</th>
                <th>Offer Status</th>
                <th>Joining Status</th>
                <th>Joining Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--slate-light)', padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--red, #d64545)', padding: 24 }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--slate-light)', padding: 32 }}>
                    {rows.length === 0 ? 'No joining records yet.' : 'No joining records match your filter.'}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.candidates?.name}</strong>
                    </td>
                    <td>{r.candidates?.colleges?.name || '—'}</td>
                    <td>{r.offers?.job_profiles?.company || '—'}</td>
                    <td>
                      <span className={`badge ${r.offers?.status === 'Sent' || r.offers?.status === 'Accepted' ? 'green' : 'gray'}`}>
                        {r.offers?.status || '—'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={r.status || 'Awaiting'}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        disabled={updatingId === r.id}
                        className={`badge ${STATUS_BADGE[r.status] || 'gray'}`}
                        style={{
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: '4px 8px',
                          border: 'none',
                          outline: 'none',
                          borderRadius: 6,
                        }}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} style={{ color: '#111', background: '#fff' }}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={r.joining_date ? r.joining_date.split('T')[0] : ''}
                        onChange={(e) => handleDateChange(r.id, e.target.value)}
                        disabled={updatingId === r.id}
                        style={{
                          fontSize: 12,
                          padding: '3px 6px',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
