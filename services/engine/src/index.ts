import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { spawn } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { Engine } from '../../../shared/engine/engine';
import { ASSETS, NEWS_EVENTS as NEWS_EVENTS_REF, STRATEGIES, xpToReach, levelFromXp } from '../../../shared/engine/constants';
import { traderNet } from '../../../shared/engine/strategies';
import { placeOrder } from '../../../shared/engine/matching';
import { applyEvent as applyEventRef } from '../../../shared/engine/market';
import { claimMission } from '../../../shared/engine/missions';
import { makeTrader } from '../../../shared/engine/traders';
import { TF_LIST, TF_MS, type TFKey, type StrategyId } from '../../../shared/engine/types';
import { buildSnapshot, type C2S, type S2C, type TickPayload } from './protocol';
import { diskLoad, diskSave } from './persistence';
import { registerAdminApi } from './admin/api';
import { ENGINE_FLAGS } from './admin/flags';
import { recordTrade as recordAnalyticsTrade, sample as sampleAnalytics } from './admin/analytics';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ymtccjfbcfogkplisjhr.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdGNjamZiY2ZvZ2twbGlzamhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTg2MTcsImV4cCI6MjA5NjAzNDYxN30.tWU3xu-UodQvt9-P2TIOy0xsyNtJ9fvB_WJFfClWwaU';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    transport: WebSocket as any
  }
});

// Per-WS state — each connected client has its own active asset + TF.
// (engine.state.active retained for snapshot fallback when no per-ws state.)
interface ClientState {
  activeAsset: string;
  activeTF: TFKey;
  lastOrderT: number; // ms timestamp of last accepted order (rate-limit)
  orderInFlight: boolean;
  traderId: number;
  userId?: string;
  authenticated: boolean;
}
const clientState: WeakMap<WebSocket, ClientState> = new WeakMap();
function getCS(ws: WebSocket): ClientState {
  let c = clientState.get(ws);
  if (!c) {
    c = { activeAsset: engine.state.active, activeTF: '5s', lastOrderT: 0, orderInFlight: false, traderId: 0, authenticated: false };
    clientState.set(ws, c);
  }
  return c;
}

// Drain any pending close intents by firing market orders against current book.
// v7.2: extended stuck timeout 20 → 600 ticks (60s). Keeps PENDING badge visible
// while liquidity slowly refills instead of flipping back to CUT mid-close.
const closeProgress: Map<string, { lastShares: number; stuckTicks: number; warned: boolean }> = new Map();
const STUCK_TICKS_LIMIT = 600; // 60s at 10Hz

function drainCloses(): void {
  engine.state.traders.forEach(p => {
    if (!p.isPlayer || p.isHouse || p.rekt) return;
    if (!p.closing) return;
    for (const aid of Object.keys(p.closing)) {
      if (!p.closing[aid]) continue;
      const h = p.holdings[aid];
      if (!h || h.shares === 0) {
        delete p.closing[aid];
        closeProgress.delete(`${p.id}:${aid}`);
        if (h) { h.sl = 0; h.tp = 0; h.slPct = 0; h.tpPct = 0; }
        continue;
      }
      const before = h.shares;
      if (h.shares > 0) placeOrder(engine.state, p.id, aid, 'sell', h.shares, 0, 'market', engine.callbacks(p.id));
      else placeOrder(engine.state, p.id, aid, 'buy', -h.shares, 0, 'market', engine.callbacks(p.id));
      const h2 = p.holdings[aid];
      if (!h2 || h2.shares === 0) {
        delete p.closing[aid];
        closeProgress.delete(`${p.id}:${aid}`);
        if (h2) { h2.sl = 0; h2.tp = 0; h2.slPct = 0; h2.tpPct = 0; }
        continue;
      }
      const key = `${p.id}:${aid}`;
      const prog = closeProgress.get(key) || { lastShares: before, stuckTicks: 0, warned: false };
      if (h2.shares === prog.lastShares) prog.stuckTicks++;
      else { prog.stuckTicks = 0; prog.lastShares = h2.shares; }
      closeProgress.set(key, prog);
      // Early warn at 200 ticks (~20s) so user knows it's struggling.
      if (prog.stuckTicks === 200 && !prog.warned) {
        prog.warned = true;
        console.warn(`drainCloses slow on ${aid} for trader ${p.id} (${p.name}): ${h2.shares} sh remain, retrying for 40 more seconds`);
      }
      if (prog.stuckTicks >= STUCK_TICKS_LIMIT) {
        console.warn(`drainCloses giving up on ${aid} for trader ${p.id} (${p.name}) (${h2.shares} sh stuck)`);
        delete p.closing[aid];
        closeProgress.delete(key);
      }
    }
  });
}

