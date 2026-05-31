import { useGame } from '../store/gameStore';
import { fmt } from '../../../shared/engine/helpers';
import { Audio } from '../audio/audio';

export function Header() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const muted = useGame(s => s.muted);
  const toggleMute = useGame(s => s.toggleMute);
  const connected = useGame(s => s.connected);
  const rank = useGame(s => s.playerRank);
  const total = useGame(s => s.totalTraders);

  const p = eng.player();

  return (
    <header>
      <div className="logo-mini">
        <svg><use href="#logoMini"/></svg>
        <div>
          <div className="t1">MARKET MOGUL</div>
          <div className="t2">TERMINAL v2.0</div>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="lbl">SERVER</span>
          <span className="val" style={{ color: connected ? 'var(--green)' : 'var(--red)', fontSize: 10 }}>
            {connected ? '● LIVE' : '○ DOWN'}
          </span>
        </div>
        <div className="stat"><span className="lbl">Cash</span><span className="val cash">{fmt(p.cash)}</span></div>
        <div className="stat"><span className="lbl">Portfolio</span><span className="val">{fmt(eng.portfolioValue())}</span></div>
        <div className="stat"><span className="lbl">Net Worth</span><span className="val net">{fmt(eng.netWorth())}</span></div>
        <div className="stat"><span className="lbl">Income/s</span><span className="val up">{fmt(eng.playerIncomePerSec())}/s</span></div>
        <div className="stat"><span className="lbl">Rank</span><span className="val rank">{`#${rank}/${total || '—'}`}</span></div>
      </div>
      <div className="header-controls">
        <button className="icon-btn" onClick={() => { toggleMute(); Audio.click(); }} title="Mute">
          <svg><use href={muted ? '#i-mute' : '#i-sound'}/></svg>
        </button>
      </div>
    </header>
  );
}
