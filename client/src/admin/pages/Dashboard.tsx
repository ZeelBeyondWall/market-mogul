import { useEffect, useState, useRef } from 'react';
import { apiGet, apiPost } from '../api';
import type { EconomyResp, AnalyticsResp, HealthResp } from '../types';
import {
  fmt, fmtNum, fmtPct, fmtDuration,
  StatCard, ConfirmModal, LineChart, safe, toast,
} from '../components';

type ConfirmKind = null | 'event' | 'spawn';

const MARKET_LABELS: Record<string, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  forex:  'Forex',
};
const MARKET_COLORS: Record<string, string> = {
  stocks: 'var(--a-accent)',
  crypto: '#f7a35c',
  forex:  '#8c66ff',
};

export default function Dashboard() {
  const [eco, setEco] = useState<EconomyResp | null>(null);
  const [ana, setAna] = useState<AnalyticsResp | null>(null);
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [acting, setActing] = useState(false);
  const [spawnCount, setSpawnCount] = useState(1000); // v8.4: editable bot spawn count
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const tick = async () => {
      const [e, a, h] = await Promise.all([
        safe(() => apiGet<EconomyResp>('/admin/economy')),
        safe(() => apiGet<AnalyticsResp>('/admin/analytics')),
        safe(() => apiGet<HealthResp>('/admin/health')),
      ]);
      if (cancelled || !mountedRef.current) return;
      if (e) setEco(e);
      if (a) setAna(a);
      if (h) setHealth(h);
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  async function fireEvent() {
    setActing(true);
    const r = await safe(() => apiPost('/admin/event', {}));
    setActing(false);
    setConfirm(null);
    if (r) toast('Random event fired', 'ok');
  }

  async function spawnBots() {
    const n = Math.max(1, Math.min(1_000_000, Math.floor(spawnCount) || 0));
    setActing(true);
    const r = await safe(() => apiPost<{ added: number; total: number }>('/admin/spawn', { n }));
    setActing(false);
    setConfirm(null);
    if (r) toast(`Spawned ${r.added.toLocaleString()} bots · total ${r.total.toLocaleString()}`, 'ok');
  }

  function openAnalytics() {
    toast('Analytics page coming up — switch nav tab', 'info');
  }

  const loading = !eco || !ana;

  // ----- chart series -----
  const volSeries = (ana?.series || []).map(s => ({ ts: s.ts, v: s.totalVolume }));
  const onlineSeries = (ana?.series || []).map(s => ({ ts: s.ts, v: s.online }));
  const tradesSeries = (ana?.series || []).map(s => ({ ts: s.ts, v: s.trades5sBucket }));

  // ----- per-market normalised bars -----
  const perMkt = eco?.perMarket || {};
  const mktEntries = Object.entries(perMkt);
  const maxMktVol = mktEntries.reduce((m, [, v]) => Math.max(m, v.volume || 0), 0) || 1;

  // ----- top lists (top 5) -----
  const gainers = (ana?.topGainers || []).slice(0, 5);
  const losers  = (ana?.topLosers  || []).slice(0, 5);
  const volTop  = (ana?.topVolume  || []).slice(0, 5);

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Dashboard</h1>
          <div className="a-page-sub">
            Live ops overview · refresh 3s
            {health && <> · uptime {fmtDuration(health.uptimeSec)}</>}
          </div>
        </div>
        <div className="a-page-actions">
          <button className="a-btn ghost" onClick={openAnalytics}>Open Analytics</button>
          <button className="a-btn primary" disabled={acting} onClick={() => setConfirm('event')}>
            Fire Random Event
          </button>
        </div>
      </div>

      {/* v8.6: dedicated Bot Management card — spawn controls no longer crammed
          into the header (they were overflowing off-screen). */}
      <div className="a-card" style={{ marginBottom: 16 }}>
        <h3 className="a-card-title">Bot Management</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="a-label">How many bots</label>
            <input
              type="number"
              className="a-input"
              style={{ width: 160 }}
              min={1}
              max={1000000}
              value={spawnCount}
              onChange={e => setSpawnCount(+e.target.value || 0)}
              title="1 – 1,000,000"
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="a-btn sm ghost" onClick={() => setSpawnCount(1000)}>1K</button>
            <button className="a-btn sm ghost" onClick={() => setSpawnCount(10000)}>10K</button>
            <button className="a-btn sm ghost" onClick={() => setSpawnCount(100000)}>100K</button>
            <button className="a-btn sm ghost" onClick={() => setSpawnCount(500000)}>500K</button>
          </div>
          <button className="a-btn success" disabled={acting || spawnCount < 1} onClick={() => setConfirm('spawn')}>
            ➕ Spawn {spawnCount.toLocaleString()} Bots
          </button>
          {eco && (
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--a-text-mute)' }}>
              Current: <b style={{ color: 'var(--a-text)' }}>{eco.totalBots.toLocaleString()}</b> bots
            </div>
          )}
        </div>
      </div>

      {loading && !eco && (
        <div className="a-empty">Loading dashboard…</div>
      )}

      {eco && (
        <div className="a-stats-grid" style={{ marginBottom: 16 }}>
          <StatCard
            label="Total Users"
            value={fmtNum(eco.totalRegistered)}
            icon="👥"
            sub={`${fmtNum(eco.totalActive)} active · ${fmtNum(eco.totalBots)} bots`}
          />
          <StatCard
            label="Online"
            value={fmtNum(eco.totalOnline)}
            icon="🟢"
            sub="connected clients"
            tone={eco.totalOnline > 0 ? 'up' : undefined}
          />
          <StatCard
            label="Total Volume"
            value={fmt(eco.totalMarketVolume)}
            icon="📊"
            sub="all markets · session"
          />
          <StatCard
            label="Open Positions"
            value={fmtNum(eco.openPositions)}
            icon="📦"
            sub={`${fmtNum(eco.openOrders)} open orders`}
          />
          <StatCard
            label="Total Cash"
            value={fmt(eco.totalCash)}
            icon="💵"
            sub={`net ${fmt(eco.totalNet)}`}
          />
          <StatCard
            label="Fee Revenue"
            value={fmt(eco.totalFeesPaid || 0)}
            icon="💸"
            sub={`borrow ${fmt(eco.totalBorrowPaid || 0)}`}
          />
          <StatCard
            label="Richest Player"
            value={eco.richest?.name || '—'}
            icon="👑"
            sub={eco.richest ? `${fmt(eco.richest.net)} · #${eco.richest.id}` : 'no traders'}
            tone="up"
          />
          <StatCard
            label="System Uptime"
            value={health ? fmtDuration(health.uptimeSec) : '—'}
            icon="⏱"
            sub="since last engine boot"
          />
        </div>
      )}

      {/* ===== Charts ===== */}
      <div className="a-grid-3" style={{ marginBottom: 16 }}>
        <div className="a-card">
          <h3>Total Volume</h3>
          {volSeries.length >= 2
            ? <LineChart data={volSeries} label="vol" color="var(--a-accent)" />
            : <div className="a-empty">Collecting samples…</div>}
        </div>
        <div className="a-card">
          <h3>Online Users</h3>
          {onlineSeries.length >= 2
            ? <LineChart data={onlineSeries} label="online" color="#3ee0a1" />
            : <div className="a-empty">Collecting samples…</div>}
        </div>
        <div className="a-card">
          <h3>Trades / 5s</h3>
          {tradesSeries.length >= 2
            ? <LineChart data={tradesSeries} label="trades" color="#f7a35c" />
            : <div className="a-empty">Collecting samples…</div>}
        </div>
      </div>

      {/* ===== Per-market breakdown ===== */}
      <div className="a-card" style={{ marginBottom: 16 }}>
        <h3>Per-Market Breakdown</h3>
        {mktEntries.length === 0 && <div className="a-empty">No market data</div>}
        {mktEntries.map(([mkt, v]) => {
          const widthPct = ((v.volume || 0) / maxMktVol) * 100;
          const color = MARKET_COLORS[mkt] || 'var(--a-accent)';
          return (
            <div key={mkt} style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 4,
                color: 'var(--a-text-dim)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--a-text)' }}>
                  {MARKET_LABELS[mkt] || mkt}
                </span>
                <span>
                  {fmtNum(v.count)} assets · {fmt(v.volume)}
                </span>
              </div>
              <div style={{
                height: 10,
                background: 'var(--a-elev)',
                borderRadius: 6,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: widthPct.toFixed(1) + '%',
                  background: color,
                  borderRadius: 6,
                  transition: 'width 400ms ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Top Gainers / Losers / Volume ===== */}
      <div className="a-grid-3" style={{ marginBottom: 16 }}>
        <div className="a-card">
          <h3>Top Gainers</h3>
          {gainers.length === 0
            ? <div className="a-empty">No data</div>
            : <TopList rows={gainers.map(g => ({
                id: g.id, primary: fmtPct(g.chgPct), secondary: fmt(g.lastPrice), tone: 'up' as const,
              }))} />
          }
        </div>
        <div className="a-card">
          <h3>Top Losers</h3>
          {losers.length === 0
            ? <div className="a-empty">No data</div>
            : <TopList rows={losers.map(g => ({
                id: g.id, primary: fmtPct(g.chgPct), secondary: fmt(g.lastPrice), tone: 'dn' as const,
              }))} />
          }
        </div>
        <div className="a-card">
          <h3>Top Volume</h3>
          {volTop.length === 0
            ? <div className="a-empty">No data</div>
            : <TopList rows={volTop.map(g => ({
                id: g.id, primary: fmt(g.volume), secondary: fmt(g.lastPrice),
              }))} />
          }
        </div>
      </div>

      {/* ===== Confirm modals ===== */}
      <ConfirmModal
        open={confirm === 'event'}
        title="Fire random market event?"
        body={<div>This triggers a random event (news/shock) across the live market. All connected clients will see it immediately.</div>}
        confirmLabel="Fire event"
        onConfirm={fireEvent}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === 'spawn'}
        title={`Spawn ${spawnCount.toLocaleString()} bots?`}
        body={<div>Adds <b>{spawnCount.toLocaleString()}</b> new bot traders to the engine. Memory + CPU usage will increase. Cannot be undone (use Purge Rekt or Reset to clean up).</div>}
        confirmLabel={`Spawn ${spawnCount.toLocaleString()}`}
        onConfirm={spawnBots}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

// Small helper component for the three top lists.
function TopList({ rows }: {
  rows: { id: string; primary: string; secondary: string; tone?: 'up' | 'dn' }[];
}) {
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.id} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--a-border)',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: 'var(--a-elev)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--a-text-dim)',
            }}>{i + 1}</span>
            <span style={{ fontWeight: 600 }}>{r.id}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={r.tone ? 'a-stat-value ' + r.tone : ''} style={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.1,
              color: r.tone === 'up' ? 'var(--a-green)' : r.tone === 'dn' ? 'var(--a-red)' : 'var(--a-text)',
            }}>{r.primary}</div>
            <div style={{ fontSize: 11, color: 'var(--a-text-mute)' }}>{r.secondary}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
