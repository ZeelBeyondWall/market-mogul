import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { IconHome, IconCandles, IconBolt, IconBriefcase, IconBell, IconStore } from '../ui/icons';
import '../styles/arcade-header.css';

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
    <nav className="bnav dock">
      {/* HOME */}
      <button
        className={'bnav-btn dock-item' + (activeScreen === 'dashboard' && !notifOpen ? ' on active' : '')}
        onClick={() => { setActiveScreen('dashboard'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconHome size={22} className="hud-svg" />
        </span>
        <span className="bnav-label">Home</span>
      </button>

      {/* MARKETS */}
      <button
        className={'bnav-btn dock-item' + (activeScreen === 'trading' && mv === 'market' && !notifOpen && activeTab !== 'news' ? ' on active' : '')}
        onClick={() => { setActiveScreen('trading'); setMv('market'); setActiveTab('movers'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconCandles size={22} className="hud-svg" />
        </span>
        <span className="bnav-label">Markets</span>
      </button>

      {/* TRADE — raised console dock center button */}
      <button
        className={'bnav-btn dock-item dock-trade' + (activeScreen === 'trading' && mv === 'trade' && !notifOpen && activeTab !== 'news' ? ' on active' : '')}
        onClick={() => { setActiveScreen('trading'); setMv('trade'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon dock-center">
          <IconBolt size={22} className="hud-svg" />
        </span>
        <span className="bnav-label">Trade</span>
      </button>

      {/* PORTFOLIO */}
      <button
        className={'bnav-btn dock-item' + (activeScreen === 'portfolio' && !notifOpen ? ' on active' : '')}
        onClick={() => { setActiveScreen('portfolio'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconBriefcase size={22} className="hud-svg" />
        </span>
        <span className="bnav-label">Portfolio</span>
      </button>

      {/* ALERTS */}
      <button
        className={'bnav-btn dock-item' + (notifOpen ? ' on active' : '')}
        onClick={() => { setNotifOpen(!notifOpen); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconBell size={22} className="hud-svg" />
          {unread > 0 && <span className="bnav-dot" />}
        </span>
        <span className="bnav-label">Alerts</span>
      </button>

      {/* STORE */}
      <button
        className={'bnav-btn dock-item' + (activeScreen === 'store' && !notifOpen ? ' on active' : '')}
        onClick={() => { setActiveScreen('store'); setNotifOpen(false); Audio.click(); }}
      >
        <span className="bnav-icon">
          <IconStore size={22} className="hud-svg" />
        </span>
        <span className="bnav-label">Store</span>
      </button>
    </nav>
  );
}
