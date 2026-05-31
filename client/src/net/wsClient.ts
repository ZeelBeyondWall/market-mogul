import { Engine } from '../../../shared/engine/engine';
import { makeBook } from '../../../shared/engine/orderbook';
import type { Order } from '../../../shared/engine/types';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

// Shape mirrors server/src/protocol.ts (kept loose here to avoid cross-package TS path)
interface PublicAsset {
  lastPrice: number; open: number; hi: number; lo: number; volume: number;
  history: number[];
  candles: { o: number; h: number; l: number; c: number; v: number }[];
  curCandle: { o: number; h: number; l: number; c: number; v: number } | null;
  candleStartT: number;
  topBids: { px: number; qty: number; ownerName: string }[];
  topAsks: { px: number; qty: number; ownerName: string }[];
  volumeHist: number[];
}

interface SnapshotPayload {
  serverTime: number;
  active: string;
  player: { cash: number; holdings: Record<string, any>; isPlayer: true };
  assets: Record<string, PublicAsset>;
  events: { type: 'boom'|'crash'|'news'; title: string; desc: string; t: number }[];
  leaderboard: { id: number; name: string; net: number; strat: string; rekt: boolean }[];
  totalTraders: number;
  playerRank: number;
}

interface TickPayload {
  serverTime: number;
  prices: Record<string, number>;
  cash: number;
  activeCandle?: { o: number; h: number; l: number; c: number; v: number } | null;
  topBidsActive?: { px: number; qty: number; ownerName: string }[];
  topAsksActive?: { px: number; qty: number; ownerName: string }[];
}

export type C2SMsg =
  | { type: 'order'; payload: { aid: string; side: 'buy'|'sell'; qty: number; orderType: 'market'|'limit'; limitPx?: number; sl?: number; tp?: number } }
  | { type: 'close'; payload: { aid: string } }
  | { type: 'setSLTP'; payload: { aid: string; sl?: number; tp?: number } }
  | { type: 'setActive'; payload: { aid: string } };

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let serverTimeOffset = 0; // server - local

const WS_URL = (() => {
  // Defaults to localhost:8787 in dev. Override via VITE_WS_URL for prod deploy.
  const env = (import.meta as any).env;
  return env?.VITE_WS_URL || `ws://${location.hostname}:8787/ws`;
})();

export function getServerNow(): number {
  return Date.now() + serverTimeOffset;
}

export function send(msg: C2SMsg): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export function connect(engine: Engine): void {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { useGame.getState().setConnected(true); };
  ws.onclose = () => {
    useGame.getState().setConnected(false);
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => connect(engine), 1500);
  };
  ws.onerror = () => { /* let onclose handle reconnect */ };
  ws.onmessage = (e) => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }
    switch (msg.type) {
      case 'snapshot': applySnapshot(engine, msg.payload); break;
      case 'tick':     applyTick(engine, msg.payload);     break;
      case 'event':    {
        const { kind } = msg.payload;
        if (kind === 'boom') Audio.boom(); else if (kind === 'crash') Audio.crash();
        engine.hooks.onEvent?.({ type: kind, title: msg.payload.title, desc: msg.payload.desc } as any);
        break;
      }
      case 'sltp_hit': {
        engine.hooks.onSLTPHit?.(msg.payload.aid, msg.payload.kind, msg.payload.ref, msg.payload.px);
        const ev = { type: 'news' as const, title: `${msg.payload.kind === 'SL' ? '🛑' : '🎯'} ${msg.payload.kind} HIT`,
                     desc: `${msg.payload.aid} closed @ ${msg.payload.px.toFixed(msg.payload.px < 10 ? 3 : 2)}`, t: Date.now() };
        engine.state.events.unshift(ev);
        if (engine.state.events.length > 30) engine.state.events.pop();
        break;
      }
      case 'order_result': {
        if (!msg.payload.ok && msg.payload.reason) {
          engine.state.events.unshift({ type: 'news', title: '✗ ' + msg.payload.reason, desc: '', t: Date.now() });
        } else if (msg.payload.ok && msg.payload.filled > 0) {
          Audio.buy(); // generic confirmation sound
        }
        break;
      }
    }
  };
}

function applySnapshot(engine: Engine, snap: SnapshotPayload): void {
  serverTimeOffset = snap.serverTime - Date.now();
  engine.state.active = snap.active;
  engine.state.events = snap.events;
  const p = engine.player();
  p.cash = snap.player.cash;
  // merge holdings (preserve unset assets)
  for (const aid of Object.keys(snap.player.holdings)) {
    p.holdings[aid] = snap.player.holdings[aid];
  }
  for (const aid of Object.keys(snap.assets)) {
    const sa = snap.assets[aid];
    const ast = engine.state.assets[aid];
    if (!ast) continue;
    ast.lastPrice = sa.lastPrice;
    ast.open = sa.open;
    ast.hi = sa.hi;
    ast.lo = sa.lo;
    ast.volume = sa.volume;
    ast.history = sa.history.slice();
    ast.candles = sa.candles.slice();
    ast.curCandle = sa.curCandle ? { ...sa.curCandle } : null;
    ast.candleStartT = sa.candleStartT;
    ast.volumeHist = sa.volumeHist.slice();
    ast.book = makeBook();
    sa.topBids.forEach((o, i) => ast.book.bids.push({ id: -1 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
    sa.topAsks.forEach((o, i) => ast.book.asks.push({ id: -1000 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
  }
  useGame.getState().setLeaderboard(snap.leaderboard, snap.totalTraders, snap.playerRank);
  useGame.getState().notifyTick();
}

function applyTick(engine: Engine, tick: TickPayload): void {
  serverTimeOffset = tick.serverTime - Date.now();
  engine.player().cash = tick.cash;
  for (const aid of Object.keys(tick.prices)) {
    const ast = engine.state.assets[aid];
    if (ast) {
      ast.lastPrice = tick.prices[aid];
      // append to history if changed (rolling window)
      ast.history.push(tick.prices[aid]);
      if (ast.history.length > 240) ast.history.shift();
    }
  }
  const ast = engine.state.assets[engine.state.active];
  if (ast && tick.activeCandle !== undefined) {
    if (tick.activeCandle) ast.curCandle = { ...tick.activeCandle };
    else {
      // server closed candle this tick — push curCandle to candles
      if (ast.curCandle) { ast.candles.push(ast.curCandle); if (ast.candles.length > 120) ast.candles.shift(); }
      ast.curCandle = null;
      ast.candleStartT = tick.serverTime;
    }
  }
  if (ast && tick.topBidsActive) {
    ast.book = makeBook();
    tick.topBidsActive.forEach((o, i) => ast.book.bids.push({ id: -1 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
    tick.topAsksActive!.forEach((o, i) => ast.book.asks.push({ id: -1000 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
  }
  useGame.getState().notifyTick();
}
