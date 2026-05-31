import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { spawn } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { Engine } from '../../../shared/engine/engine';
import { ASSETS, NEWS_EVENTS as NEWS_EVENTS_REF, STRATEGIES } from '../../../shared/engine/constants';
import { traderNet } from '../../../shared/engine/strategies';
import { placeOrder } from '../../../shared/engine/matching';
import { applyEvent as applyEventRef } from '../../../shared/engine/market';
import { makeTrader } from '../../../shared/engine/traders';
import { TF_LIST, TF_MS, type TFKey, type StrategyId } from '../../../shared/engine/types';
import { buildSnapshot, type C2S, type S2C, type TickPayload } from './protocol';
import { diskLoad, diskSave } from './persistence';

// per-connection (single-user for now) selected TF
let activeTF: TFKey = '5s';

// Drain any pending close intents by firing market orders against current book.
function drainCloses(): void {
  const p = engine.player();
  if (!p.closing) return;
  for (const aid of Object.keys(p.closing)) {
    if (!p.closing[aid]) continue;
    const h = p.holdings[aid];
    if (!h || h.shares === 0) {
      delete p.closing[aid];
      if (h) { h.sl = 0; h.tp = 0; h.slPct = 0; h.tpPct = 0; }
      continue;
    }
    if (h.shares > 0) {
      placeOrder(engine.state, 0, aid, 'sell', h.shares, 0, 'market', engine.callbacks());
    } else {
      placeOrder(engine.state, 0, aid, 'buy', -h.shares, 0, 'market', engine.callbacks());
    }
    // Verify post-trade — if drained to 0 clean up immediately
    const h2 = engine.player().holdings[aid];
    if (!h2 || h2.shares === 0) {
      delete p.closing[aid];
      if (h2) { h2.sl = 0; h2.tp = 0; h2.slPct = 0; h2.tpPct = 0; }
    }
  }
}

const PORT = Number(process.env.PORT) || 8788;

// ---- ENGINE ----
const engine = new Engine();
const loaded = diskLoad(engine.state);
if (loaded) {
  engine.seedBooks(); // top up any empty books
  console.log('💾 state loaded');
} else {
  console.log('🆕 fresh state');
}

// ---- HTTP + WS ----
const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true, time: Date.now() }));