// Process-level safety nets so any uncaught throw doesn't kill the engine silently.
process.on('uncaughtException', (e) => {
  console.error('uncaughtException:', e);
  try { diskSave(engine.state); } catch {}
});
process.on('unhandledRejection', (e) => {
  console.error('unhandledRejection:', e);
});

const PORT = Number(process.env.PORT) || 8788;

// ---- ENGINE ----
const engine = new Engine();
const loaded = diskLoad(engine.state);
if (loaded) {
  engine.houseId = (typeof engine.state.houseId === 'number' && engine.state.houseId >= 0)
    ? engine.state.houseId
    : engine.state.traders.findIndex(t => t.isHouse);
  engine.seedBooks();
  console.log('💾 state loaded');
} else {
  console.log('🆕 fresh state');
}
// v7.3: always sync player name from env (overrides stale 'YOU' in old saves).
engine.player().name = process.env.MM_PLAYER_NAME || 'Trader';

// ---- HTTP + WS ----
const app = express();
// v6 fix: scope CORS — admin paths get strict (or no) CORS; non-admin stays open.
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    // Admin: only same-origin OR explicit MM_ADMIN_ORIGIN env.
    const allow = process.env.MM_ADMIN_ORIGIN || '';
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Token,X-Admin-Actor');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  } else {
    cors()(req, res, next);
  }
});

// v6 fix: admin auth gate — applies to ALL /admin/* paths including legacy.
// In dev (no token), prints loud warning every 60s instead of one-time.
const ADMIN_TOKEN_GATE = process.env.MM_ADMIN_TOKEN || '';
if (!ADMIN_TOKEN_GATE) {
  console.warn('\n' + '='.repeat(72));
  console.warn('⚠  ADMIN API UNPROTECTED — MM_ADMIN_TOKEN env var is NOT SET.');
  console.warn('⚠  Anyone reaching /admin/* can mutate game state. SET TOKEN IN PROD!');
  console.warn('='.repeat(72) + '\n');
  setInterval(() => console.warn('⚠ admin api still unprotected — set MM_ADMIN_TOKEN'), 60_000);
}
app.use('/admin', (req, res, next) => {
  if (!ADMIN_TOKEN_GATE) return next();
  if (req.header('X-Admin-Token') === ADMIN_TOKEN_GATE) return next();
  res.status(401).json({ ok: false, reason: 'invalid admin token' });
});

// Destructive legacy endpoints outside /admin (/reset, /shutdown) share the
// same gate: open in dev (no token set), token-locked in prod. Without this
// anyone reaching the port could wipe state or kill the process.
function requireAdminToken(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_TOKEN_GATE) return true;
  if (req.header('X-Admin-Token') === ADMIN_TOKEN_GATE) return true;
  res.status(401).json({ ok: false, reason: 'invalid admin token' });
  return false;
}

app.get('/health', (_, res) => res.json({ ok: true, time: Date.now() }));

