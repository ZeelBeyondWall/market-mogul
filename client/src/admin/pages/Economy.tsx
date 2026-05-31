import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '../api';
import type { EconomyResp } from '../types';
import {
  fmt, fmtNum,
  StatCard, ConfirmModal, ToggleRow,
  toast, safe,
} from '../components';

const PER_MARKET_LABEL: Record<string, { label: string; icon: string }> = {
  stocks: { label: 'Stocks', icon: '📈' },
  crypto: { label: 'Crypto', icon: '₿' },
  forex:  { label: 'Forex',  icon: '💱' },
};

export default function Economy() {
  const [eco, setEco] = useState<EconomyResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Liquidity inputs
  const [injectAmt, setInjectAmt] = useState<string>('100000');
  const [removeAmt, setRemoveAmt] = useState<string>('100000');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Tuning slider local state (so dragging is smooth + debounced posts).
  const [volMult, setVolMult] = useState(1.0);
  const [spreadMult, setSpreadMult] = useState(1.0);
  const [activityMult, setActivityMult] = useState(1.0);

  // Track which fields the user is actively dragging — don't overwrite from server during drag.
  const dragging = useRef<{ vol: boolean; spread: boolean; act: boolean }>({ vol: false, spread: false, act: false });
  // Debounce timers per key.
  const flagTimers = useRef<Record<string, any>>({});

  async function load() {
    const r = await safe(() => apiGet<EconomyResp>('/admin/economy'), m => setErr(m));
    if (r) {
      setErr(null);
      setEco(r);
      if (!dragging.current.vol)    setVolMult(r.flags.volatilityMult ?? 1.0);
      if (!dragging.current.spread) setSpreadMult(r.flags.spreadMult ?? 1.0);
      if (!dragging.current.act)    setActivityMult(r.flags.activityMult ?? 1.0);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => {
      clearInterval(id);
      for (const k of Object.keys(flagTimers.current)) clearTimeout(flagTimers.current[k]);
    };
  }, []);

  function postFlag(key: string, value: any) {
    if (flagTimers.current[key]) clearTimeout(flagTimers.current[key]);
    flagTimers.current[key] = setTimeout(async () => {
      const r = await safe(() => apiPost('/admin/economy/flag', { key, value }));
      if (r) toast(`${key} = ${typeof value === 'number' ? value.toFixed(2) : value}`, 'ok');
    }, 220);
  }

  async function doInject() {
    const amt = Number(injectAmt);
    if (!isFinite(amt) || amt <= 0) { toast('Enter a positive amount', 'err'); return; }
    const r = await safe(() => apiPost<{ ok: boolean; distributed: number; recipients: number }>(
      '/admin/economy/inject', { amount: amt }
    ));
    if (r) {
      toast(`Injected ${fmt(amt)} across ${fmtNum(r.recipients)} bots`, 'ok');
      load();
    }
  }

  async function doRemove() {
    setConfirmRemove(false);
    const amt = Number(removeAmt);
    if (!isFinite(amt) || amt <= 0) { toast('Enter a positive amount', 'err'); return; }
    const r = await safe(() => apiPost<{ ok: boolean; removed: number; recipients: number }>(
      '/admin/economy/remove', { amount: amt }
    ));
    if (r) {
      toast(`Removed ${fmt(amt)} from ${fmtNum(r.recipients)} bots`, 'ok');
      load();
    }
  }

  const loading = !eco;
  const flags = eco?.flags;

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Economy</h1>
          <div className="a-page-sub">Real-time market stats, liquidity pools and global tuning</div>
        </div>
        <div className="a-page-actions">
          {err && <span className="a-stat-delta dn">⚠ {err}</span>}
          <button className="a-btn ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* ===== Section 1: Headline stats ===== */}
      {loading ? (
        <div className="a-empty">Loading economy…</div>
      ) : (
        <div className="a-grid-3" style={{ marginBottom: 18 }}>
          <StatCard label="Total Users"     value={fmtNum(eco!.totalRegistered)} icon="👥" sub={fmtNum(eco!.totalActive) + ' active'} />
          <StatCard label="Total Bots"      value={fmtNum(eco!.totalBots)}       icon="🤖" />
          <StatCard label="Total Cash"      value={fmt(eco!.totalCash)}          icon="💵" />
          <StatCard label="Total Net"       value={fmt(eco!.totalNet)}           icon="📊" />
          <StatCard label="Total Volume"    value={fmt(eco!.totalMarketVolume)}  icon="🔥" />
          <StatCard label="Open Positions"  value={fmtNum(eco!.openPositions)}   icon="📦" sub={fmtNum(eco!.openOrders) + ' open orders'} />
          <StatCard label="Online"          value={fmtNum(eco!.totalOnline)}     icon="🟢" />
          <StatCard
            label="Richest"
            value={eco!.richest?.name || '—'}
            icon="👑"
            sub={eco!.richest?.net ? fmt(eco!.richest.net) : ''}
          />
        </div>
      )}

      {/* ===== Section 2: Per-market breakdown ===== */}
      <div className="a-card" style={{ marginBottom: 18 }}>
        <h3 className="a-card-title">Per-Market Breakdown</h3>
        {loading ? (
          <div className="a-empty">Loading…</div>
        ) : (
          <div className="a-grid-3">
            {(['stocks', 'crypto', 'forex'] as const).map(mk => {
              const data = eco!.perMarket?.[mk] || { count: 0, volume: 0 };
              const meta = PER_MARKET_LABEL[mk];
              return (
                <StatCard
                  key={mk}
                  label={meta.label}
                  value={fmt(data.volume)}
                  icon={meta.icon}
                  sub={fmtNum(data.count) + ' assets'}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Section 3: Liquidity Controls ===== */}
      <div className="a-grid-2" style={{ marginBottom: 18 }}>
        <div className="a-card">
          <h3 className="a-card-title">Inject Liquidity</h3>
          <div className="a-page-sub" style={{ marginBottom: 12 }}>
            Distribute cash evenly across all bot traders.
          </div>
          <div className="a-form-row">
            <label className="a-label">Amount (USD)</label>
            <input
              className="a-input"
              type="number"
              min={0}
              step={1000}
              value={injectAmt}
              onChange={e => setInjectAmt(e.target.value)}
              placeholder="100000"
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="a-btn primary" onClick={doInject}>💉 Inject {fmt(Number(injectAmt) || 0)}</button>
          </div>
        </div>

        <div className="a-card">
          <h3 className="a-card-title">Remove Liquidity</h3>
          <div className="a-page-sub" style={{ marginBottom: 12 }}>
            Drain cash from all bots. Use to cool an overheated market.
          </div>
          <div className="a-form-row">
            <label className="a-label">Amount (USD)</label>
            <input
              className="a-input"
              type="number"
              min={0}
              step={1000}
              value={removeAmt}
              onChange={e => setRemoveAmt(e.target.value)}
              placeholder="100000"
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="a-btn danger" onClick={() => setConfirmRemove(true)}>🔥 Remove {fmt(Number(removeAmt) || 0)}</button>
          </div>
        </div>
      </div>

      {/* ===== Section 4: Market Tuning ===== */}
      <div className="a-card" style={{ marginBottom: 18 }}>
        <h3 className="a-card-title">Market Tuning</h3>
        <div className="a-page-sub" style={{ marginBottom: 16 }}>
          Live multipliers — changes apply instantly to the engine.
        </div>

        <SliderRow
          label="Volatility"
          sub="Price-swing magnitude across all assets"
          value={volMult}
          onInput={v => { setVolMult(v); dragging.current.vol = true; postFlag('volatilityMult', v); }}
          onCommit={() => { dragging.current.vol = false; }}
        />
        <SliderRow
          label="Spread"
          sub="Bid/ask gap on every order book"
          value={spreadMult}
          onInput={v => { setSpreadMult(v); dragging.current.spread = true; postFlag('spreadMult', v); }}
          onCommit={() => { dragging.current.spread = false; }}
        />
        <SliderRow
          label="Activity"
          sub="Bot trading frequency / aggressiveness"
          value={activityMult}
          onInput={v => { setActivityMult(v); dragging.current.act = true; postFlag('activityMult', v); }}
          onCommit={() => { dragging.current.act = false; }}
        />
      </div>

      {/* ===== Section 5: Event Toggle ===== */}
      <div className="a-card" style={{ marginBottom: 18 }}>
        <h3 className="a-card-title">Events</h3>
        <ToggleRow
          label="Auto-fire News Events"
          sub="When off, no automatic news shocks will be generated"
          on={!!flags?.eventsEnabled}
          onChange={async v => {
            const r = await safe(() => apiPost('/admin/economy/flag', { key: 'eventsEnabled', value: v }));
            if (r) { toast('Events ' + (v ? 'enabled' : 'disabled'), 'ok'); load(); }
          }}
        />
      </div>

      <ConfirmModal
        open={confirmRemove}
        danger
        title="Remove Liquidity?"
        confirmLabel="Remove"
        body={
          <>
            <p>You are about to remove <b>{fmt(Number(removeAmt) || 0)}</b> in cash, spread evenly across all bot traders.</p>
            <p className="a-page-sub">This is destructive and cannot be undone. Bots clamped to zero cash will be unable to trade until refilled.</p>
          </>
        }
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

// ---- Internal slider row ----
function SliderRow({ label, sub, value, onInput, onCommit }: {
  label: string; sub?: string; value: number;
  onInput: (v: number) => void; onCommit: () => void;
}) {
  const pct = ((value - 0.1) / (3.0 - 0.1)) * 100;
  const tone = value > 1.5 ? 'up' : value < 0.7 ? 'dn' : undefined;
  return (
    <div className="a-form-row" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <label className="a-label" style={{ margin: 0 }}>{label}</label>
        <span className={'a-stat-value' + (tone ? ' ' + tone : '')} style={{ fontSize: 16 }}>
          {value.toFixed(2)}×
        </span>
      </div>
      {sub && <div className="a-page-sub" style={{ marginBottom: 6 }}>{sub}</div>}
      <input
        type="range"
        min={0.1}
        max={3.0}
        step={0.1}
        value={value}
        onChange={e => onInput(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onBlur={onCommit}
        style={{
          width: '100%',
          accentColor: 'var(--a-accent)',
          background: `linear-gradient(to right, var(--a-accent) 0%, var(--a-accent) ${pct}%, var(--a-border) ${pct}%, var(--a-border) 100%)`,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--a-text-mute)', marginTop: 2 }}>
        <span>0.1×</span><span>1.0×</span><span>3.0×</span>
      </div>
    </div>
  );
}
