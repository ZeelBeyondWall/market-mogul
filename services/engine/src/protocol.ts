// WebSocket message types shared between client/server.
import type { GameState, Holding, NewsEvent, Trader } from '../../../shared/engine/types';

// Server → Client
export type S2C =
  | { type: 'snapshot'; payload: SnapshotPayload }
  | { type: 'tick'; payload: TickPayload }
  | { type: 'event'; payload: { kind: 'boom' | 'crash' | 'news'; title: string; desc: string } }
  | { type: 'sltp_hit'; payload: { aid: string; kind: 'SL' | 'TP'; ref: number; px: number } }
  | { type: 'order_result'; payload: { ok: boolean; reason?: string; filled?: number; cost?: number } };

// Client → Server
export type C2S =
  | { type: 'order'; payload: { aid: string; side: 'buy' | 'sell'; qty: number; orderType: 'market' | 'limit'; limitPx?: number; slPct?: number; tpPct?: number } }
  | { type: 'close'; payload: { aid: string } }
  | { type: 'setSLTP'; payload: { aid: string; slPct?: number; tpPct?: number } }
  | { type: 'setActive'; payload: { aid: string } }
  | { type: 'setTF'; payload: { tf: string } }
  | { type: 'cancelClose'; payload: { aid: string } };

// Snapshot — sent on connect + periodically. Compact subset of GameState.
export interface SnapshotPayload {
  serverTime: number;
  active: string;
  tf: string; // TF that the candles in `assets[active].candles` belong to
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
  closing: Record<string, boolean>;
}

export interface PublicAsset {
  lastPrice: number;
  open: number;
  hi: number;
  lo: number;
  volume: number;
  history: number[];
  candles: { o: number; h: number; l: number; c: number; v: number }[];
  curCandle: { o: number; h: number; l: number; c: number; v: number } | null;
  candleStartT: number;
  topBids: { px: number; qty: number; ownerName: string }[];
  topAsks: { px: number; qty: number; ownerName: string }[];
  volumeHist: number[];
}

// Tick — high-frequency lightweight update.
export interface TickPayload {
  serverTime: number;
  prices: Record<string, number>;
  cash: number;
  // Only NON-ZERO player holdings — keeps tick payload small at 100+ assets.
  // Client reflects position changes within 100ms of trade (no waiting for snapshot).
  playerHoldings: Record<string, Holding>;
  playerClosing: Record<string, boolean>;
  activeId: string;
  activeTF: string;
  activeCandles: { o: number; h: number; l: number; c: number; v: number }[];
  activeCurCandle: { o: number; h: number; l: number; c: number; v: number } | null;
  activeCandleStartT: number;
  activeTFms: number;
  activeHistory: number[];
  activeVolumeHist: number[];
  topBidsActive?: { px: number; qty: number; ownerName: string }[];
  topAsksActive?: { px: number; qty: number; ownerName: string }[];
}

export function trimTraderForPublic(t: Trader): PublicTrader {
  return { cash: t.cash, holdings: t.holdings, isPlayer: true, closing: t.closing || {} };
}

import type { TFKey } from '../../../shared/engine/types';

export function buildSnapshot(
  S: GameState,
  active: string,
  playerRank: number,
  tf: TFKey,
): SnapshotPayload {
  const p = S.traders[0];
  const assets: Record<string, PublicAsset> = {};
  for (const aid of Object.keys(S.assets)) {
    const a = S.assets[aid];
    const isActive = aid === active;
    const s = a.series[tf];
    assets[aid] = {
      lastPrice: a.lastPrice,
      open: a.open,
      hi: a.hi,
      lo: a.lo,
      volume: a.volume,
      // Heavy arrays sent ONLY for active asset — trims ~95% of payload for 100+ assets.
      history: isActive ? a.history.slice(-120) : [],
      candles: isActive ? s.candles.slice(-60) : [],
      curCandle: isActive && s.curCandle ? { ...s.curCandle } : null,
      candleStartT: isActive ? s.candleStartT : 0,
      topBids: isActive ? a.book.bids.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: S.traders[o.ownerId]?.name || '' })) : [],
      topAsks: isActive ? a.book.asks.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: S.traders[o.ownerId]?.name || '' })) : [],
      volumeHist: isActive ? a.volumeHist.slice(-120) : [],
    };
  }
  // Leaderboard left empty — caller (sendSnapshot) overwrites with cached top-N.
  return {
    serverTime: Date.now(),
    active,
    tf,
    player: trimTraderForPublic(p),
    assets,
    events: S.events.slice(0, 15),
    leaderboard: [],
    totalTraders: S.traders.length,
    playerRank,
  };
}
