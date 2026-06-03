import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { fmt, fmtPct, fmtNum } from '../../../shared/engine/helpers';
import { ASSETS } from '../../../shared/engine/constants';
import type { Market, MissionState } from '../../../shared/engine/types';
import { send } from '../net/wsClient';
import { Audio } from '../audio/audio';
import { AnimatedNumber } from './AnimatedNumber';

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
  const weekly = useGame(s => s.weeklyMissions);
  const leaderboard = useGame(s => s.leaderboard);
  const playerStats = useGame(s => s.playerStats);
  const streak = useGame(s => s.playerStreak);
  const bonus = useGame(s => s.playerBonus);
  const setActiveMarket = useGame(s => s.setActiveMarket);
  const setActiveScreen = useGame(s => s.setActiveScreen);
  const setActiveTab = useGame(s => s.setActiveTab);
  const setActiveAsset = useGame(s => s.setActive);

  const p = eng.player();
  const cash = eng.displayCash();
  const port = eng.displayPortfolioValue();
  const net = eng.netWorth();
  
  // Today's P&L calculations
  const dayStartNet = p.dayStartNet || 1000;
  const todayPnL = net - dayStartNet;
  const todayPnLPct = (todayPnL / dayStartNet) * 100;
  const xpProgress = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

  // Dynamic Operator Rank Class based on Player Level
  const getOperatorClass = (level: number) => {
    if (level < 5) return 'SPECULATOR RECRUIT';
    if (level < 10) return 'LIMIT INITIATE';
    if (level < 20) return 'MARGIN RAIDER';
    if (level < 30) return 'CRYPTO SHOGUN';
    if (level < 50) return 'FOREX OVERLORD';
    return 'APEX HEGEMON';
  };

  const getAvatarEmoji = (level: number) => {
    if (level < 5) return '🧑‍🚀';
    if (level < 10) return '🦾';
    if (level < 20) return '🤖';
    if (level < 30) return '⚡';
    if (level < 50) return '👽';
    return '👑';
  };

  // Market Selection for Highlights
  const [selectedHighlightMarket, setSelectedHighlightMarket] = useState<Market>('stocks');

  // How to Play Modal Slide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideSlide, setGuideSlide] = useState(0);

  // Onboarding Checklist visibility
  const showOnboarding = lvl === 1 && (playerStats?.totalTrades || 0) === 0;

  // Onboarding Checklist state
  const [guideRead, setGuideRead] = useState(() => {
    return localStorage.getItem('mm_onboarding_guide_read') === 'true';
  });

  const handleReadGuide = () => {
    setGuideRead(true);
    localStorage.setItem('mm_onboarding_guide_read', 'true');
    setShowGuide(true);
    setGuideSlide(0);
    Audio.click();
  };

  const handleCloseGuide = () => {
    setShowGuide(false);
    Audio.click();
  };

  // Compile Market Highlights
  const ranked = ASSETS
    .filter(a => a.market === selectedHighlightMarket)
    .map(a => {
      const ast = eng.state.assets[a.id];
      if (!ast) return null;
      const chg = ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100;
      return { a, ast, chg };
    })
    .filter(Boolean) as { a: typeof ASSETS[0]; ast: any; chg: number }[];

  const topGainers = [...ranked].sort((a, b) => b.chg - a.chg).slice(0, 3);
  const topLosers = [...ranked].sort((a, b) => a.chg - b.chg).slice(0, 3);
  const mostActive = [...ranked].sort((a, b) => b.ast.volume - a.ast.volume).slice(0, 3);

  // Calculate Holdings & Portfolio allocation list
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
        market: assetDef.market,
        shares: h.shares,
        avgCost: h.avgCost,
        lastPrice: astState.lastPrice,
        val,
        pctAlloc,
        unrealized,
      };
    })
    .filter(Boolean) as { aid: string; name: string; icon: string; market: string; shares: number; avgCost: number; lastPrice: number; val: number; pctAlloc: number; unrealized: number }[];

  const realizedPnL = playerStats?.realizedPL || 0;
  const unrealizedPnL = playerStats?.unrealizedPL || 0;

  const navigateToTrade = (assetId: string, market: Market) => {
    setActiveAsset(assetId);
    setActiveMarket(market);
    setActiveScreen('trading');
    Audio.click();
  };

  const executeQuickAction = (action: 'stocks' | 'crypto' | 'forex' | 'portfolio' | 'leaderboard') => {
    if (action === 'stocks') {
      setActiveMarket('stocks');
      setActiveScreen('trading');
    } else if (action === 'crypto') {
      if (lvl < 20) {
        useGame.getState().pushToast('Crypto Nebula unlocks at Level 20', 'err');
        Audio.click();
        return;
      }
      setActiveMarket('crypto');
      setActiveScreen('trading');
    } else if (action === 'forex') {
      if (lvl < 30) {
        useGame.getState().pushToast('Forex Grid unlocks at Level 30', 'err');
        Audio.click();
        return;
      }
      setActiveMarket('forex');
      setActiveScreen('trading');
    } else if (action === 'portfolio') {
      setActiveScreen('trading');
      setActiveTab('positions');
    } else if (action === 'leaderboard') {
      setActiveScreen('trading');
      setActiveTab('stats');
    }
    Audio.click();
  };

  return (
    <div className="dash-container">
      {/* 1. CHARACTER RPG HUD BANNER */}
      <section className="dash-section dash-summary-grid">
        {/* Operator Profile Card */}
        <div className="hud-card card-operator">
          <div className="hud-card-brackets"></div>
          <div className="operator-hud">
            <div className="operator-avatar">
              <span className="avatar-glyph">{getAvatarEmoji(lvl)}</span>
              <div className="avatar-pulse"></div>
            </div>
            <div className="operator-details">
              <div className="operator-class">{getOperatorClass(lvl)}</div>
              <div className="operator-lvl-text">COCKPIT ACCESS LEVEL {lvl}</div>
              
              <div className="operator-xp-hud">
                <div className="xp-labels">
                  <span>TELEMETRY XP</span>
                  <span>{xp - xpAt} / {xpTo - xpAt}</span>
                </div>
                <div className="xp-bar-outer">
                  <div className="xp-bar-inner" style={{ width: `${xpProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Telemetry Matrix Card */}
        <div className="hud-card card-wealth-cockpit">
          <div className="hud-card-brackets"></div>
          <div className="hud-header">📡 CORE CAPITAL SHIELD</div>
          <div className="telemetry-grid">
            <div className="telemetry-item main-net">
              <div className="tel-label">SYSTEM NET WORTH</div>
              <AnimatedNumber value={net} format={n => fmt(n)} className="tel-val net-glow" />
            </div>
            <div className="telemetry-sub-grid">
              <div className="tel-sub-item">
                <span className="tel-sub-lbl">CREDITS (CASH)</span>
                <span className="tel-sub-val green-glow"><AnimatedNumber value={cash} format={n => fmt(n)} /></span>
              </div>
              <div className="tel-sub-item">
                <span className="tel-sub-lbl">ALLOCATED LIQUIDITY</span>
                <span className="tel-sub-val blue-glow"><AnimatedNumber value={port} format={n => fmt(n)} /></span>
              </div>
            </div>
          </div>
        </div>

        {/* Match Arena Performance HUD */}
        <div className="hud-card card-performance-cockpit">
          <div className="hud-card-brackets"></div>
          <div className="hud-header">
            <span>⚔️ ARENA LEADERBOARD</span>
            <span className="telemetry-ping blinking">LIVE</span>
          </div>
          <div className="telemetry-performance-body">
            <div className="telemetry-performance-row">
              <div className="perf-metric">
                <span className="perf-label">DAILY DELTA</span>
                <div className={`perf-value ${todayPnL >= 0 ? 'up' : 'dn'}`}>
                  <span className="perf-sign">{todayPnL >= 0 ? '▲' : '▼'}</span>
                  <AnimatedNumber value={todayPnL} format={n => fmt(Math.abs(n))} />
                </div>
                <span className={`perf-pct ${todayPnL >= 0 ? 'up' : 'dn'}`}>
                  {todayPnL >= 0 ? '+' : ''}{fmtPct(todayPnLPct)}
                </span>
              </div>
              
              <div className="perf-metric rank-metric">
                <span className="perf-label">GLOBAL RANK</span>
                <div className="perf-value accent-glow">#{rank}</div>
                <span className="perf-sub-label">OF {total || '10,000'} TRADERS</span>
              </div>
            </div>

            <div className="multiplier-row">
              <div className="multiplier-badge">
                🔥 STREAK COMBO: {streak ? `${streak}D` : '1D'}
              </div>
              {bonus > 0 && (
                <div className="multiplier-bonus-badge">
                  🎁 +{fmt(bonus)} WALLET BUFF
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. FIRST-TIME INITIATION SYSTEM (ONBOARDING) */}
      {showOnboarding && (
        <section className="dash-section">
          <div className="hud-card card-onboarding">
            <div className="hud-card-brackets"></div>
            <div className="hud-header neon-gold-alert">⚙️ SYSTEM COCKPIT PROTOCOLS DEPLOYED</div>
            <div className="onboarding-cockpit">
              <p className="onboarding-welcome-text">
                Welcome, Operator. You have been injected into a live simulated market ecosystem with <b>10,000 AI bots</b>. Complete your initiation checklist to unlock advanced cockpit controls.
              </p>
              
              <div className="onboarding-steps-hud">
                <div className={`ob-step-row ${guideRead ? 'completed' : ''}`}>
                  <div className="ob-step-indicator">{guideRead ? '✓' : '01'}</div>
                  <div className="ob-step-details">
                    <div className="ob-step-title">DECRYPT PILOT MANUAL</div>
                    <div className="ob-step-desc">Scan slides regarding matching engines, locks, and bot profiles.</div>
                  </div>
                  <button className="ob-step-action-btn" onClick={handleReadGuide}>
                    {guideRead ? 'REOPEN MANUAL' : 'INITIALIZE SCAN'}
                  </button>
                </div>

                <div className="ob-step-row">
                  <div className="ob-step-indicator">02</div>
                  <div className="ob-step-details">
                    <div className="ob-step-title">EXECUTE TELEMETRY FIRST TRADE</div>
                    <div className="ob-step-desc">Target <b>NEXA (NexaTech)</b> and deploy a long position to complete the signal lock.</div>
                  </div>
                  <button 
                    className="ob-step-action-btn pulse-glow"
                    onClick={() => navigateToTrade('NEXA', 'stocks')}
                  >
                    🚀 ENGAGE NEXA MATRIX
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. TWO COLUMN MAIN WORLD HUDS */}
      <div className="dash-columns">
        {/* LEFT COLUMN: ACTIVE QUEST LOGS & BROADCASTS */}
        <div className="dash-col-left">
          {/* RPG Quest Journal */}
          <div className="hud-card card-quests">
            <div className="hud-card-brackets"></div>
            <div className="hud-header">🎯 QUEST LOG & BOUNTIES</div>
            <div className="hud-body">
              {daily.length === 0 && weekly.length === 0 ? (
                <div className="hud-telemetry-empty">Awaiting mission dispatch signal...</div>
              ) : (
                <div className="quest-list-hud">
                  {daily.map(m => <QuestRow key={m.def.id} m={m} type="DAILY BOUNTY" />)}
                  {weekly.map(m => <QuestRow key={m.def.id} m={m} type="WEEKLY RAID" />)}
                </div>
              )}
            </div>
          </div>

          {/* Monospace Tactical Wire Broadcast Feed */}
          <div className="hud-card card-news-broadcaster">
            <div className="hud-card-brackets"></div>
            <div className="hud-header">
              <span>📰 ECONOMIC INTELLIGENCE STREAM</span>
              <span className="feed-status blinking">RECEIVING</span>
            </div>
            <div className="hud-body news-cockpit-body">
              {eng.state.events.length === 0 ? (
                <div className="hud-telemetry-empty">Waiting for economic broadcast signals...</div>
              ) : (
                <div className="tactical-wire-list">
                  {eng.state.events.slice(0, 8).map((e, idx) => {
                    const elapsed = Math.floor((Date.now() - e.t) / 1000);
                    const timeStr = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm';
                    return (
                      <div key={idx} className={`wire-card ${e.type}`}>
                        <div className="wire-header">
                          <span className="wire-anomaly-tag">
                            {e.type === 'boom' ? '❇️ MARKET SURGE' : e.type === 'crash' ? '🚨 CRITICAL DEVIATION' : '📡 TELEMETRY'}
                          </span>
                          <span className="wire-time">{timeStr} AGO</span>
                        </div>
                        <div className="wire-title">{e.title}</div>
                        <p className="wire-desc">{e.desc}</p>
                        <div className="wire-foot">
                          {e.cat && <span className="wire-tag">#{e.cat.toUpperCase()}</span>}
                          {e.assetIds && e.assetIds.map(aid => (
                            <span 
                              key={aid} 
                              className="wire-tag target-link"
                              onClick={() => {
                                const def = ASSETS.find(a => a.id === aid);
                                if (def) navigateToTrade(aid, def.market);
                              }}
                            >
                              🚀 LOCK ${aid}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RADAR SCANNERS & ORBITAL SWITCHES */}
        <div className="dash-col-right">
          {/* Orbital Deck Launch Switches (Quick Actions) */}
          <div className="hud-card card-orbital-switches">
            <div className="hud-card-brackets"></div>
            <div className="hud-header">🚀 ORBITAL DECK SWITCHBOARD</div>
            <div className="switches-grid">
              <button className="switch-pod" onClick={() => executeQuickAction('stocks')}>
                <div className="switch-glow text-blue"></div>
                <span className="switch-icon">📈</span>
                <span className="switch-lbl">STOCKS GRID</span>
                <span className="switch-sub-lbl">SECURE LINK</span>
              </button>
              <button className={`switch-pod ${lvl < 20 ? 'switch-locked' : ''}`} onClick={() => executeQuickAction('crypto')}>
                <div className="switch-glow text-purple"></div>
                <span className="switch-icon">{lvl < 20 ? '🔒' : '⚡'}</span>
                <span className="switch-lbl">CRYPTO NEBULA</span>
                <span className="switch-sub-lbl">{lvl < 20 ? 'LVL 20 REQ' : 'ONLINE'}</span>
              </button>
              <button className={`switch-pod ${lvl < 30 ? 'switch-locked' : ''}`} onClick={() => executeQuickAction('forex')}>
                <div className="switch-glow text-gold"></div>
                <span className="switch-icon">{lvl < 30 ? '🔒' : '💱'}</span>
                <span className="switch-lbl">FOREX CROSSWAY</span>
                <span className="switch-sub-lbl">{lvl < 30 ? 'LVL 30 REQ' : 'ONLINE'}</span>
              </button>
              <button className="switch-pod" onClick={() => executeQuickAction('portfolio')}>
                <div className="switch-glow text-green"></div>
                <span className="switch-icon">💼</span>
                <span className="switch-lbl">PORTFOLIO HUD</span>
                <span className="switch-sub-lbl">TELEMETRY</span>
              </button>
              <button className="switch-pod" onClick={() => executeQuickAction('leaderboard')}>
                <div className="switch-glow text-cyan"></div>
                <span className="switch-icon">🏆</span>
                <span className="switch-lbl">ARENA RANKS</span>
                <span className="switch-sub-lbl">GLOBAL LEAGUE</span>
              </button>
            </div>
          </div>

          {/* Active Telemetry Positions */}
          <div className="hud-card card-allocated-holdings">
            <div className="hud-card-brackets"></div>
            <div className="hud-header">🛡️ ACTIVE TELEMETRY HOLDINGS</div>
            <div className="hud-body">
              <div className="allocation-header-hud">
                <div className="alloc-stat">
                  <span className="ash-lbl">UNSECURED P&L</span>
                  <span className={`ash-val ${unrealizedPnL >= 0 ? 'up-glow' : 'dn-glow'}`}>
                    {unrealizedPnL >= 0 ? '+' : ''}{fmt(unrealizedPnL)}
                  </span>
                </div>
                <div className="alloc-stat">
                  <span className="ash-lbl">REALIZED BOUNTY</span>
                  <span className={`ash-val ${realizedPnL >= 0 ? 'up-glow' : 'dn-glow'}`}>
                    {realizedPnL >= 0 ? '+' : ''}{fmt(realizedPnL)}
                  </span>
                </div>
                <div className="alloc-stat">
                  <span className="ash-lbl">ACTIVE SECURE SECTORS</span>
                  <span className="ash-val text-white">{holdingsList.length} TARGETS</span>
                </div>
              </div>

              {holdingsList.length === 0 ? (
                <div className="hud-telemetry-empty">No active telemetry links. Launch to a trading grid to secure capital.</div>
              ) : (
                <div className="allocated-radar-list">
                  {holdingsList.map(h => (
                    <div 
                      key={h.aid} 
                      className="radar-holding-row"
                      onClick={() => navigateToTrade(h.aid, h.market as Market)}
                    >
                      <div className="radar-holding-symbol">
                        <svg className="rhr-icon"><use href={`#${h.icon}`}/></svg>
                        <div>
                          <span className="rhr-id">${h.aid}</span>
                          <span className="rhr-name">{h.name}</span>
                        </div>
                      </div>
                      <div className="radar-holding-qty">
                        <span className="rhr-val">{fmtNum(Math.abs(h.shares))} SH</span>
                        <span className="rhr-side-tag">{h.shares > 0 ? 'LONG POSITION' : 'SHORT POSITION'}</span>
                      </div>
                      <div className="radar-holding-delta">
                        <span className={h.unrealized >= 0 ? 'up-glow' : 'dn-glow'}>
                          {h.unrealized >= 0 ? '+' : ''}{fmt(h.unrealized)}
                        </span>
                        <span className="rhr-alloc-bar-pct">{h.pctAlloc.toFixed(1)}% ALLOC</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sector Volatility Opportunity Radar */}
          <div className="hud-card card-volatility-radar">
            <div className="hud-card-brackets"></div>
            <div className="hud-header radar-header-wrap">
              <span>📡 ACTIVE SECTOR SCANNER</span>
              <div className="radar-filters">
                {(['stocks', 'crypto', 'forex'] as Market[]).map(m => (
                  <button 
                    key={m}
                    className={`radar-filter-btn ${selectedHighlightMarket === m ? 'active' : ''}`}
                    onClick={() => { setSelectedHighlightMarket(m); Audio.click(); }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="hud-body radar-scans-body">
              <div className="radar-grid-wrap">
                {/* Sector Spikes (Gainers) */}
                <div className="radar-sector-group">
                  <div className="radar-sector-title up">📈 SECTOR SPIKES (GAINERS)</div>
                  {topGainers.map(r => (
                    <RadarScanRow key={r.a.id} r={r} lvl={lvl} onClick={() => navigateToTrade(r.a.id, r.a.market)} />
                  ))}
                </div>
                {/* System Crashes (Losers) */}
                <div className="radar-sector-group">
                  <div className="radar-sector-title dn">📉 SYSTEM DEVIATIONS (LOSERS)</div>
                  {topLosers.map(r => (
                    <RadarScanRow key={r.a.id} r={r} lvl={lvl} onClick={() => navigateToTrade(r.a.id, r.a.market)} />
                  ))}
                </div>
                {/* Active Hotspots (Volume) */}
                <div className="radar-sector-group">
                  <div className="radar-sector-title">🔥 DENSITY HOTSPOTS (VOLUME)</div>
                  {mostActive.map(r => (
                    <RadarScanRow key={r.a.id} r={r} lvl={lvl} showVol={true} onClick={() => navigateToTrade(r.a.id, r.a.market)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Arena Leaderboard Lobby */}
          <div className="hud-card card-leaderboard-arena">
            <div className="hud-card-brackets"></div>
            <div className="hud-header">🏆 ARENA COMBAT RANKS</div>
            <div className="hud-body">
              <div className="arena-leaderboard-list">
                {leaderboard.slice(0, 5).map((l, idx) => {
                  const targetGap = net - l.net;
                  const isPlayerLeading = targetGap > 0;
                  return (
                    <div 
                      key={l.id} 
                      className={`arena-row ${l.isPlayer ? 'player-active' : ''}`}
                    >
                      <div className="arena-rank">#{idx + 1}</div>
                      <div className="arena-challenger">
                        <span className="challenger-name">{l.name} {l.isPlayer && '🧑‍🚀 (YOU)'}</span>
                        <span className="challenger-archetype">{l.strat.toUpperCase()} TARGET</span>
                      </div>
                      <div className="arena-score">
                        <span className="challenger-wealth">{fmt(l.net)}</span>
                        {!l.isPlayer && (
                          <span className={`challenger-gap ${isPlayerLeading ? 'up' : 'dn'}`}>
                            {isPlayerLeading ? `+${fmt(Math.abs(targetGap))}` : `-${fmt(Math.abs(targetGap))}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Player details if outside top 5 */}
                {rank > 5 && (
                  <div className="arena-row player-active offset-arena-row">
                    <div className="arena-rank">#{rank}</div>
                    <div className="arena-challenger">
                      <span className="challenger-name">{p.name || 'Trader'} 🧑‍🚀 (YOU)</span>
                      <span className="challenger-archetype">OPERATOR</span>
                    </div>
                    <div className="arena-score">
                      <span className="challenger-wealth">{fmt(net)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SYSTEM PROTOCOLS MANUAL MODAL */}
      {showGuide && (
        <div className="guide-modal-backdrop" onClick={handleCloseGuide}>
          <div className="guide-modal" onClick={e => e.stopPropagation()}>
            <div className="gm-header">
              <h3>SYSTEM COCKPIT PROTOCOLS</h3>
              <button className="gm-close" onClick={handleCloseGuide}>×</button>
            </div>
            <div className="gm-body">
              {guideSlide === 0 && (
                <div className="gm-slide">
                  <h4>Slide 1 // Injection Parameters</h4>
                  <div className="guide-illustration">🧑‍🚀</div>
                  <p>You have been authenticated as a pilot in the <b>MarketVerseX High-Frequency Matrix</b>. You start with <b>$1,000</b> of simulation credits.</p>
                  <p>Operating in this environment are <b>10,000 AI bots</b>. They trade with realistic behavioral profiles: some are volatile retail speculators (YOLO, FOMO, Gambler), while others are cold-blooded institutions (Value, Trend, Market Makers).</p>
                  <p>Your objective is to accumulate net worth and out-trade them to reach the top of the global leaderboard.</p>
                </div>
              )}
              {guideSlide === 1 && (
                <div className="gm-slide">
                  <h4>Slide 2 // Direct Matching Engine Telemetry</h4>
                  <div className="guide-illustration">📊</div>
                  <p>All assets are driven by a <b>live order matching engine</b>. The bids and asks you see are real limits resting in the order book. When you place a buy or sell order, you are trading directly against AI bots or placing orders for them to trade against.</p>
                  <p>• <b>Market (MKT)</b> orders instantly sweep resting liquidity on the books.</p>
                  <p>• <b>Limit (LMT)</b> orders place resting bids/asks in the books that await execution.</p>
                  <p>• Positions can be managed and closed at any time from the <b>Positions</b> panel.</p>
                </div>
              )}
              {guideSlide === 2 && (
                <div className="gm-slide">
                  <h4>Slide 3 // Progressive Subsystem Unlocks</h4>
                  <div className="guide-illustration">🔒</div>
                  <p>To prevent system overload, advanced trading parameters are locked behind level milestones. Accumulate XP from closed trades to unlock them:</p>
                  <ul className="guide-list">
                    <li><b>Level 1:</b> Basic Stocks Market Trading</li>
                    <li><b>Level 5:</b> Limit (LMT) resting orders</li>
                    <li><b>Level 10:</b> Short Selling (opening short positions)</li>
                    <li><b>Level 20:</b> Crypto Markets (Meme Coins unlock at L50)</li>
                    <li><b>Level 30:</b> Forex Majors & Crosses</li>
                  </ul>
                </div>
              )}
              {guideSlide === 3 && (
                <div className="gm-slide">
                  <h4>Slide 4 // Risk Control Mechanisms</h4>
                  <div className="guide-illustration">🛡️</div>
                  <p>When executing trades, you can configure safety triggers:</p>
                  <p>• <b>Stop Loss (SL %):</b> Automatically closes your position if the price moves against you by the specified percentage.</p>
                  <p>• <b>Take Profit (TP %):</b> Automatically locks in gains when your target target-profit percentage is touched.</p>
                  <p>AI bot profiles evolve dynamically; bots that win become aggressive whales, whereas losing bots become risk-averse paper hands.</p>
                </div>
              )}
            </div>
            <div className="gm-footer">
              <div className="gm-dots">
                {[0, 1, 2, 3].map(i => (
                  <span 
                    key={i} 
                    className={`gm-dot ${guideSlide === i ? 'on' : ''}`}
                    onClick={() => { setGuideSlide(i); Audio.click(); }}
                  />
                ))}
              </div>
              <div className="gm-nav-buttons">
                {guideSlide > 0 && (
                  <button className="gm-btn secondary" onClick={() => { setGuideSlide(s => s - 1); Audio.click(); }}>Back</button>
                )}
                {guideSlide < 3 ? (
                  <button className="gm-btn" onClick={() => { setGuideSlide(s => s + 1); Audio.click(); }}>Next</button>
                ) : (
                  <button className="gm-btn success" onClick={handleCloseGuide}>Initiate Cockpit</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents
function QuestRow({ m, type }: { m: MissionState; type: string }) {
  const pct = Math.min(100, (m.progress / m.def.goal.target) * 100);
  const progressText = formatProgress(m);

  return (
    <div className={`quest-row-item ${m.completed ? 'completed' : ''} ${m.claimed ? 'claimed' : ''}`}>
      <div className="qri-head">
        <span className={`qri-badge ${type === 'DAILY BOUNTY' ? 'daily' : 'weekly'}`}>{type}</span>
        <span className="qri-reward">📦 LOOT CHEST (${m.def.reward})</span>
      </div>
      <div className="qri-details">
        <div className="qri-title">{m.def.title}</div>
        <p className="qri-desc">{m.def.desc}</p>
        <div className="qri-prog-container">
          <div className="qri-bar-outer">
            <div className="qri-bar-inner" style={{ width: `${pct}%` }} />
          </div>
          <span className="qri-text">{progressText}</span>
        </div>
      </div>
      <div className="qri-claim-zone">
        {m.claimed ? (
          <span className="claimed-badge">EXTRACTED</span>
        ) : m.completed ? (
          <button 
            className="loot-extract-btn"
            onClick={() => {
              send({ type: 'claimMission', payload: { missionId: m.def.id } });
              Audio.click();
            }}
          >
            🔓 EXTRACT BOUNTY
          </button>
        ) : (
          <span className="pct-badge">{Math.floor(pct)}% TACTICAL</span>
        )}
      </div>
    </div>
  );
}

function RadarScanRow({ r, lvl, showVol = false, onClick }: any) {
  const locked = r.a.minLevel > lvl;
  const changeClass = r.chg >= 0 ? 'up' : 'dn';
  
  return (
    <div 
      className={`radar-scan-row ${locked ? 'locked' : ''}`}
      onClick={() => { if (!locked) onClick(); }}
    >
      <div className="rsr-sym-group">
        <svg className="rsr-icon"><use href={`#${r.a.icon}`}/></svg>
        <div>
          <span className="rsr-id">${r.a.id}</span>
          <span className="rsr-sector">#{r.a.cat.toUpperCase()}</span>
        </div>
      </div>
      
      <div className="rsr-data-group">
        {locked ? (
          <span className="rsr-lock-signal">🔒 LOCKED L{r.a.minLevel}</span>
        ) : (
          <>
            <span className="rsr-price">${fmt(r.ast.lastPrice, r.ast.lastPrice < 10 ? 3 : 2)}</span>
            {showVol ? (
              <span className="rsr-vol">{fmtNum(r.ast.volume)} INTENSITY</span>
            ) : (
              <span className={`rsr-chg ${changeClass}`}>{r.chg >= 0 ? '▲' : '▼'} {fmtPct(r.chg)}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatProgress(m: MissionState): string {
  const g = m.def.goal;
  switch (g.kind) {
    case 'trades':       return `${Math.floor(m.progress)} / ${g.target} transactions`;
    case 'profitable':   return `${Math.floor(m.progress)} / ${g.target} signals locked`;
    case 'distinct':     return `${Math.floor(m.progress)} / ${g.target} sectors hit`;
    case 'portfolioPct': return `${m.progress.toFixed(2)}% / ${g.target}% quota`;
    case 'holdHours':    return `${m.progress.toFixed(2)}h / ${g.target}h hold`;
  }
}
