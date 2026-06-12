import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { Audio } from '../audio/audio';
import { AvatarImg } from '../ui/avatar';
import {
  IconClock,
  IconTrophy,
  IconStar,
  IconCoin,
  IconGem,
  IconUser,
  IconShield,
  IconArrowUp,
  IconArrowDown,
} from '../ui/icons';
import { useCountUp } from '../ui/useCountUp';
import './Pages.css';
import '../styles/arcade-leaderboard.css';

/** Visual-only: maps a league name to a neon tier accent class. */
function tierClass(name: string): string {
  if (name.startsWith('CHALLENGER')) return 'tier-challenger';
  if (name.startsWith('MASTER')) return 'tier-master';
  if (name.startsWith('DIAMOND')) return 'tier-diamond';
  if (name.startsWith('PLATINUM')) return 'tier-platinum';
  if (name.startsWith('GOLD')) return 'tier-gold';
  return 'tier-silver';
}

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

function fmtLeaderboardPct(n: number): string {
  const absN = Math.abs(n);
  if (absN >= 1e12) return (absN / 1e12).toFixed(2) + 'T%';
  if (absN >= 1e9)  return (absN / 1e9).toFixed(2)  + 'B%';
  if (absN >= 1e6)  return (absN / 1e6).toFixed(2)  + 'M%';
  if (absN >= 1e3)  return (absN / 1e3).toFixed(2)  + 'K%';
  return absN.toFixed(2) + '%';
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

  const Sparkline = ({ points, color = '#34d399' }: { points: number[]; color?: string }) => {
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
      : (((entry.net - (entry.bornNet || 10000)) / (entry.bornNet || 10000)) * 100);
    const trades = entry.isPlayer
      ? (playerStats?.totalTrades || 0)
      : ((entry as any).trades || 0);
    
    return {
      ...entry,
      rank: idx + 1,
      returnPct,
      trades,
      points: getSeededPoints(entry.id)
    };
  });

  const playerLeague = getLeague(net, rank || 247);
  const playerTrades = playerStats?.totalTrades || 0;
  const playerReturnPct = (((net - (p.dayStartNet || 10000)) / (p.dayStartNet || 10000)) * 100);

  // Visual-only animated display values
  const playerTier = tierClass(playerLeague.name);
  const trophiesAnim = useCountUp(playerLeague.trophies);
  const netAnim = useCountUp(net);

  const getRankBadgeClass = (r: number) => {
    if (r === 1) return 'rank-badge-1';
    if (r === 2) return 'rank-badge-2';
    if (r === 3) return 'rank-badge-3';
    return '';
  };

  return (
    <div className="page-container leaderboard-page arcade-lb">

      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="page-sidebar">

        {/* Season card */}
        <div className="season-card mmo-card hud-panel hud-corners gold" style={{ backgroundImage: 'linear-gradient(rgba(11,16,32,0.4), rgba(11,16,32,0.95)), url(/assets/dash/hero_cityscape.webp)' }}>
          <div>
            <span className="season-tag hud-pill gold">SEASON 1</span>
            <h1 className="season-title disp">TRADING CHAMPIONSHIP</h1>
          </div>

          <div className="season-countdown-wrap">
            <span className="countdown-label"><IconClock size={10} /> SEASON ENDS IN</span>
            <div className="countdown-timer">{seasonTimer}</div>
          </div>
        </div>

        {/* League progress card */}
        <div className="league-card mmo-card hud-panel glow-hover">
          <span className="league-card-title">YOUR LEAGUE</span>
          <div className={`league-shield-wrap ${playerTier}`}>
            <IconShield size={64} strokeWidth={1.5} title={playerLeague.name} />
          </div>
          <span className={`league-name-main disp ${playerTier}`}>{playerLeague.name}</span>
          <div className="league-trophies-row">
            <IconTrophy size={15} />
            <span className="qty-val">{Math.round(trophiesAnim).toLocaleString()}</span>
          </div>
          <div className="league-top-percent">TOP 2% OF TRADERS</div>
          <div className="league-progress-bg xp-bar thin">
            <div className={`league-progress-fill xp-fill ${playerTier}`} style={{ width: `${(playerLeague.trophies / playerLeague.maxTrophies) * 100}%` }}></div>
          </div>
          <span className="league-progress-text">{playerLeague.trophies.toLocaleString()} / {playerLeague.maxTrophies.toLocaleString()}</span>
        </div>

        {/* League rewards card */}
        <div className="mmo-card hud-panel glow-hover">
          <span className="league-rewards-title">LEAGUE REWARDS</span>
          <h3 className={`disp ${playerTier}`} style={{ fontSize: '11px', marginTop: '6px' }}>{playerLeague.name}</h3>

          <div className="rewards-grid-mini">
            <div className="reward-item-mini xp">
              <IconStar size={13} />
              <span>{playerLeague.xpReward.toLocaleString()}</span>
            </div>
            <div className="reward-item-mini cash">
              <IconCoin size={13} />
              <span>{playerLeague.cashReward.toLocaleString()}</span>
            </div>
            <div className="reward-item-mini gems">
              <IconGem size={13} />
              <span>{playerLeague.gemReward.toLocaleString()}</span>
            </div>
          </div>

          <button className="rewards-card-btn arcade-btn ghost" onClick={() => { Audio.click(); pushToast('League Info: Reach next tier to unlock higher rewards.', 'info'); }}>
            <span>LEAGUE INFO</span>
            <span className="arrow-east"><IconArrowUp size={12} /></span>
          </button>
        </div>
      </aside>

      {/* ================= CENTER MAIN SECTION ================= */}
      <main className="page-main-content">
        
        {/* LEADERBOARD TABLE */}
        <section className="mmo-card hud-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
              <IconUser size={13} />
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
                          {isTop3 ? (
                            <img
                              className="rank-medal-img"
                              src={`/assets/lb/medal_${trader.rank === 1 ? 'gold' : trader.rank === 2 ? 'silver' : 'bronze'}.webp`}
                              alt={`Rank ${trader.rank}`}
                              title={`Rank ${trader.rank}`}
                            />
                          ) : (
                            <span className={`rank-badge-wrap ${getRankBadgeClass(trader.rank)}`}>
                              {trader.rank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="trader-cell">
                          <div className="trader-avatar">
                            <AvatarImg level={trader.level} />
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
                        <span className="qty-val" style={{ color: trader.isPlayer ? 'var(--neon-gold)' : '#fff' }}>
                          {fmt(trader.net)}
                        </span>
                      </td>
                      <td>
                        <span className="qty-val delta-val" style={{ color: trader.returnPct >= 0 ? 'var(--neon-green)' : 'var(--neon-rose)' }}>
                          {trader.returnPct >= 0 ? <IconArrowUp size={10} /> : <IconArrowDown size={10} />} {fmtLeaderboardPct(trader.returnPct)}
                        </span>
                      </td>
                      <td>
                        <span className="qty-val">{trader.trades.toLocaleString()}</span>
                      </td>
                      <td>
                        <Sparkline points={trader.points} color={trader.returnPct >= 0 ? '#34d399' : '#f43f5e'} />
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
                        <div className="trader-avatar"><AvatarImg level={lvl} /></div>
                        <div className="trader-info-wrap">
                          <span className="trader-name-lbl">{username} (You)</span>
                          <span className={`trader-tag-pro tier-tag ${playerTier}`}>{playerLeague.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="qty-val" style={{ color: 'var(--neon-gold)' }}>{fmt(net)}</span>
                    </td>
                    <td>
                      <span className="qty-val delta-val" style={{ color: playerReturnPct >= 0 ? 'var(--neon-green)' : 'var(--neon-rose)' }}>
                        {playerReturnPct >= 0 ? <IconArrowUp size={10} /> : <IconArrowDown size={10} />} {fmtLeaderboardPct(playerReturnPct)}
                      </span>
                    </td>
                    <td>
                      <span className="qty-val">{playerTrades.toLocaleString()}</span>
                    </td>
                    <td>
                      <Sparkline points={getSeededPoints(0)} color={playerReturnPct >= 0 ? '#34d399' : '#f43f5e'} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="leaderboard-footer-text">
            <span className="blinking-dot live-dot"></span>
            <span>Leaderboard updates in real-time</span>
          </div>
        </section>
      </main>

      {/* ================= RIGHT SIDEBAR ================= */}
      <aside className="page-right-sidebar">
        
        {/* YOUR RANK PANEL */}
        <section className="mmo-card hud-panel hud-corners">
          <h2 className="stat-label disp" style={{ fontSize: '11px' }}>YOUR RANK</h2>

          <div className="your-rank-shield-wrap">
            <div className={`your-rank-shield ${playerTier}`}>
              <IconShield size={56} strokeWidth={1.5} title={playerLeague.name} />
            </div>
            <span className="rank-shield-num disp">#{rank || 247}</span>
            <span className="rank-shield-label">TOP 2% OF TRADERS</span>
          </div>

          <div className="rank-shield-stats-grid">
            <div className="rank-shield-stat-item">
              <span className="rank-shield-stat-lbl">NET WORTH</span>
              <span className="rank-shield-stat-val">{fmt(netAnim)}</span>
            </div>
            <div className="rank-shield-stat-item">
              <span className="rank-shield-stat-lbl">TOTAL RETURN</span>
              <span className={`rank-shield-stat-val delta-val ${playerReturnPct >= 0 ? 'green' : 'red'}`}>
                {playerReturnPct >= 0 ? <IconArrowUp size={10} /> : <IconArrowDown size={10} />} {fmtLeaderboardPct(playerReturnPct)}
              </span>
            </div>
          </div>

          <div className="rank-shield-chart-wrap">
            <svg width="100%" height="100%" viewBox="0 0 250 50" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rankChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 50 L 0 30 L 40 35 L 80 25 L 120 40 L 160 20 L 200 15 L 250 10 L 250 50 Z`}
                fill="url(#rankChartGrad)"
              />
              <path
                d="M 0 30 L 40 35 L 80 25 L 120 40 L 160 20 L 200 15 L 250 10"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.6))' }}
              />
            </svg>
          </div>
        </section>

        {/* TOP PERFORMER REWARDS PANEL */}
        <section className="mmo-card hud-panel glow-hover">
          <h2 className="stat-label disp" style={{ fontSize: '11px' }}>TOP PERFORMER REWARDS</h2>

          <div className="rewards-performer-list">

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon tier-challenger"><IconTrophy size={17} /></span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 1</span>
                  <span className="reward-performer-tier-name tier-challenger">Challenger</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <IconCoin size={11} />
                  <span>100,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <IconGem size={11} />
                  <span>2,000</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon tier-master"><IconShield size={17} /></span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 2 - 3</span>
                  <span className="reward-performer-tier-name tier-master">Master</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <IconCoin size={11} />
                  <span>50,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <IconGem size={11} />
                  <span>1,000</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon tier-diamond"><IconGem size={17} /></span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 4 - 10</span>
                  <span className="reward-performer-tier-name tier-diamond">Diamond II</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <IconCoin size={11} />
                  <span>25,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <IconGem size={11} />
                  <span>500</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon tier-diamond"><IconShield size={17} /></span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 11 - 100</span>
                  <span className="reward-performer-tier-name tier-diamond">Diamond I</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <IconCoin size={11} />
                  <span>10,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <IconGem size={11} />
                  <span>250</span>
                </div>
              </div>
            </div>

            <div className="reward-performer-item">
              <div className="reward-performer-left">
                <span className="reward-performer-rank-icon tier-platinum"><IconGem size={17} /></span>
                <div className="reward-performer-details">
                  <span className="reward-performer-rank-text">TOP 101 - 500</span>
                  <span className="reward-performer-tier-name">Platinum</span>
                </div>
              </div>
              <div className="reward-performer-right">
                <div className="reward-performer-payout cash">
                  <IconCoin size={11} />
                  <span>5,000</span>
                </div>
                <div className="reward-performer-payout gems">
                  <IconGem size={11} />
                  <span>100</span>
                </div>
              </div>
            </div>

          </div>

          <div className="table-footer-btn-row" style={{ marginTop: '16px' }}>
            <button className="daily-btn arcade-btn gold" onClick={() => { Audio.click(); pushToast('Performer rewards are distributed at the end of each season.', 'ok'); }}>
              VIEW ALL REWARDS
            </button>
          </div>
        </section>

      </aside>

    </div>
  );
}
