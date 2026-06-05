import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

export function BottomNav() {
  const mv = useGame(s => s.mobileView);
  const setMv = useGame(s => s.setMobileView);
  const unread = useGame(s => s.notifUnread);
  const setNotifOpen = useGame(s => s.setNotifOpen);
  const notifOpen = useGame(s => s.notifOpen);
  const activeScreen = useGame(s => s.activeScreen);
  const setActiveScreen = useGame(s => s.setActiveScreen);
  const activeTab = useGame(s => s.activeTab);
  const setActiveTab = useGame(s => s.setActiveTab);

  return (
    <nav className="bnav">
      {/* HOME */}
      <button
        className={'bnav-btn' + (activeScreen === 'dashboard' && !notifOpen ? ' on' : '')}
        onClick={() => { setActiveScreen('dashboard'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconHome />
        </span>
        <span className="bnav-label">Home</span>
      </button>

      {/* MARKETS */}
      <button
        className={'bnav-btn' + (activeScreen === 'trading' && mv === 'market' && !notifOpen && activeTab !== 'news' ? ' on' : '')}
        onClick={() => { setActiveScreen('trading'); setMv('market'); setActiveTab('movers'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconMarkets />
        </span>
        <span className="bnav-label">Markets</span>
      </button>

      {/* TRADE */}
      <button
        className={'bnav-btn' + (activeScreen === 'trading' && mv === 'trade' && !notifOpen && activeTab !== 'news' ? ' on' : '')}
        onClick={() => { setActiveScreen('trading'); setMv('trade'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconTrade />
        </span>
        <span className="bnav-label">Trade</span>
      </button>

      {/* PORTFOLIO */}
      <button
        className={'bnav-btn' + (activeScreen === 'portfolio' && !notifOpen ? ' on' : '')}
        onClick={() => { setActiveScreen('portfolio'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconPortfolio />
        </span>
        <span className="bnav-label">Portfolio</span>
      </button>

      {/* ALERTS */}
      <button
        className={'bnav-btn' + (notifOpen ? ' on' : '')}
        onClick={() => { setNotifOpen(!notifOpen); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconAlerts />
          {unread > 0 && <span className="bnav-dot" />}
        </span>
        <span className="bnav-label">Alerts</span>
      </button>

      {/* STORE */}
      <button
        className={'bnav-btn' + (activeScreen === 'store' && !notifOpen ? ' on' : '')}
        onClick={() => { setActiveScreen('store'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconStore />
        </span>
        <span className="bnav-label">Store</span>
      </button>
    </nav>
  );
}

function IconStore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

// Sleek high-tech cockpit HUD SVG icons
function IconMarkets() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconTrade() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <path d="M3 3v18h18" stroke="currentColor" strokeOpacity="0.3" />
      <path d="M18.5 8l-5.5 5.5-3-3-5 5" />
      <circle cx="18.5" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconPortfolio() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeOpacity="0.75" />
    </svg>
  );
}

function IconAlerts() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconEvents() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
