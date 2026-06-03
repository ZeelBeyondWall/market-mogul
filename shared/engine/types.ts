export type StrategyId =
  | 'yolo' | 'diamond' | 'paper' | 'permabull' | 'permabear'
  | 'lazy' | 'newschase' | 'fomo' | 'conservative' | 'gambler'
  | 'value' | 'trend' | 'mm' | 'copycat' | 'revenge'
  | 'player';

// v5: market is the top-level grouping. Categories are sub-divisions of a market
// (e.g. tech/bank/energy under stocks; large/mid/meme under crypto).
export type Market = 'stocks' | 'crypto' | 'forex';

export type AssetCategory =
  // legacy + stocks subcategories
  | 'penny' | 'tech' | 'bank' | 'index' | 'commodity' | 'options' | 'hedge' | 'bond'
  | 'energy' | 'health' | 'consumer' | 'gaming'
  // crypto subcategories
  | 'crypto' | 'crypto_large' | 'crypto_mid' | 'crypto_meme'
  // forex subcategories
  | 'forex' | 'forex_major' | 'forex_cross';

export interface AssetDef {
  id: string;
  name: string;
  icon: string;
  fairValue: number;
  div: number;
  vol: number;
  float: number;
  desc: string;
  cat: AssetCategory;
  market: Market;
  minLevel: number;     // player/bot must be >= this to trade
}

export interface Order {
  id: number;
  ownerId: number;
  px: number;
  qty: number;
  ts: number;
  ownerName?: string; // populated client-side from snapshots for display
}

export interface Book {
  bids: Order[];
  asks: Order[];
}

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type TFKey = '1s' | '5s' | '30s' | '1m' | '5m';
export const TF_MS: Record<TFKey, number> = {
  '1s': 1000, '5s': 5000, '30s': 30000, '1m': 60000, '5m': 300000,
};
export const TF_LIST: TFKey[] = ['1s','5s','30s','1m','5m'];

export interface CandleSeries {
  candles: Candle[];
  curCandle: Candle | null;
  candleStartT: number;
}

export interface AssetState {
  book: Book;
  lastPrice: number;
  open: number;
  hi: number;
  lo: number;
  volume: number;
  volumeHist: number[];
  history: number[];
  // Multi-TF candles. Each TF maintains its own series.
  series: Record<TFKey, CandleSeries>;
  fv: number;
  fvDelta: number;
  fvEventTicks: number;
  volMult: number;
  volEventTicks: number;
  _lastVolSnap?: number;
}

export interface Holding {
  shares: number;
  avgCost: number;
  // SL/TP stored as PERCENT from avgCost (e.g. 0.5 = 0.5%, 2 = 2%).
  // Long: SL triggers when price <= avgCost*(1 - slPct/100); TP when price >= avgCost*(1 + tpPct/100).
  // Short: SL triggers when price >= avgCost*(1 + slPct/100); TP when price <= avgCost*(1 - tpPct/100).
  slPct?: number;
  tpPct?: number;
  // Legacy absolute fields — still supported as fallback if % not set.
  sl?: number;
  tp?: number;
}

export interface Indicators {
  emaFast: number | null;
  emaSlow: number | null;
}

export interface Trader {
  id: number;
  name: string;
  cash: number;
  holdings: Record<string, Holding>;
  strat: StrategyId;
  isPlayer: boolean;
  activity: number;
  cooldown: number;
  openOrders: { assetId: string; side: 'bids' | 'asks'; id: number }[];
  pickedAssets: string[] | null;
  fairBias: number;
  riskTol: number;
  stopLoss: number;
  takeProfit: number;
  indicators: Record<string, Indicators>;
  bornNet: number;
  tradesSinceChange: number;
  mutateCooldown: number;
  bornAt: number;
  rekt?: boolean;
  closing?: Record<string, boolean>;
  tier?: 'retail' | 'whale' | 'institution';
  greed?: number;
  fear?: number;
  hype?: number;
  // v8.9: House Market Maker — provides liquidity on every asset around fair
  // value. Excluded from bot ticking, rekt sweep, leaderboard, and economy
  // aggregates. In executeTrade its cash/holdings are NOT mutated (infinite
  // counterparty), so it never accumulates or pollutes totals.
  isHouse?: boolean;
  // Perf cache — invalidated on any trade involving this trader.
  _netCache?: number;
  _netDirty?: boolean;

