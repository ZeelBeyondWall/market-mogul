import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { StatsTab } from './StatsTab';
import { LevelShield } from '../ui/LevelShield';
import { IconTrophy, IconFlame, IconCheck, IconGem, IconStore, IconSettings } from '../ui/icons';
import { COSMETICS_LIST, rarityClass, type CosmeticItem } from '../data/cosmetics';
import './Pages.css';
import '../styles/arcade-profile.css';

// Same level→avatar mapping as Header so identity looks consistent.
function avatarEmoji(level: number): string {
  if (level < 5) return '🧑‍🚀';
  if (level < 10) return '🦾';
  if (level < 20) return '🤖';
  if (level < 30) return '⚡';
  if (level < 50) return '👽';
  return '👑';
}

export function ProfilePage() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const session = useGame(s => s.session);
  const lvl = useGame(s => s.playerLevel);
  const xp = useGame(s => s.playerXp);
  const xpAt = useGame(s => s.xpAtCurrent);
  const xpTo = useGame(s => s.xpToNext);
  const rank = useGame(s => s.playerRank);
  const streak = useGame(s => s.playerStreak);
  const setActiveScreen = useGame(s => s.setActiveScreen);
  const setSettingsOpen = useGame(s => s.setSettingsOpen);

  const equippedFrame = useGame(s => s.equippedFrame);
  const equippedBadge = useGame(s => s.equippedBadge);
  const equippedNameColor = useGame(s => s.equippedNameColor);
  const ownedCosmetics = useGame(s => s.ownedCosmetics);
  const setEquippedFrame = useGame(s => s.setEquippedFrame);
  const setEquippedBadge = useGame(s => s.setEquippedBadge);
  const setEquippedNameColor = useGame(s => s.setEquippedNameColor);

  const p = eng.player();
  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';
  const xpProgress = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

  // Showcase = OWNED frames/badges/colors (themes stay a Store concern).
  const owned = COSMETICS_LIST.filter(c => c.type !== 'theme' && ownedCosmetics.includes(c.id));

  // Equip conventions mirror StorePage: frames/badges by id, colors by value.
  const isEquipped = (item: CosmeticItem) =>
    item.type === 'frame' ? equippedFrame === item.id
    : item.type === 'badge' ? equippedBadge === item.id
    : equippedNameColor === item.value;

  const toggleEquip = (item: CosmeticItem) => {
    Audio.click();
    if (item.type === 'frame') setEquippedFrame(equippedFrame === item.id ? 'none' : item.id);
    else if (item.type === 'badge') setEquippedBadge(equippedBadge === item.id ? 'none' : item.id);
    else setEquippedNameColor(equippedNameColor === item.value ? 'none' : item.value);
  };

  return (
    <div className="profile-page page-container arcade-profile">
      {/* ===== Identity card ===== */}
      <section className="profile-identity-card hud-panel hud-corners gold">
        <div className={`profile-hero-avatar ${equippedFrame !== 'none' ? equippedFrame : ''}`}>
          {avatarEmoji(lvl)}
        </div>
        <div className="profile-hero-info">
          <div className="profile-hero-name disp" style={{ color: equippedNameColor !== 'none' ? equippedNameColor : undefined }}>
            {username}
            {equippedBadge !== 'none' && (
              <img src={`/store/${equippedBadge}.png`} alt="badge" className="profile-hero-badge" />
            )}
          </div>
          <div className="profile-hero-pills">
            <span className="hud-pill gold"><IconTrophy size={12} /> RANK #{rank}</span>
            <span className="hud-pill rose"><IconFlame size={12} /> {streak} STREAK</span>
          </div>
          <div className="profile-xp-row">
            <span className="profile-xp-text">LEVEL {lvl} — {Math.max(0, xp - xpAt)} / {Math.max(1, xpTo - xpAt)} XP</span>
            <div className="profile-xp-bar xp-bar"><div className="xp-fill" style={{ width: `${xpProgress}%` }} /></div>
          </div>
        </div>
        <div className="profile-hero-shield">
          <LevelShield level={lvl} size={56} color="var(--neon-gold)" />
          {/* Header avatar used to open Settings — Profile hosts it now so it
              stays reachable on every screen (MarketBar only shows on trading) */}
          <button className="profile-settings-btn arcade-btn ghost" onClick={() => { Audio.click(); setSettingsOpen(true); }}>
            <IconSettings size={13} /> SETTINGS
          </button>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className="profile-section hud-panel">
        <h3 className="section-title disp">STATS</h3>
        <StatsTab />
      </section>

      {/* ===== Cosmetics showcase ===== */}
      <section className="profile-section hud-panel">
        <h3 className="section-title disp">MY COSMETICS</h3>
        {owned.length === 0 ? (
          <div className="profile-cos-empty">
            <p>No cosmetics yet — grab frames, badges and name colors from the Store.</p>
            <button className="arcade-btn gold" onClick={() => { Audio.click(); setActiveScreen('store'); }}>
              <IconStore size={14} /> OPEN STORE
            </button>
          </div>
        ) : (
          <div className="profile-cos-grid">
            {owned.map(item => {
              const eq = isEquipped(item);
              return (
                <div key={item.id} className={`cosmetic-item-card hud-panel ${rarityClass(item.cost)} owned ${eq ? 'equipped' : ''}`}>
                  <div className="cosmetic-preview-box">
                    {item.type === 'name_color'
                      ? <span className="profile-color-dot" style={{ background: item.value }} />
                      : <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-img" />}
                  </div>
                  <span className="cos-name">{item.name}</span>
                  <button className={`cos-action-btn arcade-btn ghost ${eq ? 'eq-on' : 'eq-off'}`} onClick={() => toggleEquip(item)}>
                    {eq ? <><IconCheck size={12} strokeWidth={3} /> Equipped</> : 'Equip'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="profile-store-hint">
          <span><IconGem size={12} /> New cosmetics are available in the Store.</span>
        </div>
      </section>
    </div>
  );
}
