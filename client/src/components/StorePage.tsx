import { useState, useRef, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { fmt } from '../../../shared/engine/helpers';
import { send } from '../net/wsClient';
import './Pages.css';
import '../styles/arcade-store.css';
import {
  IconGem, IconCheck, IconStar, IconCoin, IconClock, IconShield,
  IconStore, IconBolt, IconUser, IconBriefcase, IconBook, IconSettings,
} from '../ui/icons';
import { COSMETICS_LIST, rarityClass, type CosmeticItem } from '../data/cosmetics';

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

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [cosmeticTab, setCosmeticTab] = useState<'frame' | 'badge' | 'name_color' | 'theme'>('frame');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // v11: store purchases are allowlist-gated server-side; everyone else sees
  // a coming-soon modal. The server enforces this too — UI gate is UX only.
  const storeBuyAllowed = useGame(s => s.storeBuyAllowed);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const gateBuy = (): boolean => {
    if (storeBuyAllowed) return false;
    Audio.click();
    setComingSoonOpen(true);
    return true;
  };

  // Mock checkout trigger
  const triggerUsdCheckout = (name: string, price: number, rewardCash: number, rewardGems: number, rewardXp: number, extraReward?: () => void) => {
    if (gateBuy()) return;
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
      // Already owned, just equip it! (equip stays open for everyone)
      equipCosmetic(item);
      return;
    }
    if (gateBuy()) return;

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
    if (gateBuy()) return;
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
    if (gateBuy()) return;
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
    <div className="store-page-container arcade-store">
      {/* MOBILE ONLY WALLET SUMMARY */}
      {isMobile && (
        <div className="store-mobile-wallet-bar">
          <div className="smw-item cash-green hud-pill green">
            <span className="smw-icon"><IconCoin size={14} /></span>
            <span className="smw-val">{fmt(cash)}</span>
          </div>
          <div className="smw-item gem-purple hud-pill gold">
            <span className="smw-icon"><IconGem size={14} /></span>
            <span className="smw-val">{gems}</span>
          </div>
          <div className="smw-item xp-blue hud-pill cyan">
            <span className="smw-icon"><IconStar size={14} /></span>
            <span className="smw-val">{xp} XP</span>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR */}
      <aside className="store-sidebar">
        {!isMobile && (
          <div className="store-sidebar-head">
            <IconStore size={18} strokeWidth={2.5} className="store-title-icon" />
            <h2 className="disp">STORE</h2>
          </div>
        )}

        {/* CATEGORY NAV */}
        <nav className="store-cat-nav">
          <button className={`store-cat-btn ${activeCategory === 'featured' ? 'active' : ''}`} onClick={() => handleCategoryClick('featured')}>
            <IconStar size={16} className="cat-icon" />
            Featured
          </button>
          <button className={`store-cat-btn ${activeCategory === 'boosts' ? 'active' : ''}`} onClick={() => handleCategoryClick('boosts')}>
            <IconBolt size={16} className="cat-icon" />
            Boosts
          </button>
          <button className={`store-cat-btn ${activeCategory === 'cosmetics' ? 'active' : ''}`} onClick={() => handleCategoryClick('cosmetics')}>
            <IconUser size={16} className="cat-icon" />
            Cosmetics
          </button>
          <button className={`store-cat-btn ${activeCategory === 'bundles' ? 'active' : ''}`} onClick={() => handleCategoryClick('bundles')}>
            <IconBriefcase size={16} className="cat-icon" />
            Bundles
          </button>
          <button className={`store-cat-btn ${activeCategory === 'resources' ? 'active' : ''}`} onClick={() => handleCategoryClick('resources')}>
            <IconBook size={16} className="cat-icon" />
            Resources
          </button>
          <button className={`store-cat-btn ${activeCategory === 'tools' ? 'active' : ''}`} onClick={() => handleCategoryClick('tools')}>
            <IconSettings size={16} className="cat-icon" />
            Tools
          </button>
        </nav>

        {/* WALLET */}
        {!isMobile && (
          <div className="store-wallet-card hud-panel">
            <h3 className="disp">YOUR WALLET</h3>
            <div className="store-wallet-rows">
              <div className="store-wallet-row">
                <span className="sw-label">Cash Balance</span>
                <span className="sw-val cash-green hud-pill green">{fmt(cash)}</span>
              </div>
              <div className="store-wallet-row">
                <span className="sw-label">Gems Balance</span>
                <span className="sw-val gem-purple hud-pill gold"><IconGem size={12} /> {gems}</span>
              </div>
              <div className="store-wallet-row">
                <span className="sw-label">XP Points</span>
                <span className="sw-val xp-blue hud-pill cyan"><IconStar size={12} /> {xp}</span>
              </div>
            </div>
            <button className="sw-tx-btn arcade-btn ghost" onClick={showRecentTransactions}>
              VIEW TRANSACTIONS <span>&gt;</span>
            </button>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="store-content">
        
        {/* 1. FEATURED SECTION */}
        <div ref={sectionFeatured} className="store-section featured-sec">
          <div className="featured-banner-wrap hud-panel hud-corners gold">
            <div className="featured-details">
              <span className="feat-badge disp">FEATURED BUNDLE</span>
              <h2 className="disp">STARTER BUNDLE</h2>
              <p>Kickstart your trading journey with powerful boosts and exclusive cosmetics.</p>

              <div className="bundle-contents-grid">
                <div className="bc-item xp-blue">
                  <span className="bc-icon"><IconStar size={14} /></span>
                  <span className="bc-text">10,000 XP</span>
                </div>
                <div className="bc-item cash-green">
                  <span className="bc-icon"><IconCoin size={14} /></span>
                  <span className="bc-text">$50,000 CASH</span>
                </div>
                <div className="bc-item gem-purple">
                  <span className="bc-icon"><IconGem size={14} /></span>
                  <span className="bc-text">500 GEMS</span>
                </div>
                <div className="bc-item badge-gold">
                  <span className="bc-icon"><IconShield size={14} /></span>
                  <span className="bc-text">Exclusive Badge</span>
                </div>
              </div>

              <button className="usd-buy-btn arcade-btn gold" onClick={() => triggerUsdCheckout('Starter Bundle', 9.99, 50000, 500, 10000, () => addOwnedCosmetic('badge_bronze'))}>
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
          <h3 className="section-title disp">BOOSTS</h3>
          <div className="boosts-grid">
            {/* XP BOOST 1H */}
            <div className={`store-card boost-card hud-panel glow-hover ${rarityClass(100)}`}>
              <div className="card-glow-wrap">
                <img className="card-img" src="/store/xp_boost.png" alt="1 Hour Boost" />
              </div>
              <div className="card-info">
                <h4>XP BOOST (1 HOUR)</h4>
                <p>Earn 2x XP for 1 hour.</p>
                <div className="card-meta">
                  <span className="meta-dur"><IconClock size={13} /> 1 Hour</span>
                  <button className="gem-buy-btn arcade-btn gold" onClick={() => buyXpBoost('XP Boost', 100, 1)}>
                    <IconGem size={13} /> 100
                  </button>
                </div>
              </div>
            </div>

            {/* XP BOOST 24H */}
            <div className={`store-card boost-card hud-panel glow-hover ${rarityClass(500)}`}>
              <div className="card-glow-wrap">
                <img className="card-img" src="/store/xp_boost.png" alt="24 Hour Boost" />
              </div>
              <div className="card-info">
                <h4>XP BOOST (24 HOURS)</h4>
                <p>Earn 2x XP for 24 hours.</p>
                <div className="card-meta">
                  <span className="meta-dur"><IconClock size={13} /> 24 Hours</span>
                  <button className="gem-buy-btn arcade-btn gold" onClick={() => buyXpBoost('XP Boost', 500, 24)}>
                    <IconGem size={13} /> 500
                  </button>
                </div>
              </div>
            </div>

            {/* DAILY REWARD BOOST */}
            <div className={`store-card boost-card hud-panel glow-hover ${rarityClass(300)}`}>
              <div className="card-glow-wrap green-glow">
                <img className="card-img" src="/store/daily_reward_boost.png" alt="Daily Boost" />
              </div>
              <div className="card-info">
                <h4>DAILY REWARD BOOST</h4>
                <p>Get 2x rewards from your daily chest for 7 days.</p>
                <div className="card-meta">
                  <span className="meta-dur"><IconClock size={13} /> 7 Days</span>
                  <button className="gem-buy-btn arcade-btn gold" onClick={buyDailyBoost}>
                    <IconGem size={13} /> 300
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. COSMETICS SECTION */}
        <div ref={sectionCosmetics} className="store-section list-sec">
          <h3 className="section-title disp">COSMETICS</h3>
          
          {isMobile && (
            <div className="cosmetics-mobile-tabs">
              <button className={cosmeticTab === 'frame' ? 'active' : ''} onClick={() => { Audio.click(); setCosmeticTab('frame'); }}>Frames</button>
              <button className={cosmeticTab === 'badge' ? 'active' : ''} onClick={() => { Audio.click(); setCosmeticTab('badge'); }}>Badges</button>
              <button className={cosmeticTab === 'name_color' ? 'active' : ''} onClick={() => { Audio.click(); setCosmeticTab('name_color'); }}>Colors</button>
              <button className={cosmeticTab === 'theme' ? 'active' : ''} onClick={() => { Audio.click(); setCosmeticTab('theme'); }}>Themes</button>
            </div>
          )}

          <div className="cosmetics-columns">
            {/* COLUMN 1: PROFILE FRAMES */}
            {(!isMobile || cosmeticTab === 'frame') && (
              <div className="cosmetic-group-panel hud-panel">
                <h4>PROFILE FRAMES</h4>
                <p className="group-desc">Unique frames to show off your style around your avatar.</p>

                <div className="cosmetics-grid-mini frames-grid">
                  {COSMETICS_LIST.filter(c => c.type === 'frame').map(item => {
                    const isOwned = ownedCosmetics.includes(item.id);
                    const isEquipped = equippedFrame === item.id;
                    return (
                      <div key={item.id} className={`cosmetic-item-card hud-panel glow-hover ${rarityClass(item.cost)} ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                        {isOwned && <span className="cos-owned-check" aria-hidden="true"><IconCheck size={11} strokeWidth={3.5} /></span>}
                        <div className="cosmetic-preview-box">
                          <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-img" />
                          <div className="avatar-dummy">👤</div>
                        </div>
                        <span className="cos-name">{item.name}</span>
                        <button className={`cos-action-btn arcade-btn ${isEquipped ? 'ghost eq-on' : isOwned ? 'ghost eq-off' : 'gold'}`} onClick={() => buyWithGems(item)}>
                          {isEquipped ? <><IconCheck size={12} strokeWidth={3} /> Equipped</> : isOwned ? 'Equip' : <><IconGem size={12} /> {item.cost}</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COLUMN 2: PROFILE BADGES */}
            {(!isMobile || cosmeticTab === 'badge') && (
              <div className="cosmetic-group-panel hud-panel">
                <h4>PROFILE BADGES</h4>
                <p className="group-desc">Exclusive badges to represent your rank on the leaderboard.</p>

                <div className="cosmetics-grid-mini badges-grid">
                  {COSMETICS_LIST.filter(c => c.type === 'badge').map(item => {
                    const isOwned = ownedCosmetics.includes(item.id);
                    const isEquipped = equippedBadge === item.id;
                    return (
                      <div key={item.id} className={`cosmetic-item-card hud-panel glow-hover ${rarityClass(item.cost)} ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                        {isOwned && <span className="cos-owned-check" aria-hidden="true"><IconCheck size={11} strokeWidth={3.5} /></span>}
                        <div className="cosmetic-preview-box badge-box">
                          <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-badge" />
                        </div>
                        <span className="cos-name">{item.name}</span>
                        <button className={`cos-action-btn arcade-btn ${isEquipped ? 'ghost eq-on' : isOwned ? 'ghost eq-off' : 'gold'}`} onClick={() => buyWithGems(item)}>
                          {isEquipped ? <><IconCheck size={12} strokeWidth={3} /> Equipped</> : isOwned ? 'Equip' : <><IconGem size={12} /> {item.cost}</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COLUMN 3: NAME COLORS */}
            {(!isMobile || cosmeticTab === 'name_color') && (
              <div className="cosmetic-group-panel hud-panel">
                <h4>NAME COLORS</h4>
                <p className="group-desc">Stand out in the chat and lists with custom colored names.</p>

                <div className="cosmetics-grid-mini colors-grid">
                  {COSMETICS_LIST.filter(c => c.type === 'name_color').map(item => {
                    const isOwned = ownedCosmetics.includes(item.id);
                    const isEquipped = equippedNameColor === item.value;
                    return (
                      <div key={item.id} className={`cosmetic-item-card hud-panel glow-hover ${rarityClass(item.cost)} ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                        {isOwned && <span className="cos-owned-check" aria-hidden="true"><IconCheck size={11} strokeWidth={3.5} /></span>}
                        <div className="cosmetic-preview-box color-preview-box">
                          <span style={{ color: item.value, fontWeight: 'bold' }}>TraderOne</span>
                        </div>
                        <span className="cos-name">{item.name}</span>
                        <button className={`cos-action-btn arcade-btn ${isEquipped ? 'ghost eq-on' : isOwned ? 'ghost eq-off' : 'gold'}`} onClick={() => buyWithGems(item)}>
                          {isEquipped ? <><IconCheck size={12} strokeWidth={3} /> Equipped</> : isOwned ? 'Equip' : <><IconGem size={12} /> {item.cost}</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COLUMN 4: PORTFOLIO THEMES */}
            {(!isMobile || cosmeticTab === 'theme') && (
              <div className="cosmetic-group-panel hud-panel">
                <h4>PORTFOLIO THEMES</h4>
                <p className="group-desc">Customize your system accent color variables across the app.</p>

                <div className="cosmetics-grid-mini themes-grid">
                  {COSMETICS_LIST.filter(c => c.type === 'theme').map(item => {
                    const isOwned = ownedCosmetics.includes(item.id);
                    const isEquipped = theme === item.value;
                    return (
                      <div key={item.id} className={`cosmetic-item-card hud-panel glow-hover ${rarityClass(item.cost)} ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}>
                        {isOwned && <span className="cos-owned-check" aria-hidden="true"><IconCheck size={11} strokeWidth={3.5} /></span>}
                        <div className="cosmetic-preview-box theme-preview-box">
                          <img src={item.previewUrl} alt={item.name} className="cosmetic-preview-theme" />
                        </div>
                        <span className="cos-name">{item.name}</span>
                        <button className={`cos-action-btn arcade-btn ${isEquipped ? 'ghost eq-on' : isOwned ? 'ghost eq-off' : 'gold'}`} onClick={() => buyWithGems(item)}>
                          {isEquipped ? <><IconCheck size={12} strokeWidth={3} /> Equipped</> : isOwned ? 'Equip' : <><IconGem size={12} /> {item.cost}</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 4. BUNDLES SECTION */}
        <div ref={sectionBundles} className="store-section list-sec">
          <h3 className="section-title disp">BUNDLES</h3>
          <div className="bundles-row">
            {/* STARTER BUNDLE CARD */}
            <div className="store-card bundle-horizontal-card hud-panel glow-hover">
              <div className="bundle-img-wrap">
                <img src="/store/featured_store_banner.png" alt="Starter Chest" />
              </div>
              <div className="bundle-main-info">
                <h4>STARTER BUNDLE</h4>
                <p>Everything you need to get started on your trading journey.</p>
                <div className="bundle-tags">
                  <span className="btag xp-tag hud-pill"><IconStar size={11} /> 10,000 XP</span>
                  <span className="btag cash-tag hud-pill"><IconCoin size={11} /> $50,000</span>
                  <span className="btag gem-tag hud-pill"><IconGem size={11} /> 500 Gems</span>
                  <span className="btag badge-tag hud-pill"><IconShield size={11} /> Exclusive Badge</span>
                </div>
              </div>
              <button className="usd-buy-btn mini arcade-btn gold" onClick={() => triggerUsdCheckout('Starter Bundle', 9.99, 50000, 500, 10000, () => addOwnedCosmetic('badge_bronze'))}>
                $9.99
              </button>
            </div>

            {/* ADVANCED BUNDLE CARD */}
            <div className="store-card bundle-horizontal-card purple-theme hud-panel glow-hover">
              <div className="bundle-img-wrap">
                <img src="/store/featured_store_banner.png" alt="Advanced Chest" style={{ filter: 'hue-rotate(60deg) brightness(1.2)' }} />
              </div>
              <div className="bundle-main-info">
                <h4>ADVANCED BUNDLE</h4>
                <p>Advanced boosts and exclusive cosmetics for serious traders.</p>
                <div className="bundle-tags">
                  <span className="btag xp-tag hud-pill"><IconStar size={11} /> 50,000 XP</span>
                  <span className="btag cash-tag hud-pill"><IconCoin size={11} /> $250,000</span>
                  <span className="btag gem-tag hud-pill"><IconGem size={11} /> 2,000 Gems</span>
                  <span className="btag frame-tag hud-pill"><IconUser size={11} /> Exclusive Frame</span>
                </div>
              </div>
              <button className="usd-buy-btn mini arcade-btn gold" onClick={() => triggerUsdCheckout('Advanced Bundle', 29.99, 250000, 2000, 50000, () => { addOwnedCosmetic('frame_purple'); setEquippedFrame('frame_purple'); })}>
                $29.99
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* COMING SOON MODAL — purchases gated behind admin allowlist */}
      {comingSoonOpen && (
        <div className="checkout-modal-overlay" onClick={() => setComingSoonOpen(false)}>
          <div className="checkout-modal-card hud-panel hud-corners gold" onClick={e => e.stopPropagation()}>
            <div className="checkout-status-box">
              <div style={{ fontSize: 38, lineHeight: 1 }}>🚧</div>
              <h4>COMING SOON</h4>
              <p>Store purchases are not live yet. Keep trading and earning — buying unlocks for everyone soon!</p>
              <button className="checkout-done-btn arcade-btn buy" onClick={() => { Audio.click(); setComingSoonOpen(false); }}>
                Back to Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL OVERLAY */}
      {checkoutStep !== 'idle' && checkoutItem && (
        <div className="checkout-modal-overlay">
          <div className="checkout-modal-card hud-panel hud-corners gold">
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
                <div className="checkout-success-icon"><IconCheck size={26} strokeWidth={3} /></div>
                <h4>PURCHASE SUCCESSFUL!</h4>
                <p>Your account has been credited. Happy trading!</p>
                <button className="checkout-done-btn arcade-btn buy" onClick={() => {
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
