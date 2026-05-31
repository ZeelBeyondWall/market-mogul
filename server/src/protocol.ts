// WebSocket message types shared between client/server.
import type { GameState, Holding, NewsEvent, Trader } from '../../shared/engine/types';

// Server → Client
export type S2C =
  | { type: 'snapshot'; payload: SnapshotPayload }
  | { type: 'tick'; payload: TickPayload }
  | { type: 'event'; payload: { kind: 'boom' | 'crash' | 'news'; title: string; desc: string } }
  | { type: 'sltp_hit'; payload: { aid: string; kind: 'SL' | 'TP'; ref: number; px: number } }
  | { type: 'order_result'; payload: { ok: boolean; reason?: string; filled?: number; cost?: number } };

// Client → Server
export type C2S =
  | { type: 'order'; payload: { aid: string; side: 'buy' | 'sell'; qty: number; orderType: 'market' | 'limit'; limitPx?: number; sl?: number; tp?: number } }
  | { type: 'close'; payload: { aid: string } }
  | { type: 'setSLTP'; payload: { aid: string; sl?: number; tp?: number } }
  | { type: 'setActive'; payload: { aid: string } };

// Snapshot — sent on connect + periodically. Compact subset of GameState.
export interface SnapshotPayload {
  serverTime: number;
  active: string;
  player: PublicTrader;
  assets: Record<string, PublicAsset>;
  events: NewsEvent[];
  leaderboard: { id: number; name: string; net: number; strat: string; rekt: boolean }[];
  totalTraders: number;
  playerRank: number;
}

export interface PublicTrader {
  cash: number;
  holdings: Record<string, Holding>;
  isPlayer: true;
}

export interface PublicAsset {
  lastPrice: number;
  open: number;
  hi: number;
  lo: number;
  volume: number;
  history: number[];      // last 120 ticks
  candles: { o: number; h: number; l: number; c: number; v: number }[]; // last 60
  curCandle: { o: number; h: number; l: number; c: number; v: number } | null;
  candleStartT: number;
  topBids: { px: number; qty: number; ownerName: string }[];
  topAsks: { px: number; qty: number; ownerName: string }[];
  volumeHist: number[];   // last 120
}

// Tick — high-frequency lightweight update.
export interface TickPayload {
  serverTime: number;
  prices: Record<string, number>; // last prices per asset
  cash: number;
  // changed candles (current + closed-this-tick) for active asset only
  activeCandle?: { o: number; h: number; l: number; c: number; v: number } | null;
  newClosedCandle?: { o: number; h: number; l: number; c: number; v: number } | null;
  topBidsActive?: { px: number; qty: number; ownerName: string }[];
  topAsksActive?: { px: number; qty: number; ownerName: string }[];
}

export function trimTraderForPublic(t: Trader): PublicTrader {
  return { cash: t.cash, holdings: t.holdings, isPlayer: true };
}

export function buildSnapshot(
  S: GameState,
  active: string,
  playerRank: number,
): SnapshotPayload {
  const p = S.traders[0];
  const assets: Record<string, PublicAsset> = {};
  for (const aid of Object.keys(S.assets)) {
    const a = S.assets[aid];
    assets[aid] = {
      lastPrice: a.lastPrice,
      open: a.open,
      hi: a.hi,
      lo: a.lo,
      volume: a.volume,
      history: a.history.slice(-120),
      candles: a.candles.slice(-60),
      curCandle: a.curCandle ? { ...a.curCandle } : null,
      candleStartT: a.candleStartT,
      topBids: a.book.bids.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: S.traders[o.ownerId]?.name || '' })),
      topAsks: a.book.asks.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: S.traders[o.ownerId]?.name || '' })),
      volumeHist: a.volumeHist.slice(-120),
    };
  }
  const sorted = S.traders.map(t => ({ id: t.id, name: t.name, net: 0, strat: t.strat as string, rekt: !!t.rekt })).slice();
  // net computed by caller-side via engine
  return {
    serverTime: Date.now(),
    active,
    player: trimTraderForPublic(p),
    assets,
    events: S.events.slice(0, 15),
    leaderboard: sorted,
    totalTraders: S.traders.length,
    playerRank,
  };
}
