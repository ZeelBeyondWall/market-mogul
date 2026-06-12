import { Engine } from '../../../shared/engine/engine';
import { makeBook } from '../../../shared/engine/orderbook';
import type { MissionState, NewsCategory, Order, PlayerStats, Trade } from '../../../shared/engine/types';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

// Shape mirrors server/src/protocol.ts (kept loose here to avoid cross-package TS path)
interface PublicAsset {
  lastPrice: number; open: number; hi: number; lo: number; volume: number;
  history: number[];
  candles: { o: number; h: number; l: number; c: number; v: number; t?: number }[];
  curCandle: { o: number; h: number; l: number; c: number; v: number; t?: number } | null;
  candleStartT: number;
  topBids: { px: number; qty: number; ownerName: string }[];
  topAsks: { px: number; qty: number; ownerName: string }[];
  volumeHist: number[];
}

interface SnapshotPayload {
  serverTime: number;
  active: string;
  tf?: string;
  player: { name: string; cash: number; holdings: Record<string, any>; isPlayer: true; closing?: Record<string, boolean> };
  assets: Record<string, PublicAsset>;
  events: { type: 'boom'|'crash'|'news'; title: string; desc: string; t: number; assetIds?: string[]; cat?: NewsCategory }[];
  leaderboard: { id: number; name: string; net: number; strat: string; rekt: boolean; level: number; isPlayer: boolean }[];
  totalTraders: number;
  playerRank: number;
  playerStats?: PlayerStats;
  playerBonus?: number;
  playerStreak?: number;
  dailyMissions?: MissionState[];
  weeklyMissions?: MissionState[];
  playerLevel?: number;
  playerXp?: number;
  xpAtCurrent?: number;
  xpToNext?: number;
  banner?: string;
  maintenanceMode?: boolean;
  tradingHalted?: boolean;
  storeBuyAllowed?: boolean;
  recentTrades?: Trade[];
  activeHolders?: number;
}

interface TickPayload {
  serverTime: number;
  prices: Record<string, number>;
  cash: number;
  playerHoldings?: Record<string, any>;
  playerClosing?: Record<string, boolean>;
  activeId: string;
  activeTF: string;
  activeCandles: { o: number; h: number; l: number; c: number; v: number; t?: number }[];
  activeCurCandle: { o: number; h: number; l: number; c: number; v: number; t?: number } | null;
  activeCandleStartT: number;
  activeTFms: number;
  activeHistory: number[];
  activeVolumeHist: number[];
  topBidsActive?: { px: number; qty: number; ownerName: string }[];
  topAsksActive?: { px: number; qty: number; ownerName: string }[];
}

// v9: trackers to fire level-up / mission-complete notifications exactly once.
let prevLevel = 0;
const seenCompletedMissions = new Set<string>();

// Chart scrollback: client keeps up to MERGE_CAP candles per active asset/TF,
// accumulating from small tick windows merged onto the large snapshot seed.
// Keyed on candle start time `t`; falls back to plain replace if t is absent.
const MERGE_CAP = 600;
function mergeCandles(
  existing: { o: number; h: number; l: number; c: number; v: number; t?: number }[],
  incoming: { o: number; h: number; l: number; c: number; v: number; t?: number }[],
): any[] {
  if (!incoming.length) return existing;
  // If timestamps are missing on either side, we can't merge safely — replace.
  if (incoming.some(c => c.t == null) || existing.some(c => c.t == null)) {
    return incoming.slice(-MERGE_CAP);
  }
  const byT = new Map<number, any>();
  for (const c of existing) byT.set(c.t as number, c);
  for (const c of incoming) byT.set(c.t as number, c); // upsert: newer wins
  const merged = [...byT.values()].sort((a, b) => (a.t as number) - (b.t as number));
  return merged.slice(-MERGE_CAP);
}