// v9: public feedback / bug-report endpoint (no auth — players submit). Appends
// to feedback.jsonl. Rate-limited per-IP to stop spam. Admins read via
// /admin/feedback (gated).
const feedbackLast: Map<string, number> = new Map();
app.post('/feedback', express.json(), (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const last = feedbackLast.get(ip) || 0;
  if (now - last < 5000) { res.status(429).json({ ok: false, reason: 'Please wait a few seconds between submissions' }); return; }
  // Bound the rate-limit map — purge entries older than 10 min so it can't leak.
  if (feedbackLast.size > 5000) {
    const cutoff = now - 600_000;
    for (const [k, v] of feedbackLast) if (v < cutoff) feedbackLast.delete(k);
  }
  const body = req.body || {};
  const type = String(body.type || 'feedback').slice(0, 20);
  const message = String(body.message || '').slice(0, 2000).trim();
  if (message.length < 3) { res.status(400).json({ ok: false, reason: 'Message too short' }); return; }
  feedbackLast.set(ip, now);
  const entry = { ts: now, ip, type, message, name: String(body.name || '').slice(0, 60), level: body.level };
  try {
    fs.appendFileSync(path.resolve(process.cwd(), 'feedback.jsonl'), JSON.stringify(entry) + '\n');
  } catch (e) { console.error('feedback write failed:', (e as Error).message); }
  res.json({ ok: true });
});

