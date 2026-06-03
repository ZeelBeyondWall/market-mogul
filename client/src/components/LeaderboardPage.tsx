import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { Audio } from '../audio/audio';
import './Pages.css';

// Redefine getLeague to avoid export issues
interface LeagueInfo {
  name: string;
  badgeColor: string;
  trophies: number;
  maxTrophies: number;
  xpReward: number;
  cashReward: number;
  gemReward: number;
  rankText: string;
}

function getLeague(netWorth: number, rank: number): LeagueInfo {
  if (netWorth >= 2000000) {
    return {
      name: 'CHALLENGER',
      badgeColor: '#FBBF24',
      trophies: Math.min(5000, Math.floor(4000 + (netWorth - 2000000) / 1000)),
      maxTrophies: 5000,
      xpReward: 10000,
      cashReward: 100000,
      gemReward: 2000,
      rankText: 'TOP 1'
    };
  } else if (netWorth >= 1000000) {
    return {
      name: 'MASTER',
      badgeColor: '#A855F7',
      trophies: Math.min(4000, Math.floor(3500 + (netWorth - 1000000) / 2000)),
      maxTrophies: 4000,
      xpReward: 7500,
      cashReward: 50000,
      gemReward: 1000,
      rankText: 'TOP 2 - 3'
    };
  } else if (netWorth >= 500000) {
    return {
      name: 'DIAMOND II',
      badgeColor: '#C084FC',
      trophies: Math.min(3500, Math.floor(3250 + (netWorth - 500000) / 2000)),
      maxTrophies: 3500,
      xpReward: 6000,
      cashReward: 35000,
      gemReward: 750,
      rankText: 'TOP 4 - 10'
    };
  } else if (netWorth >= 50000) {
    const diff = netWorth - 50000;
    const trophies = Math.min(3245 + Math.floor(diff / 100), 3245 + 500);
    return {
      name: 'DIAMOND I',
      badgeColor: '#8B5CF6',
      trophies: Math.floor(trophies),
      maxTrophies: 4000,
      xpReward: 5000,
      cashReward: 25000,
      gemReward: 500,
      rankText: 'TOP 11 - 100'
    };
  } else if (netWorth >= 20000) {
    return {
      name: 'PLATINUM',
      badgeColor: '#3B82F6',
      trophies: Math.min(3000, Math.floor(2000 + (netWorth - 20000) / 30)),
      maxTrophies: 3000,
      xpReward: 3000,
      cashReward: 10000,
      gemReward: 250,
      rankText: 'TOP 101 - 500'
    };
  } else if (netWorth >= 10000) {
    return {
      name: 'GOLD',
      badgeColor: '#EAB308',
      trophies: Math.min(2000, Math.floor(1000 + (netWorth - 10000) / 10)),
      maxTrophies: 2000,
      xpReward: 1500,
      cashReward: 5000,
      gemReward: 100,
      rankText: 'TOP 501 - 1000'
    };
  } else {
    return {
      name: 'SILVER',
      badgeColor: '#94A3B8',
      trophies: Math.min(1000, Math.floor(netWorth / 10)),
      maxTrophies: 1000,
      xpReward: 500,
      cashReward: 1000,
      gemReward: 50,
      rankText: 'TOP 1000+'
    };
  }
}

