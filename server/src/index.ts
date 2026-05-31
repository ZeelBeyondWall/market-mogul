import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Engine } from '../../shared/engine/engine';
import { ASSETS } from '../../shared/engine/constants';
import { traderNet } from '../../shared/engine/strategies';
import { placeOrder } from '../../shared/engine/matching';
import { buildSnapshot, type C2S, type S2C, type TickPayload } from './protocol';
import { diskLoad, diskSave } from './persistence';

const PORT = Number(process.env.PORT) || 8787;

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
app.get('/state', (_, res) => res.json({ activeAsset: engine.state.active, traders: engine.state.traders.length }));

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
  const snap = buildSnapshot(engine.state, engine.state.active, rank);
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
        if (p.sl && p.sl > 0) h.sl = p.sl;
        if (p.tp && p.tp > 0) h.tp = p.tp;
      }
      ws.send(JSON.stringify({ type: 'order_result', payload: { ok: true, filled: res.filled, cost: res.cost } } satisfies S2C));
      return;
    }
    case 'close': {
      engine.closePosition(msg.payload.aid);
      return;
    }
    case 'setSLTP': {
      const h = engine.player().holdings[msg.payload.aid];
      if (h) {
        if (msg.payload.sl !== undefined) h.sl = msg.payload.sl;
        if (msg.payload.tp !== undefined) h.tp = msg.payload.tp;
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
  lastT = now;
  // light broadcast: prices + active candle
  const prices: Record<string, number> = {};
  ASSETS.forEach(a => { prices[a.id] = engine.state.assets[a.id].lastPrice; });
  const active = engine.state.active;
  const ast = engine.state.assets[active];
  const tick: TickPayload = {
    serverTime: Date.now(),
    prices,
    cash: engine.player().cash,
    activeCandle: ast.curCandle ? { ...ast.curCandle } : null,
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
