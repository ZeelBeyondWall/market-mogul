import { useMemo, useState } from 'react';

interface DocSection {
  id: string;
  title: string;
  icon: string;
  body: string;
}

// Single source of truth — future features should append here.
const SECTIONS: DocSection[] = [
  { id: 'start', title: 'Getting Started', icon: '🚀', body: `
Welcome to MARKET MOGUL — a real-time multi-market trading simulator.

You start at Level 1 with $100 in cash and access to basic stocks.
Click any asset in the left rail to chart it. Use the BUY / SELL panel to trade.
Your portfolio + P/L update live in the right rail.

Goals:
• Grow your net worth and climb the leaderboard against 10,000+ AI bots.
• Level up to unlock new markets (Crypto at L10, Forex at L20, Premium assets at L50).
• Complete daily/weekly missions for bonus rewards.
`.trim() },

  { id: 'stocks', title: 'Understanding Stocks', icon: '📈', body: `
Stocks represent ownership in fictional companies across 6 sectors:
• Technology (NEXA, QSFT, CYCR…)
• Banking & Finance (ABNK, ZFIN…)
• Energy (FENR, SOLG, TOIL…)
• Healthcare (BNVA, TPHM…)
• Consumer & Retail (MGMT, FCRT…)
• Gaming & Entertainment (PXST, STWV…)

Each stock has a fair value the engine drifts toward. Sector-specific news (e.g.
"TECH SECTOR BOOM") moves entire industries at once. Some stocks unlock at L5
once you graduate from "basic stocks".

Long: profit when price goes UP. Short: profit when price goes DOWN.
`.trim() },

  { id: 'crypto', title: 'Understanding Crypto', icon: '⚡', body: `
Unlocks at Level 10. 25 cryptos split into:
• Large Cap (NOVA, TTNC, QTMC…) — most stable
• Mid Cap (PXLC, STRT…) — higher volatility
• Meme Coins (DGNV, PEPX, MNTT…) — PREMIUM (L50), extreme swings

Crypto is more volatile than stocks. Cross-market events like "TECH-CRYPTO RALLY"
move tech stocks AND crypto together — watch the News tab.
`.trim() },

  { id: 'forex', title: 'Understanding Forex', icon: '💱', body: `
Unlocks at Level 20. 15 currency pairs:
• USD majors: USD/NOVA, USD/TITAN, USD/SOLAR, USD/APEX, USD/ZENITH
• Cross pairs (NOVA crosses, TITAN crosses, etc.)
• APEX/ZENITH is an exotic pair — PREMIUM (L50)

Forex has the lowest baseline volatility but cross-market shocks
("BANK + FOREX STRENGTH") can spike pairs hard. Use limit orders to control entry.
`.trim() },

  { id: 'buy', title: 'Buy Orders', icon: '🟢', body: `
A BUY order purchases shares at the current ask price.
After buying, you own a LONG position — you profit if the price rises.

Steps:
1. Select an asset in the left rail.
2. Enter quantity in the Buy/Sell panel.
3. Click BUY (or use a Limit price — see "Limit Orders" below).

Your cash decreases by qty × price; shares appear in Positions tab.
`.trim() },

  { id: 'sell', title: 'Sell Orders', icon: '🔴', body: `
SELL has two meanings:
1. If you HOLD shares, SELL closes your long position.
2. If you have NO shares, SELL opens a SHORT position (profit if price drops).

Shorting requires 50% cash collateral. The engine will auto-cover the short if
your account would go bankrupt.

Use the CUT button on any open position to close it instantly at market price.
`.trim() },

  { id: 'market', title: 'Market Orders', icon: '⚡', body: `
A Market Order executes IMMEDIATELY at the best available price.
Use when you need to enter/exit RIGHT NOW and don't care about price slippage.

Risk: in thin order books, the price you actually pay can drift from what you
see on the chart. The order book on the right shows depth — wider = more
slippage risk.
`.trim() },

  { id: 'limit', title: 'Limit Orders', icon: '🎯', body: `
A Limit Order rests on the order book at YOUR chosen price.
It fills only when the market price reaches your limit.

Buy Limit: place BELOW current price → fills if price drops to your level.
Sell Limit: place ABOVE current price → fills if price rallies to your level.

Use limits to enter on dips, exit on spikes, or queue trades while AFK.
Limits show up in the Book tab next to your name.
`.trim() },

  { id: 'sl', title: 'Stop Loss (SL)', icon: '🛑', body: `
A Stop Loss closes your position automatically when losses hit a threshold.
SL is entered as a PERCENT of your average cost.

Example: bought 100 NEXA at $180 with SL 2%.
→ SL triggers when price drops to $176.40 ($180 × (1 - 2/100)).

For short positions, SL triggers when price RISES that % above your entry.
Configure SL/TP in the Positions tab or when placing the order.
`.trim() },

  { id: 'tp', title: 'Take Profit (TP)', icon: '🎯', body: `
A Take Profit closes (or partially closes) your position when gains hit a target.
TP is also entered as a PERCENT.

Example: bought NEXA at $180 with TP 5%.
→ TP triggers and exits when price hits $189.

Set TP for disciplined exits — locks in gains without watching the chart.
SL and TP can be set independently or together.
`.trim() },

  { id: 'portfolio', title: 'Portfolio Management', icon: '💼', body: `
Your portfolio = all open positions × current prices + cash.
Net Worth (in header) = cash + portfolio value.

Watch the Positions tab for:
• Quantity, average cost, current price, P/L per position
• SL/TP fields per position (% from avg cost)
• CUT button for instant close

Don't over-concentrate. Spreading across markets/sectors reduces risk.
`.trim() },

  { id: 'levels', title: 'Levels and Progression', icon: '⭐', body: `
Every closed trade awards XP based on absolute P/L (1-500 XP per trade).
XP-to-next-level grows as 100 × N^1.5:
  Level 2:    100 XP    Level 5:  1,118 XP    Level 10:  3,162 XP
  Level 20: 8,944 XP    Level 30: 16,432 XP   Level 50: 35,355 XP

Unlocks:
• Level 1   — Basic stocks (~20 tier-1)
• Level 5   — ALL stocks unlocked
• Level 10  — Crypto market
• Level 20  — Forex market
• Level 30  — Advanced trading features
• Level 50  — Premium high-volatility assets (meme coins, exotic forex)

Your level + XP bar live in the header.
`.trim() },

  { id: 'missions', title: 'Missions and Rewards', icon: '🎯', body: `
Missions are bite-size goals that pay BONUS cash (separate from your trading wallet
so it doesn't pollute the leaderboard).

DAILY (3 active, reset UTC midnight): e.g. "Execute 5 trades", "Close 3 winners",
"Grow portfolio 1%", "Hold any position 1 hour".

WEEKLY (2 active, reset ISO Monday UTC): e.g. "50 trades this week",
"Outperform — 5% portfolio growth", "Long Hold — 24h".

DAILY LOGIN BONUS: streak-based, scales up to ×7 days.
Open the Missions tab to see progress + claim rewards.
`.trim() },

  { id: 'leaderboards', title: 'Leaderboards', icon: '🏆', body: `
The Traders tab shows top 200 net-worth traders + you. You're competing against
10,000+ AI bots with their own personalities (yolo, diamond hands, paper trader,
fomo, value, gambler…).

Bots have their own levels too — high-level bots act smarter and access more
markets. The richest bots dominate the top of the board.

Your rank updates in real time. Goal: hit the top 100, then top 10.
`.trim() },

  { id: 'news', title: 'Market News', icon: '📰', body: `
The News tab shows recent market events (~30 latest). Events fall into:
• Boom (green) — bullish: rallies, beats, upgrades, deregulation
• Crash (red) — bearish: crashes, misses, downgrades, regulatory
• News (gray) — neutral information: insider sells, CEO changes

Some events are SECTOR-SPECIFIC ("BANK CRISIS" → only banks).
Cross-market events ("TECH-CRYPTO RALLY", "GLOBAL ROUT") move multiple markets.
Filter News by current market with the toggle button.

Newschase bots react to news within 30s of firing — get in early.
`.trim() },

  { id: 'tips', title: 'Trading Tips', icon: '💡', body: `
1. START SMALL. $100 starting cash. Don't blow it on one yolo. Trade 5-10% per position.

2. USE LIMITS for entries. Market orders pay the spread; limits get you a better price
   if the market comes to you.

3. SL EVERY POSITION. The engine will not save you from a -50% gap. Set SL 2-5%.

4. WATCH NEWS. If "FED CUTS RATES" fires, everything pumps. If "FLASH CRASH" fires,
   everything dies. React fast — bots are already moving.

5. SECTORS MATTER. Don't be long 100% tech when "TECH SELLOFF" can fire.

6. SHORT IN DOWNTRENDS. Don't only buy. Permabear bots make money in red weeks.

7. LEVEL UP for unlocks. Crypto + Forex have more volatility = more opportunity.

8. COMPLETE MISSIONS. Free bonus cash. The reset cycle is daily — don't skip.
`.trim() },

  { id: 'risk', title: 'Risk Management', icon: '⚠', body: `
Position Sizing:
• Never put more than 20% of net worth into a single position.
• Penny / meme / exotic assets: cap at 5%.

Stop Losses:
• Stocks: 2-3% SL is standard
• Crypto: 5-7% SL (higher volatility)
• Forex: 1-2% SL (lower volatility)
• Meme coins: 10%+ SL (or no SL — you're gambling)

Shorts are 2x risky:
• Unlimited theoretical loss (price can rocket).
• Borrow cost = 50% collateral locked.
• ALWAYS use SL on shorts.

The Stats tab shows your win rate. Below 50% means review your strategy —
mute fewer setups, follow rules.
`.trim() },
];

export function HelpTab() {
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState<string>('start');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SECTIONS;
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(needle) ||
      s.body.toLowerCase().includes(needle)
    );
  }, [q]);

  const active = SECTIONS.find(s => s.id === activeId) || SECTIONS[0];

  return (
    <div className="section">
      <h3>How to Play</h3>
      <input
        type="text"
        placeholder="Search docs…"
        value={q}
        onChange={e => setQ(e.target.value)}
        className="asset-search"
      />
      <div className="help-layout">
        <div className="help-toc">
          {filtered.map(s => (
            <div
              key={s.id}
              className={'help-toc-item' + (s.id === activeId ? ' active' : '')}
              onClick={() => setActiveId(s.id)}
            >
              <span className="help-icon">{s.icon}</span>
              <span>{s.title}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: 10, fontSize: 11 }}>No matches for "{q}"</div>
          )}
        </div>
        <div className="help-body">
          <div className="help-body-title">
            <span style={{ marginRight: 8 }}>{active.icon}</span>{active.title}
          </div>
          <pre className="help-body-text">{active.body}</pre>
        </div>
      </div>
    </div>
  );
}
