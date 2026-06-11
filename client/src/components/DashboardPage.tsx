import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { fmt, fmtPct, fmtNum } from '../../../shared/engine/helpers';
import { ASSETS } from '../../../shared/engine/constants';
import type { Market, MissionState, NewsEvent } from '../../../shared/engine/types';
import { send } from '../net/wsClient';
import { Audio } from '../audio/audio';
import { AnimatedNumber } from './AnimatedNumber';
import { LevelShield } from '../ui/LevelShield';
import { useCountUp } from '../ui/useCountUp';
import { MissionsTab } from './MissionsTab';
import {
  IconGem, IconFlame, IconTrophy, IconCoin, IconGlobe, IconCandles,
  IconWallet, IconNews, IconStar, IconShield, IconBars,
} from '../ui/icons';
import '../styles/arcade-dashboard.css';

export function DashboardPage() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const rank = useGame(s => s.playerRank);
  const total = useGame(s => s.totalTraders);
  const lvl = useGame(s => s.playerLevel);
  const xp = useGame(s => s.playerXp);
  const xpAt = useGame(s => s.xpAtCurrent);
  const xpTo = useGame(s => s.xpToNext);
  const daily = useGame(s => s.dailyMissions);
  const playerStats = useGame(s => s.playerStats);
  const streak = useGame(s => s.playerStreak);
  const bonus = useGame(s => s.playerBonus);
  const setActiveMarket = useGame(s => s.setActiveMarket);
  const setActiveScreen = useGame(s => s.setActiveScreen);
  const setActiveTab = useGame(s => s.setActiveTab);
  const setActiveAsset = useGame(s => s.setActive);
  const session = useGame(s => s.session);
  const pushToast = useGame(s => s.pushToast);

  const p = eng.player();
  const cash = eng.displayCash();
  const port = eng.displayPortfolioValue();
  const net = eng.netWorth();

  // Today's P&L calculations
  const dayStartNet = p.dayStartNet || 1000;
  const todayPnL = net - dayStartNet;
  const todayPnLPct = (todayPnL / dayStartNet) * 100;
  const xpProgress = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';

  // Animated display value for the hero stat strip (pure display)
  const netCount = useCountUp(net);

  // State for viewport size detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // State for tabs inside Market Movers
  const [moversTab, setMoversTab] = useState<'gainers' | 'losers' | 'active'>('gainers');
  // Missions live on Home now (trade-panel tab removed) — summary card expands
  // into the full claimable MissionsTab inline.
  const [showAllMissions, setShowAllMissions] = useState(false);

  // Dynamic countdown timers
  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 35, seconds: 21 });
  const [midnightTimeLeft, setMidnightTimeLeft] = useState('12H 35M');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diffMs = midnight.getTime() - now.getTime();
      
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      
      setTimeLeft({ hours, minutes, seconds });
      setMidnightTimeLeft(`${hours}H ${minutes}M`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Claim Daily Chest Action
  const handleClaimDailyReward = () => {
    Audio.click();
    pushToast(`Daily Reward opened! Streak: ${streak || 1} Days. You claimed +${(streak || 1) * 100} Credits!`, 'ok');
  };

  // Compile Market Movers data
  const moversList = ASSETS.map(a => {
    const ast = eng.state.assets[a.id];
    if (!ast) return null;
    const chg = ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100;
    return { a, ast, chg };
  }).filter(Boolean) as { a: typeof ASSETS[0]; ast: any; chg: number }[];

  const topGainers = [...moversList].sort((a, b) => b.chg - a.chg).slice(0, 5);
  const topLosers = [...moversList].sort((a, b) => a.chg - b.chg).slice(0, 5);
  const mostActive = [...moversList].sort((a, b) => b.ast.volume - a.ast.volume).slice(0, 5);

  const activeMovers = moversTab === 'gainers' ? topGainers : moversTab === 'losers' ? topLosers : mostActive;

  // Compile news list with fallback
  const newsList = eng.state.events.slice(0, 4);
  const defaultNews = [
    { title: 'Global Markets Rally as Tech Stocks Surge', desc: 'Tech index gains 3.5% led by NexaTech and QuantumSoft.', time: '2m ago' },
    { title: 'Fed Hints at Possible Rate Cut Next Month', desc: 'Central bank signals cooling inflation metrics support rate cuts.', time: '15m ago' },
    { title: 'Oil Prices Climb Amid Supply Concerns', desc: 'Geopolitical tensions restrict production targets in Fusion sectors.', time: '32m ago' },
    { title: 'QuantumSoft Announces Breakthrough AI Chip', desc: 'Next-gen silicon yields 50% improvement in model latency tests.', time: '1h ago' }
  ];

  // Compile allocations list
  const holdingsList = Object.keys(p.holdings)
    .map(aid => {
      const h = p.holdings[aid];
      const assetDef = ASSETS.find(a => a.id === aid);
      const astState = eng.state.assets[aid];
      if (!h || h.shares === 0 || !assetDef || !astState) return null;
      const val = Math.abs(h.shares) * astState.lastPrice;
      const pctAlloc = port > 0 ? (val / port) * 100 : 0;
      const unrealized = h.shares > 0
        ? h.shares * (astState.lastPrice - h.avgCost)
        : (-h.shares) * (h.avgCost - astState.lastPrice);
      return {
        aid,
        name: assetDef.name,
        icon: assetDef.icon,
        cat: assetDef.cat,
        market: assetDef.market,
        shares: h.shares,
        avgCost: h.avgCost,
        lastPrice: astState.lastPrice,
        val,
        pctAlloc,
        unrealized,
      };
    })
    .filter(Boolean) as { aid: string; name: string; icon: string; cat: string; market: string; shares: number; avgCost: number; lastPrice: number; val: number; pctAlloc: number; unrealized: number }[];

  const realizedPnL = playerStats?.realizedPL || 0;
  const unrealizedPnL = playerStats?.unrealizedPL || 0;

  // Donut allocations grouping
  const sectorGroups: Record<string, { label: string; val: number; color: string }> = {
    tech: { label: 'Technology', val: 0, color: '#7C5CFF' },
    bank: { label: 'Finance', val: 0, color: '#3B82F6' },
    energy: { label: 'Energy', val: 0, color: '#FBBF24' },
    health: { label: 'Healthcare', val: 0, color: '#10B981' },
    consumer: { label: 'Consumer', val: 0, color: '#EC4899' },
    gaming: { label: 'Gaming', val: 0, color: '#8B5CF6' },
    crypto: { label: 'Crypto', val: 0, color: '#D946EF' },
    forex: { label: 'Forex', val: 0, color: '#06B6D4' },
  };

  holdingsList.forEach(h => {
    const cat = h.market === 'crypto' ? 'crypto' : h.market === 'forex' ? 'forex' : (h.cat || 'other');
    if (sectorGroups[cat]) {
      sectorGroups[cat].val += h.val;
    } else {
      if (!sectorGroups['other']) {
        sectorGroups['other'] = { label: 'Others', val: 0, color: '#A8B3CF' };
      }
      sectorGroups['other'].val += h.val;
    }
  });

  const activeSectors = Object.values(sectorGroups)
    .filter(g => g.val > 0)
    .map(g => ({
      label: g.label,
      value: g.val,
      color: g.color,
      pct: port > 0 ? (g.val / port) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);

  const displaySectors = activeSectors.length > 0 
    ? activeSectors 
    : [
        { label: 'Technology', value: 42.5, color: '#7C5CFF', pct: 42.5 },
        { label: 'Finance', value: 25.1, color: '#3B82F6', pct: 25.1 },
        { label: 'Energy', value: 15.3, color: '#FBBF24', pct: 15.3 },
        { label: 'Healthcare', value: 9.8, color: '#10B981', pct: 9.8 },
        { label: 'Others', value: 7.3, color: '#A8B3CF', pct: 7.3 }
      ];

  const topHumans = [
    { rank: 1, name: 'AlphaTrader', net: 245231.25, level: 18, isPlayer: false },
    { rank: 2, name: 'WolfInvestor', net: 189023.14, level: 14, isPlayer: false },
    { rank: 3, name: 'MarketKing', net: 175332.67, level: 15, isPlayer: false }
  ];

  const playerRankNum = rank || 247;
  const showPlayerInLeaderboard = playerRankNum > 3;

  // Active Live Event data with countdown
  const activeEvent: NewsEvent | null = eng.state.events.length > 0 ? eng.state.events[0] : null;
  const eventTitle = activeEvent ? activeEvent.title : 'EARNINGS SEASON';
  const eventDesc = activeEvent ? activeEvent.desc : 'High volatility across tech stocks!';

  const navigateToTrade = (assetId: string, market: Market) => {
    setActiveAsset(assetId);
    setActiveMarket(market);
    setActiveScreen('trading');
    Audio.click();
  };

  // Static Sparkline Renderer
  const Sparkline = ({ points, color = '#22C55E' }: { points: number[]; color?: string }) => {
    const width = 80;
    const height = 24;
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const ptsStr = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - ((p - min) / range) * height}`).join(' ');
    return (
      <svg width={width} height={height} className="spark-line-svg">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={ptsStr} />
      </svg>
    );
  };

  const getStaticPoints = (positive: boolean) => {
    return positive 
      ? [10, 12, 11, 14, 13, 16, 15, 18, 17, 20]
      : [20, 18, 19, 16, 17, 14, 15, 12, 13, 10];
  };

  const firstTradeUnlocked = (playerStats?.totalTrades || 0) > 0;
  const profitMakerUnlocked = realizedPnL >= 10000 || net >= 15000;
  const bigSpenderUnlocked = net >= 100000 || (playerStats?.totalTrades || 0) >= 20;
  const marketMasterUnlocked = lvl >= 20;

  const handleNavTab = (tab: any) => {
    Audio.click();
    setActiveScreen('trading');
    setActiveTab(tab);
  };

  // Hero stat strip — reuses existing display data (net worth / rank / streak)
  const heroStatStrip = (
    <div className="hero-stat-strip">
      <span className="hud-pill gold"><IconGem size={12} /><span className="strip-lbl">NET</span>{fmt(netCount)}</span>
      <span className="hud-pill cyan"><IconTrophy size={12} /><span className="strip-lbl">RANK</span>#{rank || 247}</span>
      <span className="hud-pill rose"><IconFlame size={12} /><span className="strip-lbl">STREAK</span>{streak || 7}D</span>
    </div>
  );

  // Skeleton rows shown while asset snapshot has not arrived yet (visual only)
  const moverSkeletonRows = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <div key={`skel-${i}`} className="mover-row-item skel-row" aria-hidden="true">
        <div className="skel skel-icon" />
        <div className="skel skel-line skel-w-lg" />
        <div className="skel skel-line skel-w-sm" />
      </div>
    ));

  // ==========================================================================
  // MOBILE RENDER LAYOUT
  // ==========================================================================
  if (isMobile) {
    return (
      <div className="mmo-mobile-dash-container arcdash">

        {/* 1. Hero Card Welcome + Live Event combined */}
        <section className="mmo-mobile-hero hud-panel hud-corners gold" style={{ backgroundImage: 'linear-gradient(rgba(11,16,32,0.4), rgba(11,16,32,0.9)), url(/cityscape_sunset.png)' }}>
          <div className="mobile-hero-welcome-area">
            <h1 className="mob-welcome-title disp">WELCOME BACK, <span className="gold-text neon-gold">{username.toUpperCase()}</span>!</h1>
            <p className="mob-welcome-sub">The market never sleeps. Opportunity is everywhere.</p>
            {heroStatStrip}
          </div>

          <div className="mobile-hero-event-overlay">
            <div className="mob-event-head-row">
              <span className="mob-event-tag">LIVE EVENT</span>
              <span className="mob-event-time">
                {timeLeft.hours.toString().padStart(2, '0')}H : {timeLeft.minutes.toString().padStart(2, '0')}M : {timeLeft.seconds.toString().padStart(2, '0')}S
              </span>
            </div>
            <h3 className="mob-event-title disp">{eventTitle}</h3>
            <p className="mob-event-desc">{eventDesc}</p>
            <button className="mob-event-cta arcade-btn" onClick={() => handleNavTab('news')}>
              VIEW EVENT
            </button>
          </div>
        </section>

        {/* 2. Player Progression Card */}
        <section className="mmo-mobile-card prog-mobile-card hud-panel glow-hover">
          <div className="prog-mobile-left-badge">
            <LevelShield level={lvl} size={44} color="var(--neon-gold)" />
          </div>
          <div className="prog-mobile-center-text">
            <span className="prog-mob-lbl">YOUR RANK</span>
            <span className="prog-mob-rank disp">#{rank || 247}</span>
            <span className="prog-mob-sub">TOP 2% OF TRADERS</span>
          </div>
          <div className="prog-mobile-right-spark">
            <Sparkline points={[10, 12, 11, 14, 13, 16, 17, 16, 19, 18, 22]} color="#22C55E" />
          </div>
        </section>

        {/* 3. Financial Summary full-width cards */}
        <section className="mmo-mobile-financial-summary">
          {/* Cash Balance */}
          <div className="mmo-mobile-card summary-mobile-card cash-card hud-panel glow-hover">
            <div className="sm-circle green-theme-circle">
              <IconWallet size={18} />
            </div>
            <div className="sm-details">
              <span className="sm-label">CASH BALANCE</span>
              <span className="sm-value disp"><AnimatedNumber value={cash} format={n => fmt(n)} /></span>
            </div>
            <div className="sm-sparkline">
              <Sparkline points={[100, 102, 101, 104, 103, 106, 105, 108]} color="#22C55E" />
            </div>
          </div>

          {/* Net Worth */}
          <div className="mmo-mobile-card summary-mobile-card networth-card hud-panel glow-hover">
            <div className="sm-circle blue-theme-circle">
              <IconGem size={18} />
            </div>
            <div className="sm-details">
              <span className="sm-label">NET WORTH</span>
              <span className="sm-value disp"><AnimatedNumber value={net} format={n => fmt(n)} /></span>
              <span className={`sm-delta ${todayPnLPct >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                {todayPnLPct >= 0 ? '▲' : '▼'} {Math.abs(todayPnLPct).toFixed(2)}% TODAY
              </span>
            </div>
            <div className="sm-sparkline">
              <Sparkline points={[200, 201, 203, 202, 205, 204, 208, 210]} color="#22C55E" />
            </div>
          </div>

          {/* Today's Profit */}
          <div className="mmo-mobile-card summary-mobile-card hud-panel glow-hover">
            <div className="sm-circle dark-green-circle">
              <IconBars size={18} />
            </div>
            <div className="sm-details">
              <span className="sm-label">TODAY'S PROFIT</span>
              <span className={`sm-value disp ${todayPnL >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                {todayPnL >= 0 ? '+' : ''}<AnimatedNumber value={todayPnL} format={n => fmt(n)} />
              </span>
              <span className={`sm-delta ${todayPnL >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                {todayPnL >= 0 ? '▲' : '▼'} {Math.abs(todayPnLPct).toFixed(2)}%
              </span>
            </div>
            <div className="sm-sparkline">
              <Sparkline points={todayPnL >= 0 ? [50, 52, 51, 55, 53, 58, 60] : [60, 58, 55, 52, 50]} color={todayPnL >= 0 ? '#22C55E' : '#EF4444'} />
            </div>
          </div>
        </section>

        {/* 4. Rewards chest + Streak row */}
        <section className="mmo-mobile-rewards-row">
          {/* Daily Reward */}
          <div className="mmo-mobile-card reward-mob-card hud-panel glow-hover hud-corners gold">
            <div className="reward-mob-top">
              <span className="chest-badge-icon"><IconGem size={22} /></span>
              <div className="reward-text-wrap">
                <span className="reward-main-lbl">DAILY REWARD</span>
                <span className="reward-sub-lbl">CLAIM YOUR REWARD</span>
              </div>
            </div>
            <button className="claim-now-btn-mob arcade-btn cyan" onClick={handleClaimDailyReward}>
              CLAIM NOW
            </button>
          </div>

          {/* Streak Card */}
          <div className="mmo-mobile-card streak-mob-card hud-panel glow-hover">
            <div className="streak-mob-top">
              <span className="streak-flame-icon"><IconFlame size={22} /></span>
              <div className="streak-text-wrap">
                <span className="streak-main-lbl">STREAK</span>
                <span className="streak-sub-lbl disp">{streak || 7} DAYS</span>
                <span className="streak-caption">Keep it up!</span>
              </div>
            </div>
            <div className="streak-progress-container-mob">
              <div className="streak-line-bg-mob"></div>
              <div className="streak-line-fill-mob" style={{ width: `${((Math.min(7, streak || 7) - 1) / 6) * 100}%` }}></div>
              <div className="streak-dots-wrap-mob">
                {[1, 2, 3, 4, 5, 6, 7].map(day => {
                  const active = day <= (streak || 7);
                  return (
                    <span key={day} className={`streak-dot-node-mob ${active ? 'active' : ''}`} />
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Market Movers Card */}
        <section className="mmo-mobile-card movers-mob-card hud-panel glow-hover">
          <div className="movers-mob-head">
            <span className="movers-mob-title disp">MARKET MOVERS</span>
            <span className="movers-mob-view-all" onClick={() => handleNavTab('movers')}>VIEW ALL</span>
          </div>

          <div className="movers-mob-tabs">
            <button className={`movers-tab-btn-mob ${moversTab === 'gainers' ? 'active' : ''}`} onClick={() => setMoversTab('gainers')}>TOP GAINERS</button>
            <button className={`movers-tab-btn-mob ${moversTab === 'losers' ? 'active' : ''}`} onClick={() => setMoversTab('losers')}>TOP LOSERS</button>
            <button className={`movers-tab-btn-mob ${moversTab === 'active' ? 'active' : ''}`} onClick={() => setMoversTab('active')}>MOST ACTIVE</button>
          </div>

          <div className="movers-mob-list">
            {activeMovers.length === 0 && moverSkeletonRows(3)}
            {activeMovers.slice(0, 3).map(({ a, ast, chg }) => {
              const isPositive = chg >= 0;
              return (
                <div key={a.id} className="mover-mob-row" onClick={() => navigateToTrade(a.id, a.market as Market)}>
                  <div className="mover-mob-icon-wrap">
                    <svg className="mover-mob-icon-svg" style={{ width: '18px', height: '18px', fill: isPositive ? '#22C55E' : '#EF4444' }}>
                      <use href={`#${a.icon}`} />
                    </svg>
                  </div>
                  <div className="mover-mob-asset-info">
                    <span className="mover-mob-sym">{a.id}</span>
                    <span className="mover-mob-name">{a.name}</span>
                  </div>
                  <div className="mover-mob-price-col">
                    <span className="mover-mob-price">{fmt(ast.lastPrice)}</span>
                    <span className={`mover-mob-chg ${isPositive ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                      {isPositive ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Daily Missions Card */}
        <section className="mmo-mobile-card missions-mob-card hud-panel glow-hover">
          <div className="missions-mob-head">
            <span className="missions-mob-title disp">DAILY MISSIONS</span>
            <span className="missions-mob-countdown hud-pill gold">RESETS IN {midnightTimeLeft}</span>
          </div>

          <div className="missions-mob-list">
            {daily.length > 0 ? (
              daily.map((m, idx) => {
                const pct = Math.min(100, (m.progress / m.def.goal.target) * 100);
                return (
                  <div key={m.def.id} className="mission-mob-row">
                    <span className="mission-mob-num">{idx + 1}</span>
                    <div className="mission-mob-details">
                      <span className="mission-mob-title-text">{m.def.title}</span>
                      <div className="mission-mob-prog-row">
                        <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: `${pct}%` }} /></div>
                        <span className="m-prog-count-mob">{Math.floor(m.progress)} / {m.def.goal.target}</span>
                      </div>
                    </div>
                    <div className="mission-mob-rewards">
                      <span className="mob-rew-xp hud-pill purple">XP {m.def.reward * 5}</span>
                      <span className="mob-rew-cash hud-pill gold"><IconCoin size={11} /> {m.def.reward * 10}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="mission-mob-row">
                  <span className="mission-mob-num">1</span>
                  <div className="mission-mob-details">
                    <span className="mission-mob-title-text">Make 3 Profitable Trades</span>
                    <div className="mission-mob-prog-row">
                      <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: '66%' }} /></div>
                      <span className="m-prog-count-mob">2 / 3</span>
                    </div>
                  </div>
                  <div className="mission-mob-rewards">
                    <span className="mob-rew-xp hud-pill purple">XP 250</span>
                    <span className="mob-rew-cash hud-pill gold"><IconCoin size={11} /> 500</span>
                  </div>
                </div>
                <div className="mission-mob-row">
                  <span className="mission-mob-num">2</span>
                  <div className="mission-mob-details">
                    <span className="mission-mob-title-text">Trade in Crypto Market</span>
                    <div className="mission-mob-prog-row">
                      <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: '0%' }} /></div>
                      <span className="m-prog-count-mob">0 / 1</span>
                    </div>
                  </div>
                  <div className="mission-mob-rewards">
                    <span className="mob-rew-xp hud-pill purple">XP 200</span>
                    <span className="mob-rew-cash hud-pill gold"><IconCoin size={11} /> 300</span>
                  </div>
                </div>
                <div className="mission-mob-row">
                  <span className="mission-mob-num">3</span>
                  <div className="mission-mob-details">
                    <span className="mission-mob-title-text">Earn $5,000 Profit</span>
                    <div className="mission-mob-prog-row">
                      <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: '25%' }} /></div>
                      <span className="m-prog-count-mob">$1,245 / $5,000</span>
                    </div>
                  </div>
                  <div className="mission-mob-rewards">
                    <span className="mob-rew-xp hud-pill purple">XP 500</span>
                    <span className="mob-rew-cash hud-pill gold"><IconCoin size={11} /> 750</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <button className="view-all-missions-btn-mob arcade-btn ghost" onClick={() => { Audio.click(); setShowAllMissions(v => !v); }}>
            {showAllMissions ? 'HIDE MISSIONS' : 'VIEW ALL MISSIONS'}
          </button>
          {showAllMissions && (
            <div className="dash-missions-full">
              <MissionsTab />
            </div>
          )}
        </section>

      </div>
    );
  }

  // ==========================================================================
  // DESKTOP RENDER LAYOUT
  // ==========================================================================
  return (
    <div className="mmo-dash-layout arcdash">
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="mmo-sidebar">
        {/* Level Card */}
        <div className="sidebar-card level-card hud-panel glow-hover">
          <div className="level-shield-wrap">
            <LevelShield level={lvl} size={64} color="var(--neon-gold)" />
          </div>
          <div className="level-text-info">
            <h2 className="lvl-title disp">LEVEL {lvl}</h2>
            <div className="xp-text-range">{xp - xpAt} / {xpTo - xpAt} XP</div>
            <div className="lvl-bar-outer xp-bar">
              <div className="lvl-bar-inner xp-fill" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
          <div className="lvl-divider"></div>
          <div className="rank-info-row">
            <div className="rank-left">
              <span className="rank-label">RANK</span>
              <span className="rank-value disp">#{rank || 247}</span>
              <span className="rank-sub">TOP 2% OF TRADERS</span>
            </div>
            <div className="rank-right-spark">
              <Sparkline points={[10, 11, 10, 13, 12, 14, 15, 14, 16]} color="#22C55E" />
            </div>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="sidebar-card balance-card cash-card hud-panel glow-hover">
          <div className="card-icon-circle green-theme">
            <IconWallet size={20} />
          </div>
          <div className="balance-info">
            <span className="balance-lbl">CASH BALANCE</span>
            <span className="balance-val disp"><AnimatedNumber value={cash} format={n => fmt(n)} /></span>
          </div>
        </div>

        {/* Net Worth */}
        <div className="sidebar-card balance-card networth-card hud-panel glow-hover">
          <div className="card-icon-circle purple-theme">
            <IconGem size={20} />
          </div>
          <div className="balance-info">
            <span className="balance-lbl">NET WORTH</span>
            <span className="balance-val disp"><AnimatedNumber value={net} format={n => fmt(n)} /></span>
            <span className={`delta-pct-today ${todayPnLPct >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
              {todayPnLPct >= 0 ? '▲' : '▼'} {Math.abs(todayPnLPct).toFixed(2)}% TODAY
            </span>
          </div>
        </div>

        {/* Daily Profit/Loss */}
        <div className="sidebar-card pnl-card hud-panel glow-hover">
          <div className="pnl-header-row">
            <div className="pnl-lbl-col">
              <span className="pnl-lbl">TODAY'S PROFIT</span>
              <span className={`pnl-val disp ${todayPnL >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                {todayPnL >= 0 ? '+' : ''}<AnimatedNumber value={todayPnL} format={n => fmt(n)} />
              </span>
              <span className={`pnl-pct ${todayPnL >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                {todayPnL >= 0 ? '▲' : '▼'} {Math.abs(todayPnLPct).toFixed(2)}%
              </span>
            </div>
            <div className="pnl-sparkline">
              <Sparkline points={todayPnL >= 0 ? [2, 3, 2, 5, 4, 6, 7] : [7, 6, 8, 5, 4, 3, 2]} color={todayPnL >= 0 ? '#22C55E' : '#EF4444'} />
            </div>
          </div>
        </div>

        {/* Daily Reward Chest */}
        <div className="sidebar-card daily-reward-card hud-panel glow-hover hud-corners gold">
          <div className="chest-badge-layout">
            <div className="chest-illustration-wrap">
              <div className="glowing-orb"></div>
              <span className="chest-icon-emoji"><IconGem size={22} /></span>
            </div>
            <div className="reward-claim-info">
              <span className="reward-lbl">DAILY REWARD</span>
              <span className="reward-sub">CLAIM YOUR REWARD</span>
            </div>
          </div>
          <button className="claim-now-btn arcade-btn cyan" onClick={handleClaimDailyReward}>
            CLAIM NOW
          </button>
        </div>

        {/* Streak */}
        <div className="sidebar-card streak-card hud-panel glow-hover">
          <div className="streak-title-row">
            <span className="streak-flame"><IconFlame size={22} /></span>
            <div className="streak-labels">
              <span className="streak-lbl">STREAK</span>
              <span className="streak-days disp">{streak || 7} DAYS</span>
              <span className="streak-sub">Keep it up!</span>
            </div>
          </div>
          <div className="streak-dots-row">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const active = day <= (streak || 7);
              return (
                <div 
                  key={day} 
                  className={`streak-dot ${active ? 'active-gold' : ''}`}
                  title={active ? `Day ${day} Completed` : `Day ${day} Pending`}
                />
              );
            })}
          </div>
        </div>
      </aside>

      {/* ================= CENTER / MAIN WORKSPACE ================= */}
      <div className="mmo-main-content">
        
        {/* Center Top Hero Section */}
        <section className="hero-banner-section hud-panel hud-corners gold" style={{ backgroundImage: 'linear-gradient(rgba(11,16,32,0.4), rgba(11,16,32,0.9)), url(/cityscape_sunset.png)' }}>
          <div className="hero-banner-left">
            <h1 className="welcome-heading disp">WELCOME BACK, <span className="neon-gold">{username.toUpperCase()}</span>!</h1>
            <p className="welcome-subtext">The market never sleeps. Opportunity is everywhere.</p>
            {heroStatStrip}
          </div>

          {/* Live Market Event Card */}
          <div className="hero-banner-right event-card-live">
            <div className="live-event-sparkline-bg">
              <Sparkline points={[10, 14, 12, 19, 15, 24, 21, 28, 25, 32]} color="#EF4444" />
            </div>
            <div className="live-event-content">
              <span className="live-event-tag">LIVE MARKET EVENT</span>
              <h3 className="live-event-title disp">{eventTitle}</h3>
              <p className="live-event-desc">{eventDesc}</p>

              <div className="live-event-bottom">
                <button className="view-event-btn arcade-btn" onClick={() => handleNavTab('news')}>
                  VIEW EVENT
                </button>
                <div className="event-countdown-display">
                  <span className="ends-in-lbl">ENDS IN</span>
                  <span className="ends-in-time">
                    {timeLeft.hours.toString().padStart(2, '0')}H : {timeLeft.minutes.toString().padStart(2, '0')}M : {timeLeft.seconds.toString().padStart(2, '0')}S
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Column Main Grid */}
        <div className="main-3col-grid">
          
          {/* COLUMN 1: Market Movers & News */}
          <div className="grid-col flex-col">
            
            {/* Market Movers Card */}
            <div className="mmo-card movers-card hud-panel glow-hover">
              <div className="movers-header">
                <h3 className="card-title-mmo disp">MARKET MOVERS</h3>
                <div className="movers-tab-buttons">
                  <button 
                    className={`mover-tab-btn ${moversTab === 'gainers' ? 'active' : ''}`}
                    onClick={() => { Audio.click(); setMoversTab('gainers'); }}
                  >
                    TOP GAINERS
                  </button>
                  <button 
                    className={`mover-tab-btn ${moversTab === 'losers' ? 'active' : ''}`}
                    onClick={() => { Audio.click(); setMoversTab('losers'); }}
                  >
                    TOP LOSERS
                  </button>
                  <button 
                    className={`mover-tab-btn ${moversTab === 'active' ? 'active' : ''}`}
                    onClick={() => { Audio.click(); setMoversTab('active'); }}
                  >
                    MOST ACTIVE
                  </button>
                </div>
              </div>

              <div className="movers-list-body">
                {activeMovers.length === 0 && moverSkeletonRows(5)}
                {activeMovers.map(({ a, ast, chg }) => {
                  const isPositive = chg >= 0;
                  return (
                    <div 
                      key={a.id} 
                      className="mover-row-item"
                      onClick={() => navigateToTrade(a.id, a.market as Market)}
                    >
                      <div className="mover-asset-info">
                        <span className="asset-icon-placeholder">{a.market === 'crypto' ? <IconCoin size={14} /> : a.market === 'forex' ? <IconGlobe size={14} /> : <IconCandles size={14} />}</span>
                        <div className="mover-name-col">
                          <span className="mover-symbol">{a.id}</span>
                          <span className="mover-fullname">{a.name}</span>
                        </div>
                      </div>
                      
                      <div className="mover-sparkline-col">
                        <Sparkline 
                          points={ast.history && ast.history.length > 1 ? ast.history.slice(-10) : getStaticPoints(isPositive)} 
                          color={isPositive ? '#22C55E' : '#EF4444'} 
                        />
                      </div>

                      <div className="mover-price-col">
                        <span className="mover-price">{fmt(ast.lastPrice)}</span>
                        <span className={`mover-chg-pct ${isPositive ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                          {isPositive ? '+' : ''}{fmtPct(chg)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="card-footer-action-btn arcade-btn ghost" onClick={() => handleNavTab('movers')}>
                VIEW ALL MARKETS
              </button>
            </div>

            {/* Market News Card */}
            <div className="mmo-card news-card hud-panel glow-hover">
              <h3 className="card-title-mmo disp">MARKET NEWS</h3>
              
              <div className="news-list-body">
                {newsList.length > 0 ? (
                  newsList.map((e, idx) => {
                    const elapsed = Math.floor((Date.now() - e.t) / 1000);
                    const timeStr = elapsed < 60 ? elapsed + 's ago' : Math.floor(elapsed / 60) + 'm ago';
                    return (
                      <div key={idx} className="news-article-row hud-panel">
                        <span className="news-bullet"><IconNews size={13} /></span>
                        <div className="news-content-col">
                          <div className="news-headline">{e.title}</div>
                          <div className="news-meta">{timeStr} • #{e.cat || 'general'}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  defaultNews.map((n, idx) => (
                    <div key={idx} className="news-article-row hud-panel">
                      <span className="news-bullet"><IconNews size={13} /></span>
                      <div className="news-content-col">
                        <div className="news-headline">{n.title}</div>
                        <div className="news-meta">{n.time} • #{n.desc.split(' ')[0].toLowerCase()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="card-footer-action-btn arcade-btn ghost" onClick={() => handleNavTab('news')}>
                VIEW ALL NEWS
              </button>
            </div>

          </div>

          {/* COLUMN 2: Portfolio Overview & Leaderboard */}
          <div className="grid-col flex-col">
            
            {/* Portfolio Overview Card */}
            <div className="mmo-card portfolio-card hud-panel glow-hover">
              <h3 className="card-title-mmo disp">PORTFOLIO OVERVIEW</h3>
              
              <div className="donut-chart-section">
                {/* SVG Donut Chart */}
                <DonutChart allocations={displaySectors} totalValue={net} />
                
                {/* Donut Legend */}
                <div className="donut-legend-col">
                  {displaySectors.map((sector, idx) => (
                    <div key={idx} className="legend-row-item">
                      <span className="legend-bullet-dot" style={{ backgroundColor: sector.color }}></span>
                      <span className="legend-sector-name">{sector.label}</span>
                      <span className="legend-sector-pct">{sector.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats Row at bottom of Portfolio */}
              <div className="portfolio-stats-grid">
                <div className="p-stat-box">
                  <span className="p-stat-lbl">HOLDINGS</span>
                  <span className="p-stat-val">{holdingsList.length > 0 ? holdingsList.length : 28}</span>
                </div>
                <div className="p-stat-box">
                  <span className="p-stat-lbl">P&L (UNREALIZED)</span>
                  <span className={`p-stat-val ${unrealizedPnL >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                    {unrealizedPnL >= 0 ? '+' : ''}{fmt(unrealizedPnL)}
                  </span>
                </div>
                <div className="p-stat-box">
                  <span className="p-stat-lbl">P&L (REALIZED)</span>
                  <span className={`p-stat-val ${realizedPnL >= 0 ? 'up-green neon-green' : 'dn-red neon-rose'}`}>
                    {realizedPnL >= 0 ? '+' : ''}{fmt(realizedPnL)}
                  </span>
                </div>
              </div>

              <button className="card-footer-action-btn arcade-btn ghost" onClick={() => handleNavTab('positions')}>
                VIEW PORTFOLIO
              </button>
            </div>

            {/* Leaderboard Card */}
            <div className="mmo-card leaderboard-card hud-panel glow-hover">
              <div className="leaderboard-header-row">
                <h3 className="card-title-mmo disp">LEADERBOARD</h3>
                <span className="weekly-ranking-lbl hud-pill cyan">WEEKLY TOP TRADERS</span>
              </div>

              <div className="leaderboard-lobby-list">
                {topHumans.map((item, idx) => (
                  <div key={idx} className="lobby-leaderboard-row">
                    <span className="lobby-rank">
                      {idx === 0 ? <IconTrophy size={15} /> : `#${idx + 1}`}
                    </span>
                    <div className="lobby-avatar-wrap">
                      <span className="lobby-avatar-icon">🧑‍💻</span>
                    </div>
                    <div className="lobby-player-info">
                      <span className="lobby-player-name">{item.name}</span>
                      <span className="lobby-player-sub">Level {item.level}</span>
                    </div>
                    <div className="lobby-player-net">
                      ${fmt(item.net)}
                    </div>
                  </div>
                ))}

                {/* Show player row if player is lower rank */}
                {showPlayerInLeaderboard && (
                  <div className="lobby-leaderboard-row player-active-row">
                    <span className="lobby-rank">#{playerRankNum}</span>
                    <div className="lobby-avatar-wrap">
                      <span className="lobby-avatar-icon">🧑‍🚀</span>
                    </div>
                    <div className="lobby-player-info">
                      <span className="lobby-player-name">{username} (YOU)</span>
                      <span className="lobby-player-sub">Level {lvl}</span>
                    </div>
                    <div className="lobby-player-net">
                      ${fmt(net)}
                    </div>
                  </div>
                )}
              </div>

              <button className="card-footer-action-btn arcade-btn ghost" onClick={() => { Audio.click(); setActiveScreen('leaderboard'); }}>
                VIEW FULL LEADERBOARD
              </button>
            </div>

          </div>

          {/* COLUMN 3: Daily Missions & Achievements */}
          <div className="grid-col flex-col">
            
            {/* Daily Missions Card */}
            <div className="mmo-card missions-card hud-panel glow-hover">
              <div className="missions-header-row">
                <h3 className="card-title-mmo disp">DAILY MISSIONS</h3>
                <span className="resets-in-countdown hud-pill gold">RESETS IN {midnightTimeLeft}</span>
              </div>

              <div className="missions-lobby-list">
                {daily.length > 0 ? (
                  daily.map((m, idx) => {
                    const pct = Math.min(100, (m.progress / m.def.goal.target) * 100);
                    return (
                      <div key={m.def.id} className={`lobby-mission-row ${m.completed ? 'completed' : ''}`}>
                        <div className="lobby-mission-left">
                          <span className="mission-number">{idx + 1}</span>
                        </div>
                        <div className="lobby-mission-middle">
                          <div className="lobby-mission-title">{m.def.title}</div>
                          <div className="lobby-mission-desc">{m.def.desc}</div>
                          
                          <div className="lobby-mission-progress-row">
                            <div className="m-bar-outer xp-bar thin">
                              <div className="m-bar-inner xp-fill purple" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="m-progress-count">{Math.floor(m.progress)} / {m.def.goal.target}</span>
                          </div>
                        </div>
                        <div className="lobby-mission-rewards">
                          <span className="lobby-reward-xp hud-pill purple">XP {m.def.reward * 5}</span>
                          <span className="lobby-reward-cash hud-pill gold">${m.def.reward * 10}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div className="lobby-mission-row">
                      <div className="lobby-mission-left"><span className="mission-number">1</span></div>
                      <div className="lobby-mission-middle">
                        <div className="lobby-mission-title">Make 3 Profitable Trades</div>
                        <div className="lobby-mission-desc">Buy low, sell high to lock in signals.</div>
                        <div className="lobby-mission-progress-row">
                          <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: '66%' }} /></div>
                          <span className="m-progress-count">2 / 3</span>
                        </div>
                      </div>
                      <div className="lobby-mission-rewards">
                        <span className="lobby-reward-xp hud-pill purple">XP 250</span>
                        <span className="lobby-reward-cash hud-pill gold">$500</span>
                      </div>
                    </div>
                    <div className="lobby-mission-row">
                      <div className="lobby-mission-left"><span className="mission-number">2</span></div>
                      <div className="lobby-mission-middle">
                        <div className="lobby-mission-title">Trade in Crypto Market</div>
                        <div className="lobby-mission-desc">Execute an order in any crypto pair.</div>
                        <div className="lobby-mission-progress-row">
                          <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: '0%' }} /></div>
                          <span className="m-progress-count">0 / 1</span>
                        </div>
                      </div>
                      <div className="lobby-mission-rewards">
                        <span className="lobby-reward-xp hud-pill purple">XP 200</span>
                        <span className="lobby-reward-cash hud-pill gold">$300</span>
                      </div>
                    </div>
                    <div className="lobby-mission-row">
                      <div className="lobby-mission-left"><span className="mission-number">3</span></div>
                      <div className="lobby-mission-middle">
                        <div className="lobby-mission-title">Earn $5,000 Profit</div>
                        <div className="lobby-mission-desc">Amass trading bounty allocations.</div>
                        <div className="lobby-mission-progress-row">
                          <div className="m-bar-outer xp-bar thin"><div className="m-bar-inner xp-fill purple" style={{ width: '25%' }} /></div>
                          <span className="m-progress-count">$1,245 / $5,000</span>
                        </div>
                      </div>
                      <div className="lobby-mission-rewards">
                        <span className="lobby-reward-xp hud-pill purple">XP 500</span>
                        <span className="lobby-reward-cash hud-pill gold">$750</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button className="card-footer-action-btn arcade-btn ghost" onClick={() => { Audio.click(); setShowAllMissions(v => !v); }}>
                {showAllMissions ? 'HIDE MISSIONS' : 'VIEW ALL MISSIONS'}
              </button>
              {showAllMissions && (
                <div className="dash-missions-full">
                  <MissionsTab />
                </div>
              )}
            </div>

            {/* Achievements Card */}
            <div className="mmo-card achievements-card hud-panel glow-hover">
              <div className="achievements-header-row">
                <h3 className="card-title-mmo disp">ACHIEVEMENTS</h3>
                <span className="ach-new-badge hud-pill gold">NEW</span>
              </div>

              <div className="achievements-lobby-grid">
                <div className={`ach-badge-box ${firstTradeUnlocked ? 'unlocked' : 'locked'}`}>
                  <div className="ach-shield-icon first-trade"><IconStar size={20} /></div>
                  <span className="ach-name">First Trade</span>
                  <span className="ach-status">{firstTradeUnlocked ? 'Complete' : '0/1 Complete'}</span>
                </div>
                <div className={`ach-badge-box ${profitMakerUnlocked ? 'unlocked' : 'locked'}`}>
                  <div className="ach-shield-icon profit-maker"><IconCoin size={20} /></div>
                  <span className="ach-name">Profit Maker</span>
                  <span className="ach-status">{profitMakerUnlocked ? 'Complete' : 'Earn $10k Profit'}</span>
                </div>
                <div className={`ach-badge-box ${bigSpenderUnlocked ? 'unlocked' : 'locked'}`}>
                  <div className="ach-shield-icon big-spender"><IconGem size={20} /></div>
                  <span className="ach-name">Big Spender</span>
                  <span className="ach-status">{bigSpenderUnlocked ? 'Complete' : 'Spend $100k'}</span>
                </div>
                <div className={`ach-badge-box ${marketMasterUnlocked ? 'unlocked' : 'locked'}`}>
                  <div className="ach-shield-icon market-master"><IconTrophy size={20} /></div>
                  <span className="ach-name">Market Master</span>
                  <span className="ach-status">{marketMasterUnlocked ? 'Complete' : 'Reach Level 20'}</span>
                </div>
              </div>

              <button className="card-footer-action-btn arcade-btn ghost" onClick={() => handleNavTab('help')}>
                VIEW ALL ACHIEVEMENTS
              </button>
            </div>

          </div>

        </div>

        {/* Bottom Section */}
        <section className="choose-market-footer-section">
          <h2 className="choose-market-heading disp">CHOOSE YOUR MARKET</h2>

          <div className="choose-market-cards-row">
            {/* Stocks */}
            <div className="market-choice-card stocks-card-border hud-panel" onClick={() => handleChooseMarket('stocks')}>
              <div className="choice-icon-circle green-outline">
                <IconStar size={18} />
              </div>
              <div className="choice-main-info">
                <span className="choice-title disp">TRADE STOCKS</span>
                <span className="choice-desc">100+ COMPANIES</span>
              </div>
              <button className="choice-cta-btn arcade-btn green-btn">ENTER MARKET</button>
            </div>

            {/* Crypto */}
            <div className={`market-choice-card crypto-card-border hud-panel ${lvl < 20 ? 'locked-grey' : ''}`} onClick={() => handleChooseMarket('crypto')}>
              <div className="choice-icon-circle purple-outline">
                <span>₿</span>
              </div>
              <div className="choice-main-info">
                <span className="choice-title disp">TRADE CRYPTO</span>
                <span className="choice-desc">{lvl < 20 ? 'UNLOCKS AT LEVEL 20' : '50+ CRYPTO PAIRS'}</span>
              </div>
              <button className={`choice-cta-btn arcade-btn ${lvl < 20 ? 'locked-btn' : 'purple-btn'}`}>
                {lvl < 20 ? 'LOCKED' : 'ENTER MARKET'}
              </button>
            </div>

            {/* Forex */}
            <div className={`market-choice-card forex-card-border hud-panel ${lvl < 30 ? 'locked-grey' : ''}`} onClick={() => handleChooseMarket('forex')}>
              <div className="choice-icon-circle blue-outline">
                <span>$</span>
              </div>
              <div className="choice-main-info">
                <span className="choice-title disp">TRADE FOREX</span>
                <span className="choice-desc">{lvl < 30 ? 'UNLOCKS AT LEVEL 30' : '30+ CURRENCY PAIRS'}</span>
              </div>
              <button className={`choice-cta-btn arcade-btn ${lvl < 30 ? 'locked-btn' : 'blue-btn'}`}>
                {lvl < 30 ? 'LOCKED' : 'ENTER MARKET'}
              </button>
            </div>

            {/* Commodities */}
            <div className="market-choice-card commodities-card-border locked-grey hud-panel" onClick={() => { Audio.click(); pushToast('Commodities: Coming in the next seasonal expansion!', 'info'); }}>
              <div className="choice-icon-circle locked-outline">
                <IconShield size={18} />
              </div>
              <div className="choice-main-info">
                <span className="choice-title disp">COMMODITIES</span>
                <span className="choice-desc">COMING SOON</span>
              </div>
              <button className="choice-cta-btn arcade-btn locked-btn">LOCKED</button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );

  function handleChooseMarket(market: 'stocks' | 'crypto' | 'forex') {
    Audio.click();
    if (market === 'stocks') {
      setActiveMarket('stocks');
      setActiveScreen('trading');
    } else if (market === 'crypto') {
      if (lvl < 20) {
        pushToast('Crypto Nebula unlocks at Level 20', 'err');
        return;
      }
      setActiveMarket('crypto');
      setActiveScreen('trading');
    } else if (market === 'forex') {
      if (lvl < 30) {
        pushToast('Forex Grid unlocks at Level 30', 'err');
        return;
      }
      setActiveMarket('forex');
      setActiveScreen('trading');
    }
  }
}

// Donut Chart Subcomponent
function DonutChart({ allocations, totalValue }: { allocations: { label: string; value: number; color: string; pct: number }[]; totalValue: number }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  let accumulatedPercent = 0;

  return (
    <div className="donut-chart-wrapper">
      <svg viewBox="0 0 100 100" className="donut-chart-svg">
        <circle cx="50" cy="50" r={R} fill="transparent" stroke="#1c2438" strokeWidth="8" />
        {allocations.map((alloc, idx) => {
          const strokeLength = (alloc.pct / 100) * C;
          const strokeOffset = C - strokeLength + (accumulatedPercent / 100) * C;
          accumulatedPercent += alloc.pct;
          return (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={R}
              fill="transparent"
              stroke={alloc.color}
              strokeWidth="8"
              strokeDasharray={C}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 50 50)"
            />
          );
        })}
      </svg>
      <div className="donut-chart-center-info">
        <span className="donut-center-val">{fmt(totalValue)}</span>
        <span className="donut-center-lbl">TOTAL VALUE</span>
      </div>
    </div>
  );
}
