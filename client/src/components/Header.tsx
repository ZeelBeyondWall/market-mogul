import { useGame } from '../store/gameStore';
import { fmt } from '../../../shared/engine/helpers';
import { AnimatedNumber } from './AnimatedNumber';

// v8: cleaner header — single row, big level pill, stats as cards.
export function Header() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const rank = useGame(s => s.playerRank);
  const total = useGame(s => s.totalTraders);
  const lvl = useGame(s => s.playerLevel);
  const xp = useGame(s => s.playerXp);
  const xpAt = useGame(s => s.xpAtCurrent);
  const xpTo = useGame(s => s.xpToNext);
  const session = useGame(s => s.session);
  const activeScreen = useGame(s => s.activeScreen);
  const setActiveScreen = useGame(s => s.setActiveScreen);

  const p = eng.player();
  // v9.1: display short proceeds as a margin bet — cash never jumps up, P&L
  // lives in the position. (displayCash + displayPortfolio === netWorth.)
  const cash = eng.displayCash();
  const port = eng.displayPortfolioValue();
  const net = eng.netWorth();
  const bonus = p.bonus || 0;
  const xpProgress = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';

  return (
    <header className="hdr-v8">
      <div className="hdr-brand">
        <svg className="hdr-logo"><use href="#logoMini"/></svg>
        <div>
          <div className="hdr-name">MARKETVERSEX</div>
          <div className="hdr-sub-row">
            <span className="hdr-sub">{username}</span>
            <span className="hdr-status-badge">PILOT // ONLINE</span>
          </div>
        </div>
      </div>

      <div className="hdr-nav">
        <button 
          className={'hdr-nav-btn' + (activeScreen === 'dashboard' ? ' on' : '')} 
          onClick={() => { setActiveScreen('dashboard'); }}
        >
          🏠 Home
        </button>
        <button 
          className={'hdr-nav-btn' + (activeScreen === 'trading' ? ' on' : '')} 
          onClick={() => { setActiveScreen('trading'); }}
        >
          📈 Trade
        </button>
      </div>

      <div className="hdr-lvl">
        <div className="hdr-lvl-num">LVL {lvl}</div>
        <div className="hdr-lvl-bar">
          <div className="hdr-lvl-fill" style={{ width: xpProgress + '%' }} />
        </div>
        <div className="hdr-lvl-xp">{xp - xpAt} / {xpTo - xpAt} XP</div>
      </div>

      <div className="hdr-stats">
        <HStat label="⚡ SYS.CASH_BAL" tone="cash">
          <AnimatedNumber value={cash} format={n => fmt(n)} className="hs-v" />
        </HStat>
        <HStat label="🛡️ SYS.HOLD_VAL" tone="port">
          <AnimatedNumber value={port} format={n => fmt(n)} className="hs-v" />
        </HStat>
        <HStat label="💎 SYS.NET_WORTH" tone="net">
          <AnimatedNumber value={net} format={n => fmt(n)} className="hs-v" />
        </HStat>
        {bonus > 0 && (
          <HStat label="🎁 SYS.BONUS_CRD" tone="bonus">
            <AnimatedNumber value={bonus} format={n => fmt(n)} className="hs-v" />
          </HStat>
        )}
        <HStat label="🏆 SYS.GLOBAL_RANK" tone="rank">
          <span className="hs-v">{`#${rank}`}</span>
          <span className="hs-sub">/ {total || '—'}</span>
        </HStat>
      </div>
    </header>
  );
}

function HStat({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={'hs hs-' + tone}>
      <div className="hs-l">{label}</div>
      <div className="hs-row">{children}</div>
    </div>
  );
}
