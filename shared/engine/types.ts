export type StrategyId =
  | 'yolo' | 'diamond' | 'paper' | 'permabull' | 'permabear'
  | 'lazy' | 'newschase' | 'fomo' | 'conservative' | 'gambler'
  | 'value' | 'trend' | 'mm' | 'copycat' | 'revenge'
  | 'player';

export type AssetCategory =
  | 'penny' | 'tech' | 'bank' | 'index' | 'crypto'
  | 'forex' | 'commodity' | 'options' | 'hedge' | 'bond';

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
  // Pending close intents — assetId -> true means "drain this position to 0 over upcoming ticks"
  closing?: Record<string, boolean>;
}

export interface NewsEventDef {
  type: 'boom' | 'crash' | 'news';
  title: string;
  desc: string;
  weight: number;
  fvDelta: number;
  vol: number;
  dur: number;
  filter?: string[];
}

export interface NewsEvent {
  type: 'boom' | 'crash' | 'news';
  title: string;
  desc: string;
  t: number;
}

export interface GameState {
  traders: Trader[];
  assets: Record<string, AssetState>;
  events: NewsEvent[];
  active: string;
  orderId: number;
}
