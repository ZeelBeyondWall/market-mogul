import { useState, type ReactNode } from 'react';

// ===== Formatting =====
export function fmt(n: number): string {
  if (n == null || isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e12) return sign + '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return sign + '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return sign + '$' + (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return sign + '$' + (n / 1e3).toFixed(2)  + 'K';
  return sign + '$' + n.toFixed(2);
}
export function fmtNum(n: number): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
export function fmtPct(n: number, dec = 2): string {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(dec) + '%';
}
export function fmtDuration(sec: number): string {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  if (sec < 86400) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h + 'h ' + m + 'm';
  }
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
  return d + 'd ' + h + 'h';
}
export function fmtTime(ts: number): string {
  if (!ts) return '—';
  const elapsed = (Date.now() - ts) / 1000;
  if (elapsed < 60) return Math.floor(elapsed) + 's ago';
  if (elapsed < 3600) return Math.floor(elapsed / 60) + 'm ago';
  if (elapsed < 86400) return Math.floor(elapsed / 3600) + 'h ago';
  return Math.floor(elapsed / 86400) + 'd ago';
}

// ===== StatCard =====
export function StatCard({ label, value, icon, sub, tone, delta }: {
  label: string; value: string | number; icon?: string;
  sub?: string; tone?: 'up' | 'dn' | 'warn'; delta?: { v: number; label?: string };
}) {
  return (
    <div className="a-stat-card">
      {icon && <div className="a-stat-icon">{icon}</div>}
      <div className="a-stat-label">{label}</div>
      <div className={'a-stat-value' + (tone ? ' ' + tone : '')}>{value}</div>
      <div className="a-stat-sub">
        {sub && <span>{sub}</span>}
        {delta && (
          <span className={'a-stat-delta ' + (delta.v >= 0 ? 'up' : 'dn')}>
            {delta.v >= 0 ? '▲' : '▼'} {Math.abs(delta.v).toFixed(2)}% {delta.label || ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ===== ConfirmModal =====
export function ConfirmModal({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: ReactNode;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="a-modal-backdrop" onClick={onCancel}>
      <div className={'a-modal' + (danger ? ' danger' : '')} onClick={e => e.stopPropagation()}>
        <div className="a-modal-header">
          <h2><span className="a-modal-icon">{danger ? '⚠' : 'ⓘ'}</span> {title}</h2>
        </div>
        <div className="a-modal-body">{body}</div>
        <div className="a-modal-footer">
          <button className="a-btn ghost" onClick={onCancel}>Cancel</button>
          <button className={'a-btn ' + (danger ? 'danger' : 'primary')} onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

// ===== Switch =====
export function Switch({ on, onChange, tone }: { on: boolean; onChange: (v: boolean) => void; tone?: 'warn' | 'danger' }) {
  return <button className={'a-switch' + (on ? ' on' : '') + (tone ? ' ' + tone : '')} onClick={() => onChange(!on)} aria-pressed={on} />;
}

// ===== Toggle row =====
export function ToggleRow({ label, sub, on, onChange, tone }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void; tone?: 'warn' | 'danger' }) {
  return (
    <div className="a-toggle">
      <div className="a-toggle-label">
        <span className="l1">{label}</span>
        {sub && <span className="l2">{sub}</span>}
      </div>
      <Switch on={on} onChange={onChange} tone={tone} />
    </div>
  );
}

// ===== Sparkline =====
export function Sparkline({ data, color = 'var(--a-accent)', area = true, height = 36 }: { data: number[]; color?: string; area?: boolean; height?: number }) {
  if (!data || data.length < 2) {
    return <svg className="a-spark" style={{ height }} viewBox="0 0 100 40" preserveAspectRatio="none"><line x1="0" y1="20" x2="100" y2="20" stroke="var(--a-text-mute)" strokeWidth="0.5" /></svg>;
  }
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 40 - ((v - min) / range) * 38 - 1;
    return [x, y];
  });
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L100,40 L0,40 Z`;
  return (
    <svg className="a-spark" style={{ height }} viewBox="0 0 100 40" preserveAspectRatio="none">
      {area && <path className="a-chart-area" d={areaPath} fill={color} />}
      <path className="a-chart-line" d={linePath} stroke={color} />
    </svg>
  );
}

// ===== Chart with axis =====
export function LineChart({ data, height = 180, color = 'var(--a-accent)', label }: { data: { ts: number; v: number }[]; height?: number; color?: string; label?: string }) {
  // FIX: guard against length 0 OR 1 (1 would divide by zero in x calc).
  if (!data || data.length < 2) return <div className="a-empty" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{data?.length === 1 ? 'Collecting data…' : 'No data'}</div>;
  const w = 600;
  const min = Math.min(...data.map(d => d.v));
  const max = Math.max(...data.map(d => d.v));
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((d.v - min) / range) * (height - 30) - 15;
    return [x, y];
  });
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${w},${height} L0,${height} Z`;
  return (
    <svg className="a-chart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75].map(r => (
        <line key={r} className="a-chart-grid" x1="0" y1={height * r} x2={w} y2={height * r} />
      ))}
      <path className="a-chart-area" d={areaPath} fill={color} />
      <path className="a-chart-line" d={linePath} stroke={color} />
      {label && <text x="8" y="14" fill="var(--a-text-mute)" fontSize="10" fontFamily="var(--a-font)">{label} · {data[data.length - 1].v.toFixed(0)}</text>}
    </svg>
  );
}

// ===== Toast manager (singleton, simple) =====
let toastCb: ((m: string, t: 'ok'|'err'|'info') => void) | null = null;
export function toast(m: string, t: 'ok'|'err'|'info' = 'ok') { toastCb?.(m, t); }
export function ToastHost() {
  const [m, setM] = useState<{ msg: string; kind: 'ok'|'err'|'info' } | null>(null);
  toastCb = (msg, kind) => { setM({ msg, kind }); setTimeout(() => setM(null), 3000); };
  if (!m) return null;
  return <div className={'a-toast ' + m.kind}>{m.msg}</div>;
}

// ===== KV row =====
export function KV({ label, value, tone }: { label: string; value: string | number; tone?: 'up' | 'dn' }) {
  return (
    <div className="a-kv-row">
      <span className="a-kv-l">{label}</span>
      <span className={'a-kv-v' + (tone ? ' ' + tone : '')}>{value}</span>
    </div>
  );
}

// ===== useApi loader =====
export async function safe<T>(fn: () => Promise<T>, onErr?: (e: string) => void): Promise<T | null> {
  try { return await fn(); }
  catch (e: any) {
    const msg = e?.message || String(e);
    if (onErr) onErr(msg); else toast(msg, 'err');
    return null;
  }
}
