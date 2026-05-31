import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api';
import type { AuditEntry } from '../types';
import { fmtTime, toast, safe } from '../components';

type ResultFilter = 'all' | 'ok' | 'error';
type PrefixFilter = 'all' | 'user' | 'economy' | 'gm' | 'emergency' | 'sim';

function payloadPreview(p: any): string {
  if (p == null) return '—';
  if (typeof p === 'string') return p;
  try {
    const s = JSON.stringify(p);
    if (s === '{}' || s === '[]') return '—';
    return s.length > 120 ? s.slice(0, 117) + '…' : s;
  } catch {
    return String(p);
  }
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [prefixFilter, setPrefixFilter] = useState<PrefixFilter>('all');

  async function load() {
    setLoading(true);
    const res = await safe(() => apiGet<{ ok: boolean; entries: AuditEntry[] }>('/admin/audit?limit=500'));
    if (res && Array.isArray(res.entries)) {
      setEntries(res.entries);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = search.toLowerCase().trim();
    return entries.filter(e => {
      if (resultFilter !== 'all' && (e.result || 'ok') !== resultFilter) return false;
      if (prefixFilter !== 'all' && !e.action?.startsWith(prefixFilter + '.')) return false;
      if (q) {
        const hay =
          (e.actor || '').toLowerCase() + ' ' +
          (e.action || '').toLowerCase() + ' ' +
          String(e.target ?? '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, resultFilter, prefixFilter]);

  function download() {
    try {
      const data = JSON.stringify(filtered, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `audit-log-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast(`Exported ${filtered.length} entries`, 'ok');
    } catch (e: any) {
      toast(e?.message || 'export failed', 'err');
    }
  }

  const isEmpty = entries !== null && entries.length === 0;
  const noMatches = entries !== null && entries.length > 0 && filtered.length === 0;

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Audit Log</h1>
          <div className="a-page-sub">Every admin action is recorded</div>
        </div>
        <div className="a-page-actions">
          <button className="a-btn ghost" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
          <button className="a-btn primary" onClick={download} disabled={!filtered.length}>
            Download JSON
          </button>
        </div>
      </div>

      <div className="a-card">
        <div className="a-form-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 220px', minWidth: 200 }}>
            <label className="a-label">Search (actor / action / target)</label>
            <input
              className="a-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="e.g. admin, user.ban, 42"
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="a-label">Result</label>
            <select
              className="a-select"
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value as ResultFilter)}
            >
              <option value="all">All</option>
              <option value="ok">OK</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="a-label">Action prefix</label>
            <select
              className="a-select"
              value={prefixFilter}
              onChange={e => setPrefixFilter(e.target.value as PrefixFilter)}
            >
              <option value="all">All</option>
              <option value="user">user.*</option>
              <option value="economy">economy.*</option>
              <option value="gm">gm.*</option>
              <option value="emergency">emergency.*</option>
              <option value="sim">sim.*</option>
            </select>
          </div>
          <div style={{ flex: '0 0 auto', color: 'var(--a-text-mute)', fontSize: 12, paddingBottom: 8 }}>
            {entries === null
              ? 'Loading…'
              : `${filtered.length} of ${entries.length} entries`}
          </div>
        </div>
      </div>

      <div className="a-card" style={{ marginTop: 12, padding: 0 }}>
        {entries === null ? (
          <div className="a-empty" style={{ padding: 24 }}>Loading…</div>
        ) : isEmpty ? (
          <div className="a-empty" style={{ padding: 24 }}>No audit entries yet.</div>
        ) : noMatches ? (
          <div className="a-empty" style={{ padding: 24 }}>No entries match the current filters.</div>
        ) : (
          <div className="a-table-wrap" style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <table className="a-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Time</th>
                  <th style={{ width: 130 }}>Actor</th>
                  <th style={{ width: 180 }}>Action</th>
                  <th style={{ width: 110 }}>Target</th>
                  <th>Payload</th>
                  <th style={{ width: 90 }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const result = e.result || 'ok';
                  return (
                    <tr key={(e.ts || 0) + '-' + i} className="a-log-entry">
                      <td title={e.ts ? new Date(e.ts).toLocaleString() : ''}>
                        {fmtTime(e.ts)}
                      </td>
                      <td>{e.actor || '—'}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>{e.action || '—'}</code>
                      </td>
                      <td>{e.target != null ? String(e.target) : '—'}</td>
                      <td
                        style={{
                          maxWidth: 360,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--a-text-mute)',
                          fontFamily: 'var(--a-font-mono, monospace)',
                          fontSize: 12,
                        }}
                        title={e.reason ? `${payloadPreview(e.payload)} — ${e.reason}` : payloadPreview(e.payload)}
                      >
                        {payloadPreview(e.payload)}
                        {e.reason && (
                          <span style={{ color: 'var(--a-danger, #f55)', marginLeft: 6 }}>
                            · {e.reason}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={'a-badge ' + (result === 'ok' ? 'ok' : 'err')}
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              result === 'ok'
                                ? 'rgba(46, 204, 113, 0.15)'
                                : 'rgba(231, 76, 60, 0.15)',
                            color:
                              result === 'ok'
                                ? 'var(--a-up, #2ecc71)'
                                : 'var(--a-dn, #e74c3c)',
                          }}
                        >
                          {result === 'ok' ? 'OK' : 'ERROR'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
