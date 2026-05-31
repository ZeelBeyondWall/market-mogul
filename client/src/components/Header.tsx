import { useGame } from '../store/gameStore';
import { fmt } from '../../../shared/engine/helpers';
import { Audio } from '../audio/audio';
import { AnimatedNumber } from './AnimatedNumber';

export function Header() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const setSettingsOpen = useGame(s => s.setSettingsOpen);
  const rank = useGame(s => s.playerRank);
  const total = useGame(s => s.totalTraders);

  const p = eng.player();
  const cash = p.cash;
  const port = eng.portfolioValue();
  const net = eng.netWorth();

  return (
    <header>
      <div className="logo-mini">
        <svg><use href="#logoMini"/></svg>
        <div>
          <div className="t1">MARKET MOGUL</div>
          <div className="t2">TERMINAL v2.1</div>
        </div>
      </div>
      <div className="stats">
        <Stat label="💰 Cash">
          <AnimatedNumber value={cash} format={n => fmt(n)} className="val cash" />
        </Stat>
        <Stat label="📊 Portfolio">
          <AnimatedNumber value={port} format={n => fmt(n)} className="val" />
        </Stat>
        <Stat label="🏆 Net Worth">
          <AnimatedNumber value={net} format={n => fmt(n)} className="val net" />
        </Stat>
        <Stat label="🥇 Rank">
          <span className="val rank">{`#${rank}/${total || '—'}`}</span>
        </Stat>
      </div>
      <div className="header-controls">
        <button className="icon-btn" onClick={() => { setSettingsOpen(true); Audio.click(); }} title="Settings">
          <svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0zm10.4-1.2l-1.7-.3-.3-.7.9-1.4-1.4-1.4-1.4.9-.7-.3-.3-1.7h-2l-.3 1.7-.7.3-1.4-.9-1.4 1.4.9 1.4-.3.7-1.7.3v2l1.7.3.3.7-.9 1.4 1.4 1.4 1.4-.9.7.3.3 1.7h2l.3-1.7.7-.3 1.4.9 1.4-1.4-.9-1.4.3-.7 1.7-.3z" fill="currentColor"/></svg>
        </button>
      </div>
    </header>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <span className="lbl">{label}</span>
      {children}
    </div>
  );
}
