import { useState, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { fmt } from '../../../shared/engine/helpers';
import { send } from '../net/wsClient';

interface CosmeticItem {
  id: string;
  name: string;
  cost: number;
  type: 'frame' | 'badge' | 'name_color' | 'theme';
  previewUrl?: string;
  value: string; // The CSS class or style value
}

const COSMETICS_LIST: CosmeticItem[] = [
  // PROFILE FRAMES
  { id: 'frame_gold', name: 'Gold Frame', cost: 150, type: 'frame', previewUrl: '/store/frame_gold.png', value: 'gold-frame' },
  { id: 'frame_purple', name: 'Purple Frame', cost: 150, type: 'frame', previewUrl: '/store/frame_purple.png', value: 'purple-frame' },
  { id: 'frame_diamond', name: 'Diamond Frame', cost: 300, type: 'frame', previewUrl: '/store/frame_diamond.png', value: 'diamond-frame' },
  { id: 'frame_emerald', name: 'Emerald Frame', cost: 500, type: 'frame', previewUrl: '/store/frame_emerald.png', value: 'emerald-frame' },

  // PROFILE BADGES
  { id: 'badge_bronze', name: 'Bronze Trader', cost: 100, type: 'badge', previewUrl: '/store/badge_bronze.png', value: 'bronze-badge' },
  { id: 'badge_silver', name: 'Silver Trader', cost: 150, type: 'badge', previewUrl: '/store/badge_silver.png', value: 'silver-badge' },
  { id: 'badge_gold', name: 'Gold Trader', cost: 200, type: 'badge', previewUrl: '/store/badge_gold.png', value: 'gold-badge' },
  { id: 'badge_diamond', name: 'Diamond Trader', cost: 300, type: 'badge', previewUrl: '/store/badge_diamond.png', value: 'diamond-badge' },
  { id: 'badge_champion', name: 'Market Champion', cost: 400, type: 'badge', previewUrl: '/store/badge_champion.png', value: 'champion-badge' },

  // NAME COLORS
  { id: 'color_gold', name: 'Gold Username', cost: 100, type: 'name_color', value: '#ffd700' },
  { id: 'color_purple', name: 'Purple Username', cost: 100, type: 'name_color', value: '#a78bfa' },
  { id: 'color_green', name: 'Green Username', cost: 100, type: 'name_color', value: '#10b981' },
  { id: 'color_cyan', name: 'Cyan Username', cost: 100, type: 'name_color', value: '#06b6d4' },

  // PORTFOLIO THEMES
  { id: 'theme_purple', name: 'Purple Market Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_purple.png', value: 'purple' },
  { id: 'theme_green', name: 'Green Profit Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_green.png', value: 'green' },
  { id: 'theme_gold', name: 'Gold Wealth Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_gold.png', value: 'gold' },
  { id: 'theme_blue', name: 'Blue Trading Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_blue.png', value: 'blue' }
];

export function StorePage() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick); // force rerender on tick
  
  // Balances
  const cash = eng.displayCash();
  const gems = useGame(s => s.playerBonus);
  const xp = useGame(s => s.playerXp);

  // Equipped / Owned Cosmetics
  const equippedFrame = useGame(s => s.equippedFrame);
  const equippedBadge = useGame(s => s.equippedBadge);
  const equippedNameColor = useGame(s => s.equippedNameColor);
  const ownedCosmetics = useGame(s => s.ownedCosmetics);

  // Setters
  const setEquippedFrame = useGame(s => s.setEquippedFrame);
  const setEquippedBadge = useGame(s => s.setEquippedBadge);
  const setEquippedNameColor = useGame(s => s.setEquippedNameColor);
  const addOwnedCosmetic = useGame(s => s.addOwnedCosmetic);
  const setTheme = useGame(s => s.setTheme);
  const theme = useGame(s => s.theme);
  const pushToast = useGame(s => s.pushToast);

  // UI state
  const [activeCategory, setActiveCategory] = useState<'featured' | 'boosts' | 'cosmetics' | 'bundles' | 'resources' | 'tools'>('featured');
  const [checkoutItem, setCheckoutItem] = useState<{ name: string; price: number; type: 'usd' | 'gems'; run: () => void } | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'processing' | 'success'>('idle');

  // Refs for scrolling
  const sectionFeatured = useRef<HTMLDivElement>(null);
  const sectionBoosts = useRef<HTMLDivElement>(null);
  const sectionCosmetics = useRef<HTMLDivElement>(null);
  const sectionBundles = useRef<HTMLDivElement>(null);

  const handleCategoryClick = (cat: 'featured' | 'boosts' | 'cosmetics' | 'bundles' | 'resources' | 'tools') => {
    Audio.click();
    setActiveCategory(cat);
    
    let targetRef: React.RefObject<HTMLDivElement> | null = null;
    if (cat === 'featured') targetRef = sectionFeatured;
    else if (cat === 'boosts') targetRef = sectionBoosts;
    else if (cat === 'cosmetics') targetRef = sectionCosmetics;
    else if (cat === 'bundles') targetRef = sectionBundles;

    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      pushToast('More items in this category are coming next season!', 'info');
    }
  };

  // Mock checkout trigger
  const triggerUsdCheckout = (name: string, price: number, rewardCash: number, rewardGems: number, rewardXp: number, extraReward?: () => void) => {
    Audio.click();
    setCheckoutItem({
      name,
      price,
      type: 'usd',
      run: () => {
        send({
          type: 'storePurchase',
          payload: { cashChange: rewardCash, gemsChange: rewardGems, xpChange: rewardXp }
        });
        if (extraReward) extraReward();
      }
    });
    setCheckoutStep('processing');
    
    // Simulate gateway delay
    setTimeout(() => {
      setCheckoutStep('success');
      Audio.success?.();
    }, 1800);
  };

  // Gem purchase trigger
  const buyWithGems = (item: CosmeticItem) => {
    Audio.click();
    if (ownedCosmetics.includes(item.id)) {
      // Already owned, just equip it!
      equipCosmetic(item);
      return;
    }

    if (gems < item.cost) {
      Audio.error?.();
      pushToast('Insufficient Gems! Earn more from Missions.', 'err');
      return;
    }

    // Deduct gems on the server
    send({
      type: 'storePurchase',
      payload: { cashChange: 0, gemsChange: -item.cost, xpChange: 0 }
    });

    // Add to owned locally
    addOwnedCosmetic(item.id);
    equipCosmetic(item);
    pushToast(`Purchased ${item.name}!`, 'ok');
  };

  const equipCosmetic = (item: CosmeticItem) => {
    Audio.click();
    if (item.type === 'frame') {
      setEquippedFrame(equippedFrame === item.id ? 'none' : item.id);
    } else if (item.type === 'badge') {
      setEquippedBadge(equippedBadge === item.id ? 'none' : item.id);
    } else if (item.type === 'name_color') {
      setEquippedNameColor(equippedNameColor === item.value ? 'none' : item.value);
    } else if (item.type === 'theme') {
      // Set the active UI theme
      setTheme(item.value as any);
    }
  };

  // XP Boost Gem Purchase
  const buyXpBoost = (name: string, cost: number, hours: number) => {
    Audio.click();
    if (gems < cost) {
      Audio.error?.();
      pushToast('Insufficient Gems! Earn more from Missions.', 'err');
      return;
    }

    // Deduct gems on the server
    send({
      type: 'storePurchase',
      payload: { cashChange: 0, gemsChange: -cost, xpChange: 0 }
    });

    pushToast(`Activated 2x ${name} for ${hours}h!`, 'ok');
  };

  // Daily Reward Gem Purchase
  const buyDailyBoost = () => {
    Audio.click();
    if (gems < 300) {
      Audio.error?.();
      pushToast('Insufficient Gems! Earn more from Missions.', 'err');
      return;
    }

    // Deduct gems on the server
    send({
      type: 'storePurchase',
      payload: { cashChange: 0, gemsChange: -300, xpChange: 0 }
    });

    pushToast('Daily Reward Multiplier active for 7 Days!', 'ok');
  };

  const showRecentTransactions = () => {
    Audio.click();
    pushToast('Transaction History: Clean. No chargebacks recorded.', 'info');
  };

  return (
    <div className="store-page-container">
      {/* LEFT SIDEBAR */}
      <aside className="store-sidebar">
        <div className="store-sidebar-head">
          <svg className="store-title-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h2>STORE</h2>
        </div>

        {/* CATEGORY NAV */}
        <nav className="store-cat-nav">
          <button className={`store-cat-btn ${activeCategory === 'featured' ? 'active' : ''}`} onClick={() => handleCategoryClick('featured')}>
            <svg className="cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            Featured
          </button>
          <button className={`store-cat-btn ${activeCategory === 'boosts' ? 'active' : ''}`} onClick={() => handleCategoryClick('boosts')}>
            <svg className="cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            Boosts
          </button>
          <button className={`store-cat-btn ${activeCategory === 'cosmetics' ? 'active' : ''}`} onClick={() => handleCategoryClick('cosmetics')}>
            <svg className="cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 2 12 22Z" strokeWidth="2" /><path d="M7.5 10.5C8.32843 10.5 9 9.82843 9 9C9 8.17157 8.32843 7.5 7.5 7.5C6.67157 7.5 6 8.17157 6 9C6 9.82843 6.67157 10.5 7.5 10.5Z" /><path d="M11.5 7.5C12.3284 7.5 13 6.82843 13 6C13 5.17157 12.3284 4.5 11.5 4.5C10.6716 4.5 10 5.17157 10 6C10 6.82843 10.6716 7.5 11.5 7.5Z" /><path d="M16.5 9.5C17.3284 9.5 18 8.82843 18 8C18 7.17157 17.3284 6.5 16.5 6.5C15.6716 6.5 15 7.17157 15 8C15 8.82843 15.6716 9.5 16.5 9.5Z" /><path d="M6 15C6 15 7.5 18 12 18C16.5 18 18 15 18 15" strokeLinecap="round" /></svg>
            Cosmetics
          </button>
          <button className={`store-cat-btn ${activeCategory === 'bundles' ? 'active' : ''}`} onClick={() => handleCategoryClick('bundles')}>
            <svg className="cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
            Bundles
          </button>
          <button className={`store-cat-btn ${activeCategory === 'resources' ? 'active' : ''}`} onClick={() => handleCategoryClick('resources')}>
            <svg className="cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
            Resources
          </button>
          <button className={`store-cat-btn ${activeCategory === 'tools' ? 'active' : ''}`} onClick={() => handleCategoryClick('tools')}>
            <svg className="cat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
            Tools
          </button>
        </nav>

        {/* WALLET */}
        <div className="store-wallet-card">
          <h3>YOUR WALLET</h3>
          <div className="store-wallet-rows">
            <div className="store-wallet-row">
              <span className="sw-label">Cash Balance</span>
              <span className="sw-val cash-green">${fmt(cash)}</span>
            </div>
            <div className="store-wallet-row">
              <span className="sw-label">Gems Balance</span>
              <span className="sw-val gem-purple">💎 {gems}</span>
            </div>
            <div className="store-wallet-row">
              <span className="sw-label">XP Points</span>
              <span className="sw-val xp-blue">⭐ {xp}</span>
            </div>
          </div>
          <button className="sw-tx-btn" onClick={showRecentTransactions}>
            VIEW TRANSACTIONS <span>&gt;</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="store-content">
        
        {/* 1. FEATURED SECTION */}
        <div ref={sectionFeatured} className="store-section featured-sec">
          <div className="featured-banner-wrap">
            <div className="featured-details">
              <span className="feat-badge">FEATURED BUNDLE</span>
              <h2>STARTER BUNDLE</h2>
              <p>Kickstart your trading journey with powerful boosts and exclusive cosmetics.</p>
              
              <div className="bundle-contents-grid">
                <div className="bc-item xp-blue">
                  <span className="bc-icon">⭐</span>
                  <span className="bc-text">10,000 XP</span>
                </div>
                <div className="bc-item cash-green">
                  <span className="bc-icon">💵</span>
                  <span className="bc-text">$50,000 CASH</span>
                </div>
                <div className="bc-item gem-purple">
                  <span className="bc-icon">💎</span>
                  <span className="bc-text">500 GEMS</span>
                </div>
                <div className="bc-item badge-gold">
                  <span className="bc-icon">🛡️</span>
                  <span className="bc-text">Exclusive Badge</span>
                </div>
              </div>

              <button className="usd-buy-btn" onClick={() => triggerUsdCheckout('Starter Bundle', 9.99, 50000, 500, 10000, () => addOwnedCosmetic('badge_bronze'))}>
                $9.99
              </button>
            </div>
            <div className="featured-art">
              <img src="/store/featured_store_banner.png" alt="Featured Chest" />
            </div>
          </div>
        </div>

        {/* 2. BOOSTS SECTION */}
        <div ref={sectionBoosts} className="store-section list-sec">
          <h3 className="section-title">BOOSTS</h3>
          <div className="boosts-grid">
            {/* XP BOOST 1H */}
            <div className="store-card boost-card">
              <div className="card-glow-wrap">
                <img className="card-img" src="/store/xp_boost.png" alt="1 Hour Boost" />
              </div>
              <div className="card-info">
                <h4>XP BOOST (1 HOUR)</h4>
                <p>Earn 2x XP for 1 hour.</p>
                <div className="card-meta">
                  <span className="meta-dur">🕒 1 Hour</span>
                  <button className="gem-buy-btn" onClick={() => buyXpBoost('XP Boost', 100, 1)}>
                    💎 100
                  </button>
                </div>
              </div>
            </div>

            {/* XP BOOST 24H */}
            <div className="store-card boost-card">
              <div className="card-glow-wrap">
                <img className="card-img" src="/store/xp_boost.png" alt="24 Hour Boost" />
              </div>
              <div className="card-info">
                <h4>XP BOOST (24 HOURS)</h4>
                <p>Earn 2x XP for 24 hours.</p>
                <div className="card-meta">
                  <span className="meta-dur">🕒 24 Hours</span>
                  <button className="gem-buy-btn" onClick={() => buyXpBoost('XP Boost', 500, 24)}>
                    💎 500
                  </button>
                </div>
              </div>
            </div>

            {/* DAILY REWARD BOOST */}
            <div className="store-card boost-card">
              <div className="card-glow-wrap green-glow">
                <img className="card-img" src="/store/daily_reward_boost.png" alt="Daily Boost" />
              </div>
              <div className="card-info">
                <h4>DAILY REWARD BOOST</h4>
                <p>Get 2x rewards from your daily chest for 7 days.</p>
                <div className="card-meta">
                  <span className="meta-dur">🕒 7 Days</span>
                  <button className="gem-buy-btn" onClick={buyDailyBoost}>
                    💎 300
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. COSMETICS SECTION */}
        <div ref={sectionCosmetics} className="store-section list-sec">
          <h3 className="section-title">COSMETICS</h3>
          
          <div className="cosmetics-columns">
            {/* COLUMN 1: PROFILE FRAMES */}
            <div className="cosmetic-group-panel">
              <h4>PROFILE FRAMES</h4>
              <p className="group-desc">Unique frames to show off your style around your avatar.</p>
              
              <div className="cosmetics-grid-mini frames-grid">
                {COSMETICS_LIST.filter(c => c.type === 'frame').map(item => {
                  const isOwned = ownedCosmetics.includes(item.id);
                  const isEquipped = equippedFrame === item.id;
                  return (
                    <div key={item.id} className={`cosmetic-item-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                      <div className="cosmetic-preview-box">
                        <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-img" />
                        <div className="avatar-dummy">👤</div>
                      </div>
                      <span className="cos-name">{item.name}</span>
                      <button className={`cos-action-btn ${isEquipped ? 'eq-on' : isOwned ? 'eq-off' : ''}`} onClick={() => buyWithGems(item)}>
                        {isEquipped ? 'Equipped' : isOwned ? 'Equip' : `💎 ${item.cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: PROFILE BADGES */}
            <div className="cosmetic-group-panel">
              <h4>PROFILE BADGES</h4>
              <p className="group-desc">Exclusive badges to represent your rank on the leaderboard.</p>
              
              <div className="cosmetics-grid-mini badges-grid">
                {COSMETICS_LIST.filter(c => c.type === 'badge').map(item => {
                  const isOwned = ownedCosmetics.includes(item.id);
                  const isEquipped = equippedBadge === item.id;
                  return (
                    <div key={item.id} className={`cosmetic-item-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                      <div className="cosmetic-preview-box badge-box">
                        <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-badge" />
                      </div>
                      <span className="cos-name">{item.name}</span>
                      <button className={`cos-action-btn ${isEquipped ? 'eq-on' : isOwned ? 'eq-off' : ''}`} onClick={() => buyWithGems(item)}>
                        {isEquipped ? 'Equipped' : isOwned ? 'Equip' : `💎 ${item.cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: NAME COLORS */}
            <div className="cosmetic-group-panel">
              <h4>NAME COLORS</h4>
              <p className="group-desc">Stand out in the chat and lists with custom colored names.</p>
              
              <div className="cosmetics-grid-mini colors-grid">
                {COSMETICS_LIST.filter(c => c.type === 'name_color').map(item => {
                  const isOwned = ownedCosmetics.includes(item.id);
                  const isEquipped = equippedNameColor === item.value;
                  return (
                    <div key={item.id} className={`cosmetic-item-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                      <div className="cosmetic-preview-box color-preview-box">
                        <span style={{ color: item.value, fontWeight: 'bold' }}>TraderOne</span>
                      </div>
                      <span className="cos-name">{item.name}</span>
                      <button className={`cos-action-btn ${isEquipped ? 'eq-on' : isOwned ? 'eq-off' : ''}`} onClick={() => buyWithGems(item)}>
                        {isEquipped ? 'Equipped' : isOwned ? 'Equip' : `💎 ${item.cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 4: PORTFOLIO THEMES */}
            <div className="cosmetic-group-panel">
              <h4>PORTFOLIO THEMES</h4>
              <p className="group-desc">Customize your system accent color variables across the app.</p>
              
              <div className="cosmetics-grid-mini themes-grid">
                {COSMETICS_LIST.filter(c => c.type === 'theme').map(item => {
                  const isOwned = ownedCosmetics.includes(item.id);
                  const isEquipped = theme === item.value;
                  return (
                    <div key={item.id} className={`cosmetic-item-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                      <div className="cosmetic-preview-box theme-preview-box">
                        <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-theme" />
                      </div>
                      <span className="cos-name">{item.name}</span>
                      <button className={`cos-action-btn ${isEquipped ? 'eq-on' : isOwned ? 'eq-off' : ''}`} onClick={() => buyWithGems(item)}>
                        {isEquipped ? 'Equipped' : isOwned ? 'Equip' : `💎 ${item.cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* 4. BUNDLES SECTION */}
        <div ref={sectionBundles} className="store-section list-sec">
          <h3 className="section-title">BUNDLES</h3>
          <div className="bundles-row">
            {/* STARTER BUNDLE CARD */}
            <div className="store-card bundle-horizontal-card">
              <div className="bundle-img-wrap">
                <img src="/store/featured_store_banner.png" alt="Starter Chest" />
              </div>
              <div className="bundle-main-info">
                <h4>STARTER BUNDLE</h4>
                <p>Everything you need to get started on your trading journey.</p>
                <div className="bundle-tags">
                  <span className="btag xp-tag">⭐ 10,000 XP</span>
                  <span className="btag cash-tag">💵 $50,000</span>
                  <span className="btag gem-tag">💎 500 Gems</span>
                  <span className="btag badge-tag">🛡️ Exclusive Badge</span>
                </div>
              </div>
              <button className="usd-buy-btn mini" onClick={() => triggerUsdCheckout('Starter Bundle', 9.99, 50000, 500, 10000, () => addOwnedCosmetic('badge_bronze'))}>
                $9.99
              </button>
            </div>

            {/* ADVANCED BUNDLE CARD */}
            <div className="store-card bundle-horizontal-card purple-theme">
              <div className="bundle-img-wrap">
                <img src="/store/featured_store_banner.png" alt="Advanced Chest" style={{ filter: 'hue-rotate(60deg) brightness(1.2)' }} />
              </div>
              <div className="bundle-main-info">
                <h4>ADVANCED BUNDLE</h4>
                <p>Advanced boosts and exclusive cosmetics for serious traders.</p>
                <div className="bundle-tags">
                  <span className="btag xp-tag">⭐ 50,000 XP</span>
                  <span className="btag cash-tag">💵 $250,000</span>
                  <span className="btag gem-tag">💎 2,000 Gems</span>
                  <span className="btag frame-tag">🖼️ Exclusive Frame</span>
                </div>
              </div>
              <button className="usd-buy-btn mini" onClick={() => triggerUsdCheckout('Advanced Bundle', 29.99, 250000, 2000, 50000, () => { addOwnedCosmetic('frame_purple'); setEquippedFrame('frame_purple'); })}>
                $29.99
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* CHECKOUT MODAL OVERLAY */}
      {checkoutStep !== 'idle' && checkoutItem && (
        <div className="checkout-modal-overlay">
          <div className="checkout-modal-card">
            {checkoutStep === 'processing' ? (
              <div className="checkout-status-box">
                <div className="checkout-loader"></div>
                <h4>PROCESSING TRANSACTION</h4>
                <p>Connecting with secure sandbox banking gateway...</p>
                <div className="checkout-meta-rows">
                  <div className="cm-row"><span>Product:</span> <strong>{checkoutItem.name}</strong></div>
                  <div className="cm-row"><span>Amount:</span> <strong>${checkoutItem.price} USD</strong></div>
                </div>
              </div>
            ) : (
              <div className="checkout-status-box success">
                <div className="checkout-success-icon">✓</div>
                <h4>PURCHASE SUCCESSFUL!</h4>
                <p>Your account has been credited. Happy trading!</p>
                <button className="checkout-done-btn" onClick={() => {
                  checkoutItem.run();
                  setCheckoutStep('idle');
                  setCheckoutItem(null);
                }}>
                  Back to Store
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
