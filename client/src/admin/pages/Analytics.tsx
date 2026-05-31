import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api';
import type { AnalyticsResp } from '../types';
import {
  fmt, fmtNum, fmtPct,
  StatCard, LineChart, safe, toast,
} from '../components';

type TimeFilter = '1H' | '6H' | '24H' | '7D';

const FILTER_WINDOWS: Record<TimeFilter, number> = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('1H');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await safe(() => apiGet<AnalyticsResp>('/admin/analytics'));
      if (alive && r) { setData(r); setLoading(false); }
    };
    load();
    const id = setInterval(load, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const useHourly = filter !== '1H';
  const windowMs = FILTER_WINDOWS[filter];

  // Build filtered series for charts + KPIs.
  const tradeSeries = useMemo(() => {
    if (!data) return [];
    const now = data.current?.ts || (data.series.length ? data.series[data.series.length - 1].ts : 0);
    const cutoff = now - windowMs;
    if (useHourly) {
      return (data.hourly || [])
        .filter(h => h.ts >= cutoff)
        .map(h => ({ ts: h.ts, v: h.trades }));
    }
    return (data.series || [])
      .filter(s => s.ts >= cutoff)
      .map(s => ({ ts: s.ts, v: s.trades5sBucket }));
  }, [data, filter, useHourly, windowMs]);

  const volumeSeries = useMemo(() => {
    if (!data) return [];
    const now = data.current?.ts || 0;
    const cutoff = now - windowMs;
    if (useHourly) {
      return (data.hourly || [])
        .filter(h => h.ts >= cutoff)
        .map(h => ({ ts: h.ts, v: h.volume }));
    }
    return (data.series || [])
      .filter(s => s.ts >= cutoff)
      .map(s => ({ ts: s.ts, v: s.totalVolume }));
  }, [data, filter, useHourly, windowMs]);

  const onlineSeries = useMemo(() => {
    if (!data) return [];
    const now = data.current?.ts || 0;
    const cutoff = now - windowMs;
    if (useHourly) {
      return (data.hourly || [])
        .filter(h => h.ts >= cutoff)
        .map(h => ({ ts: h.ts, v: h.users }));
    }
    return (data.series || [])
      .filter(s => s.ts >= cutoff)
      .map(s => ({ ts: s.ts, v: s.online }));
  }, [data, filter, useHourly, windowMs]);

  // KPI sums (over the visible window).
  const totalTrades = useMemo(() => {
    if (!data) return 0;
    const now = data.current?.ts || 0;
    const cutoff = now - windowMs;
    return (data.series || [])
      .filter(s => s.ts >= cutoff)
      .reduce((acc, s) => acc + (s.trades5sBucket || 0), 0);
  }, [data, windowMs]);

  const onlineNow = data?.current?.online ?? 0;
  const totalVolume = data?.current?.totalVolume ?? 0;
  const activeTraders = data?.current?.totalTraders ?? 0;

  // Heatmap: union of gainers/losers/topVolume, deduped, sorted by abs(chg).
  const heatmap = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, { id: string; chgPct: number }>();
    const push = (id: string, chgPct: number) => {
      if (!seen.has(id)) seen.set(id, { id, chgPct: chgPct || 0 });
    };
    (data.topGainers || []).forEach(g => push(g.id, g.chgPct));
    (data.topLosers || []).forEach(g => push(g.id, g.chgPct));
    (data.topVolume || []).forEach(g => {
      const existing = seen.get(g.id);
      if (!existing) push(g.id, 0);
    });
    return Array.from(seen.values()).sort((a, b) => Math.abs(b.chgPct) - Math.abs(a.chgPct));
  }, [data]);

  const perMarket = data?.perMarket || {};
  const maxMktVol = Math.max(1, ...Object.values(perMarket).map((m: any) => m?.volume || 0));

  const handleExport = () => {
    try {
      if (!data) { toast('No data to export', 'err'); return; }
      const rows: string[] = ['ts,iso,trades,volume,online'];
      if (useHourly) {
        for (const h of data.hourly || []) {
          rows.push([h.ts, new Date(h.ts).toISOString(), h.trades, h.volume, h.users].join(','));
        }
      } else {
        for (const s of data.series || []) {
          rows.push([s.ts, new Date(s.ts).toISOString(), s.trades5sBucket, s.totalVolume, s.online].join(','));
        }
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${filter}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Exported CSV', 'ok');
    } catch (e: any) {
      toast(e?.message || 'Export failed', 'err');
    }
  };

  const heatColor = (chg: number): string => {
    const intensity = Math.min(1, Math.abs(chg) / 10);
    if (chg >= 0) {
      return `rgba(34, 197, 94, ${0.15 + intensity * 0.75})`;
    }
    return `rgba(239, 68, 68, ${0.15 + intensity * 0.75})`;
  };

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Analytics</h1>
          <div className="a-page-sub">
            Live engine telemetry · {useHourly ? 'hourly buckets' : '5s buckets'} · refresh 3s
          </div>
        </div>
        <div className="a-page-actions">
          <div className="a-time-filter">
            {(['1H', '6H', '24H', '7D'] as TimeFilter[]).map(f => (
              <button
                key={f}
                className={'a-btn ' + (filter === f ? 'primary' : 'ghost')}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="a-btn primary" onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      {loading && !data ? (
        <div className="a-card">Loading…</div>
      ) : (
        <>
          {/* 1. KPI row */}
          <div className="a-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard label="Online Now" value={fmtNum(onlineNow)} icon="●" tone="up" />
            <StatCard label={`Total Trades (${filter})`} value={fmtNum(totalTrades)} icon="↻" />
            <StatCard label="Total Volume" value={fmt(totalVolume)} icon="$" />
            <StatCard label="Active Traders" value={fmtNum(activeTraders)} icon="◉" />
          </div>

          {/* 2. Main chart */}
          <div className="a-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Trade Frequency</h3>
              <span style={{ opacity: 0.6, fontSize: 12 }}>{useHourly ? 'hourly trades' : 'trades per 5s'}</span>
            </div>
            {tradeSeries.length > 1 ? (
              <LineChart data={tradeSeries} height={220} label={useHourly ? 'trades/hr' : 'trades/5s'} />
            ) : (
              <div className="a-empty">No data in window</div>
            )}
          </div>

          {/* 3. Two side-by-side charts */}
          <div className="a-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="a-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Volume</h3>
                <span style={{ opacity: 0.6, fontSize: 12 }}>over time</span>
              </div>
              {volumeSeries.length > 1 ? (
                <LineChart data={volumeSeries} height={180} color="var(--a-accent2, #22c55e)" label="vol" />
              ) : (
                <div className="a-empty">No data</div>
              )}
            </div>
            <div className="a-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Online Users</h3>
                <span style={{ opacity: 0.6, fontSize: 12 }}>over time</span>
              </div>
              {onlineSeries.length > 1 ? (
                <LineChart data={onlineSeries} height={180} color="#3b82f6" label="online" />
              ) : (
                <div className="a-empty">No data</div>
              )}
            </div>
          </div>

          {/* 4. Heatmap */}
          <div className="a-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Market Heatmap</h3>
              <span style={{ opacity: 0.6, fontSize: 12 }}>{heatmap.length} assets</span>
            </div>
            {heatmap.length === 0 ? (
              <div className="a-empty">No movement</div>
            ) : (
              <div
                className="a-heatmap"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: 8,
                }}
              >
                {heatmap.map(cell => (
                  <div
                    key={cell.id}
                    className="a-heatcell"
                    style={{
                      background: heatColor(cell.chgPct),
                      padding: '10px 8px',
                      borderRadius: 6,
                      textAlign: 'center',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{cell.id}</div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>{fmtPct(cell.chgPct)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Three lists side-by-side */}
          <div className="a-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div className="a-card">
              <h3 style={{ marginTop: 0 }}>Top Gainers</h3>
              {(data?.topGainers || []).length === 0 ? (
                <div className="a-empty">None</div>
              ) : (
                (data?.topGainers || []).slice(0, 10).map(g => (
                  <div key={g.id} className="a-list-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight: 600 }}>{g.id}</span>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>{fmt(g.lastPrice)}</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{fmtPct(g.chgPct)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="a-card">
              <h3 style={{ marginTop: 0 }}>Top Losers</h3>
              {(data?.topLosers || []).length === 0 ? (
                <div className="a-empty">None</div>
              ) : (
                (data?.topLosers || []).slice(0, 10).map(g => (
                  <div key={g.id} className="a-list-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight: 600 }}>{g.id}</span>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>{fmt(g.lastPrice)}</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmtPct(g.chgPct)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="a-card">
              <h3 style={{ marginTop: 0 }}>Most Active</h3>
              {(data?.topVolume || []).length === 0 ? (
                <div className="a-empty">None</div>
              ) : (
                (data?.topVolume || []).slice(0, 10).map(g => (
                  <div key={g.id} className="a-list-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight: 600 }}>{g.id}</span>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>{fmt(g.lastPrice)}</span>
                    <span style={{ opacity: 0.9 }}>{fmt(g.volume)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 6. Per-Market Bars */}
          <div className="a-card">
            <h3 style={{ marginTop: 0 }}>Per-Market Volume</h3>
            {Object.keys(perMarket).length === 0 ? (
              <div className="a-empty">No market data</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(perMarket).map(([mkt, m]: [string, any]) => {
                  const vol = m?.volume || 0;
                  const pct = (vol / maxMktVol) * 100;
                  return (
                    <div key={mkt}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{mkt}</span>
                        <span style={{ opacity: 0.8 }}>
                          {fmt(vol)} · {fmtNum(m?.count || 0)} assets · OI {fmtNum(m?.openInterest || 0)}
                        </span>
                      </div>
                      <div style={{ height: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: pct + '%',
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--a-accent, #3b82f6), #22c55e)',
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
