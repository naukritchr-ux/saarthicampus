import { useState, useRef } from 'react';
import { authHeaders } from '../lib/api';

export default function AIImport({ type, onImported }) {
  const [dragging, setDragging] = useState(false);
  const [, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const label = type === 'campus' ? 'Campus' : 'Corporate';
  const columns = type === 'campus'
    ? ['name', 'city', 'course', 'tpo', 'tpo_email', 'strength', 'status']
    : ['name', 'sector', 'hr_name', 'hr_email', 'hq_location', 'hiring_status'];

  const handleFile = async (f) => {
    if (!f) return;
    const allowed = ['xlsx', 'xls', 'csv', 'pdf'];
    const ext = f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError('Only Excel (.xlsx, .xls, .csv) or PDF files are supported');
      return;
    }
    setFile(f);
    setError('');
    setPreview(null);
    setDone(false);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', f);

      const headers = await authHeaders();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/import/${type}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Import failed');

      setPreview(data.preview);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSave = async () => {
    if (!preview || preview.length === 0) return;
    setSaving(true);

    try {
      const body = type === 'campus'
        ? { colleges: preview }
        : { companies: preview };

      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/import/${type}/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDone(true);
      setPreview(null);
      setFile(null);
      if (onImported) onImported();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const editCell = (rowIndex, key, value) => {
    setPreview(prev => prev.map((row, i) =>
      i === rowIndex ? { ...row, [key]: value } : row
    ));
  };

  const removeRow = (index) => {
    setPreview(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* Upload zone */}
      {!preview && !loading && !done && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--brand-purple)' : 'var(--border-default)'}`,
            borderRadius: 14,
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(124,58,237,0.04)' : 'var(--bg-surface-2)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
            Drop your Excel or PDF here
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Supports .xlsx, .xls, .csv, .pdf · Any format — AI will fix it automatically
          </div>
          <span style={{
            background: 'linear-gradient(135deg, var(--brand-purple), #06B6D4)',
            color: 'white',
            padding: '10px 24px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            display: 'inline-block',
          }}>
            Browse File
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          background: 'var(--bg-surface-2)',
          borderRadius: 14,
          border: '1px solid var(--border-default)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
            AI is reading your file...
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Mapping columns and fixing formatting automatically
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--brand-purple)',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <style>{`
            @keyframes bounce {
              0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
              40% { transform: scale(1.2); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'var(--danger-soft)',
          border: '1px solid var(--danger-border)',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: 13,
          color: 'var(--danger)',
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>❌ {error}</span>
          <button onClick={() => setError('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Success */}
      {done && (
        <div style={{
          background: 'var(--success-soft)',
          border: '1px solid var(--success-border)',
          borderRadius: 10,
          padding: '20px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--success)', marginBottom: 6 }}>
            Data imported successfully!
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            All {label.toLowerCase()} records have been saved to the database.
          </div>
          <button
            className="btn-outline"
            onClick={() => { setDone(false); setFile(null); setError(''); }}
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                🤖 AI formatted {preview.length} records
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                Review and edit before saving. Click any cell to edit it.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-outline"
                onClick={() => { setPreview(null); setFile(null); setError(''); }}
              >
                Cancel
              </button>
              <button
                className="btn-gold"
                onClick={handleSave}
                disabled={saving || preview.length === 0}
              >
                {saving ? 'Saving...' : `✓ Save All ${preview.length} Records`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-default)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-2)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>
                    #
                  </th>
                  {columns.map(col => (
                    <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                  <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-default)' }}></th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                    {columns.map(col => (
                      <td key={col} style={{ padding: '6px 8px' }}>
                        <input
                          value={row[col] || ''}
                          onChange={e => editCell(i, col, e.target.value)}
                          style={{
                            width: '100%',
                            minWidth: 100,
                            padding: '5px 8px',
                            border: '1px solid transparent',
                            borderRadius: 6,
                            fontSize: 12.5,
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-body)',
                            transition: 'all 0.15s',
                          }}
                          onFocus={e => {
                            e.target.style.border = '1px solid var(--brand-purple)';
                            e.target.style.background = 'white';
                          }}
                          onBlur={e => {
                            e.target.style.border = '1px solid transparent';
                            e.target.style.background = 'transparent';
                          }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={() => removeRow(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: 4, borderRadius: 6 }}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}