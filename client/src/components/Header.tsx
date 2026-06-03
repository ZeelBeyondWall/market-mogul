import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { NotificationCenter } from './NotificationCenter';

export function Header() {
  const eng = useGame(s => s.engine);
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

  return (
    <header className="mmo-header">
      {/* LEFT: Game Logo, Player Name & Online Status */}
      <div className="hdr-left">
        <div className="hdr-logo-area" onClick={() => handleNav('dashboard')}>
          <div className="logo-title">MARKETVERSE</div>
          <div className="logo-slogan">TRADE. INVEST. DOMINATE.</div>
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
