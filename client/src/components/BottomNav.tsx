import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

// v9.5: premium mobile HUD controller with custom vector icons.
export function BottomNav() {
  const mv = useGame(s => s.mobileView);
  const setMv = useGame(s => s.setMobileView);
  const unread = useGame(s => s.notifUnread);
  const setNotifOpen = useGame(s => s.setNotifOpen);
  const notifOpen = useGame(s => s.notifOpen);
  const setSettingsOpen = useGame(s => s.setSettingsOpen);

  return (
    <nav className="bnav">
      {/* MARKETS */}
      <button
        className={'bnav-btn' + (mv === 'market' ? ' on' : '')}
        onClick={() => { setMv('market'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconMarkets />
        </span>
        <span className="bnav-label">Markets</span>
      </button>

      {/* TRADE */}
      <button
        className={'bnav-btn' + (mv === 'trade' ? ' on' : '')}
        onClick={() => { setMv('trade'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconTrade />
        </span>
        <span className="bnav-label">Trade</span>
      </button>

      {/* PORTFOLIO */}
      <button
        className={'bnav-btn' + (mv === 'panel' ? ' on' : '')}
        onClick={() => { setMv('panel'); setNotifOpen(false); Audio.click(); }}
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

      {/* SYSTEM */}
      <button
        className="bnav-btn"
        onClick={() => { setSettingsOpen(true); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconSystem />
        </span>
        <span className="bnav-label">System</span>
      </button>
    </nav>
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

function IconSystem() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hud-svg">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeOpacity="0.4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9V5M12 19v-4M9.4 10.5l-3.5-2M18.1 15.5l-3.5-2M14.6 10.5l3.5-2M5.9 15.5l3.5-2" />
    </svg>
  );
}

