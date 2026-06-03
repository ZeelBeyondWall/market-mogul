import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { ASSETS } from '../../../shared/engine/constants';
import { NotificationCenter } from './NotificationCenter';

export function Header() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const lvl = useGame(s => s.playerLevel);
  const session = useGame(s => s.session);
  const activeScreen = useGame(s => s.activeScreen);
  const setActiveScreen = useGame(s => s.setActiveScreen);
  const activeTab = useGame(s => s.activeTab);
  const setActiveTab = useGame(s => s.setActiveTab);
  const pushToast = useGame(s => s.pushToast);
  const setSettingsOpen = useGame(s => s.setSettingsOpen);

  const p = eng.player();
  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getAvatarEmoji = (level: number) => {
    if (level < 5) return '🧑‍🚀';
    if (level < 10) return '🦾';
    if (level < 20) return '🤖';
    if (level < 30) return '⚡';
    if (level < 50) return '👽';
    return '👑';
  };

  const handleNav = (screen: 'dashboard' | 'trading', tab?: any) => {
    Audio.click();
    setActiveScreen(screen);
    if (tab) {
      setActiveTab(tab);
    }
  };

  // Compile ticker items for the header ticker
  const tickerItems = ASSETS.slice(0, 8).map(a => {
    const ast = eng.state.assets[a.id];
    if (!ast) return null;
    const chg = ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100;
    const isPositive = chg >= 0;
    return (
      <span key={a.id} className="hdr-ticker-item" onClick={() => handleNav('trading', 'positions')}>
        <span className="ticker-sym">{a.id}</span>
        <span className="ticker-price">{fmt(ast.lastPrice)}</span>
        <span className={`ticker-chg ${isPositive ? 'up-green' : 'dn-red'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
        </span>
      </span>
    );
  }).filter(Boolean);

  if (isMobile) {
    return (
      <header className="mmo-mobile-header">
        <div className="mobile-header-top-row">
          {/* Logo */}
          <div className="mobile-hdr-logo" onClick={() => handleNav('dashboard')}>
            <svg width="24" height="24" className="logo-icon-svg" style={{ fill: '#FBBF24', marginRight: '6px', flexShrink: 0 }}>
              <use href="#logoMini" />
            </svg>
            <div className="logo-text-wrap">
              <div className="logo-title">MARKETVERSE</div>
              <div className="logo-slogan">TRADE. INVEST. DOMINATE.</div>
            </div>
          </div>

          {/* Profile Card */}
          <div className="mobile-hdr-profile" onClick={() => { Audio.click(); setSettingsOpen(true); }}>
            <div className="mobile-profile-details" style={{ textAlign: 'right' }}>
              <span className="mobile-profile-name">{username}</span>
              <span className="mobile-profile-lvl">LEVEL {lvl}</span>
            </div>
            <div className="mobile-profile-avatar">
              {getAvatarEmoji(lvl)}
              <span className="mobile-active-dot"></span>
            </div>
          </div>

          {/* Notification Bell */}
          <div className="mobile-hdr-bell">
            <NotificationCenter />
          </div>
        </div>

        {/* Horizontal Market Ticker */}
        <div className="mobile-hdr-ticker-row">
          <div className="hdr-ticker-scroll-content">
            {tickerItems}
            {tickerItems}
          </div>
        </div>
      </header>
    );
  }

  // Desktop Header
  return (
    <header className="mmo-header">
      {/* LEFT: Game Logo, Player Name & Online Status */}
      <div className="hdr-left">
        <div className="hdr-logo-area" onClick={() => handleNav('dashboard')}>
          <svg width="32" height="32" className="logo-icon-svg" style={{ fill: '#FBBF24', marginRight: '8px', flexShrink: 0 }}>
            <use href="#logoMini" />
          </svg>
          <div className="logo-text-wrap">
            <div className="logo-title">MARKETVERSE</div>
            <div className="logo-slogan">TRADE. INVEST. DOMINATE.</div>
          </div>
        </div>
        <div className="hdr-player-status">
          <span className="player-username">{username}</span>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span className="status-text">ONLINE</span>
          </div>
        </div>
      </div>

      {/* CENTER: Navigation Links */}
      <nav className="hdr-center-nav">
        <button
          className={`nav-link-btn ${activeScreen === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNav('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'trading' && activeTab === 'movers' ? 'active' : ''}`}
          onClick={() => handleNav('trading', 'movers')}
        >
          Markets
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'trading' && activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => handleNav('trading', 'positions')}
        >
          Portfolio
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'trading' && activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => handleNav('trading', 'stats')}
        >
          Leaderboard
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'trading' && activeTab === 'missions' ? 'active' : ''}`}
          onClick={() => handleNav('trading', 'missions')}
        >
          Missions
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'trading' && activeTab === 'news' ? 'active' : ''}`}
          onClick={() => handleNav('trading', 'news')}
        >
          Events
        </button>
        <button
          className="nav-link-btn store-btn"
          onClick={() => {
            Audio.click();
            pushToast('Premium Store unlocks in the next season!', 'info');
          }}
        >
          Store
        </button>
      </nav>

      {/* RIGHT: Notifications, Messages, Profile Card */}
      <div className="hdr-right">
        <div className="hdr-actions-icons">
          <button
            className="hdr-msg-btn"
            onClick={() => {
              Audio.click();
              pushToast('Message Inbox: No unread messages.', 'ok');
            }}
            title="Messages"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hdr-icon-svg">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span className="badge red-badge">3</span>
          </button>
          <NotificationCenter />
        </div>

        <div className="hdr-profile-card" onClick={() => { Audio.click(); setSettingsOpen(true); }} title="Profile Settings">
          <div className="profile-avatar">
            {getAvatarEmoji(lvl)}
          </div>
          <div className="profile-info">
            <span className="profile-name">{username}</span>
            <span className="profile-level">LEVEL {lvl}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
