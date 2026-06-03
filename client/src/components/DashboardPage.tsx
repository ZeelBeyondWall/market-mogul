import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { fmt, fmtPct, fmtNum } from '../../../shared/engine/helpers';
import { ASSETS, MARKET_LABELS } from '../../../shared/engine/constants';
import type { Market, MissionState, Trade } from '../../../shared/engine/types';
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
        useGame.getState().pushToast('Crypto unlocks at Level 20', 'err');
        Audio.click();
        return;
      }
      setActiveMarket('crypto');
      setActiveScreen('trading');
    } else if (action === 'forex') {
      if (lvl < 30) {
        useGame.getState().pushToast('Forex unlocks at Level 30', 'err');
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
      {/* 1. PLAYER OVERVIEW SUMMARY BAR */}
      <section className="dash-section dash-summary-grid">
        {/* Wealth Card */}
        <div className="dash-card card-wealth">
          <div className="dc-header">💎 NET WORTH & FUNDS</div>
          <div className="dc-body">
            <div className="wealth-net">
              <AnimatedNumber value={net} format={n => fmt(n)} className="w-val" />
              <span className="w-lbl">NET WORTH</span>
            </div>
            <div className="wealth-sub">
              <div className="ws-item">
                <span className="ws-lbl">⚙ CASH</span>
                <span className="ws-val"><AnimatedNumber value={cash} format={n => fmt(n)} /></span>
              </div>
              <div className="ws-item">
                <span className="ws-lbl">🛡 HOLDINGS</span>
                <span className="ws-val"><AnimatedNumber value={port} format={n => fmt(n)} /></span>
              </div>
              {bonus > 0 && (
                <div className="ws-item bonus">
                  <span className="ws-lbl">🎁 BONUS</span>
                  <span className="ws-val"><AnimatedNumber value={bonus} format={n => fmt(n)} /></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* P&L / Growth Card */}
        <div className="dash-card card-pnl">
          <div className="dc-header">⚡ PERFORMANCE TODAY</div>
          <div className="dc-body pnl-body">
            <div className={`pnl-total ${todayPnL >= 0 ? 'up' : 'dn'}`}>
              <span className="pnl-sign">{todayPnL >= 0 ? '+' : ''}</span>
              <AnimatedNumber value={todayPnL} format={n => fmt(Math.abs(n))} className="pnl-val" />
            </div>
            <div className={`pnl-pct ${todayPnL >= 0 ? 'up' : 'dn'}`}>
              {todayPnL >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(todayPnLPct))} TODAY
            </div>
            <div className="pnl-streak-row">
              <div className="streak-badge">🔥 {streak ? `${streak}D STREAK` : '1D STREAK'}</div>
              <span className="streak-reset">Resets UTC 00:00</span>
            </div>
          </div>
        </div>

        {/* Progression / Rank Card */}
        <div className="dash-card card-prog">
          <div className="dc-header">⭐ SYSTEM RANKING</div>
          <div className="dc-body prog-body">
            <div className="rank-value">
              <span className="rank-lbl">RANK</span>
              <span className="rank-num">#{rank}</span>
              <span className="rank-total">/ {total || '10,000'}</span>
            </div>
            
            <div className="lvl-progress-container">
              <div className="lvl-labels">
                <span className="lvl-text">LEVEL {lvl}</span>
                <span className="lvl-xp-text">{xp - xpAt} / {xpTo - xpAt} XP</span>
              </div>
              <div className="lvl-bar-outer">
                <div className="lvl-bar-inner" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FIRST-TIME ONBOARDING (CHECKLIST) */}
      {showOnboarding && (
        <section className="dash-section">
          <div className="dash-card card-onboarding">
            <div className="dc-header neon-alert">💼 BEGINNER COCKPIT INITIATION</div>
            <div className="dc-body onboarding-body">
              <div className="ob-welcome">
                <h4>Welcome to the MarketVerse pilot program!</h4>
                <p>Before you are allowed to deploy advanced algorithms, you must complete your initial cockpit training.</p>
              </div>
              
              <div className="ob-checklist">
                <div className={`ob-item ${guideRead ? 'checked' : ''}`}>
                  <div className="ob-circle">{guideRead ? '✓' : '1'}</div>
                  <div className="ob-details">
                    <div className="ob-t">Review Cockpit System Guide</div>
                    <div className="ob-d">Learn matches, SL/TP locks, and mechanics.</div>
                    <button className="ob-btn" onClick={handleReadGuide}>
                      {guideRead ? 'Reopen Guide' : 'Read Guide'}
                    </button>
                  </div>
                </div>

                <div className="ob-item">
                  <div className="ob-circle">2</div>
                  <div className="ob-details">
                    <div className="ob-t">Execute Suggested First Trade</div>
                    <div className="ob-d">Open a long position on <b>NEXA (NexaTech)</b> to initialize your telemetry.</div>
                    <button 
                      className="ob-btn pulse"
                      onClick={() => navigateToTrade('NEXA', 'stocks')}
                    >
                      🚀 Trade NEXA Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. TWO COLUMN MAIN AREA */}
      <div className="dash-columns">
        {/* LEFT COLUMN: OBJECTIVES & NEWS */}
        <div className="dash-col-left">
          {/* Daily & Weekly Objectives */}
          <div className="dash-card">
            <div className="dc-header">🎯 MISSIONS & CHALLENGES</div>
            <div className="dc-body">
              {daily.length === 0 && weekly.length === 0 ? (
                <div className="ob-empty">Missions loading from match server...</div>
              ) : (
                <div className="dash-missions-list">
                  {daily.map(m => <MissionRow key={m.def.id} m={m} type="DAILY" />)}
                  {weekly.map(m => <MissionRow key={m.def.id} m={m} type="WEEKLY" />)}
                </div>
              )}
            </div>
          </div>

          {/* Market News Feed */}
          <div className="dash-card">
            <div className="dc-header">📰 LIVE TERMINAL WIRE FEED</div>
            <div className="dc-body dash-news-body">
              {eng.state.events.length === 0 ? (
                <div className="ob-empty">Waiting for economic broadcasts...</div>
              ) : (
                <div className="dash-events-list">
                  {eng.state.events.slice(0, 8).map((e, idx) => {
                    const elapsed = Math.floor((Date.now() - e.t) / 1000);
                    const timeStr = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm';
                    return (
                      <div key={idx} className={`dash-event-card ${e.type}`}>
                        <div className="dec-head">
                          <span className="dec-title">{e.title}</span>
                          <span className="dec-time">{timeStr} ago</span>
                        </div>
                        <p className="dec-desc">{e.desc}</p>
                        <div className="dec-tags">
                          {e.cat && <span className="dec-tag">#{e.cat}</span>}
                          {e.assetIds && e.assetIds.map(aid => (
                            <span 
                              key={aid} 
                              className="dec-tag clickable"
                              onClick={() => {
                                const def = ASSETS.find(a => a.id === aid);
                                if (def) navigateToTrade(aid, def.market);
                              }}
                            >
                              ${aid}
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

        {/* RIGHT COLUMN: MARKET HIGHLIGHTS & PORTFOLIO */}
        <div className="dash-col-right">
          {/* Quick Action Navigation */}
          <div className="dash-card card-quick-actions">
            <div className="dc-header">⚡ QUICK LAUNCH SYSTEM</div>
            <div className="dc-body quick-actions-body">
              <button className="qa-btn" onClick={() => executeQuickAction('stocks')}>
                <span className="qa-icon">📈</span>
                <span className="qa-lbl">STOCKS</span>
                <span className="qa-sub">Lvl 1+</span>
              </button>
              <button className={`qa-btn ${lvl < 20 ? 'locked' : ''}`} onClick={() => executeQuickAction('crypto')}>
                <span className="qa-icon">{lvl < 20 ? '🔒' : '⚡'}</span>
                <span className="qa-lbl">CRYPTO</span>
                <span className="qa-sub">{lvl < 20 ? 'Lvl 20' : 'Open'}</span>
              </button>
              <button className={`qa-btn ${lvl < 30 ? 'locked' : ''}`} onClick={() => executeQuickAction('forex')}>
                <span className="qa-icon">{lvl < 30 ? '🔒' : '💱'}</span>
                <span className="qa-lbl">FOREX</span>
                <span className="qa-sub">{lvl < 30 ? 'Lvl 30' : 'Open'}</span>
              </button>
              <button className="qa-btn" onClick={() => executeQuickAction('portfolio')}>
                <span className="qa-icon">💼</span>
                <span className="qa-lbl">PORTFOLIO</span>
                <span className="qa-sub">Positions</span>
              </button>
              <button className="qa-btn" onClick={() => executeQuickAction('leaderboard')}>
                <span className="qa-icon">🏆</span>
                <span className="qa-lbl">LEADERBOARD</span>
                <span className="qa-sub">Rankings</span>
              </button>
            </div>
          </div>

          {/* Portfolio Allocations */}
          <div className="dash-card">
            <div className="dc-header">💼 PORTFOLIO ALLOCATION SUMMARY</div>
            <div className="dc-body">
              <div className="portfolio-stats-row">
                <div className="ps-card">
                  <span className="ps-lbl">UNREALIZED P&L</span>
                  <b className={`ps-val ${unrealizedPnL >= 0 ? 'up' : 'dn'}`}>
                    {unrealizedPnL >= 0 ? '+' : ''}{fmt(unrealizedPnL)}
                  </b>
                </div>
                <div className="ps-card">
                  <span className="ps-lbl">REALIZED P&L</span>
                  <b className={`ps-val ${realizedPnL >= 0 ? 'up' : 'dn'}`}>
                    {realizedPnL >= 0 ? '+' : ''}{fmt(realizedPnL)}
                  </b>
                </div>
                <div className="ps-card">
                  <span className="ps-lbl">ACTIVE HOLDS</span>
                  <b className="ps-val">{holdingsList.length} assets</b>
                </div>
              </div>

              {holdingsList.length === 0 ? (
                <div className="ob-empty">No active positions. Execute a trade to allocate capital.</div>
              ) : (
                <div className="dash-holdings-list">
                  {holdingsList.map(h => (
                    <div 
                      key={h.aid} 
                      className="dash-holding-row"
                      onClick={() => navigateToTrade(h.aid, h.market as Market)}
                    >
                      <div className="dhr-sym">
                        <svg className="dhr-icon"><use href={`#${h.icon}`}/></svg>
                        <div>
                          <div className="dhr-id">{h.aid}</div>
                          <div className="dhr-name">{h.name}</div>
                        </div>
                      </div>
                      <div className="dhr-qty">
                        <div><b>{fmtNum(Math.abs(h.shares))}</b> sh</div>
                        <div className="dhr-side">{h.shares > 0 ? 'LONG' : 'SHORT'}</div>
                      </div>
                      <div className="dhr-pnl">
                        <span className={h.unrealized >= 0 ? 'up' : 'dn'}>
                          {h.unrealized >= 0 ? '+' : ''}{fmt(h.unrealized)}
                        </span>
                        <div className="dhr-alloc">{h.pctAlloc.toFixed(1)}% alloc</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Market Highlights */}
          <div className="dash-card">
            <div className="dc-header mhighlights-head">
              <span>🔥 MARKET HIGHLIGHTS</span>
              <div className="mh-tabs">
                {(['stocks', 'crypto', 'forex'] as Market[]).map(m => (
                  <button 
                    key={m}
                    className={`mh-tab-btn ${selectedHighlightMarket === m ? 'on' : ''}`}
                    onClick={() => { setSelectedHighlightMarket(m); Audio.click(); }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="dc-body highlights-body">
              <div className="highlight-column-wrap">
                {/* Gainers */}
                <div className="hl-group">
                  <div className="hl-g-title up">📈 TOP GAINERS</div>
                  {topGainers.map(r => (
                    <HighlightRow key={r.a.id} r={r} lvl={lvl} onClick={() => navigateToTrade(r.a.id, r.a.market)} />
                  ))}
                </div>
                {/* Losers */}
                <div className="hl-group">
                  <div className="hl-g-title dn">📉 TOP LOSERS</div>
                  {topLosers.map(r => (
                    <HighlightRow key={r.a.id} r={r} lvl={lvl} onClick={() => navigateToTrade(r.a.id, r.a.market)} />
                  ))}
                </div>
                {/* Most Active */}
                <div className="hl-group">
                  <div className="hl-g-title">🔥 MOST ACTIVE</div>
                  {mostActive.map(r => (
                    <HighlightRow key={r.a.id} r={r} lvl={lvl} showVol={true} onClick={() => navigateToTrade(r.a.id, r.a.market)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard Preview */}
          <div className="dash-card">
            <div className="dc-header">🏆 LEADERBOARD RANKINGS</div>
            <div className="dc-body">
              <div className="dash-leaderboard-list">
                {leaderboard.slice(0, 5).map((l, idx) => (
                  <div 
                    key={l.id} 
                    className={`dash-leaderboard-row ${l.isPlayer ? 'player-row' : ''}`}
                  >
                    <span className="dlr-rank">#{idx + 1}</span>
                    <div className="dlr-details">
                      <span className="dlr-name">{l.name} {l.isPlayer && '🧑‍🚀 (YOU)'}</span>
                      <span className="dlr-strat">{l.strat.toUpperCase()}</span>
                    </div>
                    <b className="dlr-net">{fmt(l.net)}</b>
                  </div>
                ))}
                
                {/* Player Row if not in top 5 */}
                {rank > 5 && (
                  <div className="dash-leaderboard-row player-row offset-row">
                    <span className="dlr-rank">#{rank}</span>
                    <div className="dlr-details">
                      <span className="dlr-name">{p.name || 'Trader'} 🧑‍🚀 (YOU)</span>
                      <span className="dlr-strat">PLAYER</span>
                    </div>
                    <b className="dlr-net">{fmt(net)}</b>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SYSTEM GUIDE MODAL OVERLAY */}
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
                  <h4>Slide 1 // Pilot Program Overview</h4>
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
function MissionRow({ m, type }: { m: MissionState; type: string }) {
  const pct = Math.min(100, (m.progress / m.def.goal.target) * 100);
  const progressText = formatProgress(m);

  return (
    <div className={`dash-mission-row ${m.completed ? 'completed' : ''} ${m.claimed ? 'claimed' : ''}`}>
      <div className="dmr-main">
        <div className="dmr-badge">{type}</div>
        <div className="dmr-details">
          <div className="dmr-title">{m.def.title}</div>
          <div className="dmr-desc">{m.def.desc}</div>
          <div className="dmr-prog-row">
            <div className="dmr-bar-outer">
              <div className="dmr-bar-inner" style={{ width: `${pct}%` }} />
            </div>
            <span className="dmr-text">{progressText}</span>
          </div>
        </div>
      </div>
      <div className="dmr-action">
        {m.claimed ? (
          <span className="claimed-lbl">CLAIMED</span>
        ) : m.completed ? (
          <button 
            className="claim-btn"
            onClick={() => {
              send({ type: 'claimMission', payload: { missionId: m.def.id } });
              Audio.click();
            }}
          >
            CLAIM ${m.def.reward}
          </button>
        ) : (
          <span className="pending-pct">{Math.floor(pct)}%</span>
        )}
      </div>
    </div>
  );
}

function HighlightRow({ r, lvl, showVol = false, onClick }: any) {
  const locked = r.a.minLevel > lvl;
  const changeClass = r.chg >= 0 ? 'up' : 'dn';
  
  return (
    <div 
      className={`dash-highlight-row ${locked ? 'locked' : ''}`}
      onClick={() => { if (!locked) onClick(); }}
    >
      <div className="dhr-sym-group">
        <svg className="dhr-icon"><use href={`#${r.a.icon}`}/></svg>
        <div>
          <span className="dhr-id">{r.a.id}</span>
          {locked && <span className="dhr-lock">🔒L{r.a.minLevel}</span>}
        </div>
      </div>
      <div className="dhr-data-group">
        <span className="dhr-price">${fmt(r.ast.lastPrice, r.ast.lastPrice < 10 ? 3 : 2)}</span>
        {showVol ? (
          <span className="dhr-vol">V: {fmtNum(r.ast.volume)}</span>
        ) : (
          <span className={`dhr-chg ${changeClass}`}>{r.chg >= 0 ? '▲' : '▼'} {fmtPct(r.chg)}</span>
        )}
      </div>
    </div>
  );
}

function formatProgress(m: MissionState): string {
  const g = m.def.goal;
  switch (g.kind) {
    case 'trades':       return `${Math.floor(m.progress)} / ${g.target} trades`;
    case 'profitable':   return `${Math.floor(m.progress)} / ${g.target} winners`;
    case 'distinct':     return `${Math.floor(m.progress)} / ${g.target} assets`;
    case 'portfolioPct': return `${m.progress.toFixed(2)}% / ${g.target}%`;
    case 'holdHours':    return `${m.progress.toFixed(2)}h / ${g.target}h`;
  }
}
