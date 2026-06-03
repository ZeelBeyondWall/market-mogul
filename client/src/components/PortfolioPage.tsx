import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { fmt, fmtPct, fmtNum } from '../../../shared/engine/helpers';
import { ASSETS } from '../../../shared/engine/constants';
import { Audio } from '../audio/audio';
import { AnimatedNumber } from './AnimatedNumber';
import './Pages.css';

export function PortfolioPage() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  
  const rank = useGame(s => s.playerRank);
  const total = useGame(s => s.totalTraders);
  const lvl = useGame(s => s.playerLevel);
  const xp = useGame(s => s.playerXp);
  const xpAt = useGame(s => s.xpAtCurrent);
  const xpTo = useGame(s => s.xpToNext);
  const streak = useGame(s => s.playerStreak);
  const playerStats = useGame(s => s.playerStats);
  const session = useGame(s => s.session);
  const pushToast = useGame(s => s.pushToast);
  const setActiveMarket = useGame(s => s.setActiveMarket);
  const setActiveScreen = useGame(s => s.setActiveScreen);
  const setActiveAsset = useGame(s => s.setActive);
  const setActiveTab = useGame(s => s.setActiveTab);

  const p = eng.player();
  const cash = eng.displayCash();
  const port = eng.displayPortfolioValue();
  const net = eng.netWorth();

  // Today's P&L
  const dayStartNet = p.dayStartNet || 10000;
  const todayPnL = net - dayStartNet;
  const todayPnLPct = (todayPnL / dayStartNet) * 100;
  const xpProgress = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';

  // Sub-sections State
  const [activeTf, setActiveTf] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1D');
  const [activeHoldingsTab, setActiveHoldingsTab] = useState<'ALL' | 'STOCKS' | 'CRYPTO' | 'FOREX' | 'COMMODITIES' | 'CASH'>('ALL');
  const [claimTimer, setClaimTimer] = useState('12H : 35M : 21S');
  const [isHoveredChart, setIsHoveredChart] = useState(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{ val: number; date: string } | null>(null);

  // Countdown timer for reward
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diffMs = midnight.getTime() - now.getTime();
      const hours = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
      const minutes = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
      setClaimTimer(`${hours}H : ${minutes}M : ${seconds}S`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClaimReward = () => {
    Audio.click();
    pushToast(`Daily Chest opened! Streak: ${streak || 1} Days. You claimed +$${(streak || 1) * 100} cash reward!`, 'ok');
  };

  // Compile holdings list
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
      const unrealizedPct = (unrealized / (Math.abs(h.shares) * h.avgCost)) * 100;
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
        unrealizedPct,
        chg: ((astState.lastPrice - astState.open) / (astState.open || 1)) * 100
      };
    })
    .filter(Boolean) as any[];

  // Allocation categories logic
  const assetClasses: Record<string, { label: string; val: number; color: string; pct: number }> = {
    stocks: { label: 'Stocks', val: 0, color: '#7C5CFF', pct: 0 },
    crypto: { label: 'Crypto', val: 0, color: '#D946EF', pct: 0 },
    forex: { label: 'Forex', val: 0, color: '#06B6D4', pct: 0 },
    commodity: { label: 'Commodities', val: 0, color: '#F59E0B', pct: 0 },
    cash: { label: 'Cash', val: cash, color: '#22C55E', pct: 0 }
  };

  holdingsList.forEach(h => {
    const market = h.market;
    if (assetClasses[market]) {
      assetClasses[market].val += h.val;
    } else if (h.cat === 'commodity' && assetClasses.commodity) {
      assetClasses.commodity.val += h.val;
    } else if (assetClasses.stocks) {
      assetClasses.stocks.val += h.val;
    }
  });

  const totalValue = port + cash;
  Object.keys(assetClasses).forEach(k => {
    assetClasses[k].pct = totalValue > 0 ? (assetClasses[k].val / totalValue) * 100 : 0;
  });

  const activeAllocations = Object.values(assetClasses)
    .filter(c => c.val > 0)
    .sort((a, b) => b.val - a.val);

  // Generate chart data based on selected filter
  const generateChartPoints = () => {
    // Generate a beautiful consistent wavy chart curve ending at current net worth
    const pointsCount = 60;
    const seed = net;
    const list: number[] = [];
    let cur = dayStartNet;
    const step = (net - dayStartNet) / pointsCount;
    for (let i = 0; i < pointsCount; i++) {
      // Add nice sine waves & random walk fluctuations
      const factor = Math.sin((i / 5) * Math.PI) * (net * 0.04);
      const walk = (Math.sin(i / 1.5) * 0.5 + Math.cos(i / 3) * 0.5) * (net * 0.02);
      const trend = cur + step * i;
      list.push(Math.max(net * 0.2, trend + factor + walk));
    }
    list[pointsCount - 1] = net; // lock end point to current net worth
    return list;
  };

  const chartPoints = generateChartPoints();

  // Holdings table filter
  const filteredHoldings = holdingsList.filter(h => {
    if (activeHoldingsTab === 'ALL') return true;
    if (activeHoldingsTab === 'STOCKS') return h.market === 'stocks';
    if (activeHoldingsTab === 'CRYPTO') return h.market === 'crypto';
    if (activeHoldingsTab === 'FOREX') return h.market === 'forex';
    if (activeHoldingsTab === 'COMMODITIES') return h.cat === 'commodity';
    return false;
  });

  // Recent activity logs
  const activityLogs = p.playerTrades ? p.playerTrades.slice(-6).reverse() : [];

  const handleNavigateToAsset = (aid: string, market: any) => {
    setActiveAsset(aid);
    setActiveMarket(market);
    setActiveScreen('trading');
    setActiveTab('positions');
    Audio.click();
  };

  // Donut chart SVG rendering path helper
  const renderDonutChart = () => {
    const size = 140;
    const center = size / 2;
    const radius = 50;
    const strokeWidth = 14;
    const circ = 2 * Math.PI * radius;
    let accumulatedAngle = -90; // start at top

    if (activeAllocations.length === 0) {
      return (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />
      );
    }

    return activeAllocations.map((alloc, idx) => {
      const pct = alloc.pct;
      const strokeDash = (pct / 100) * circ;
      const strokeOffset = circ - strokeDash;
      const rotation = accumulatedAngle;
      accumulatedAngle += (pct / 100) * 360;

      return (
        <circle
          key={idx}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={alloc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${strokeDash} ${circ}`}
          strokeDashoffset={strokeOffset}
          transform={`rotate(${rotation} ${center} ${center})`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      );
    });
  };

  // Interactive Chart Tooltip Hover Handlers
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const index = Math.min(
      chartPoints.length - 1,
      Math.max(0, Math.floor((x / width) * chartPoints.length))
    );
    const val = chartPoints[index];
    
    // Generate mock timestamp
    const baseHour = 24 / chartPoints.length;
    const totalHour = index * baseHour;
    const ampm = totalHour >= 12 ? 'PM' : 'AM';
    const dispHour = Math.floor(totalHour % 12 === 0 ? 12 : totalHour % 12);
    const dispMin = String(Math.floor((totalHour % 1) * 60)).padStart(2, '0');
    
    setHoveredDataPoint({
      val,
      date: `May 20, ${dispHour}:${dispMin} ${ampm}`
    });
    setIsHoveredChart(true);
  };

  return (
    <div className="page-container">
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="page-sidebar">
        
        {/* Level card */}
        <div className="lvl-card mmo-card">
          <div className="lvl-badge-wrap">
            <span className="lvl-badge-icon">⭐</span>
          </div>
          <div className="lvl-progress-area">
            <span className="lvl-text">LEVEL</span>
            <div className="lvl-num">{lvl}</div>
            <div className="lvl-xp-bar-bg">
              <div className="lvl-xp-bar-fill" style={{ width: `${xpProgress}%` }}></div>
            </div>
            <div className="lvl-xp-text">XP {xp - xpAt} / {xpTo - xpAt}</div>
          </div>
        </div>

        {/* Rank card */}
        <div className="stat-pill-card mmo-card">
          <div className="stat-card-left">
            <div className="stat-icon-wrap icon-purple-bg">🏆</div>
            <div className="stat-card-details">
              <span className="stat-label">RANK</span>
              <span className="rank-val">#{rank || 247}</span>
            </div>
          </div>
          <span className="rank-pct">TOP 2%</span>
        </div>

        {/* Cash Balance */}
        <div className="stat-pill-card mmo-card">
          <div className="stat-card-left">
            <div className="stat-icon-wrap icon-green-bg">💵</div>
            <div className="stat-card-details">
              <span className="stat-label">CASH BALANCE</span>
              <span className="stat-val-large">{fmt(cash)}</span>
            </div>
          </div>
        </div>

        {/* Net Worth */}
        <div className="stat-pill-card mmo-card">
          <div className="stat-card-left">
            <div className="stat-icon-wrap icon-blue-bg">💎</div>
            <div className="stat-card-details">
              <span className="stat-label">NET WORTH</span>
              <span className="stat-val-large">{fmt(net)}</span>
            </div>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="stat-pill-card mmo-card">
          <div className="stat-card-left">
            <div className="stat-icon-wrap icon-green-bg">📈</div>
            <div className="stat-card-details">
              <span className="stat-label">TODAY'S PROFIT</span>
              <span className="stat-val-large" style={{ color: todayPnL >= 0 ? '#22C55E' : '#EF4444' }}>
                {todayPnL >= 0 ? '+' : ''}{fmt(todayPnL)}
              </span>
            </div>
          </div>
          <span className={todayPnLPct >= 0 ? 'stat-subtext-green' : 'stat-subtext-red'}>
            {todayPnLPct >= 0 ? '▲' : '▼'} {Math.abs(todayPnLPct).toFixed(2)}%
          </span>
        </div>

        {/* Daily Reward countdown chest */}
        <div className="daily-reward-card mmo-card">
          <div className="daily-title">DAILY REWARD</div>
          <div className="daily-timer">Next reward in: {claimTimer}</div>
          <span className="daily-chest-img" style={{ fontSize: '48px' }}>🎁</span>
          <button className="daily-btn" onClick={handleClaimReward}>CLAIM REWARD</button>
        </div>

        {/* Streak card */}
        <div className="streak-card mmo-card">
          <div className="streak-row">
            <div className="streak-details">
              <span className="stat-label">STREAK</span>
              <span className="stat-val-large" style={{ color: '#EF4444' }}>{streak || 7} DAYS</span>
            </div>
            <div className="stat-icon-wrap" style={{ fontSize: '24px' }}>🔥</div>
          </div>
          <div className="streak-dots-row">
            {Array.from({ length: 7 }).map((_, idx) => (
              <span 
                key={idx} 
                className={`streak-dot ${idx < (streak || 7) ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* ================= CENTER MAIN SECTION ================= */}
      <main className="page-main-content">
        
        {/* PORTFOLIO OVERVIEW */}
        <section className="mmo-card">
          <div className="portfolio-header-row">
            <div className="portfolio-title-wrap">
              <h2 className="stat-label" style={{ fontSize: '12px' }}>PORTFOLIO OVERVIEW</h2>
              <button className="eye-btn" title="Toggle visibility">👁</button>
            </div>
            <div className="time-filters">
              {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const).map(tf => (
                <button
                  key={tf}
                  className={`tf-pill ${activeTf === tf ? 'active' : ''}`}
                  onClick={() => { Audio.click(); setActiveTf(tf); }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="portfolio-value-main">
            {isHoveredChart && hoveredDataPoint ? fmt(hoveredDataPoint.val) : fmt(net)}
          </div>
          <div className="portfolio-change-sub" style={{ color: todayPnL >= 0 ? '#22C55E' : '#EF4444' }}>
            <span>{todayPnL >= 0 ? '▲' : '▼'} {fmt(Math.abs(todayPnL))} ({Math.abs(todayPnLPct).toFixed(2)}%) Today</span>
            <span style={{ color: 'var(--dim)', marginLeft: '10px', fontWeight: 'normal' }}>
              {isHoveredChart && hoveredDataPoint ? hoveredDataPoint.date : 'Live net worth'}
            </span>
          </div>

          {/* Line Chart */}
          <div className="portfolio-chart-container">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 500 200"
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setIsHoveredChart(false)}
              style={{ overflow: 'visible', cursor: 'crosshair' }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />

              {/* Area path */}
              <path
                d={`M 0 200 ${chartPoints.map((pt, idx) => {
                  const x = (idx / (chartPoints.length - 1)) * 500;
                  const min = Math.min(...chartPoints);
                  const max = Math.max(...chartPoints);
                  const y = 170 - ((pt - min) / ((max - min) || 1)) * 140;
                  return `L ${x} ${y}`;
                }).join(' ')} L 500 200 Z`}
                fill="url(#chartGradient)"
              />

              {/* Glowing Line path */}
              <path
                d={chartPoints.map((pt, idx) => {
                  const x = (idx / (chartPoints.length - 1)) * 500;
                  const min = Math.min(...chartPoints);
                  const max = Math.max(...chartPoints);
                  const y = 170 - ((pt - min) / ((max - min) || 1)) * 140;
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#7C5CFF"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0px 0px 5px rgba(124, 92, 255, 0.8))' }}
              />

              {/* Vertical Crosshair Line */}
              {isHoveredChart && hoveredDataPoint && (
                <line
                  x1={(chartPoints.indexOf(hoveredDataPoint.val) / (chartPoints.length - 1)) * 500}
                  y1="0"
                  x2={(chartPoints.indexOf(hoveredDataPoint.val) / (chartPoints.length - 1)) * 500}
                  y2="200"
                  stroke="rgba(124, 92, 255, 0.4)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              )}
            </svg>
          </div>

          {/* Performance metrics breakdown */}
          <div className="performance-metrics-grid">
            <div className="metric-item">
              <span className="metric-lbl">UNREALIZED P&L</span>
              <span className={`metric-val ${playerStats?.unrealizedPL && playerStats.unrealizedPL >= 0 ? 'green' : 'red'}`}>
                {playerStats?.unrealizedPL && playerStats.unrealizedPL >= 0 ? '+' : ''}
                {fmt(playerStats?.unrealizedPL || 0)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-lbl">REALIZED P&L</span>
              <span className={`metric-val ${playerStats?.realizedPL && playerStats.realizedPL >= 0 ? 'green' : 'red'}`}>
                {playerStats?.realizedPL && playerStats.realizedPL >= 0 ? '+' : ''}
                {fmt(playerStats?.realizedPL || 0)}
              </span>
            </div>
            <div className="metric-item buying-power-row">
              <div className="metric-item">
                <span className="metric-lbl">BUYING POWER</span>
                <span className="metric-val">{fmt(cash)}</span>
              </div>
              <button 
                className="add-buying-power-btn"
                title="Add buying power"
                onClick={() => { Audio.click(); pushToast('Buying power can be added by completing missions or selling assets.', 'info'); }}
              >
                +
              </button>
            </div>
          </div>
        </section>

        {/* HOLDINGS TABLE */}
        <section className="holdings-card mmo-card">
          <div className="holdings-header-row">
            <div className="holdings-tabs">
              {(['ALL', 'STOCKS', 'CRYPTO', 'FOREX', 'COMMODITIES', 'CASH'] as const).map(tab => (
                <button
                  key={tab}
                  className={`holdings-tab-btn ${activeHoldingsTab === tab ? 'active' : ''}`}
                  onClick={() => { Audio.click(); setActiveHoldingsTab(tab); }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="mmo-table-wrap">
            <table className="mmo-table">
              <thead>
                <tr>
                  <th>ASSET</th>
                  <th>TYPE</th>
                  <th>AVG PRICE</th>
                  <th>CURRENT PRICE</th>
                  <th>QUANTITY</th>
                  <th>POSITION VALUE</th>
                  <th>P&L</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {activeHoldingsTab === 'CASH' || activeHoldingsTab === 'ALL' ? (
                  <tr>
                    <td>
                      <div className="asset-cell">
                        <div className="asset-logo-wrap" style={{ color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' }}>$</div>
                        <div className="asset-name-sub">
                          <span className="asset-ticker-lbl">CASH</span>
                          <span className="asset-name-lbl">US Dollar Balance</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="type-pill" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>Cash</span></td>
                    <td><span className="qty-val">$1.00</span></td>
                    <td>
                      <div className="price-cell-wrap">
                        <span className="price-main">$1.00</span>
                        <span className="price-change-pct" style={{ color: 'var(--dim)' }}>0.00%</span>
                      </div>
                    </td>
                    <td><span className="qty-val">{fmtNum(cash)}</span></td>
                    <td><span className="qty-val">{fmt(cash)}</span></td>
                    <td><span className="qty-val" style={{ color: 'var(--dim)' }}>—</span></td>
                    <td></td>
                  </tr>
                ) : null}

                {filteredHoldings.map((h, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => handleNavigateToAsset(h.aid, h.market)}>
                    <td>
                      <div className="asset-cell">
                        <div className="asset-logo-wrap">{h.aid.slice(0, 2)}</div>
                        <div className="asset-name-sub">
                          <span className="asset-ticker-lbl">{h.aid}</span>
                          <span className="asset-name-lbl">{h.name}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className={`type-pill ${h.market}`}>{h.market}</span></td>
                    <td><span className="qty-val">{fmt(h.avgCost)}</span></td>
                    <td>
                      <div className="price-cell-wrap">
                        <span className="price-main">{fmt(h.lastPrice)}</span>
                        <span className={`price-change-pct ${h.chg >= 0 ? 'up-green' : 'dn-red'}`}>
                          {h.chg >= 0 ? '▲' : '▼'} {Math.abs(h.chg).toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td><span className="qty-val">{fmtNum(Math.abs(h.shares))}</span></td>
                    <td><span className="qty-val">{fmt(h.val)}</span></td>
                    <td>
                      <div className="price-cell-wrap">
                        <span className="qty-val" style={{ color: h.unrealized >= 0 ? '#22C55E' : '#EF4444' }}>
                          {h.unrealized >= 0 ? '+' : ''}{fmt(h.unrealized)}
                        </span>
                        <span className="price-change-pct" style={{ color: h.unrealized >= 0 ? '#22C55E' : '#EF4444' }}>
                          {h.unrealized >= 0 ? '+' : ''}{h.unrealizedPct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); Audio.click(); pushToast(`Options for ${h.aid} clicked.`, 'info'); }}>
                      <button className="actions-btn">⋮</button>
                    </td>
                  </tr>
                ))}

                {filteredHoldings.length === 0 && activeHoldingsTab !== 'CASH' && activeHoldingsTab !== 'ALL' && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--dim)' }}>
                      No positions held in this asset class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer-btn-row">
            <span className="view-all-link" onClick={() => { setActiveScreen('trading'); setActiveTab('positions'); Audio.click(); }}>
              VIEW ALL HOLDINGS
            </span>
          </div>
        </section>
      </main>

      {/* ================= RIGHT SIDEBAR ================= */}
      <aside className="page-right-sidebar">
        
        {/* ASSET ALLOCATION */}
        <section className="mmo-card">
          <h2 className="stat-label" style={{ fontSize: '11px' }}>ASSET ALLOCATION</h2>
          
          <div className="donut-section">
            <div className="donut-chart-wrap">
              <svg width="100%" height="100%" viewBox="0 0 140 140">
                {renderDonutChart()}
              </svg>
              <div className="donut-center-text">
                <span className="donut-center-val">{fmt(totalValue)}</span>
                <span className="donut-center-lbl">TOTAL VALUE</span>
              </div>
            </div>

            <div className="allocation-legend">
              {activeAllocations.map((alloc, idx) => (
                <div key={idx} className="legend-item">
                  <div className="legend-dot-label">
                    <span className="legend-dot" style={{ backgroundColor: alloc.color }}></span>
                    <span>{alloc.label}</span>
                  </div>
                  <span className="legend-pct">{alloc.pct.toFixed(1)}%</span>
                  <span className="legend-val">{fmt(alloc.val)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="diversity-footer">
            <div className="diversity-lbl-row">
              <span>PORTFOLIO DIVERSITY</span>
              <span style={{ color: '#22C55E', fontWeight: '700' }}>78% Well Balanced</span>
            </div>
            <div className="diversity-progress-bg">
              <div className="diversity-progress-fill" style={{ width: '78%' }}></div>
            </div>
          </div>
        </section>

        {/* RECENT ACTIVITY */}
        <section className="mmo-card">
          <div className="activity-header-row">
            <h2 className="stat-label" style={{ fontSize: '11px' }}>RECENT ACTIVITY</h2>
            <span className="view-all-link" onClick={() => { setActiveScreen('trading'); setActiveTab('history'); Audio.click(); }}>
              VIEW ALL
            </span>
          </div>

          <div className="activity-list">
            {activityLogs.slice(0, 5).map((log: any, idx: number) => {
              const chg = log.pnl || 0;
              const isProfit = chg >= 0;
              const isBuy = log.side === 'buy';
              return (
                <div key={idx} className="activity-item">
                  <div className="activity-item-left">
                    <div className="activity-icon" style={{ color: isBuy ? '#22C55E' : '#EF4444' }}>
                      {isBuy ? '↙' : '↗'}
                    </div>
                    <div className="activity-details">
                      <div className="activity-title-line">
                        <span>{log.assetId}</span>
                        <span className={`activity-action-tag ${log.side}`}>{log.side}</span>
                      </div>
                      <span className="activity-meta-line">
                        {fmtNum(log.qty)} shares @ {fmt(log.price)}
                      </span>
                    </div>
                  </div>
                  <div className="activity-item-right">
                    <span className={`activity-value-lbl ${isProfit ? 'positive' : 'negative'}`}>
                      {isProfit ? '+' : ''}{fmt(chg)}
                    </span>
                    <span className="activity-time-lbl">
                      {new Date(log.ts).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}

            {activityLogs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--dim)', padding: '15px' }}>
                No recent activity logs.
              </div>
            )}
          </div>

          <div className="table-footer-btn-row" style={{ marginTop: '16px' }}>
            <span className="view-all-link" onClick={() => { setActiveScreen('trading'); setActiveTab('history'); Audio.click(); }}>
              VIEW ALL ACTIVITY
            </span>
          </div>
        </section>
      </aside>
      
    </div>
  );
}
