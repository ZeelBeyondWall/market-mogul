import { useState } from 'react';
import { useGame, type Theme } from '../store/gameStore';
import { Audio, setMuted } from '../audio/audio';
import { showModal } from './Modal';

export function Settings() {
  const open = useGame(s => s.settingsOpen);
  const setOpen = useGame(s => s.setSettingsOpen);
  const theme = useGame(s => s.theme);
  const setTheme = useGame(s => s.setTheme);
  const muted = useGame(s => s.muted);
  const toggleMute = useGame(s => s.toggleMute);
  const reduceMotion = useGame(s => s.reduceMotion);
  const setReduceMotion = useGame(s => s.setReduceMotion);
  const showParticles = useGame(s => s.showParticles);
  const setShowParticles = useGame(s => s.setShowParticles);
  const autoConfirm = useGame(s => s.autoConfirm);
  const setAutoConfirm = useGame(s => s.setAutoConfirm);
  const beginnerMode = useGame(s => s.beginnerMode);
  const setBeginnerMode = useGame(s => s.setBeginnerMode);

  if (!open) return null;

  const onReset = async () => {
    const ok = await showModal('Reset everything?',
      'Wipes server state (state.json) AND local prefs. Server must be restarted via start.bat.', true);
    if (!ok) return;
    try { await fetch(`http://${location.hostname}:8787/admin/reset`, { method: 'POST' }); } catch { /* server gone */ }
    localStorage.removeItem('mm_ui_prefs_v2');
    location.reload();
  };

  return (
    <>
      <div className="settings-backdrop" onClick={() => setOpen(false)} />
      <aside className="settings-panel">
        <div className="settings-head">
          <h2>⚙ Settings</h2>
          <button className="settings-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <Section title="Theme">
          <SegmentedRow
            value={theme}
            options={[
              { v: 'game', label: '🎮 Game', desc: 'Bold colorful arcade UI' },
              { v: 'pro',  label: '📈 Pro',  desc: 'Bloomberg terminal style' },
            ]}
            onChange={(v) => { setTheme(v as Theme); Audio.click(); }}
          />
        </Section>

        <Section title="Audio">
          <Toggle label="Sound effects" value={!muted} onChange={() => { toggleMute(); Audio.click(); }} />
        </Section>

        <Section title="Display">
          <Toggle label="Show particles on wins" value={showParticles} onChange={v => { setShowParticles(v); Audio.click(); }} />
          <Toggle label="Reduce motion (instant updates)" value={reduceMotion} onChange={v => { setReduceMotion(v); Audio.click(); }} />
        </Section>

        <Section title="Difficulty">
          <Toggle label="🌱 Beginner Mode (hides advanced tabs + collapses SL/TP)" value={beginnerMode} onChange={v => { setBeginnerMode(v); Audio.click(); }} />
        </Section>

        <Section title="Trading">
          <Toggle label="Auto-confirm large orders" value={autoConfirm} onChange={v => { setAutoConfirm(v); Audio.click(); }} />
        </Section>

        <Section title="Danger">
          <button className="settings-danger" onClick={onReset}>Reset save + restart</button>
        </Section>

        <div className="settings-foot">
          <div>MarketVerseX v2.1</div>
          <div>Server: <ServerBadge /></div>
        </div>
      </aside>
    </>
  );
}

function ServerBadge() {
  const ok = useGame(s => s.connected);
  return <span style={{ color: ok ? 'var(--green)' : 'var(--red)' }}>{ok ? '● LIVE' : '○ DOWN'}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <span className={'toggle-switch' + (value ? ' on' : '')} onClick={() => onChange(!value)}>
        <span className="toggle-knob" />
      </span>
    </label>
  );
}

function SegmentedRow<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string; desc: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="settings-segmented">
      {options.map(o => (
        <button key={o.v} className={'seg' + (value === o.v ? ' on' : '')} onClick={() => onChange(o.v)}>
          <div className="seg-label">{o.label}</div>
          <div className="seg-desc">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}
