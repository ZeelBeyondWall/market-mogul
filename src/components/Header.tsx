import { useGame } from '../store/gameStore';
import { useEffect, useState } from 'react';
import { fmt } from '../engine/helpers';
import { showModal } from './Modal';
import { wipe } from '../utils/persistence';
import { Audio } from '../audio/audio';

export function Header() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick); // re-render
  const muted = useGame(s => s.muted);
  const toggleMute = useGame(s => s.toggleMute);
  const [rank, setRank] = useState('—');

  useEffect(() => {
    const id = setInterval(() => setRank(`#${eng.playerRank()}/${eng.state.traders.length}`), 500);
    return () => clearInterval(id);
  }, [eng]);

  const p = eng.player();
  const onReset = async () => {
    const ok = await showModal('Reset save?', 'Delete all progress & restart?', true);
    if (ok) wipe();
  };

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
        <div className="stat"><span className="lbl">Cash</span><span className="val cash">{fmt(p.cash)}</span></div>
        <div className="stat"><span className="lbl">Portfolio</span><span className="val">{fmt(eng.portfolioValue())}</span></div>
        <div className="stat"><span className="lbl">Net Worth</span><span className="val net">{fmt(eng.netWorth())}</span></div>
        <div className="stat"><span className="lbl">Income/s</span><span className="val up">{fmt(eng.playerIncomePerSec())}/s</span></div>
        <div className="stat"><span className="lbl">Rank</span><span className="val rank">{rank}</span></div>
      </div>
      <div className="header-controls">
        <button className="icon-btn" onClick={() => { toggleMute(); Audio.click(); }} title="Mute">
          <svg><use href={muted ? '#i-mute' : '#i-sound'}/></svg>
        </button>
        <button className="icon-btn" onClick={onReset} title="Reset save">
          <svg><use href="#i-reset"/></svg>
        </button>
      </div>
    </header>
  );
}