// Reset: wipe disk save + kill server so start.bat must be re-run.
// Wipe state.json + reinitialize engine in-place (no process kill).
// Existing WS clients get a fresh snapshot on next interval and just re-render.
app.post('/reset', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  console.log('🔄 /reset — wiping disk + reinitializing engine');
  try {
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
    totalTrades: totalVolume,
    activeAsset: engine.state.active,
    activeTF: '5s', // per-WS now; admin shows default
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
  // Cap raised to 1M for stress testing — engine handles via fixed-budget tick scan.
  const count = Math.max(1, Math.min(1_000_000, Math.floor(n)));
  let strat: StrategyId | undefined;
  if (strategy && (STRATEGIES as string[]).includes(strategy)) strat = strategy as StrategyId;
  const startId = engine.state.traders.length;
  for (let k = 0; k < count; k++) {
    const id = engine.state.traders.length;
    engine.state.traders.push(makeTrader(id, false, strat));
  }
  // Only seed books for the newly-added range (avoids quadratic re-seed of existing bots).
  engine.seedBooks(startId);
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
app.post('/shutdown', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  console.log('🛑 /shutdown received — saving + killing windows...');
  diskSave(engine.state);
  res.json({ ok: true });
  // Kill the client cmd window by its title (Windows-only, no-op elsewhere)
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq MarketVerseX-Client*'], { detached: true, stdio: 'ignore' }).unref();
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq MarketVerseX-Server*'], { detached: true, stdio: 'ignore' }).unref();
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
    if (ws.readyState !== WebSocket.OPEN) continue;
    try { ws.send(data); }
    catch (e) {
      console.error('broadcast send failed:', (e as Error).message);
      try { ws.terminate(); } catch {}
      clients.delete(ws);
    }
  }
}

// PERF: leaderboard cache shared across all clients. Recomputed lazily after
// LEADERBOARD_TTL_MS — avoids O(N log N) sort per client per snapshot.
const LEADERBOARD_TTL_MS = 1500;
const TOP_N = 200;
interface LbEntry { id: number; name: string; net: number; strat: string; rekt: boolean; level: number; isPlayer: boolean; tier?: string; trades: number; bornNet: number }
let lbCache: { top: LbEntry[]; ts: number } | null = null;

function computeLeaderboard(): LbEntry[] {
  const traders = engine.state.traders;
  // Heap-light: insertion-sort against top-N min element. O(N) avg, no full sort.
  const top: LbEntry[] = [];
  let minNet = -Infinity;
  for (let i = 0; i < traders.length; i++) {
    const t = traders[i];
    if (t.isHouse) continue; // v8.9: House excluded from leaderboard
    const net = traderNet(t, engine.state);
    if (top.length < TOP_N) {
      top.push({ id: t.id, name: t.name, net, strat: t.strat as string, rekt: !!t.rekt, level: t.level || 1, isPlayer: !!t.isPlayer, tier: t.tier, trades: t.totalTradeCount || 0, bornNet: t.bornNet || t.cash });
      if (top.length === TOP_N) {
        top.sort((a, b) => a.net - b.net);
        minNet = top[0].net;
      }
    } else if (net > minNet) {
      top[0] = { id: t.id, name: t.name, net, strat: t.strat as string, rekt: !!t.rekt, level: t.level || 1, isPlayer: !!t.isPlayer, tier: t.tier, trades: t.totalTradeCount || 0, bornNet: t.bornNet || t.cash };
      // Re-bubble new entry to its sorted slot (still ascending by net).
      let j = 0;
      while (j + 1 < TOP_N && top[j + 1].net < top[j].net) {
        const tmp = top[j]; top[j] = top[j + 1]; top[j + 1] = tmp; j++;
      }
      minNet = top[0].net;
    }
  }
  // Now top is ascending — reverse for descending display.
  if (top.length < TOP_N) top.sort((a, b) => a.net - b.net);
  top.reverse();
  return top;
}

function getLeaderboard(): LbEntry[] {
  const now = Date.now();
  if (lbCache && now - lbCache.ts < LEADERBOARD_TTL_MS) return lbCache.top;
  const fresh = computeLeaderboard();
  lbCache = { top: fresh, ts: now };
  return lbCache.top;
}

// v9: holders-per-asset count, cached once per ~1.5s (shared across all clients).
// Avoids an O(traders) scan per client per snapshot (50M+ ops at 100 clients ×
// 500k bots). One pass over traders × held-assets refreshes the whole map.
let holdersCache: Record<string, number> = {};
let holdersCacheTs = 0;
const HOLDERS_TTL_MS = 1500;
function refreshHoldersCache() {
  const now = Date.now();
  if (now - holdersCacheTs < HOLDERS_TTL_MS) return;
  holdersCacheTs = now;
  const next: Record<string, number> = {};
  const traders = engine.state.traders;
  for (let i = 0; i < traders.length; i++) {
    const t = traders[i];
    if (t.isHouse) continue;
    const h = t.holdings;
    // Only iterate the trader's OWN holding keys (sparse for bots), not all assets.
    for (const aid in h) {
      if ((h[aid]?.shares || 0) !== 0) next[aid] = (next[aid] || 0) + 1;
    }
  }
  holdersCache = next;
}

function sendSnapshot(ws: WebSocket) {
  refreshHoldersCache(); // cheap after first call within TTL window
  const cs = getCS(ws);
  const rank = engine.playerRank(cs.traderId);
  const snap = buildSnapshot(engine.state, cs.activeAsset, rank, cs.activeTF, cs.traderId);
  
  // Clone global leaderboard top 200
  const top = getLeaderboard().slice();
  // If player isn't in top 200, append them to the leaderboard array
  if (!top.some(entry => entry.id === cs.traderId)) {
    const p = engine.player(cs.traderId);
    top.push({
      id: cs.traderId,
      name: p.name,
      net: traderNet(p, engine.state),
      strat: p.strat as string,
      rekt: !!p.rekt,
      level: p.level || 1,
      isPlayer: true,
      tier: p.tier,
      trades: p.totalTradeCount || 0,
      bornNet: p.bornNet || p.cash
    });
  }
  snap.leaderboard = top;
  
  // Player extras — stats + missions + bonus + streak.
  const stats = engine.getPlayerStats(cs.traderId);
  stats.rank = rank;
  stats.total = Math.max(0, engine.state.traders.length - 1); // v8.9: exclude House
  snap.playerStats = stats;
  const p = engine.player(cs.traderId);
  snap.playerBonus = p.bonus || 0;
  snap.playerStreak = p.loginStreak || 0;
  snap.dailyMissions = p.dailyMissions || [];
  snap.weeklyMissions = p.weeklyMissions || [];
  // v9: last 50 closed trades for Trade History view.
  snap.recentTrades = (p.playerTrades || []).slice(-50).reverse();
  // v9: holders of the active asset — read from the per-tick cache (computed
  // ONCE per snapshot cycle in refreshHoldersCache, not per client).
  snap.activeHolders = holdersCache[cs.activeAsset] || 0;
  // v5: level/xp progression
  snap.playerLevel = p.level || 1;
  snap.playerXp = p.xp || 0;
  snap.xpAtCurrent = xpToReach(snap.playerLevel);
  snap.xpToNext = xpToReach(snap.playerLevel + 1);
  snap.banner = ENGINE_FLAGS.broadcastBanner || '';
  snap.maintenanceMode = !!ENGINE_FLAGS.maintenanceMode;
  snap.tradingHalted = !!ENGINE_FLAGS.tradingHalted;
  try { ws.send(JSON.stringify({ type: 'snapshot', payload: snap } satisfies S2C)); }
  catch (e) { console.error('snapshot send failed:', (e as Error).message); }
}

// hooks for event/SL-TP broadcast
engine.hooks.onEvent = (ev) => broadcast({ type: 'event', payload: { kind: ev.type, title: ev.title, desc: ev.desc } });
engine.hooks.onSLTPHit = (aid, kind, ref, px, traderId) => {
  const data = JSON.stringify({ type: 'sltp_hit', payload: { aid, kind, ref, px } });
  for (const ws of clients) {
    const cs = getCS(ws);
    if (cs.traderId === traderId && ws.readyState === WebSocket.OPEN) {
      try { ws.send(data); } catch {}
    }
  }
};

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

const ORDER_MIN_INTERVAL_MS = 50; // per-WS rate limit

function handleClientMessage(ws: WebSocket, msg: C2S) {
  const cs = getCS(ws);

  // Auth guard: block all actions except auth, setActive, and setTF if not authenticated.
  if (!cs.authenticated && msg.type !== 'auth' && msg.type !== 'setActive' && msg.type !== 'setTF') {
    ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Authentication required' } } satisfies S2C));
    return;
  }

  switch (msg.type) {
    case 'auth': {
      const { token } = msg.payload || {};
      if (!token) return;
      
      (async () => {
        try {
          const { data, error } = await supabase.auth.getUser(token);
          if (error || !data?.user) {
            ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Authentication failed' } } satisfies S2C));
            return;
          }
          const user = data.user;
          const uuid = user.id;
          const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Trader';
          
          // Memory-first lookup: search for a trader that is a player and has either the matching userId (uuid) or matching username name.
          let foundTraderIdx = engine.state.traders.findIndex(t => t && t.isPlayer && !t.isHouse && (t.userId === uuid || t.name === username));
          
          let traderId = 0;
          if (foundTraderIdx >= 0) {
            // Found in memory! Let's ensure its fields are synced.
            traderId = foundTraderIdx;
            const t = engine.state.traders[traderId];
            t.userId = uuid; // Sync just in case it was loaded via name match
            t.name = username;
            
            // Sync database profile table to point to this index
            const { data: profile, error: dbErr } = await supabase
              .from('profiles')
              .select('trader_id')
              .eq('id', uuid)
              .maybeSingle();

            if (!profile) {
              // Profile not in DB yet, insert it
              await supabase
                .from('profiles')
                .insert({ id: uuid, username, trader_id: traderId });
            } else if (profile.trader_id !== traderId) {
              // Index shifted, update database to current index
              await supabase
                .from('profiles')
                .update({ trader_id: traderId, username })
                .eq('id', uuid);
            }
          } else {
            // Not found in memory. Let's check the database as fallback.
            const { data: profile, error: dbErr } = await supabase
              .from('profiles')
              .select('trader_id')
              .eq('id', uuid)
              .maybeSingle();
              
            if (dbErr) {
              console.error('DB query error:', dbErr.message);
              ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Database error' } } satisfies S2C));
              return;
            }
            
            if (profile) {
              // DB has it, but it wasn't matched in memory (maybe index changed and name changed).
              // Let's check if the index is valid and is a player.
              traderId = profile.trader_id;
              const t = engine.state.traders[traderId];
              if (t && t.isPlayer && !t.isHouse) {
                // Yes, the index is still valid. Sync memory fields.
                t.userId = uuid;
                t.name = username;
              } else {
                // The index was occupied by a bot or invalid. Allocate a new trader index.
                traderId = engine.state.traders.length;
                const newTrader = makeTrader(traderId, true);
                newTrader.userId = uuid;
                newTrader.name = username;
                engine.state.traders.push(newTrader);
                
                await supabase
                  .from('profiles')
                  .update({ trader_id: traderId, username })
                  .eq('id', uuid);
                  
                diskSave(engine.state);
              }
            } else {
              // Brand new user, not in memory and not in DB.
              traderId = engine.state.traders.length;
              const newTrader = makeTrader(traderId, true);
              newTrader.userId = uuid;
              newTrader.name = username;
              engine.state.traders.push(newTrader);
              
              const { error: insErr } = await supabase
                .from('profiles')
                .insert({ id: uuid, username, trader_id: traderId });
                
              if (insErr) {
                console.error('DB insert error:', insErr.message);
              }
              
              diskSave(engine.state);
            }
          }
          
          cs.traderId = traderId;
          cs.userId = uuid;
          cs.authenticated = true;
          
          console.log(`🔑 Client authenticated: username=${username}, traderId=${traderId}, uuid=${uuid}`);
          sendSnapshot(ws);
        } catch (err: any) {
          console.error('Authentication exception:', err.message);
          ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Internal auth error' } } satisfies S2C));
        }
      })();
      return;
    }
    case 'setActive': {
      if (typeof msg.payload?.aid !== 'string') return;
      if (engine.state.assets[msg.payload.aid]) cs.activeAsset = msg.payload.aid;
      sendSnapshot(ws);
      return;
    }
    case 'setTF': {
      if (typeof msg.payload?.tf === 'string' && (TF_LIST as string[]).includes(msg.payload.tf)) {
        cs.activeTF = msg.payload.tf as TFKey;
        sendSnapshot(ws);
      }
      return;
    }
    case 'order': {
      const p = msg.payload;
      if (!p || typeof p.aid !== 'string') return;
      // v6: emergency trading-halt gate (admin).
      if (ENGINE_FLAGS.tradingHalted) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Trading halted by admin' } } satisfies S2C));
        return;
      }
      const ast = engine.state.assets[p.aid];
      if (!ast) return;
      const def = ASSETS.find(a => a.id === p.aid);
      const playerLvl = engine.player(cs.traderId).level || 1;
      if (def && def.minLevel > playerLvl) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: `Requires Level ${def.minLevel}` } } satisfies S2C));
        return;
      }
      if (!Number.isFinite(p.qty) || p.qty <= 0 || !Number.isInteger(p.qty) || p.qty > 1e8) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Invalid qty' } } satisfies S2C));
        return;
      }
      if (p.orderType !== 'market' && p.orderType !== 'limit') return;
      if (p.orderType === 'limit' && (!Number.isFinite(p.limitPx) || (p.limitPx as number) <= 0)) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Invalid limit price' } } satisfies S2C));
        return;
      }
      // Rate limit
      const now = Date.now();
      if (cs.orderInFlight || now - cs.lastOrderT < ORDER_MIN_INTERVAL_MS) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Too fast' } } satisfies S2C));
        return;
      }
      cs.orderInFlight = true;
      try {
        const hold = engine.player(cs.traderId).holdings[p.aid];
        if (!hold) return;
        // v8.10: shorting allowed on all markets. BUY opens/extends long or
        // covers short; SELL closes long or opens/extends short. No special cap.
        const lpx = p.orderType === 'market' ? 0 : (p.limitPx ?? ast.lastPrice);
        const res = placeOrder(engine.state, cs.traderId, p.aid, p.side, p.qty, lpx, p.orderType, engine.callbacks(cs.traderId));
        const h = engine.player(cs.traderId).holdings[p.aid];
        if (h) {
          // Allow explicit 0 to CLEAR — only check undefined.
          if (p.slPct !== undefined) { h.slPct = Math.max(0, Math.min(1000, +p.slPct || 0)); h.sl = 0; }
          if (p.tpPct !== undefined) { h.tpPct = Math.max(0, Math.min(10000, +p.tpPct || 0)); h.tp = 0; }
        }
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: true, filled: res.filled, cost: res.cost } } satisfies S2C));
        broadcastTickNow();
      } finally {
        cs.lastOrderT = Date.now();
        cs.orderInFlight = false;
      }
      return;
    }
    case 'close': {
      if (typeof msg.payload?.aid !== 'string') return;
      const p = engine.player(cs.traderId);
      if (!p.closing) p.closing = {};
      p.closing[msg.payload.aid] = true;
      drainCloses();
      broadcastTickNow();
      return;
    }
    case 'cancelClose': {
      if (typeof msg.payload?.aid !== 'string') return;
      const p = engine.player(cs.traderId);
      if (p.closing) delete p.closing[msg.payload.aid];
      broadcastTickNow();
      return;
    }
    case 'setSLTP': {
      if (typeof msg.payload?.aid !== 'string') return;
      const h = engine.player(cs.traderId).holdings[msg.payload.aid];
      if (h) {
        if (msg.payload.slPct !== undefined) { h.slPct = Math.max(0, Math.min(1000, +msg.payload.slPct || 0)); h.sl = 0; }
        if (msg.payload.tpPct !== undefined) { h.tpPct = Math.max(0, Math.min(10000, +msg.payload.tpPct || 0)); h.tp = 0; }
        broadcastTickNow();
      }
      return;
    }
    case 'claimMission': {
      if (typeof msg.payload?.missionId !== 'string') return;
      const reward = claimMission(engine.player(cs.traderId), msg.payload.missionId);
      if (reward > 0) sendSnapshot(ws);
      return;
    }
    case 'storePurchase': {
      const p = engine.player(cs.traderId);
      const cashChange = Number(msg.payload?.cashChange) || 0;
      const gemsChange = Number(msg.payload?.gemsChange) || 0;
      const xpChange = Number(msg.payload?.xpChange) || 0;

      // Verify that player has enough gems (if gemsChange is negative)
      if (gemsChange < 0 && (p.bonus || 0) + gemsChange < 0) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Insufficient Gems!' } } satisfies S2C));
        return;
      }
      
      // Verify that player has enough cash (if cashChange is negative)
      if (cashChange < 0 && p.cash + cashChange < 0) {
        ws.send(JSON.stringify({ type: 'order_result', payload: { ok: false, reason: 'Insufficient Cash!' } } satisfies S2C));
        return;
      }

      // Apply changes
      p.cash += cashChange;
      p.bonus = (p.bonus || 0) + gemsChange;
      p.xp = (p.xp || 0) + xpChange;
      p.level = levelFromXp(p.xp);

      // Save and sync
      diskSave(engine.state);
      sendSnapshot(ws);
      return;
    }
  }
}

