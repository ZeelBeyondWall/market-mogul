// Admin API surface — registered against the main Express app from index.ts.
// All mutating endpoints flow through audit() so every action is logged.
import express, { type Request, type Response, type Express } from 'express';
import { ASSETS, marketUnlockLevel, xpToReach } from '../../../../shared/engine/constants';
import { placeOrder } from '../../../../shared/engine/matching';
import { traderNet } from '../../../../shared/engine/strategies';
import { ensureMissionsCurrent } from '../../../../shared/engine/missions';
import type { Market } from '../../../../shared/engine/types';
import type { Engine } from '../../../../shared/engine/engine';
import { ENGINE_FLAGS } from './flags';
import { audit, loadRecent } from './audit';
import { snapshot as analyticsSnapshot } from './analytics';

// Auth is enforced by global middleware in index.ts — no duplicate check here.
function actor(req: Request): string {
  return (req.header('X-Admin-Actor') as string) || 'admin';
}

interface AdminDeps {
  engine: Engine;
  clients: Set<{ readyState: number; send: (s: string) => void; terminate: () => void }>;
  sendSnapshot: (ws: any) => void;
  serverStartMs: number;
  // Hook into main tick loop — admin queues fast-forward ticks here.
  scheduleFastForward: (ticks: number) => void;
}

