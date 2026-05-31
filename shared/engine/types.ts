export type StrategyId =
  | 'yolo' | 'diamond' | 'paper' | 'permabull' | 'permabear'
  | 'lazy' | 'newschase' | 'fomo' | 'conservative' | 'gambler'
  | 'value' | 'trend' | 'mm' | 'copycat' | 'revenge'
  | 'player';

export interface AssetDef {
  id: string;
  name: string;
  icon: string;
  fairValue: number;
  div: number;
  vol: number;
  float: number;
  desc: string;
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

export interface AssetState {
  book: Book;
  lastPrice: number;
  open: number;
  hi: number;
  lo: number;
  volume: number;
  volumeHist: number[];
  history: number[];
  candles: Candle[];
  curCandle: Candle | null;
  candleStartT: number;
  fv: number;
  fvDelta: number;
  fvEventTicks: number;
  volMult: number;
  volEventTicks: number;
  _candleVolStart?: number;
  _lastVolSnap?: number;
}

export interface Holding {
  shares: number;
  avgCost: number;
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