// ---- TICK LOOP (server-authoritative, 10 Hz) ----
const TICK_MS = 100;
let lastT = performance.now();

function buildTickFor(ws: WebSocket): TickPayload {
  const cs = getCS(ws);
  const prices: Record<string, number> = {};
  ASSETS.forEach(a => { prices[a.id] = engine.state.assets[a.id].lastPrice; });
  const active = cs.activeAsset;
  const ast = engine.state.assets[active] || engine.state.assets[engine.state.active];
  const tf = cs.activeTF;
  const series = ast.series[tf];
  const p = engine.player(cs.traderId);
  const playerHoldings: Record<string, any> = {};
  for (const aid of Object.keys(p.holdings)) {
    const h = p.holdings[aid];
    if (h && h.shares !== 0) playerHoldings[aid] = h;
  }
  return {
    serverTime: Date.now(),
    prices,
    cash: p.cash,
    playerHoldings,
    playerClosing: p.closing || {},
    activeId: active,
    activeTF: tf,
    activeCandles: series.candles.slice(-60),
    activeCurCandle: series.curCandle ? { ...series.curCandle } : null,
    activeCandleStartT: series.candleStartT,
    activeTFms: TF_MS[tf],
    activeHistory: ast.history.slice(-120),
    activeVolumeHist: ast.volumeHist.slice(-120),
    topBidsActive: ast.book.bids.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: engine.state.traders[o.ownerId]?.name || '' })),
    topAsksActive: ast.book.asks.slice(0, 10).map(o => ({ px: o.px, qty: o.qty, ownerName: engine.state.traders[o.ownerId]?.name || '' })),
  };
}

