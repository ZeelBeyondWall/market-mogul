import { useEffect, useState } from 'react';
import './admin.css';

interface Stats {
  uptimeSec: number;
  totalTraders: number;
  aliveTraders: number;
  rektTraders: number;
  totalCash: number;
  totalNet: number;
  totalVolume: number;
  totalTrades: number;
  activeAsset: string;
  activeTF: string;
  botCounts: Record<string, number>;
  assetCount: number;
  recentEvents: { type: string; title: string; desc: string; t: number }[];
  clients: number;
}

interface Bot {
  id: number; name: string; strat: string; cash: number;
  net: number; rekt: boolean; openOrders: number; isPlayer: boolean;
}

const API = `http://${location.hostname}:8787`;

function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e12) return sign + '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return sign + '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return sign + '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return sign + '$' + (n / 1e3).toFixed(2) + 'K';
  return sign + '$' + n.toFixed(2);
}

function fmtDuration(sec: number): string {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h + 'h ' + m + 'm';
}

export function AdminApp() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [filter, setFilter] = useState('');
  const [stratFilter, setStratFilter] = useState('all');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [s, b] = await Promise.all([
        fetch(API + '/admin/stats').then(r => r.json()),
        fetch(API + '/admin/bots').then(r => r.json()),
      ]);
      setStats(s);
      setBots(b.bots);
      setErr('');
    } catch (e: any) {
      setErr('Server unreachable: ' + (e?.message || e));
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const [spawnN, setSpawnN] = useState(50);
  const [spawnStrat, setSpawnStrat] = useState('');
  const [killStrat, setKillStrat] = useState('');

  const fireEvent = async () => {
    setBusy(true);
    await fetch(API + '/admin/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await refresh(); setBusy(false);
  };
  const reset = async () => {
    if (!confirm('Reset entire game state? Server stays up; all bots respawn fresh.')) return;
    setBusy(true);
    await fetch(API + '/admin/reset', { method: 'POST' });
    await refresh(); setBusy(false);
  };
  const killBot = async (id: number) => {
    if (!confirm('Kill bot #' + id + '? (sets cash + holdings to 0)')) return;
    await fetch(API + '/admin/kill-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    refresh();
  };
  const spawn = async () => {
    if (spawnN < 1) return;
    setBusy(true);
    const body = JSON.stringify({ n: spawnN, strategy: spawnStrat || undefined });
    const r = await fetch(API + '/admin/spawn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const data = await r.json();
    alert(`Added ${data.added} bots. Total: ${data.total}`);
    await refresh(); setBusy(false);
  };
  const killStrategy = async () => {
    if (!killStrat) return;
    if (!confirm(`Kill ALL "${killStrat}" bots? They go REKT (cannot trade).`)) return;
    setBusy(true);
    const r = await fetch(API + '/admin/kill-strategy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: killStrat }) });
    const data = await r.json();
    alert(`Killed ${data.killed} bots of strategy ${killStrat}.`);
    await refresh(); setBusy(false);
  };
  const purgeRekt = async () => {
    if (!confirm('Permanently remove ALL REKT bots from the array? Books will be cleared and rebuilt.')) return;
    setBusy(true);
    const r = await fetch(API + '/admin/purge-rekt', { method: 'POST' });
    const data = await r.json();
    alert(`Removed ${data.removed}. Total now: ${data.total}`);
    await refresh(); setBusy(false);
  };

  if (err) {
    return <div className="admin-app"><div className="admin-err">⚠ {err}<button onClick={refresh}>Retry</button></div></div>;
  }
  if (!stats) return <div className="admin-app"><div className="admin-loading">Loading…</div></div>;

  const q = filter.trim().toUpperCase();
  const filtered = bots.filter(b =>
    (!q || b.name.toUpperCase().includes(q) || b.strat.toUpperCase().includes(q)) &&
    (stratFilter === 'all' || b.strat === stratFilter)
  );

  return (
    <div className="admin-app">
      <header className="admin-head">
        <div className="admin-logo">⚙ MARKET MOGUL — ADMIN</div>
        <div className="admin-server-badge">
          <span className="dot ok" /> Server live · {fmtDuration(stats.uptimeSec)} uptime · {stats.clients} client{stats.clients !== 1 ? 's' : ''}
        </div>
        <a href="/" className="admin-back">← back to game</a>
      </header>

      <div className="admin-grid">
        <section className="card kpi">
          <div className="kpi-row">
            <Kpi label="Traders" v={stats.totalTraders} sub={`${stats.aliveTraders} alive · ${stats.rektTraders} REKT`} />
            <Kpi label="Assets" v={stats.assetCount} sub={`Active: ${stats.activeAsset} (${stats.activeTF})`} />
            <Kpi label="Total trades" v={stats.totalTrades} sub={`Vol: ${fmt(stats.totalVolume)}`} />
            <Kpi label="Total cash in market" v={fmt(stats.totalCash)} sub={`Net: ${fmt(stats.totalNet)}`} />
          </div>
        </section>

        <section className="card">
          <h3>Bot strategy distribution</h3>
          <div className="strat-bars">
            {Object.entries(stats.botCounts).sort((a, b) => b[1] - a[1]).map(([s, n]) => {
              const max = Math.max(...Object.values(stats.botCounts));
              const pct = (n / max) * 100;
              return (
                <div key={s} className="strat-bar-row">
                  <div className="strat-bar-label">{s}</div>
                  <div className="strat-bar-track"><div className="strat-bar-fill" style={{ width: pct + '%' }} /></div>
                  <div className="strat-bar-val">{n}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h3>Controls</h3>
          <div className="controls">
            <button className="btn-primary" onClick={fireEvent} disabled={busy}>🎲 Fire random event</button>
            <button className="btn-warn" onClick={reset} disabled={busy}>🔄 Reset game</button>
            <button className="btn-warn" onClick={purgeRekt} disabled={busy}>🧹 Purge REKT bots</button>
          </div>

          <h3 style={{ marginTop: 16 }}>Spawn bots</h3>
          <div className="controls">
            <label className="ctl-label">Count:
              <input type="number" min="1" max="2000" value={spawnN} onChange={e => setSpawnN(+e.target.value || 1)} className="ctl-input" style={{ width: 80 }} />
            </label>
            <label className="ctl-label">Strategy:
              <select value={spawnStrat} onChange={e => setSpawnStrat(e.target.value)} className="ctl-input">
                <option value="">random mix</option>
                {Object.keys(stats.botCounts).filter(s => s !== 'player').sort().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button className="btn-primary" onClick={spawn} disabled={busy}>➕ Spawn {spawnN}</button>
          </div>

          <h3 style={{ marginTop: 16 }}>Kill by strategy</h3>
          <div className="controls">
            <label className="ctl-label">Strategy:
              <select value={killStrat} onChange={e => setKillStrat(e.target.value)} className="ctl-input">
                <option value="">— pick one —</option>
                {Object.keys(stats.botCounts).filter(s => s !== 'player').sort().map(s => <option key={s} value={s}>{s} ({stats.botCounts[s]})</option>)}
              </select>
            </label>
            <button className="btn-warn" onClick={killStrategy} disabled={busy || !killStrat}>💀 Kill all "{killStrat || '…'}"</button>
          </div>
        </section>

        <section className="card">
          <h3>Recent events</h3>
          {stats.recentEvents.length === 0 ? (
            <div className="empty">No events yet.</div>
          ) : (
            <ul className="events-list">
              {stats.recentEvents.map((e, i) => (
                <li key={i} className={'ev-' + e.type}>
                  <b>{e.title}</b> <span className="ev-desc">— {e.desc}</span>
                  <span className="ev-time">{Math.floor((Date.now() - e.t) / 1000)}s ago</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card bots-card">
          <h3>All traders ({bots.length})</h3>
          <div className="bot-filters">
            <input
              type="text"
              placeholder="Search by name or strategy…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <select value={stratFilter} onChange={e => setStratFilter(e.target.value)}>
              <option value="all">All strategies</option>
              {Object.keys(stats.botCounts).sort().map(s => <option key={s} value={s}>{s} ({stats.botCounts[s]})</option>)}
            </select>
          </div>
          <div className="bots-table-wrap">
            <table className="bots-table">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Strat</th>
                  <th style={{ textAlign: 'right' }}>Cash</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((b, i) => (
                  <tr key={b.id} className={(b.isPlayer ? 'me ' : '') + (b.rekt ? 'rekt' : '')}>
                    <td>{i + 1}</td>
                    <td>{b.name}{b.isPlayer && <span className="me-tag"> YOU</span>}</td>
                    <td>{b.strat}</td>
                    <td className="num">{fmt(b.cash)}</td>
                    <td className="num">{fmt(b.net)}</td>
                    <td className="num">{b.openOrders}</td>
                    <td>{b.rekt ? <span className="status rekt">REKT</span> : <span className="status alive">●</span>}</td>
                    <td>{!b.isPlayer && !b.rekt && <button className="row-btn" onClick={() => killBot(b.id)}>kill</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <div className="bots-more">+{filtered.length - 500} more (filter to narrow)</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, v, sub }: { label: string; v: number | string; sub: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{v}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}
