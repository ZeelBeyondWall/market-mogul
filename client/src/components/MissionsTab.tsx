import type { MissionState } from '../../../shared/engine/types';
import { fmt } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { send } from '../net/wsClient';
import { Audio } from '../audio/audio';

export function MissionsTab() {
  const daily = useGame(s => s.dailyMissions);
  const weekly = useGame(s => s.weeklyMissions);
  const bonus = useGame(s => s.playerBonus);
  const streak = useGame(s => s.playerStreak);

  return (
    <div className="section">
      <h3>Missions <span className="badge">{(daily.length + weekly.length)}</span></h3>

      <div className="mission-summary">
        <div>
          <div className="ms-l">Bonus Wallet</div>
          <div className="ms-v">{fmt(bonus)}</div>
        </div>
        <div>
          <div className="ms-l">Login Streak</div>
          <div className="ms-v">{streak ? streak + 'd 🔥' : 'Start today'}</div>
        </div>
      </div>

      <div className="mission-group">
        <div className="mission-group-title">DAILY <span className="mg-reset">resets at UTC 00:00</span></div>
        {daily.length === 0 ? (
          <div className="empty">Loading…</div>
        ) : daily.map(m => <Row key={m.def.id} m={m} />)}
      </div>

      <div className="mission-group">
        <div className="mission-group-title">WEEKLY <span className="mg-reset">resets Monday UTC</span></div>
        {weekly.length === 0 ? (
          <div className="empty">Loading…</div>
        ) : weekly.map(m => <Row key={m.def.id} m={m} />)}
      </div>
    </div>
  );
}

function Row({ m }: { m: MissionState }) {
  const pct = Math.min(100, (m.progress / m.def.goal.target) * 100);
  const progressText = formatProgress(m);
  return (
    <div className={'mission-row' + (m.completed ? ' done' : '') + (m.claimed ? ' claimed' : '')}>
      <div className="mr-info">
        <div className="mr-title">{m.def.title}</div>
        <div className="mr-desc">{m.def.desc}</div>
        <div className="mr-bar"><div className="mr-bar-fill" style={{ width: pct + '%' }} /></div>
        <div className="mr-prog">{progressText} · reward ${m.def.reward}</div>
      </div>
      <div className="mr-action">
        {m.claimed ? (
          <span className="mr-tag claimed">✓ CLAIMED</span>
        ) : m.completed ? (
          <button className="mr-claim" onClick={() => { send({ type: 'claimMission', payload: { missionId: m.def.id } }); Audio.click(); }}>CLAIM</button>
        ) : (
          <span className="mr-tag pending">{Math.floor(pct)}%</span>
        )}
      </div>
    </div>
  );
}

function formatProgress(m: MissionState): string {
  const g = m.def.goal;
  switch (g.kind) {
    case 'trades':       return `${Math.floor(m.progress)} / ${g.target} trades`;
    case 'profitable':   return `${Math.floor(m.progress)} / ${g.target} winners`;
    case 'distinct':     return `${Math.floor(m.progress)} / ${g.target} stocks`;
    case 'portfolioPct': return `${m.progress.toFixed(2)}% / ${g.target}%`;
    case 'holdHours':    return `${m.progress.toFixed(2)}h / ${g.target}h`;
  }
}