export type C2SMsg =
  | { type: 'auth'; payload: { token: string } }
  | { type: 'order'; payload: { aid: string; side: 'buy'|'sell'; qty: number; orderType: 'market'|'limit'; limitPx?: number; slPct?: number; tpPct?: number } }
  | { type: 'close'; payload: { aid: string } }
  | { type: 'setSLTP'; payload: { aid: string; slPct?: number; tpPct?: number } }
  | { type: 'setActive'; payload: { aid: string } }
  | { type: 'setTF'; payload: { tf: string } }
  | { type: 'cancelClose'; payload: { aid: string } }
  | { type: 'claimMission'; payload: { missionId: string } }
  | { type: 'storePurchase'; payload: { cashChange: number; gemsChange: number; xpChange: number } };

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let serverTimeOffset = 0; // server - local
let lastTickT = 0;

export function getTickFrac(): number {
  if (!lastTickT) return 0;
  return Math.min(1, (performance.now() - lastTickT) / 100);
}

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
  // Stale-socket guard — detach old handlers BEFORE close to avoid double-reconnect
  if (ws) {
    try {
      ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    } catch {}
  }
  const sock = new WebSocket(WS_URL);
  ws = sock;
  sock.onopen = () => {
    if (ws !== sock) return; // stale
    reconnectAttempt = 0;
    useGame.getState().setConnected(true);
    const s = useGame.getState();
    if (s.session) {
      send({ type: 'auth', payload: { token: s.session.access_token } });
    }
    send({ type: 'setTF', payload: { tf: s.activeTF } });
    if (s.engine.state.active) send({ type: 'setActive', payload: { aid: s.engine.state.active } });
  };
  sock.onclose = () => {
    if (ws !== sock) return; // stale
    useGame.getState().setConnected(false);
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    // Exponential backoff with jitter, capped at 30s
    reconnectAttempt++;
    const base = Math.min(30000, 1000 * Math.pow(1.5, Math.min(reconnectAttempt, 8)));
    const delay = base + Math.random() * 500;
    reconnectTimer = window.setTimeout(() => connect(engine), delay);
  };
  sock.onerror = () => { /* let onclose handle reconnect */ };
  sock.onmessage = (e) => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }
    switch (msg.type) {
      case 'snapshot': applySnapshot(engine, msg.payload); break;
      case 'tick':     applyTick(engine, msg.payload);     break;
      case 'event':    {
        const { kind } = msg.payload;
        if (kind === 'boom') Audio.boom(); else if (kind === 'crash') Audio.crash();
        engine.hooks.onEvent?.({ type: kind, title: msg.payload.title, desc: msg.payload.desc } as any);
        // v9: market news → notification center.
        useGame.getState().pushNotif('news', '📰 ' + msg.payload.title, msg.payload.desc);
        break;
      }
      case 'sltp_hit': {
        engine.hooks.onSLTPHit?.(msg.payload.aid, msg.payload.kind, msg.payload.ref, msg.payload.px);
        const ev = { type: 'news' as const, title: `${msg.payload.kind === 'SL' ? '🛑' : '🎯'} ${msg.payload.kind} HIT`,
                     desc: `${msg.payload.aid} closed @ ${msg.payload.px.toFixed(msg.payload.px < 10 ? 3 : 2)}`, t: Date.now() };
        engine.state.events.unshift(ev);
        if (engine.state.events.length > 30) engine.state.events.pop();
        // v9: SL/TP trigger → notification center.
        useGame.getState().pushNotif(msg.payload.kind === 'SL' ? 'sl' : 'tp', ev.title, ev.desc);
        break;
      }
      case 'order_result': {
        if (!msg.payload.ok && msg.payload.reason) {
          engine.state.events.unshift({ type: 'news', title: '✗ ' + msg.payload.reason, desc: '', t: Date.now() });
          useGame.getState().pushToast(msg.payload.reason, 'err');
        } else if (msg.payload.ok) {
          if (msg.payload.filled > 0) {
            Audio.buy();
            useGame.getState().pushNotif('fill', `✓ Filled ${msg.payload.filled} sh @ $${(msg.payload.cost / msg.payload.filled).toFixed(2)}`);
          } else {
            useGame.getState().pushToast('Order placed — resting on book', 'info');
          }
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
  p.name = snap.player.name;
  p.cash = snap.player.cash;
  // merge holdings (preserve unset assets)
  for (const aid of Object.keys(snap.player.holdings)) {
    p.holdings[aid] = snap.player.holdings[aid];
  }
  p.closing = snap.player.closing || {};
  // Server tells us which TF the snapshot's candles are for; fall back to client store if missing.
  const tf: import('../../../shared/engine/types').TFKey =
    (snap.tf as any) || useGame.getState().activeTF;
  for (const aid of Object.keys(snap.assets)) {
    const sa = snap.assets[aid];
    const ast = engine.state.assets[aid];
    if (!ast) continue;
    ast.lastPrice = sa.lastPrice;
    ast.open = sa.open;
    ast.hi = sa.hi;
    ast.lo = sa.lo;
    ast.volume = sa.volume;
    // Server only sends heavy arrays for ACTIVE asset — skip overwrite with empty for others
    if (sa.history.length) ast.history = sa.history.slice();
    if (ast.series && ast.series[tf]) {
      if (sa.candles.length) ast.series[tf].candles = mergeCandles(ast.series[tf].candles, sa.candles);
      if (sa.curCandle) ast.series[tf].curCandle = { ...sa.curCandle };
      else if (aid === snap.active) ast.series[tf].curCandle = null;
      if (sa.candleStartT) ast.series[tf].candleStartT = sa.candleStartT;
    }
    if (sa.volumeHist.length) ast.volumeHist = sa.volumeHist.slice();
    if (sa.topBids.length || sa.topAsks.length || aid === snap.active) {
      ast.book = makeBook();
      sa.topBids.forEach((o, i) => ast.book.bids.push({ id: -1 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
      sa.topAsks.forEach((o, i) => ast.book.asks.push({ id: -1000 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
    }
  }
  useGame.getState().setLeaderboard(snap.leaderboard, snap.totalTraders, snap.playerRank);
  useGame.getState().setTradeData(snap.recentTrades || [], snap.activeHolders || 0);
  if (snap.playerStats) {
    // v9: detect level-up (fire once).
    const lvl = snap.playerLevel || 1;
    if (prevLevel === 0) prevLevel = lvl; // first snapshot — seed, no notif
    else if (lvl > prevLevel) {
      useGame.getState().pushNotif('level', `⭐ Level Up! You reached Level ${lvl}`, 'New markets/features may have unlocked.');
      prevLevel = lvl;
    }
    // v9: detect mission completion (fire once per mission id).
    const allMissions = [...(snap.dailyMissions || []), ...(snap.weeklyMissions || [])];
    for (const m of allMissions) {
      const id = m?.def?.id;
      if (!id) continue;
      if (m.completed && !seenCompletedMissions.has(id)) {
        seenCompletedMissions.add(id);
        useGame.getState().pushNotif('mission', `🎯 Mission Complete: ${m.def.title}`, `Reward $${m.def.reward} — claim it in Missions.`);
      }
      // Reset tracking when a fresh (incomplete) mission with same id reappears after reset.
      if (!m.completed && seenCompletedMissions.has(id)) seenCompletedMissions.delete(id);
    }
    useGame.getState().setPlayerExtras({
      stats: snap.playerStats,
      bonus: snap.playerBonus || 0,
      streak: snap.playerStreak || 0,
      daily: snap.dailyMissions || [],
      weekly: snap.weeklyMissions || [],
      level: snap.playerLevel || 1,
      xp: snap.playerXp || 0,
      xpAtCurrent: snap.xpAtCurrent || 0,
      xpToNext: snap.xpToNext || 100,
    });
  }
  useGame.getState().setServerFlags({
    banner: snap.banner || '',
    maintenanceMode: !!snap.maintenanceMode,
    tradingHalted: !!snap.tradingHalted,
    storeBuyAllowed: !!snap.storeBuyAllowed,
  });
  useGame.getState().notifyDataTick();
}

function applyTick(engine: Engine, tick: TickPayload): void {
  serverTimeOffset = tick.serverTime - Date.now();
  lastTickT = performance.now();
  const p = engine.player();
  p.cash = tick.cash;
  // Merge player holdings instead of replacing — preserves in-flight optimistic edits
  // (e.g. user typing in SL% input) until server echo arrives.
  if (tick.playerHoldings) {
    for (const aid of Object.keys(p.holdings)) {
      const incoming = tick.playerHoldings[aid];
      if (incoming) {
        Object.assign(p.holdings[aid], incoming);
      } else if (p.holdings[aid].shares !== 0) {
        p.holdings[aid].shares = 0;
        p.holdings[aid].avgCost = 0;
        p.holdings[aid].sl = 0;
        p.holdings[aid].tp = 0;
        p.holdings[aid].slPct = 0;
        p.holdings[aid].tpPct = 0;
      }
    }
  }
  if (tick.playerClosing) p.closing = tick.playerClosing;
  for (const aid of Object.keys(tick.prices)) {
    const ast = engine.state.assets[aid];
    if (ast) ast.lastPrice = tick.prices[aid];
  }
  // v9: check user price alerts against new prices; fire + remove on cross.
  // Collect hits first, then remove — never mutate the array while iterating.
  const alerts = useGame.getState().priceAlerts;
  if (alerts.length) {
    const fired: { id: number; aid: string; dir: string; price: number; px: number }[] = [];
    for (const al of alerts) {
      const px = tick.prices[al.aid];
      if (px == null) continue;
      const hit = al.dir === 'above' ? px >= al.price : px <= al.price;
      if (hit) fired.push({ id: al.id, aid: al.aid, dir: al.dir, price: al.price, px });
    }
    for (const f of fired) {
      useGame.getState().pushNotif('alert', `🔔 ${f.aid} ${f.dir === 'above' ? '≥' : '≤'} $${f.price}`, `Now $${f.px.toFixed(f.px < 10 ? 3 : 2)}`);
      useGame.getState().removePriceAlert(f.id);
    }
  }
  // Active asset's candle series: MERGE the small live window onto the client's
  // accumulated buffer (keyed on candle start time) so scrollback keeps growing
  // instead of being clipped to the tick window.
  if (tick.activeId && tick.activeId === engine.state.active) {
    const ast = engine.state.assets[tick.activeId];
    if (ast && ast.series) {
      const tf = (tick.activeTF || useGame.getState().activeTF) as keyof typeof ast.series;
      if (ast.series[tf]) {
        ast.series[tf].candles = mergeCandles(ast.series[tf].candles, tick.activeCandles);
        ast.series[tf].curCandle = tick.activeCurCandle ? { ...tick.activeCurCandle } : null;
        ast.series[tf].candleStartT = tick.activeCandleStartT;
      }
      ast.history = tick.activeHistory.slice();
      ast.volumeHist = tick.activeVolumeHist.slice();
      if (tick.topBidsActive) {
        ast.book = makeBook();
        tick.topBidsActive.forEach((o, i) => ast.book.bids.push({ id: -1 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
        tick.topAsksActive!.forEach((o, i) => ast.book.asks.push({ id: -1000 - i, ownerId: -1, ts: 0, px: o.px, qty: o.qty, ownerName: o.ownerName } as Order & { ownerName: string }));
      }
    }
  }
  // Other assets just get lastPrice update — full history when user switches active asset.
  useGame.getState().notifyDataTick();
}
