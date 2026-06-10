import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { ASSETS } from '../../../shared/engine/constants';
import { NotificationCenter } from './NotificationCenter';
import { LevelShield } from '../ui/LevelShield';
import { useCountUp } from '../ui/useCountUp';
import { IconGem, IconFlame, IconSettings, IconWallet } from '../ui/icons';
import '../styles/arcade-header.css';

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
  const equippedFrame = useGame(s => s.equippedFrame);
  const equippedNameColor = useGame(s => s.equippedNameColor);
  const equippedBadge = useGame(s => s.equippedBadge);
  const xp = useGame(s => s.playerXp);
  const xpAt = useGame(s => s.xpAtCurrent);
  const xpTo = useGame(s => s.xpToNext);
  const streak = useGame(s => s.playerStreak);
  const gems = useGame(s => s.playerBonus);

  const p = eng.player();
  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';

  // HUD display values (pure presentation: same numbers, animated)
  const cashAnim = useCountUp(eng.displayCash());
  const gemsAnim = useCountUp(gems);
  const xpProgress = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

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

  const handleNav = (screen: 'dashboard' | 'trading' | 'portfolio' | 'leaderboard' | 'store', tab?: any) => {
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

  // Wallet chips: cash (count-up, mono), gems (gold), streak (rose)
  const walletPills = (
    <>
      <span className="hud-pill green hdr-cash-pill" title="Cash">
        <IconWallet size={12} />
        <span className="hdr-cash-val">{fmt(cashAnim)}</span>
      </span>
      <span className="hud-pill gold" title="Gems">
        <IconGem size={12} />
        {Math.round(gemsAnim).toLocaleString()}
      </span>
      <span className="hud-pill rose" title="Daily streak">
        <IconFlame size={12} />
        {streak}
      </span>
    </>
  );

  if (isMobile) {
    return (
      <header className="mmo-mobile-header arcade-hud-m">
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
              <span className="mobile-profile-name" style={{ color: equippedNameColor !== 'none' ? equippedNameColor : undefined }}>
                {username}
                {equippedBadge && equippedBadge !== 'none' && (
                  <img src={`/store/${equippedBadge}.png`} alt="badge" style={{ width: '14px', height: '14px', marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }} />
                )}
              </span>
              <span className="mobile-profile-lvl">LEVEL {lvl}</span>
            </div>
            <div className={`mobile-profile-avatar ${equippedFrame !== 'none' ? equippedFrame : ''}`}>
              {getAvatarEmoji(lvl)}
              <span className="mobile-active-dot live-dot"></span>
            </div>
          </div>

          {/* Notification Bell */}
          <div className="mobile-hdr-bell">
            <NotificationCenter />
          </div>
        </div>

        {/* XP progress + wallet strip */}
        <div className="m-hud-strip">
          <div className="xp-bar thin m-hud-xp" title={`Level ${lvl} — ${Math.round(xpProgress)}% to next`}>
            <div className="xp-fill" style={{ width: xpProgress + '%' }} />
          </div>
          {walletPills}
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
    <header className="mmo-header arcade-hud">
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
          <LevelShield level={lvl} size={36} />
          <div className="hdr-player-meta">
            <span className="player-username disp">{username}</span>
            <div className="xp-bar thin hdr-xp" title={`Level ${lvl} — ${Math.round(xpProgress)}% to next`}>
              <div className="xp-fill" style={{ width: xpProgress + '%' }} />
            </div>
            <div className="status-indicator">
              <span className="status-dot live-dot"></span>
              <span className="status-text">ONLINE</span>
            </div>
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
          className={`nav-link-btn ${activeScreen === 'trading' && activeTab !== 'movers' && activeTab !== 'missions' && activeTab !== 'news' ? 'active' : ''}`}
          onClick={() => handleNav('trading', 'positions')}
        >
          Trade
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'portfolio' ? 'active' : ''}`}
          onClick={() => handleNav('portfolio')}
        >
          Portfolio
        </button>
        <button
          className={`nav-link-btn ${activeScreen === 'leaderboard' ? 'active' : ''}`}
          onClick={() => handleNav('leaderboard')}
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
          className={`nav-link-btn store-btn ${activeScreen === 'store' ? 'active' : ''}`}
          onClick={() => handleNav('store')}
        >
          Store
        </button>
      </nav>

      {/* RIGHT: Wallet, Notifications, Messages, Profile Card */}
      <div className="hdr-right">
        <div className="hdr-wallet">{walletPills}</div>
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

        <div className="hdr-profile-card" role="button" tabIndex={0} onClick={() => { Audio.click(); setSettingsOpen(true); }} title="Profile Settings">
          <div className={`profile-avatar ${equippedFrame !== 'none' ? equippedFrame : ''}`}>
            {getAvatarEmoji(lvl)}
          </div>
          <div className="profile-info">
            <span className="profile-name" style={{ color: equippedNameColor !== 'none' ? equippedNameColor : undefined }}>
              {username}
              {equippedBadge && equippedBadge !== 'none' && (
                <img src={`/store/${equippedBadge}.png`} alt="badge" style={{ width: '14px', height: '14px', marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }} />
              )}
            </span>
            <span className="profile-level">LEVEL {lvl}</span>
          </div>
          <IconSettings size={14} className="hdr-gear" />
        </div>
      </div>
    </header>
  );
}