// Reset: wipe disk save + kill server so start.bat must be re-run.
// Wipe state.json + reinitialize engine in-place (no process kill).
// Existing WS clients get a fresh snapshot on next interval and just re-render.
app.post('/reset', (_, res) => {
  console.log('🔄 /reset — wiping disk + reinitializing engine');
  try {
    const fs = require('fs');
    const path = require('path');
    const f = path.resolve(process.cwd(), 'state.json');
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch { /* ignore */ }
  // rebuild fresh state in place (preserves hooks + connection)
  engine.state = engine.freshState();
  engine.seedBooks();
  // immediately push snapshot to all clients
  for (const ws of clients) sendSnapshot(ws);
  res.json({ ok: true });
});
app.get('/state', (_, res) => res.json({ activeAsset: engine.state.active, traders: engine.state.traders.length }));

// ============ ADMIN ============
const SERVER_START = Date.now();

app.get('/admin/stats', (_, res) => {
  const traders = engine.state.traders;
  const stratCounts: Record<string, number> = {};
  let alive = 0;
  let totalCash = 0;
  let totalNet = 0;
  for (const t of traders) {
    if (!t.rekt) alive++;
    stratCounts[t.strat as string] = (stratCounts[t.strat as string] || 0) + 1;
    totalCash += t.cash;
    totalNet += traderNet(t, engine.state);
  }
  const totalVolume = ASSETS.reduce((s, a) => s + engine.state.assets[a.id].volume, 0);
  res.json({
    uptimeSec: Math.floor((Date.now() - SERVER_START) / 1000),
    totalTraders: traders.length,
    aliveTraders: alive,
    rektTraders: traders.length - alive,
    totalCash, totalNet, totalVolume,
    totalTrades: totalVolume, // proxy: total shares traded ≈ trade volume
    activeAsset: engine.state.active,
    activeTF,
    botCounts: stratCounts,
    assetCount: ASSETS.length,
    recentEvents: engine.state.events.slice(0, 10),
    clients: clients.size,
  });
});

app.get('/admin/bots', (_, res) => {
  const rows = engine.state.traders.map(t => ({
    id: t.id, name: t.name, strat: t.strat, cash: t.cash,
    net: traderNet(t, engine.state), rekt: !!t.rekt,
    openOrders: t.openOrders.length, isPlayer: t.isPlayer,
  })).sort((a, b) => b.net - a.net);
  res.json({ bots: rows });
});

app.post('/admin/event', express.json(), (req, res) => {
  const { title } = (req.body || {}) as { title?: string };
  let ev = title ? NEWS_EVENTS_REF.find(e => e.title === title) : undefined;
  if (!ev) ev = NEWS_EVENTS_REF[Math.floor(Math.random() * NEWS_EVENTS_REF.length)];
  applyEventRef(engine.state, ev);
  engine.hooks.onEvent?.(ev);
  for (const ws of clients) sendSnapshot(ws);
  res.json({ ok: true, fired: ev.title });
});

app.post('/admin/kill-bot', express.json(), (req, res) => {
  const { id } = (req.body || {}) as { id?: number };
  if (id == null || id === 0) { res.status(400).json({ ok: false, reason: 'invalid id' }); return; }
  const t = engine.state.traders[id];
  if (!t) { res.status(404).json({ ok: false, reason: 'not found' }); return; }
  t.cash = 0;
  Object.values(t.holdings).forEach(h => { h.shares = 0; h.avgCost = 0; });
  res.json({ ok: true });
});

// Spawn N new bots. Optional `strategy` forces a specific personality.
app.post('/admin/spawn', express.json(), (req, res) => {
  const { n = 1, strategy } = (req.body || {}) as { n?: number; strategy?: string };
  const count = Math.max(1, Math.min(50000, Math.floor(n)));
  let strat: StrategyId | undefined;
  if (strategy && (STRATEGIES as string[]).includes(strategy)) strat = strategy as StrategyId;
  for (let k = 0; k < count; k++) {
    const id = engine.state.traders.length;
    engine.state.traders.push(makeTrader(id, false, strat));
  }
  // seed initial books for these new bots so they have liquidity to draw from
  engine.seedBooks();
  for (const ws of clients) sendSnapshot(ws);
  res.json({ ok: true, added: count, total: engine.state.traders.length });
});

// Kill all bots matching a strategy (sets cash + holdings to 0 — REKT)
app.post('/admin/kill-strategy', express.json(), (req, res) => {
  const { strategy } = (req.body || {}) as { strategy?: string };
  if (!strategy) { res.status(400).json({ ok: false, reason: 'strategy required' }); return; }
  let killed = 0;
  for (const t of engine.state.traders) {
    if (t.isPlayer || t.rekt) continue;
    if (t.strat === strategy) {
      t.cash = 0;
      Object.values(t.holdings).forEach(h => { h.shares = 0; h.avgCost = 0; });
      killed++;
    }
  }
  res.json({ ok: true, killed, strategy });
});

// Permanently remove all REKT bots (frees memory, prunes array).
// Re-numbering not done — IDs stay sparse. Engine handles via traders.length checks.
app.post('/admin/purge-rekt', (_, res) => {
  const before = engine.state.traders.length;
  engine.state.traders = engine.state.traders.filter(t => t.isPlayer || !t.rekt);
  // re-index IDs to keep array contiguous (orders use ownerId — must clean books)
  engine.state.traders.forEach((t, i) => { t.id = i; });
  // Drop all book orders since owner IDs may have shifted
  ASSETS.forEach(a => { engine.state.assets[a.id].book = { bids: [], asks: [] }; });
  // Bots will repost
  for (const ws of clients) sendSnapshot(ws);
  res.json({ ok: true, removed: before - engine.state.traders.length, total: engine.state.traders.length });
});

app.post('/admin/reset', (_, res) => {
  console.log('🔄 admin /reset');
  try {
    const fs = require('fs');
    const path = require('path');
    const f = path.resolve(process.cwd(), 'state.json');
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch { /* ignore */ }
  engine.state = engine.freshState();
  engine.seedBooks();
  for (const ws of clients) sendSnapshot(ws);
  res.json({ ok: true });
});

// Dev-only emergency shutdown — kills both server (this process) and the
// Vite dev window (matched by cmd-window title set in start.bat).
app.post('/shutdown', (_, res) => {
  console.log('🛑 /shutdown received — saving + killing windows...');
  diskSave(engine.state);
  res.json({ ok: true });
  // Kill the client cmd window by its title (Windows-only, no-op elsewhere)
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq MarketMogul-Client*'], { detached: true, stdio: 'ignore' }).unref();
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq MarketMogul-Server*'], { detached: true, stdio: 'ignore' }).unref();
    } catch { /* ignore */ }
  }
  setTimeout(() => process.exit(0), 300);
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const clients = new Set<WebSocket>();

function broadcast(msg: S2C) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function sendSnapshot(ws: WebSocket) {
  const rank = engine.playerRank();
  const snap = buildSnapshot(engine.state, engine.state.active, rank, activeTF);
  // fill in net worths
  snap.leaderboard = snap.leaderboard
    .map(b => ({ ...b, net: traderNet(engine.state.traders[b.id], engine.state), strat: engine.state.traders[b.id].strat as string }))
    .sort((a, b) => b.net - a.net);
  ws.send(JSON.stringify({ type: 'snapshot', payload: snap } satisfies S2C));
}

// hooks for event/SL-TP broadcast
engine.hooks.onEvent = (ev) => broadcast({ type: 'event', payload: { kind: ev.type, title: ev.title, desc: ev.desc } });
engine.hooks.onSLTPHit = (aid, kind, ref, px) =>
  broadcast({ type: 'sltp_hit', payload: { aid, kind, ref, px } });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`+ client (${clients.size} total)`);
  sendSnapshot(ws);

  ws.on('message', (raw) => {
    let msg: C2S;
    try { msg = JSON.parse(String(raw)) as C2S; } catch { return; }
    handleClientMessage(ws, msg);
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`- client (${clients.size} total)`);
  });

  ws.on('error', () => clients.delete(ws));
});

