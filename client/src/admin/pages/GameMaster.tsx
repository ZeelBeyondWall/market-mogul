import { useState } from 'react';
import { apiPost } from '../api';
import { ConfirmModal, toast, safe } from '../components';

const EVENT_TITLES = [
  'EARNINGS BEAT',
  'EARNINGS MISS',
  'TECH SECTOR BOOM',
  'TECH SELLOFF',
  'CRYPTO RALLY',
  'CRYPTO WINTER',
  'BANK CRISIS',
  'TECH-CRYPTO RALLY',
  'GLOBAL RECOVERY',
  'GLOBAL ROUT',
  'FLASH CRASH',
  'PRODUCT LAUNCH HIT',
];

type FFKey = '1h' | '6h' | '24h' | '7d';
const FF_PRESETS: { key: FFKey; label: string; seconds: number }[] = [
  { key: '1h',  label: '+1h',  seconds: 3600   },
  { key: '6h',  label: '+6h',  seconds: 21600  },
  { key: '24h', label: '+24h', seconds: 86400  },
  { key: '7d',  label: '+7d',  seconds: 604800 },
];

export default function GameMaster() {
  // ===== XP Operations =====
  const [xpUserId, setXpUserId] = useState('');
  const [xpAmount, setXpAmount] = useState('100');
  const [lvlUserId, setLvlUserId] = useState('');
  const [lvlValue, setLvlValue] = useState('10');

  // ===== Market Access =====
  const [maUserId, setMaUserId] = useState('');
  const [maMarket, setMaMarket] = useState<'stocks' | 'crypto' | 'forex'>('crypto');

  // ===== Mission Control =====
  const [missUserId, setMissUserId] = useState('');
  const [missId, setMissId] = useState('');
  const [resetMissUserId, setResetMissUserId] = useState('');
  const [confirmResetMiss, setConfirmResetMiss] = useState(false);

  // ===== Time Simulation =====
  const [pendingFF, setPendingFF] = useState<{ label: string; seconds: number } | null>(null);
  const [ffBusy, setFFBusy] = useState(false);
  const [eventBusy, setEventBusy] = useState<string | null>(null);

  // ===== Handlers =====
  async function doGiveXp(amount: number) {
    const id = Number(xpUserId);
    if (!Number.isFinite(id) || xpUserId === '') { toast('Enter a valid user ID', 'err'); return; }
    if (!Number.isFinite(amount) || amount === 0) { toast('Enter a non-zero amount', 'err'); return; }
    const r = await safe(() => apiPost(`/admin/user/${id}/giveXp`, { amount }));
    if (r) toast(`XP ${amount > 0 ? '+' : ''}${amount} → user ${id} (lvl ${(r as any).level ?? '?'})`, 'ok');
  }

  async function doSetLevel() {
    const id = Number(lvlUserId);
    const lvl = Math.floor(Number(lvlValue));
    if (!Number.isFinite(id) || lvlUserId === '') { toast('Enter a valid user ID', 'err'); return; }
    if (!Number.isFinite(lvl) || lvl < 1 || lvl > 99) { toast('Level must be 1–99', 'err'); return; }
    const r = await safe(() => apiPost(`/admin/user/${id}/setLevel`, { level: lvl }));
    if (r) toast(`User ${id} → level ${lvl}`, 'ok');
  }

  async function doMarketAccess(action: 'unlock' | 'lock') {
    const id = Number(maUserId);
    if (!Number.isFinite(id) || maUserId === '') { toast('Enter a valid user ID', 'err'); return; }
    const path = action === 'unlock' ? '/admin/gm/unlockMarket' : '/admin/gm/lockMarket';
    const r = await safe(() => apiPost(path, { userId: id, market: maMarket }));
    if (r) toast(`${maMarket.toUpperCase()} ${action}ed for user ${id}`, 'ok');
  }

  async function doForceMission() {
    const id = Number(missUserId);
    if (!Number.isFinite(id) || missUserId === '') { toast('Enter a valid user ID', 'err'); return; }
    if (!missId.trim()) { toast('Enter a mission ID', 'err'); return; }
    const r = await safe(() => apiPost('/admin/gm/forceMission', { userId: id, missionId: missId.trim() }));
    if (r) toast(`Mission ${missId.trim()} force-completed for user ${id}`, 'ok');
  }

  async function doResetMissions() {
    const id = Number(resetMissUserId);
    if (!Number.isFinite(id) || resetMissUserId === '') { toast('Enter a valid user ID', 'err'); setConfirmResetMiss(false); return; }
    setConfirmResetMiss(false);
    const r = await safe(() => apiPost(`/admin/user/${id}/resetMissions`));
    if (r) toast(`Missions reset for user ${id}`, 'ok');
  }

  async function doFireEvent(title?: string) {
    setEventBusy(title || '__random__');
    const r = await safe(() => apiPost('/admin/event', title ? { title } : {}));
    setEventBusy(null);
    if (r) toast(`Fired: ${(r as any).fired || title || 'random'}`, 'ok');
  }

  async function doFastForward(seconds: number, label: string) {
    setFFBusy(true);
    const r = await safe(() => apiPost('/admin/sim/fastForward', { seconds }));
    setFFBusy(false);
    if (r) {
      const proc = (r as any).processedNow ?? 0;
      const sched = (r as any).ticksScheduled ?? 0;
      toast(`Fast-forwarded ${label} — ${proc}/${sched} ticks ${proc < sched ? 'queued' : 'done'}`, 'ok');
    }
  }

  function requestFF(p: { label: string; seconds: number }) {
    if (p.seconds >= 86400) {
      setPendingFF(p);
    } else {
      doFastForward(p.seconds, p.label);
    }
  }

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Game Master</h1>
          <div className="a-page-sub">Testing & balancing tools — grant XP, unlock markets, force events, fast-forward time.</div>
        </div>
      </div>

      <div className="a-grid-2">
        {/* ============== XP Operations ============== */}
        <div className="a-card">
          <h3 style={{ marginTop: 0 }}>XP Operations</h3>

          <div className="a-form-row" style={{ marginBottom: 12 }}>
            <div style={{ flex: '1 1 120px' }}>
              <label className="a-label">User ID</label>
              <input
                className="a-input"
                type="number"
                placeholder="e.g. 0"
                value={xpUserId}
                onChange={e => setXpUserId(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="a-label">Amount</label>
              <input
                className="a-input"
                type="number"
                placeholder="100"
                value={xpAmount}
                onChange={e => setXpAmount(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="a-btn primary"
                onClick={() => doGiveXp(Math.abs(Number(xpAmount) || 0))}
              >
                Give XP
              </button>
              <button
                className="a-btn danger"
                onClick={() => doGiveXp(-Math.abs(Number(xpAmount) || 0))}
              >
                Remove XP
              </button>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--a-border, #2a2a35)', margin: '12px 0' }} />

          <div className="a-form-row">
            <div style={{ flex: '1 1 120px' }}>
              <label className="a-label">User ID</label>
              <input
                className="a-input"
                type="number"
                placeholder="e.g. 0"
                value={lvlUserId}
                onChange={e => setLvlUserId(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="a-label">Level (1–99)</label>
              <input
                className="a-input"
                type="number"
                min={1}
                max={99}
                placeholder="10"
                value={lvlValue}
                onChange={e => setLvlValue(e.target.value)}
              />
            </div>
            <div>
              <button className="a-btn primary" onClick={doSetLevel}>Set Level</button>
            </div>
          </div>
        </div>

        {/* ============== Market Access ============== */}
        <div className="a-card">
          <h3 style={{ marginTop: 0 }}>Market Access</h3>

          <div className="a-form-row">
            <div style={{ flex: '1 1 120px' }}>
              <label className="a-label">User ID</label>
              <input
                className="a-input"
                type="number"
                placeholder="e.g. 0"
                value={maUserId}
                onChange={e => setMaUserId(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="a-label">Market</label>
              <select
                className="a-select"
                value={maMarket}
                onChange={e => setMaMarket(e.target.value as any)}
              >
                <option value="stocks">stocks</option>
                <option value="crypto">crypto</option>
                <option value="forex">forex</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="a-btn primary" onClick={() => doMarketAccess('unlock')}>Unlock</button>
              <button className="a-btn danger" onClick={() => doMarketAccess('lock')}>Lock</button>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--a-text-mute)' }}>
            Unlock bumps the user's level to the market's required threshold; lock drops them just below it.
          </div>
        </div>

        {/* ============== Mission Control ============== */}
        <div className="a-card">
          <h3 style={{ marginTop: 0 }}>Mission Control</h3>

          <div className="a-form-row" style={{ marginBottom: 12 }}>
            <div style={{ flex: '1 1 100px' }}>
              <label className="a-label">User ID</label>
              <input
                className="a-input"
                type="number"
                placeholder="e.g. 0"
                value={missUserId}
                onChange={e => setMissUserId(e.target.value)}
              />
            </div>
            <div style={{ flex: '2 1 180px' }}>
              <label className="a-label">Mission ID</label>
              <input
                className="a-input"
                type="text"
                placeholder="e.g. daily_trade_10"
                value={missId}
                onChange={e => setMissId(e.target.value)}
              />
            </div>
            <div>
              <button className="a-btn primary" onClick={doForceMission}>Force Complete</button>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--a-border, #2a2a35)', margin: '12px 0' }} />

          <div className="a-form-row">
            <div style={{ flex: '1 1 120px' }}>
              <label className="a-label">User ID</label>
              <input
                className="a-input"
                type="number"
                placeholder="e.g. 0"
                value={resetMissUserId}
                onChange={e => setResetMissUserId(e.target.value)}
              />
            </div>
            <div>
              <button
                className="a-btn danger"
                onClick={() => {
                  if (resetMissUserId === '' || !Number.isFinite(Number(resetMissUserId))) {
                    toast('Enter a valid user ID', 'err');
                    return;
                  }
                  setConfirmResetMiss(true);
                }}
              >
                Reset User Missions
              </button>
            </div>
          </div>
        </div>

        {/* ============== Time Simulation ============== */}
        <div className="a-card">
          <h3 style={{ marginTop: 0 }}>Time Simulation</h3>
          <div style={{ fontSize: 12, color: 'var(--a-text-mute)', marginBottom: 12 }}>
            Fast-forwards the engine by simulating ticks at 100ms each. Long jumps run async in batches.
          </div>
          <div className="a-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {FF_PRESETS.map(p => (
              <button
                key={p.key}
                className={'a-btn ' + (p.seconds >= 86400 ? 'danger' : 'primary')}
                disabled={ffBusy}
                onClick={() => requestFF(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {ffBusy && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--a-text-mute)' }}>Stepping engine…</div>}
        </div>
      </div>

      {/* ============== Event Triggers (full width) ============== */}
      <div className="a-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Event Triggers</h3>
          <button
            className="a-btn primary"
            disabled={eventBusy === '__random__'}
            onClick={() => doFireEvent()}
          >
            {eventBusy === '__random__' ? 'Firing…' : 'Fire Random Event'}
          </button>
        </div>

        <div
          className="a-grid-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}
        >
          {EVENT_TITLES.map(t => (
            <button
              key={t}
              className="a-btn ghost"
              disabled={eventBusy === t}
              onClick={() => doFireEvent(t)}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
            >
              {eventBusy === t ? '…' : t}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--a-text-mute)' }}>
          Fires a news event matching the title; falls back to random if title is unknown server-side.
        </div>
      </div>

      {/* ============== Modals ============== */}
      <ConfirmModal
        open={confirmResetMiss}
        title="Reset User Missions"
        body={
          <div>
            Reset daily + weekly missions for user <b>#{resetMissUserId}</b>?<br />
            All progress will be wiped and fresh missions issued.
          </div>
        }
        confirmLabel="Reset"
        danger
        onConfirm={doResetMissions}
        onCancel={() => setConfirmResetMiss(false)}
      />

      <ConfirmModal
        open={!!pendingFF}
        title="Fast-forward Time"
        body={
          <div>
            Advance the engine by <b>{pendingFF?.label}</b> ({pendingFF?.seconds.toLocaleString()}s)?<br />
            Long jumps run in async batches and may take a while to drain.
          </div>
        }
        confirmLabel={`Skip ${pendingFF?.label}`}
        danger
        onConfirm={() => {
          if (pendingFF) {
            const p = pendingFF;
            setPendingFF(null);
            doFastForward(p.seconds, p.label);
          }
        }}
        onCancel={() => setPendingFF(null)}
      />
    </>
  );
}
