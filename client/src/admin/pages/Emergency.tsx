import { useEffect, useState, type ReactNode } from 'react';
import { apiGet, apiPost } from '../api';
import type { EconomyResp, HealthResp } from '../types';
import {
  fmtNum, fmtDuration,
  StatCard, ConfirmModal, ToggleRow,
  toast, safe,
} from '../components';

type ConfirmCfg = {
  title: string;
  body: ReactNode;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export default function Emergency() {
  const [econ, setEcon] = useState<EconomyResp | null>(null);
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [resetTyped, setResetTyped] = useState('');

  // Auto-refresh economy flags every 2s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const e = await safe(() => apiGet<EconomyResp>('/admin/economy'));
      if (alive && e) {
        setEcon(e);
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 2000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Health pull every 5s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const h = await safe(() => apiGet<HealthResp>('/admin/health'));
      if (alive && h) setHealth(h);
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const flags = econ?.flags;

  const ask = (cfg: ConfirmCfg) => setConfirmCfg(cfg);
  const closeConfirm = () => { setConfirmCfg(null); setResetTyped(''); };

  const runConfirmed = async () => {
    if (!confirmCfg) return;
    try {
      await confirmCfg.onConfirm();
    } catch (e: any) {
      toast(e?.message || 'Action failed', 'err');
    } finally {
      closeConfirm();
    }
  };

  // ---- Action wrappers ----
  const toggleHaltTrading = (enabled: boolean) => {
    ask({
      title: enabled ? 'Halt All Trading?' : 'Resume Trading?',
      body: enabled
        ? 'This will IMMEDIATELY stop all order matching across every market. Open orders will remain but no new fills will occur.'
        : 'Trading will resume across all markets.',
      danger: true,
      confirmLabel: enabled ? 'Halt Trading' : 'Resume',
      onConfirm: async () => {
        await apiPost('/admin/emergency/haltTrading', { enabled });
        toast(enabled ? 'Trading halted' : 'Trading resumed', enabled ? 'err' : 'ok');
      },
    });
  };

  // UI shows "Disable Bot Trading". on=true means bots ARE disabled (i.e. !botsEnabled).
  // Server: enabled=true means DISABLE bots.
  const toggleDisableBots = (on: boolean) => {
    ask({
      title: on ? 'Disable Bot Trading?' : 'Re-Enable Bot Trading?',
      body: on
        ? 'All bot traders will stop placing orders. The market will go quiet — only human players will trade.'
        : 'Bots will resume placing orders.',
      danger: true,
      confirmLabel: on ? 'Disable Bots' : 'Enable Bots',
      onConfirm: async () => {
        await apiPost('/admin/emergency/disableBots', { enabled: on });
        toast(on ? 'Bot trading disabled' : 'Bot trading enabled', on ? 'err' : 'ok');
      },
    });
  };

  const toggleDisableEvents = (on: boolean) => {
    ask({
      title: on ? 'Disable News Events?' : 'Re-Enable News Events?',
      body: on
        ? 'News events that drive price movement and missions will be suppressed.'
        : 'News events will resume.',
      danger: true,
      confirmLabel: on ? 'Disable Events' : 'Enable Events',
      onConfirm: async () => {
        await apiPost('/admin/emergency/disableEvents', { enabled: on });
        toast(on ? 'Events disabled' : 'Events enabled', on ? 'err' : 'ok');
      },
    });
  };

  const toggleMaintenance = (enabled: boolean) => {
    ask({
      title: enabled ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?',
      body: enabled
        ? 'Players will be shown a maintenance banner and may be blocked from trading.'
        : 'Maintenance mode will be lifted.',
      danger: true,
      confirmLabel: enabled ? 'Enable Maintenance' : 'Disable Maintenance',
      onConfirm: async () => {
        await apiPost('/admin/emergency/maintenance', { enabled });
        toast(enabled ? 'Maintenance ON' : 'Maintenance OFF', enabled ? 'err' : 'ok');
      },
    });
  };

  const toggleRegistration = (disabled: boolean) => {
    ask({
      title: disabled ? 'Block New Registrations?' : 'Allow New Registrations?',
      body: disabled
        ? 'No new player accounts can be created until you re-enable this.'
        : 'New player registrations will be allowed.',
      danger: true,
      confirmLabel: disabled ? 'Block Registrations' : 'Allow Registrations',
      onConfirm: async () => {
        await apiPost('/admin/emergency/registration', { disabled });
        toast(disabled ? 'Registrations blocked' : 'Registrations open', disabled ? 'err' : 'ok');
      },
    });
  };

  const sendBroadcast = () => {
    const msg = broadcastMsg.trim();
    if (!msg) { toast('Message is empty', 'err'); return; }
    ask({
      title: 'Send Broadcast Banner?',
      body: (
        <>
          <div style={{ marginBottom: 8 }}>This message will appear on every connected client immediately:</div>
          <div style={{ padding: 10, background: 'var(--a-elev)', borderRadius: 6, fontStyle: 'italic' }}>{msg}</div>
        </>
      ),
      danger: true,
      confirmLabel: 'Broadcast',
      onConfirm: async () => {
        await apiPost('/admin/emergency/broadcast', { message: msg });
        toast('Broadcast sent', 'ok');
        setBroadcastMsg('');
      },
    });
  };

  const clearBanner = () => {
    ask({
      title: 'Clear Banner?',
      body: 'Remove the current broadcast banner from all clients.',
      danger: false,
      confirmLabel: 'Clear',
      onConfirm: async () => {
        await apiPost('/admin/emergency/broadcast', { message: '' });
        toast('Banner cleared', 'ok');
      },
    });
  };

  const nukeReset = () => {
    setResetTyped('');
    ask({
      title: 'RESET ENTIRE GAME STATE?',
      body: (
        <>
          <div style={{ marginBottom: 10, color: 'var(--a-red)', fontWeight: 700 }}>
            This will WIPE all traders, holdings, orders, missions, and price history.
          </div>
          <div style={{ marginBottom: 10 }}>This action CANNOT be undone.</div>
          <div style={{ marginBottom: 6 }}>Type <b>RESET</b> to confirm:</div>
          <input
            className="a-input"
            autoFocus
            placeholder="RESET"
            value={resetTyped}
            onChange={e => setResetTyped(e.target.value)}
          />
        </>
      ),
      danger: true,
      confirmLabel: 'RESET GAME',
      onConfirm: async () => {
        if (resetTyped !== 'RESET') {
          toast('You must type RESET exactly', 'err');
          throw new Error('confirm text mismatch');
        }
        await apiPost('/admin/reset');
        toast('Game state reset', 'ok');
      },
    });
  };

  const purgeRekt = () => {
    ask({
      title: 'Purge All REKT Bots?',
      body: 'All bots flagged as REKT will be permanently removed from the engine. This frees memory but is irreversible.',
      danger: true,
      confirmLabel: 'Purge REKT',
      onConfirm: async () => {
        await apiPost('/admin/purge-rekt');
        toast('REKT bots purged', 'ok');
      },
    });
  };

  // ---- Render helpers ----
  const flagBadge = (label: string, active: boolean, activeTone: 'err' | 'warn' = 'err') => (
    <span className={'a-badge ' + (active ? activeTone : 'ok')}>
      {label}: {active ? 'ON' : 'OFF'}
    </span>
  );

  // Memory usage percent
  let memPct = 0;
  let memUsedMb = 0;
  let memTotalMb = 0;
  if (health) {
    memUsedMb = health.mem.heapUsed / (1024 * 1024);
    memTotalMb = health.mem.heapTotal / (1024 * 1024);
    memPct = memTotalMb > 0 ? (memUsedMb / memTotalMb) * 100 : 0;
  }
  const memWarn = memPct > 80;

  // Re-bind reset confirm body so it picks up resetTyped changes
  const liveConfirm: ConfirmCfg | null = confirmCfg && confirmCfg.title.startsWith('RESET ENTIRE') ? {
    ...confirmCfg,
    body: (
      <>
        <div style={{ marginBottom: 10, color: 'var(--a-red)', fontWeight: 700 }}>
          This will WIPE all traders, holdings, orders, missions, and price history.
        </div>
        <div style={{ marginBottom: 10 }}>This action CANNOT be undone.</div>
        <div style={{ marginBottom: 6 }}>Type <b>RESET</b> to confirm:</div>
        <input
          className="a-input"
          autoFocus
          placeholder="RESET"
          value={resetTyped}
          onChange={e => setResetTyped(e.target.value)}
        />
      </>
    ),
  } : confirmCfg;

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title" style={{ color: 'var(--a-red)' }}>🚨 Emergency Operations</h1>
          <div className="a-page-sub">Break-glass controls. Every action is logged and confirmed.</div>
        </div>
      </div>

      {loading && !econ && <div className="a-card">Loading…</div>}

      {/* 1. STATUS PANEL */}
      <div className="a-card danger-zone" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>System Status</h3>
        {!flags ? (
          <div className="a-empty">No flag data</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {flagBadge('Trading', flags.tradingHalted ? true : false, 'err')}
            <span className={'a-badge ' + (flags.tradingHalted ? 'err' : 'ok')}>
              {flags.tradingHalted ? 'HALTED' : 'LIVE'}
            </span>
            <span className={'a-badge ' + (flags.botsEnabled ? 'ok' : 'warn')}>
              Bots: {flags.botsEnabled ? 'ON' : 'OFF'}
            </span>
            <span className={'a-badge ' + (flags.eventsEnabled ? 'ok' : 'warn')}>
              Events: {flags.eventsEnabled ? 'ON' : 'OFF'}
            </span>
            <span className={'a-badge ' + (flags.maintenanceMode ? 'err' : 'ok')}>
              Maintenance: {flags.maintenanceMode ? 'ON' : 'OFF'}
            </span>
            <span className={'a-badge ' + (flags.registrationDisabled ? 'warn' : 'ok')}>
              Registration: {flags.registrationDisabled ? 'BLOCKED' : 'OPEN'}
            </span>
            {flags.broadcastBanner && (
              <span className="a-badge info">Banner active</span>
            )}
          </div>
        )}
      </div>

      {/* 2. TRADING CONTROLS */}
      <div className="a-card danger-zone" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Trading Controls</h3>
        {!flags ? (
          <div className="a-empty">Loading flags…</div>
        ) : (
          <>
            <ToggleRow
              label="Halt All Trading"
              sub="Freeze every market. Open orders stay queued; no fills occur."
              on={flags.tradingHalted}
              onChange={toggleHaltTrading}
              tone="danger"
            />
            <ToggleRow
              label="Disable Bot Trading"
              sub="Bots stop placing orders. Only human players will trade."
              on={!flags.botsEnabled}
              onChange={toggleDisableBots}
              tone="warn"
            />
            <ToggleRow
              label="Disable News Events"
              sub="Suppress event-driven price moves and mission triggers."
              on={!flags.eventsEnabled}
              onChange={toggleDisableEvents}
              tone="warn"
            />
          </>
        )}
      </div>

      {/* 3. SYSTEM CONTROLS */}
      <div className="a-card danger-zone" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>System Controls</h3>
        {!flags ? (
          <div className="a-empty">Loading flags…</div>
        ) : (
          <>
            <ToggleRow
              label="Maintenance Mode"
              sub="Show maintenance banner to all players."
              on={flags.maintenanceMode}
              onChange={toggleMaintenance}
              tone="danger"
            />
            <ToggleRow
              label="Block New Registrations"
              sub="Reject all new player sign-ups."
              on={flags.registrationDisabled}
              onChange={toggleRegistration}
              tone="warn"
            />
          </>
        )}
      </div>

      {/* 4. BROADCAST */}
      <div className="a-card danger-zone" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Broadcast Banner</h3>
        <div className="a-form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label className="a-label">Message (max 280 chars)</label>
          <textarea
            className="a-input"
            rows={3}
            maxLength={280}
            value={broadcastMsg}
            onChange={e => setBroadcastMsg(e.target.value)}
            placeholder="e.g. Scheduled maintenance in 10 minutes — close your positions."
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ fontSize: 11, color: 'var(--a-text-mute)', textAlign: 'right' }}>
            {broadcastMsg.length}/280
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="a-btn danger" disabled={!broadcastMsg.trim()} onClick={sendBroadcast}>
            Broadcast
          </button>
          <button className="a-btn ghost" onClick={clearBanner} disabled={!flags?.broadcastBanner}>
            Clear Banner
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="a-label" style={{ marginBottom: 4 }}>Current banner:</div>
          {flags?.broadcastBanner ? (
            <div style={{
              padding: 10,
              background: 'rgba(240,79,87,.08)',
              border: '1px solid rgba(240,79,87,.25)',
              borderRadius: 6,
              fontStyle: 'italic',
            }}>
              {flags.broadcastBanner}
            </div>
          ) : (
            <div className="a-empty" style={{ padding: 10 }}>No active banner</div>
          )}
        </div>
      </div>

      {/* 5. SERVER HEALTH */}
      <div className="a-card danger-zone" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Server Health</h3>
        {!health ? (
          <div className="a-empty">Loading health…</div>
        ) : (
          <>
            {/* v8.1: compact horizontal summary instead of cramped 3-col cards */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 14 }}>
              <HealthKV label="Uptime"  value={fmtDuration(health.uptimeSec)} />
              <HealthKV label="Memory"  value={`${memUsedMb.toFixed(0)} / ${memTotalMb.toFixed(0)} MB`} tone={memWarn ? 'warn' : undefined} />
              <HealthKV label="Traders" value={fmtNum(health.tradersCount)} />
              <HealthKV label="Clients" value={fmtNum(health.clientCount)} />
              <HealthKV label="Assets"  value={fmtNum(health.assetsCount)} />
              <HealthKV label="PID"     value={String(health.pid)} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--a-text-mute)', marginBottom: 4 }}>
                <span>Heap usage</span>
                <span>{memPct.toFixed(1)}%</span>
              </div>
              <div className="a-meter">
                <div className={'a-meter-fill' + (memWarn ? ' warn' : '')} style={{ width: Math.min(100, memPct).toFixed(1) + '%' }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 6. NUCLEAR OPTIONS */}
      <div className="a-card danger-zone" style={{ marginBottom: 14, borderColor: 'var(--a-red)' }}>
        <h3 style={{ margin: '0 0 4px 0', color: 'var(--a-red)' }}>☢ Nuclear Options</h3>
        <div style={{ fontSize: 12, color: 'var(--a-text-mute)', marginBottom: 12 }}>
          Irreversible. Use only when you really mean it.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="a-btn danger" onClick={nukeReset}>
            Reset Game State
          </button>
          <button className="a-btn danger" onClick={purgeRekt}>
            Purge All REKT Bots
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!liveConfirm}
        title={liveConfirm?.title || ''}
        body={liveConfirm?.body || ''}
        danger={liveConfirm?.danger}
        confirmLabel={liveConfirm?.confirmLabel}
        onConfirm={runConfirmed}
        onCancel={closeConfirm}
      />
    </>
  );
}

// v8.1: inline KV pair for server-health summary (avoids cramped 3-col grid)
function HealthKV({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
      <span style={{ fontSize: 9, color: 'var(--a-text-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: tone === 'warn' ? 'var(--a-amber)' : 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