  // v10: cumulative trading fees + short borrow costs paid by this trader.
  totalFeesPaid?: number;
  totalBorrowPaid?: number;

  // v5: Progression. Bots + player both have it. Small int = cheap at 500K bots.
  level: number;
  xp: number;

  // ===== PLAYER-ONLY (Trader[0] only — never set on bots) =====
  // Bounded ring of last 500 closed trades.
  playerTrades?: Trade[];
  // Entry timestamp per asset (set when position opens 0 → nonzero).
  playerEntryTs?: Record<string, number>;
  // Mission bonus — pays out from missions. NOT included in traderNet/leaderboard.
  bonus?: number;
  // Login streak tracking (UTC day-number based)
  loginStreak?: number;
  lastLoginDay?: number;     // utcDayNumber() value
  lastClaimedDay?: number;   // last day daily-login bonus was claimed
  // Mission state — regenerated on day/week rollover
  dailyMissions?: MissionState[];
  weeklyMissions?: MissionState[];
  dailyMissionDay?: number;  // day-number the daily set was generated for
  weeklyMissionWeek?: number;// iso week number the weekly set was generated for
  // Portfolio snapshot at UTC day start — for portfolioPct mission goal
  dayStartNet?: number;
  dayStartDay?: number;
}

// Extended news taxonomy — sub-category drives icon/color in UI and bot reaction logic.
export type NewsCategory =
  | 'earnings' | 'analyst' | 'industry' | 'economy' | 'regulatory'
  | 'product' | 'supply' | 'sentiment' | 'macro' | 'other';

export interface NewsEventDef {
  type: 'boom' | 'crash' | 'news';
  title: string;
  desc: string;
  weight: number;
  fvDelta: number;
  vol: number;
  dur: number;
  filter?: string[];                   // explicit asset-id list
  sectorFilter?: AssetCategory[];      // resolved to asset ids at apply time
  cat?: NewsCategory;                  // narrative classification
}

export interface NewsEvent {
  type: 'boom' | 'crash' | 'news';
  title: string;
  desc: string;
  t: number;
  // Asset ids actually affected at fire-time. Enables per-stock news filter.
  assetIds?: string[];
  cat?: NewsCategory;
}

// PLAYER-ONLY: never attach these to bot Trader instances at scale.
export interface Trade {
  assetId: string;
  side: 'long' | 'short';      // direction CLOSED
  qty: number;                  // shares closed
  entryPx: number;              // avg cost at open
  exitPx: number;
  entryTs: number;
  exitTs: number;
  pnl: number;                  // realized cash p/l
}

export interface PlayerStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;             // 0-100
  realizedPL: number;
  unrealizedPL: number;
  largestWin: number;
  largestLoss: number;
  avgPL: number;
  avgHoldMs: number;
  bestAsset: string | null;
  worstAsset: string | null;
  rank: number;
  total: number;
}

export type MissionPeriod = 'daily' | 'weekly';
export type MissionGoal =
  | { kind: 'trades';        target: number }
  | { kind: 'profitable';    target: number }
  | { kind: 'distinct';      target: number }
  | { kind: 'portfolioPct';  target: number }   // % growth from day start
  | { kind: 'holdHours';     target: number };  // hold any position >= N hours

export interface MissionDef {
  id: string;
  period: MissionPeriod;
  title: string;
  desc: string;
  goal: MissionGoal;
  reward: number;             // bonus units (NOT cash — see Trader.bonus)
}

export interface MissionState {
  def: MissionDef;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface GameState {
  traders: Trader[];
  assets: Record<string, AssetState>;
  events: NewsEvent[];
  active: string;
  orderId: number;
  // v9.4: index of the House Market Maker in `traders`. Persisted so a loaded
  // save still knows its house (otherwise liquidity silently stops after a
  // server restart, leaving books to drain). -1 = none.
  houseId?: number;
  // v7.1: transient cap for bot asset access. Set by engine each tick when
  // admin enables strictBotLevelGate. 0/undefined = no cap (default).
  playerLevelCap?: number;
}
