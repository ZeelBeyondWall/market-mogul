import { useEffect, useState } from 'react';
import { apiGet } from '../api';
import { fmtTime, safe } from '../components';

interface FB { ts: number; ip: string; type: string; message: string; name?: string; level?: number; }

export default function Feedback() {
  const [items, setItems] = useState<FB[]>([]);
  const [filter, setFilter] = useState<'all' | 'bug' | 'idea' | 'other'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const r = await safe(() => apiGet<{ entries: FB[] }>('/admin/feedback?limit=500'));
    if (r) setItems(r.entries || []);
    setLoading(false);
  };
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, []);

  const shown = filter === 'all' ? items : items.filter(i => i.type === filter);
  const counts = {
    bug: items.filter(i => i.type === 'bug').length,
    idea: items.filter(i => i.type === 'idea').length,
    other: items.filter(i => i.type === 'other').length,
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'feedback.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Player Feedback</h1>
          <div className="a-page-sub">Bug reports + ideas submitted from the game ({items.length} total)</div>
        </div>
        <div className="a-page-actions">
          <button className="a-btn ghost" onClick={load}>Reload</button>
          <button className="a-btn ghost" onClick={exportJson} disabled={!items.length}>Export JSON</button>
        </div>
      </div>

      <div className="a-stats-grid">
        <div className="a-stat-card"><div className="a-stat-label">🐞 Bugs</div><div className="a-stat-value dn">{counts.bug}</div></div>
        <div className="a-stat-card"><div className="a-stat-label">💡 Ideas</div><div className="a-stat-value up">{counts.idea}</div></div>
        <div className="a-stat-card"><div className="a-stat-label">💬 Other</div><div className="a-stat-value">{counts.other}</div></div>
        <div className="a-stat-card"><div className="a-stat-label">Total</div><div className="a-stat-value">{items.length}</div></div>
      </div>

      <div className="a-card">
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['all', 'bug', 'idea', 'other'] as const).map(f => (
            <button key={f} className={'a-btn sm ' + (filter === f ? 'primary' : 'ghost')} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="a-empty">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="a-empty">No feedback yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((f, i) => (
              <div key={i} style={{ border: '1px solid var(--a-border)', borderRadius: 8, padding: '12px 14px', background: 'var(--a-panel)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={'a-badge ' + (f.type === 'bug' ? 'err' : f.type === 'idea' ? 'ok' : 'info')}>
                      {f.type === 'bug' ? '🐞 bug' : f.type === 'idea' ? '💡 idea' : '💬 other'}
                    </span>
                    <b style={{ fontSize: 13 }}>{f.name || 'Anonymous'}</b>
                    {f.level != null && <span style={{ fontSize: 11, color: 'var(--a-text-mute)' }}>L{f.level}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--a-text-mute)' }}>{fmtTime(f.ts)}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--a-text)', whiteSpace: 'pre-wrap' }}>{f.message}</div>
                <div style={{ fontSize: 10, color: 'var(--a-text-mute)', marginTop: 6 }}>{f.ip}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