function broadcastTickNow(): void {
  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    try {
      const payload = buildTickFor(ws);
      ws.send(JSON.stringify({ type: 'tick', payload } satisfies S2C));
    } catch (e) {
      console.error('tick send failed:', (e as Error).message);
    }
  }
}

// v6: fast-forward queue — drained one batch per main tick to avoid racing.
let fastForwardRemaining = 0;
const FF_BATCH_PER_TICK = 50; // ~5s of virtual time per real tick
function scheduleFastForward(ticks: number) { fastForwardRemaining += Math.max(0, Math.floor(ticks)); }

setInterval(() => {
  try {
    const now = performance.now();
    engine.step(now);
    // Drain fast-forward queue serially with the main loop — no concurrency.
    if (fastForwardRemaining > 0) {
      const batch = Math.min(FF_BATCH_PER_TICK, fastForwardRemaining);
      let virtNow = now;
      for (let i = 0; i < batch; i++) {
        virtNow += TICK_MS;
        engine.step(virtNow);
      }
      fastForwardRemaining -= batch;
    }
    drainCloses();
    lastT = now;
    broadcastTickNow();
    sampleAnalytics(engine.state, clients.size);
  } catch (e) {
    console.error('tick loop error:', e);
  }
}, TICK_MS);

// periodic full snapshot every 5s to resync
setInterval(() => {
  for (const ws of clients) sendSnapshot(ws);
}, 5000);

// PERF: save interval scales with population — heavy JSON.stringify of 100K+
// traders blocks the event loop for ~1s. Less frequent at scale.
function saveInterval(): number {
  const n = engine.state.traders.length;
  if (n > 100_000) return 60_000;
  if (n > 20_000) return 30_000;
  return 15_000;
}
let saveTimer: NodeJS.Timeout;
function scheduleSave() {
  saveTimer = setTimeout(() => { diskSave(engine.state); scheduleSave(); }, saveInterval());
}
scheduleSave();
process.on('SIGINT', () => { diskSave(engine.state); process.exit(0); });
process.on('SIGTERM', () => { diskSave(engine.state); process.exit(0); });

// v6: register the new admin API surface (users/economy/gm/emergency/analytics/audit).
registerAdminApi(app, { engine, clients, sendSnapshot, serverStartMs: SERVER_START, scheduleFastForward });

// v6: trade counter for analytics — engine fires onAnyTrade per trade.
engine.hooks.onAnyTrade = () => recordAnalyticsTrade();

httpServer.listen(PORT, () => {
  console.log(`🟢 server listening :${PORT}  (ws on /ws)`);
});