export function LeaderboardPage() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  
  const rank = useGame(s => s.playerRank);
  const leaderboard = useGame(s => s.leaderboard);
  const total = useGame(s => s.totalTraders);
  const session = useGame(s => s.session);
  const pushToast = useGame(s => s.pushToast);
  const lvl = useGame(s => s.playerLevel);
  const playerStats = useGame(s => s.playerStats);

  const p = eng.player();
  const net = eng.netWorth();
  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || p.name || 'Trader';

  // Tab State
  const [activeTab, setActiveTab] = useState<'OVERALL' | 'WEEKLY' | 'MONTHLY' | 'DAILY'>('OVERALL');
  const [seasonTimer, setSeasonTimer] = useState('12D : 14H : 35M : 21S');

  // Countdown timer for Season Ends
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // Mock season end to 12 days out
      const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 12, 14, 35, 21));
      const diffMs = target.getTime() - now.getTime();
      
      const days = String(Math.floor(diffMs / (3600000 * 24))).padStart(2, '0');
      const hours = String(Math.floor((diffMs % (3600000 * 24)) / 3600000)).padStart(2, '0');
      const minutes = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
      
      setSeasonTimer(`${days}D : ${hours}H : ${minutes}M : ${seconds}S`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getAvatarEmoji = (level: number, name: string) => {
    if (name.includes('Bull')) return '🐂';
    if (name.includes('King')) return '👑';
    if (name.includes('Titan')) return '🤖';
    if (name.includes('Wizard')) return '🧙‍♂️';
    if (name.includes('Hunter')) return '🏹';
    if (name.includes('Surgeon')) return '😷';
    if (name.includes('Ninja')) return '🥷';
    if (name.includes('Tony')) return '👨‍🚀';
    
    if (level < 5) return '🧑‍🚀';
    if (level < 10) return '🦾';
    if (level < 20) return '🤖';
    if (level < 30) return '⚡';
    if (level < 50) return '👽';
    return '👑';
  };

  const getSeededPoints = (seedId: number) => {
    const points = [];
    let cur = 10;
    let seed = seedId;
    for (let i = 0; i < 12; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      cur += (rnd - 0.46) * 6;
      points.push(cur);
    }
    return points;
  };

  const Sparkline = ({ points, color = '#22C55E' }: { points: number[]; color?: string }) => {
    const width = 80;
    const height = 20;
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const ptsStr = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - ((p - min) / range) * height}`).join(' ');
    return (
      <svg width={width} height={height} className="spark-line-svg" style={{ overflow: 'visible' }}>
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={ptsStr} />
      </svg>
    );
  };

  // Compile leaderboard list
  // Top 10 lists
  const displayList = leaderboard.slice(0, 10).map((entry, idx) => {
    const returnPct = entry.isPlayer 
      ? (((net - (p.dayStartNet || 10000)) / (p.dayStartNet || 10000)) * 100)
      : (entry.net / 10000);
    const trades = entry.isPlayer
      ? (playerStats?.totalTrades || 28)
      : Math.floor(100 + (entry.net / 2200) + (entry.level * 8));
    
    return {
      ...entry,
      rank: idx + 1,
      returnPct,
      trades,
      points: getSeededPoints(entry.id)
    };
  });

  const playerLeague = getLeague(net, rank || 247);
  const playerTrades = playerStats?.totalTrades || 28;
  const playerReturnPct = (((net - (p.dayStartNet || 10000)) / (p.dayStartNet || 10000)) * 100);

  const getRankBadgeClass = (r: number) => {
    if (r === 1) return 'rank-badge-1';
    if (r === 2) return 'rank-badge-2';
    if (r === 3) return 'rank-badge-3';
    return '';
  };

  return (
    <div className="page-container leaderboard-page">
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="page-sidebar">
        
        {/* Season card */}
        <div className="season-card mmo-card" style={{ backgroundImage: 'linear-gradient(rgba(11,16,32,0.4), rgba(11,16,32,0.95)), url(/cityscape_sunset.png)' }}>
          <div>
            <span className="season-tag">SEASON 1</span>
            <h1 className="season-title">TRADING CHAMPIONSHIP</h1>
          </div>
          
          <div className="season-countdown-wrap">
            <span className="countdown-label">⏱ SEASON ENDS IN</span>
            <div className="countdown-timer">{seasonTimer}</div>
          </div>
        </div>

        {/* League progress card */}
        <div className="league-card mmo-card">
          <span className="league-card-title">YOUR LEAGUE</span>
          {/* Mock Purple Shield emoji for diamond */}
          <div style={{ fontSize: '72px', margin: '8px 0', filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.4))' }}>🛡️</div>
          <span className="league-name-main">{playerLeague.name}</span>
          <div className="league-trophies-row">
            <span>🏆</span>
            <span className="qty-val">{playerLeague.trophies.toLocaleString()}</span>
          </div>
          <div className="league-top-percent">TOP 2% OF TRADERS</div>
          <div className="league-progress-bg">
            <div className="league-progress-fill" style={{ width: `${(playerLeague.trophies / playerLeague.maxTrophies) * 100}%` }}></div>
          </div>
          <span className="league-progress-text">{playerLeague.trophies.toLocaleString()} / {playerLeague.maxTrophies.toLocaleString()}</span>
        </div>

        {/* League rewards card */}
        <div className="mmo-card">
          <span className="league-rewards-title">LEAGUE REWARDS</span>
          <h3 style={{ fontSize: '11px', color: '#fff', marginTop: '6px' }}>{playerLeague.name}</h3>
          
          <div className="rewards-grid-mini">
            <div className="reward-item-mini xp">
              <span>⭐</span>
              <span>{playerLeague.xpReward.toLocaleString()}</span>
            </div>
            <div className="reward-item-mini cash">
              <span>💵</span>
              <span>{playerLeague.cashReward.toLocaleString()}</span>
            </div>
            <div className="reward-item-mini gems">
              <span>💎</span>
              <span>{playerLeague.gemReward.toLocaleString()}</span>
            </div>
          </div>

          <button className="rewards-card-btn" onClick={() => { Audio.click(); pushToast('League Info: Reach next tier to unlock higher rewards.', 'info'); }}>
            <span>LEAGUE INFO</span>
            <span>➔</span>
          </button>
        </div>
      </aside>

      {/* ================= CENTER MAIN SECTION ================= */}
      <main className="page-main-content">
        
        {/* LEADERBOARD TABLE */}
        <section className="mmo-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="leaderboard-tabs-row">
            <div className="holdings-tabs">
              {(['OVERALL', 'WEEKLY', 'MONTHLY', 'DAILY'] as const).map(tab => (
                <button
                  key={tab}
                  className={`holdings-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => { Audio.click(); setActiveTab(tab); }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button className="leaderboard-friends-btn" onClick={() => { Audio.click(); pushToast('Friends list integrations unlocks next season!', 'info'); }}>
              <span>👥</span>
              <span>FRIENDS</span>
            </button>
          </div>

          <div className="mmo-table-wrap" style={{ flex: 1 }}>
            <table className="mmo-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>RANK</th>
                  <th>TRADER</th>
                  <th>NET WORTH</th>
                  <th>TOTAL RETURN</th>
                  <th>TRADES</th>
                  <th>PERFORMANCE GRAPH</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((trader, i) => {
                  const isTop3 = trader.rank <= 3;
                  return (
                    <tr key={i} className={trader.isPlayer ? 'highlighted-user-row' : ''}>
                      <td>
                        <div className="rank-badge-wrap">
                          <span className={`rank-badge-wrap ${getRankBadgeClass(trader.rank)}`}>
                            {trader.rank}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="trader-cell">
                          <div className="trader-avatar">
                            {getAvatarEmoji(trader.level, trader.name)}
                          </div>
                          <div className="trader-info-wrap">
                            <span className="trader-name-lbl">{trader.name}</span>
                            {trader.level >= 12 && (
                              <span className="trader-tag-pro">PRO</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="qty-val" style={{ color: trader.isPlayer ? '#FBBF24' : '#fff' }}>
                          {fmt(trader.net)}
                        </span>
                      </td>
                      <td>
                        <span className="qty-val" style={{ color: trader.returnPct >= 0 ? '#22C55E' : '#EF4444' }}>
                          {trader.returnPct >= 0 ? '▲' : '▼'} {Math.abs(trader.returnPct).toFixed(2)}%
                        </span>
                      </td>
                      <td>
                        <span className="qty-val">{trader.trades.toLocaleString()}</span>
                      </td>
                      <td>
                        <Sparkline points={trader.points} color={trader.returnPct >= 0 ? '#22C55E' : '#EF4444'} />
                      </td>
                    </tr>
                  );
                })}

                {/* Always lock the current player details as the highlighted last row if not in top 10 */}
                {rank > 10 && (
                  <tr className="highlighted-user-row">
                    <td>
                      <div className="rank-badge-wrap">
                        <span className="qty-val">{rank}</span>
                      </div>
                    </td>
                    <td>
                      <div className="trader-cell">
                        <div className="trader-avatar">👨‍🚀</div>
                        <div className="trader-info-wrap">
                          <span className="trader-name-lbl">{username} (You)</span>
                          <span className="trader-tag-pro" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.3)' }}>{playerLeague.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="qty-val" style={{ color: '#FBBF24' }}>{fmt(net)}</span>
                    </td>
                    <td>
                      <span className="qty-val" style={{ color: playerReturnPct >= 0 ? '#22C55E' : '#EF4444' }}>
                        {playerReturnPct >= 0 ? '▲' : '▼'} {Math.abs(playerReturnPct).toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span className="qty-val">{playerTrades.toLocaleString()}</span>
                    </td>
                    <td>
                      <Sparkline points={getSeededPoints(0)} color={playerReturnPct >= 0 ? '#22C55E' : '#EF4444'} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="leaderboard-footer-text">
            <span className="blinking-dot"></span>
            <span>Leaderboard updates in real-time</span>
          </div>
        </section>
      </main>

      {/* ================= RIGHT SIDEBAR ================= */}
      <aside className="page-right-sidebar">
        
        {/* YOUR RANK PANEL */}
        <section className="mmo-card">
          <h2 className="stat-label" style={{ fontSize: '11px' }}>YOUR RANK</h2>
          
          <div className="your-rank-shield-wrap">
            {/* Mock Shield Badge */}
            <div style={{ fontSize: '64px', filter: 'drop-shadow(0 0 10px rgba(124, 92, 255, 0.4))' }}>🛡️</div>
            <span className="rank-shield-num">#{rank || 247}</span>
            <span className="rank-shield-label">TOP 2% OF TRADERS</span>
          </div>

          <div className="rank-shield-stats-grid">
            <div className="rank-shield-stat-item">
              <span className="rank-shield-stat-lbl">NET WORTH</span>
              <span className="rank-shield-stat-val">{fmt(net)}</span>
            </div>
            <div className="rank-shield-stat-item">
              <span className="rank-shield-stat-lbl">TOTAL RETURN</span>
              <span className={`rank-shield-stat-val ${playerReturnPct >= 0 ? 'green' : 'red'}`}>
                {playerReturnPct >= 0 ? '▲' : '▼'} {Math.abs(playerReturnPct).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="rank-shield-chart-wrap">
            <svg width="100%" height="100%" viewBox="0 0 250 50" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rankChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 50 L 0 30 L 40 35 L 80 25 L 120 40 L 160 20 L 200 15 L 250 10 L 250 50 Z`}
                fill="url(#rankChartGrad)"
              />
              <path
                d="M 0 30 L 40 35 L 80 25 L 120 40 L 160 20 L 200 15 L 250 10"
                fill="none"
                stroke="#7C5CFF"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px rgba(124, 92, 255, 0.6))' }}
              />
            </svg>
          </div>
        </section>

        {/* TOP PERFORMER REWARDS PANEL */}
        <section className="mmo-card">
          <h2 className="stat-label" style={{ fontSize: '11px' }}>TOP PERFORMER REWARDS</h2>
          
          <div className="rewards-performer-list">
            
            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon">👑</span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 1</span>
                  <span className="reward-performer-tier-name">Challenger</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <span>💵</span>
                  <span>100,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <span>💎</span>
                  <span>2,000</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon">🥈</span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 2 - 3</span>
                  <span className="reward-performer-tier-name">Master</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <span>💵</span>
                  <span>50,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <span>💎</span>
                  <span>1,000</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon">🥉</span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 4 - 10</span>
                  <span className="reward-performer-tier-name">Diamond II</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <span>💵</span>
                  <span>25,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <span>💎</span>
                  <span>500</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon">🛡️</span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 11 - 100</span>
                  <span className="reward-performer-tier-name">Diamond I</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <span>💵</span>
                  <span>10,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <span>💎</span>
                  <span>250</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon">🔹</span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 101 - 500</span>
                  <span className="reward-performer-tier-name">Platinum</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <span>💵</span>
                  <span>5,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <span>💎</span>
                  <span>100</span>
                </div>
              </div>
            </div>

          </div>

          <div className="table-footer-btn-row" style={{ marginTop: '16px' }}>
            <button className="daily-btn" onClick={() => { Audio.click(); pushToast('Performer rewards are distributed at the end of each season.', 'ok'); }}>
              VIEW ALL REWARDS
            </button>
          </div>
        </section>

      </aside>

    </div>
  );
}