export function registerAdminApi(app: Express, deps: AdminDeps): void {
  const { engine, clients } = deps;
  const j = express.json();

  // ===== USERS =====
  app.get('/admin/users', (req, res) => {
    const q = (req.query.q as string || '').toLowerCase().trim();
    const market = req.query.market as string | undefined;
    const rektFilter = req.query.rekt as string | undefined; // 'true' | 'false' | undefined
    const minLevel = req.query.minLevel ? Number(req.query.minLevel) : 0;
    const sort = (req.query.sort as string) || 'net';
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const out = [];
    for (const t of engine.state.traders) {
      if (q && !t.name.toLowerCase().includes(q) && !String(t.id).includes(q)) continue;
      if (rektFilter === 'true' && !t.rekt) continue;
      if (rektFilter === 'false' && t.rekt) continue;
      if (minLevel > 0 && (t.level || 1) < minLevel) continue;
      out.push({
        id: t.id, name: t.name, strat: t.strat, isPlayer: t.isPlayer,
        cash: t.cash, net: traderNet(t, engine.state),
        rekt: !!t.rekt, level: t.level || 1, xp: t.xp || 0,
        openOrders: t.openOrders?.length || 0,
        bornAt: t.bornAt || 0,
      });
    }
    // Sort + paginate.
    const cmp: Record<string, (a: any, b: any) => number> = {
      net:    (a, b) => b.net - a.net,
      cash:   (a, b) => b.cash - a.cash,
      level:  (a, b) => b.level - a.level,
      id:     (a, b) => a.id - b.id,
      name:   (a, b) => a.name.localeCompare(b.name),
    };
    out.sort(cmp[sort] || cmp.net);
    res.json({ ok: true, total: out.length, items: out.slice(offset, offset + limit) });
  });

  app.get('/admin/user/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = engine.state.traders[id];
    if (!t) { res.status(404).json({ ok: false, reason: 'not found' }); return; }
    const holdings = Object.entries(t.holdings || {})
      .filter(([_, h]) => h && h.shares !== 0)
      .map(([aid, h]) => {
        const ast = engine.state.assets[aid];
        const px = ast?.lastPrice || 0;
        const pnl = h.shares > 0 ? h.shares * (px - h.avgCost) : (-h.shares) * (h.avgCost - px);
        return { aid, shares: h.shares, avgCost: h.avgCost, lastPrice: px, value: Math.abs(h.shares) * px, pnl };
      });
    const trades = (t.playerTrades || []).slice(-100);
    res.json({
      ok: true,
      user: {
        id: t.id, name: t.name, strat: t.strat, isPlayer: t.isPlayer,
        cash: t.cash, net: traderNet(t, engine.state),
        rekt: !!t.rekt, level: t.level || 1, xp: t.xp || 0,
        bonus: t.bonus || 0, loginStreak: t.loginStreak || 0,
        bornAt: t.bornAt || 0, activity: t.activity,
        stopLoss: t.stopLoss, takeProfit: t.takeProfit,
        openOrders: t.openOrders || [],
        holdings,
        recentTrades: trades,
        dailyMissions: t.dailyMissions || [],
        weeklyMissions: t.weeklyMissions || [],
      },
    });
  });

  const wrap = (action: string, targetOf: (req: Request) => string | number | undefined, fn: (req: Request, res: Response) => any) =>
    (req: Request, res: Response) => {
      const tgt = targetOf(req);
      try {
        const result = fn(req, res);
        Promise.resolve(result).then(out => {
          // If handler already responded, leverage that; else default ok.
          if (!res.headersSent) res.json({ ok: true, ...out });
          audit({ actor: actor(req), action, target: tgt, payload: req.body, result: 'ok' });
        }).catch(e => {
          if (!res.headersSent) res.status(500).json({ ok: false, reason: e?.message || 'error' });
          audit({ actor: actor(req), action, target: tgt, payload: req.body, result: 'error', reason: e?.message });
        });
      } catch (e: any) {
        if (!res.headersSent) res.status(500).json({ ok: false, reason: e?.message || 'error' });
        audit({ actor: actor(req), action, target: tgt, payload: req.body, result: 'error', reason: e?.message });
      }
    };

  app.post('/admin/user/:id/ban', j, wrap('user.ban', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    if (t.isPlayer) throw new Error('cannot ban player');
    t.rekt = true; t.activity = 0;
    return { id: t.id, banned: true };
  }));
  app.post('/admin/user/:id/unban', j, wrap('user.unban', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    t.rekt = false;
    if (t.cash <= 0) t.cash = 1000; // give starting cash so they can trade
    return { id: t.id, unbanned: true };
  }));
  app.post('/admin/user/:id/giveCash', j, wrap('user.giveCash', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    const amt = +req.body?.amount || 0;
    t.cash = Math.max(0, t.cash + amt);
    t._netDirty = true;
    return { id: t.id, cash: t.cash, delta: amt };
  }));
  app.post('/admin/user/:id/giveXp', j, wrap('user.giveXp', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    const amt = +req.body?.amount || 0;
    t.xp = Math.max(0, (t.xp || 0) + amt);
    // Recompute level from new XP.
    let lvl = 1; while (lvl < 99 && t.xp >= xpToReach(lvl + 1)) lvl++;
    t.level = lvl;
    return { id: t.id, xp: t.xp, level: t.level };
  }));
  app.post('/admin/user/:id/setLevel', j, wrap('user.setLevel', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    const lvl = Math.max(1, Math.min(99, Math.floor(+req.body?.level || 1)));
    t.level = lvl;
    t.xp = xpToReach(lvl);
    return { id: t.id, level: lvl, xp: t.xp };
  }));
  app.post('/admin/user/:id/resetMissions', j, wrap('user.resetMissions', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    t.dailyMissions = []; t.weeklyMissions = [];
    t.dailyMissionDay = undefined; t.weeklyMissionWeek = undefined;
    ensureMissionsCurrent(t, Date.now());
    return { id: t.id, daily: t.dailyMissions?.length, weekly: t.weeklyMissions?.length };
  }));
  app.post('/admin/user/:id/resetPortfolio', j, wrap('user.resetPortfolio', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    for (const aid of Object.keys(t.holdings || {})) {
      t.holdings[aid].shares = 0;
      t.holdings[aid].avgCost = 0;
    }
    t.openOrders = []; t.closing = {}; t.playerTrades = []; t.playerEntryTs = {};
    return { id: t.id, reset: true };
  }));
  app.post('/admin/user/:id/closePositions', j, wrap('user.closePositions', r => +r.params.id, (req) => {
    const t = engine.state.traders[+req.params.id];
    if (!t) throw new Error('user not found');
    // FIX: pass engine.callbacks() so player gets onPlayerTradeClosed (XP, mission, trade log).
    const cb = t.isPlayer ? engine.callbacks() : undefined;
    let closed = 0;
    for (const aid of Object.keys(t.holdings || {})) {
      const h = t.holdings[aid];
      if (!h || h.shares === 0) continue;
      if (h.shares > 0) placeOrder(engine.state, t.id, aid, 'sell', h.shares, 0, 'market', cb);
      else placeOrder(engine.state, t.id, aid, 'buy', -h.shares, 0, 'market', cb);
      closed++;
    }
    return { id: t.id, attempted: closed };
  }));

  // ===== ECONOMY =====
  app.get('/admin/economy', (_req, res) => {
    let totalCash = 0, totalNet = 0, openPos = 0, openOrders = 0;
    const traders = engine.state.traders;
    let richest = { id: 0, name: '', net: 0 };
    for (let i = 0; i < traders.length; i++) {
      const t = traders[i];
      totalCash += t.cash || 0;
      const n = traderNet(t, engine.state);
      totalNet += n;
      if (n > richest.net) richest = { id: t.id, name: t.name, net: n };
      openOrders += (t.openOrders?.length || 0);
      for (const aid of Object.keys(t.holdings || {})) {
        if ((t.holdings[aid]?.shares || 0) !== 0) openPos++;
      }
    }
    const perMkt: Record<Market, { volume: number; count: number }> = {
      stocks: { volume: 0, count: 0 }, crypto: { volume: 0, count: 0 }, forex: { volume: 0, count: 0 },
    };
    for (const a of ASSETS) {
      const ast = engine.state.assets[a.id];
      if (!ast) continue;
      perMkt[a.market].volume += ast.volume;
      perMkt[a.market].count += 1;
    }
    res.json({
      ok: true,
      totalRegistered: traders.length,
      totalActive: traders.filter(t => !t.rekt).length,
      totalOnline: clients.size,
      totalBots: traders.length - 1,
      totalCash, totalNet,
      totalMarketVolume: ASSETS.reduce((s, a) => s + (engine.state.assets[a.id]?.volume || 0), 0),
      openPositions: openPos,
      openOrders,
      richest,
      perMarket: perMkt,
      flags: { ...ENGINE_FLAGS },
    });
  });

  // FIX: cap inject/remove amounts to prevent numeric overflow.
  const CASH_OP_CAP = 1e15;
  app.post('/admin/economy/inject', j, wrap('economy.inject', () => 'pool', (req) => {
    const amt = Math.max(0, Math.min(CASH_OP_CAP, +req.body?.amount || 0));
    const N = Math.min(engine.state.traders.length, 5000);
    if (N <= 1) throw new Error('no bots');
    const per = amt / (N - 1);
    for (let i = 1; i < N; i++) {
      engine.state.traders[i].cash += per;
      engine.state.traders[i]._netDirty = true;
    }
    return { distributed: amt, perBot: per, recipients: N - 1 };
  }));
  app.post('/admin/economy/remove', j, wrap('economy.remove', () => 'pool', (req) => {
    const amt = Math.max(0, Math.min(CASH_OP_CAP, +req.body?.amount || 0));
    const N = Math.min(engine.state.traders.length, 5000);
    if (N <= 1) throw new Error('no bots');
    const per = amt / (N - 1);
    for (let i = 1; i < N; i++) {
      engine.state.traders[i].cash = Math.max(0, engine.state.traders[i].cash - per);
      engine.state.traders[i]._netDirty = true;
    }
    return { removed: amt, recipients: N - 1 };
  }));
  app.post('/admin/economy/flag', j, wrap('economy.flag', r => r.body?.key, (req) => {
    const { key, value } = req.body || {};
    if (!(key in ENGINE_FLAGS)) throw new Error('unknown flag ' + key);
    (ENGINE_FLAGS as any)[key] = value;
    // v7.1: sync engine.config when relevant flags change.
    if (key === 'botsEnabled') engine.config.botsEnabled = !!value;
    if (key === 'eventsEnabled') engine.config.eventsEnabled = !!value;
    if (key === 'botsRespectPlayerLevel') engine.config.strictBotLevelGate = !!value;
    if (key === 'volatilityMult') engine.config.volMult = +value || 1;
    if (key === 'activityMult') engine.config.activityMult = +value || 1;
    return { key, value };
  }));

  // ===== GAME MASTER =====
  app.post('/admin/gm/unlockMarket', j, wrap('gm.unlockMarket', r => +r.body?.userId, (req) => {
    const { userId, market } = req.body || {};
    const t = engine.state.traders[+userId];
    if (!t) throw new Error('user not found');
    const need = marketUnlockLevel(market as Market);
    if ((t.level || 1) < need) {
      t.level = need;
      t.xp = xpToReach(need);
    }
    return { id: t.id, level: t.level, market };
  }));
  app.post('/admin/gm/lockMarket', j, wrap('gm.lockMarket', r => +r.body?.userId, (req) => {
    const { userId, market } = req.body || {};
    const t = engine.state.traders[+userId];
    if (!t) throw new Error('user not found');
    const need = marketUnlockLevel(market as Market);
    if ((t.level || 1) >= need) {
      t.level = Math.max(1, need - 1);
      t.xp = xpToReach(t.level);
    }
    return { id: t.id, level: t.level, market };
  }));
  app.post('/admin/gm/forceMission', j, wrap('gm.forceMission', r => r.body?.missionId, (req) => {
    const { userId, missionId } = req.body || {};
    const t = engine.state.traders[+userId];
    if (!t) throw new Error('user not found');
    const all = [...(t.dailyMissions || []), ...(t.weeklyMissions || [])];
    const m = all.find(x => x.def.id === missionId);
    if (!m) throw new Error('mission not found');
    m.progress = m.def.goal.target;
    m.completed = true;
    return { id: t.id, mission: missionId, completed: true };
  }));

  // ===== EMERGENCY =====
  app.post('/admin/emergency/maintenance', j, wrap('emergency.maintenance', () => 'global', (req) => {
    ENGINE_FLAGS.maintenanceMode = !!req.body?.enabled;
    return { maintenanceMode: ENGINE_FLAGS.maintenanceMode };
  }));
  app.post('/admin/emergency/haltTrading', j, wrap('emergency.haltTrading', () => 'global', (req) => {
    ENGINE_FLAGS.tradingHalted = !!req.body?.enabled;
    return { tradingHalted: ENGINE_FLAGS.tradingHalted };
  }));
  app.post('/admin/emergency/disableBots', j, wrap('emergency.disableBots', () => 'global', (req) => {
    // Accept either {disabled: true} (clear) or legacy {enabled: true} (inverted).
    const disabled = req.body?.disabled !== undefined ? !!req.body.disabled : !!req.body?.enabled;
    ENGINE_FLAGS.botsEnabled = !disabled;
    engine.config.botsEnabled = ENGINE_FLAGS.botsEnabled;
    return { botsEnabled: ENGINE_FLAGS.botsEnabled };
  }));
  app.post('/admin/emergency/disableEvents', j, wrap('emergency.disableEvents', () => 'global', (req) => {
    const disabled = req.body?.disabled !== undefined ? !!req.body.disabled : !!req.body?.enabled;
    ENGINE_FLAGS.eventsEnabled = !disabled;
    engine.config.eventsEnabled = ENGINE_FLAGS.eventsEnabled;
    return { eventsEnabled: ENGINE_FLAGS.eventsEnabled };
  }));
  app.post('/admin/emergency/registration', j, wrap('emergency.registration', () => 'global', (req) => {
    ENGINE_FLAGS.registrationDisabled = !!req.body?.disabled;
    return { registrationDisabled: ENGINE_FLAGS.registrationDisabled };
  }));
  // FIX: rate-limit broadcast snapshot fan-out to prevent admin-side DoS.
  let lastBroadcastAt = 0;
  app.post('/admin/emergency/broadcast', j, wrap('emergency.broadcast', () => 'global', (req) => {
    const now = Date.now();
    if (now - lastBroadcastAt < 2000) throw new Error('rate limit — wait 2s between broadcasts');
    lastBroadcastAt = now;
    ENGINE_FLAGS.broadcastBanner = String(req.body?.message || '').slice(0, 280);
    for (const ws of clients) deps.sendSnapshot(ws);
    return { message: ENGINE_FLAGS.broadcastBanner };
  }));

  // ===== SIM =====
  // FIX: queue fastForward ticks into the main loop instead of racing setInterval.
  // The main tick loop drains this queue (FF_QUEUE) — at most one engine.step at a time.
  app.post('/admin/sim/fastForward', j, wrap('sim.fastForward', r => r.body?.seconds, (req) => {
    const sec = Math.max(0, Math.min(7 * 86400, +req.body?.seconds || 0));
    const stepMs = 100;
    const ticks = Math.floor((sec * 1000) / stepMs);
    deps.scheduleFastForward(ticks);
    return { requestedSeconds: sec, ticksScheduled: ticks };
  }));

  // ===== ANALYTICS =====
  app.get('/admin/analytics', (_req, res) => {
    res.json({ ok: true, ...analyticsSnapshot(engine.state) });
  });

  // ===== HEALTH =====
  app.get('/admin/health', (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
      ok: true,
      uptimeSec: Math.floor((Date.now() - deps.serverStartMs) / 1000),
      pid: process.pid,
      mem: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
      cpuLoad: process.cpuUsage(),
      tradersCount: engine.state.traders.length,
      assetsCount: ASSETS.length,
      clientCount: clients.size,
      flags: { ...ENGINE_FLAGS },
    });
  });

  // ===== AUDIT LOG =====
  app.get('/admin/audit', async (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const entries = await loadRecent(limit);
    res.json({ ok: true, entries });
  });
}