function handleClientMessage(ws: WebSocket, msg: C2S) {
  switch (msg.type) {
    case 'setActive': {
      if (engine.state.assets[msg.payload.aid]) engine.state.active = msg.payload.aid;
      sendSnapshot(ws);
      return;
    }
    case 'setTF': {
      if ((TF_LIST as string[]).includes(msg.payload.tf)) {
        activeTF = msg.payload.tf as TFKey;
        sendSnapshot(ws);
      }
      return;
    }
    case 'order': {
      const p = msg.payload;
      const ast = engine.state.assets[p.aid];
      if (!ast) return;
      const hold = engine.player().holdings[p.aid];
      // simple guards
      if (p.side === 'buy' && hold.shares < 0) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Cover short first' } } satisfies S2C));
        return;
      }
      if (p.side === 'sell' && hold.shares > 0) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Sell long first' } } satisfies S2C));
        return;
      }
      const lpx = p.orderType === 'market' ? 0 : (p.limitPx ?? ast.lastPrice);
      const res = placeOrder(engine.state, 0, p.aid, p.side, p.qty, lpx, p.orderType, engine.callbacks());
      const h = engine.player().holdings[p.aid];
      if (h && h.shares !== 0) {
        if (p.slPct && p.slPct > 0) h.slPct = p.slPct;
        if (p.tpPct && p.tpPct > 0) h.tpPct = p.tpPct;
      }
      ws.send(JSON.stringify({ type: 'order_result', payload: { ok: true, filled: res.filled, cost: res.cost } } satisfies S2C));
      return;
    }
    case 'close': {
      // Mark as pending close — server will keep firing market orders each tick
      // until the position is fully drained (handles thin/empty books).
      const p = engine.player();
      if (!p.closing) p.closing = {};
      p.closing[msg.payload.aid] = true;
      drainCloses(); // immediate attempt
      return;
    }
    case 'cancelClose': {
      const p = engine.player();
      if (p.closing) delete p.closing[msg.payload.aid];
      return;
    }
    case 'setSLTP': {
      const h = engine.player().holdings[msg.payload.aid];
      if (h) {
        if (msg.payload.slPct !== undefined) { h.slPct = msg.payload.slPct; h.sl = 0; }
        if (msg.payload.tpPct !== undefined) { h.tpPct = msg.payload.tpPct; h.tp = 0; }
      }
      return;
    }
  }
}

// ---- TICK LOOP (server-authoritative, 10 Hz) ----
const TICK_MS = 100;
let lastT = performance.now();
setInterval(() => {
  const now = performance.now();
  engine.step(now);
  drainCloses();
  lastT = now;
  // light broadcast: prices + active candle
  const prices: Record<string, number> = {};
  ASSETS.forEach(a => { prices[a.id] = engine.state.assets[a.id].lastPrice; });
  const active = engine.state.active;
  const ast = engine.state.assets[active];
  const series = ast.series[activeTF];
  const tick: TickPayload = {
    serverTime: Date.now(),
    prices,
    cash: engine.player().cash,
    activeId: active,
    activeTF,
    activeCandles: series.candles.slice(-60),
    activeCurCandle: series.curCandle ? { ...series.curCandle } : null,
    activeCandleStartT: series.candleStartT,
    activeTFms: TF_MS[activeTF],
    activeHistory: ast.history.slice(-120),
    activeVolumeHist: ast.volumeHist.slice(-120),
    topBidsActive: ast.book.bids.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: engine.state.traders[o.ownerId]?.name || '' })),
    topAsksActive: ast.book.asks.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: engine.state.traders[o.ownerId]?.name || '' })),
  };
  broadcast({ type: 'tick', payload: tick });
}, TICK_MS);

// periodic full snapshot every 5s to resync
setInterval(() => {
  for (const ws of clients) sendSnapshot(ws);
}, 5000);

// disk save every 15s
setInterval(() => diskSave(engine.state), 15000);
process.on('SIGINT', () => { diskSave(engine.state); process.exit(0); });
process.on('SIGTERM', () => { diskSave(engine.state); process.exit(0); });

httpServer.listen(PORT, () => {
  console.log(`🟢 server listening :${PORT}  (ws on /ws)`);
});
