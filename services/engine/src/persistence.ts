import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { ASSETS } from '../../../shared/engine/constants';
import { makeBook } from '../../../shared/engine/orderbook';
import type { CandleSeries, GameState, Holding, TFKey, Trader } from '../../../shared/engine/types';
import { TF_LIST } from '../../../shared/engine/types';

const SAVE_FILE = path.resolve(process.cwd(), 'state.json');
const TMP_FILE = SAVE_FILE + '.tmp';
const BAK_FILE = SAVE_FILE + '.bak';
// v3 — added player-only extras (trades, bonus, missions).
// v4 — added level/xp on Trader (player + bots).
// Backward-compat: v2/v3 saves load fine — missing fields default-fill at runtime.
const FORMAT_VERSION = 4;

let saving = false; // prevent overlapping saves

export function diskSave(S: GameState): void {
  if (saving) return;
  saving = true;
  // Serialize on next tick so we don't block the call site; await externally if needed.
  void doSave(S).finally(() => { saving = false; });
}

async function doSave(S: GameState): Promise<void> {
  try {
    // PERF: skip rekt bots (they're dead — recreate as fresh fodder on reload).
    // Player ALWAYS saved (id 0).
    const persistedTraders = S.traders.filter(t => t.isPlayer || !t.rekt);
    const out = {
      v: FORMAT_VERSION,
      traders: persistedTraders.map(t => ({
        id: t.id, name: t.name, cash: t.cash,
        holdings: nonZeroHoldings(t.holdings), // ~20x smaller
        strat: t.strat,
        isPlayer: t.isPlayer, activity: t.activity, pickedAssets: t.pickedAssets,
        fairBias: t.fairBias, riskTol: t.riskTol, stopLoss: t.stopLoss, takeProfit: t.takeProfit,
        bornNet: t.bornNet, tradesSinceChange: t.tradesSinceChange, mutateCooldown: t.mutateCooldown,
        rekt: t.rekt,
        level: t.level, xp: t.xp,    // v4: progression
        // Player-only extras (no-op for bots — fields will be undefined).
        playerTrades: t.isPlayer ? (t.playerTrades || []) : undefined,
        playerEntryTs: t.isPlayer ? (t.playerEntryTs || {}) : undefined,
        bonus: t.isPlayer ? (t.bonus || 0) : undefined,
        loginStreak: t.isPlayer ? (t.loginStreak || 0) : undefined,
        lastLoginDay: t.isPlayer ? t.lastLoginDay : undefined,
        lastClaimedDay: t.isPlayer ? t.lastClaimedDay : undefined,
        dailyMissions: t.isPlayer ? (t.dailyMissions || []) : undefined,
        weeklyMissions: t.isPlayer ? (t.weeklyMissions || []) : undefined,
        dailyMissionDay: t.isPlayer ? t.dailyMissionDay : undefined,
        weeklyMissionWeek: t.isPlayer ? t.weeklyMissionWeek : undefined,
        dayStartNet: t.isPlayer ? t.dayStartNet : undefined,
        dayStartDay: t.isPlayer ? t.dayStartDay : undefined,
      })),
      assets: {} as Record<string, any>,
      events: S.events.slice(0, 30),
      active: S.active,
      saveTime: Date.now(),
    };
    ASSETS.forEach(a => {
      const ast = S.assets[a.id];
      const series: Record<string, { candles: any[] }> = {};
      for (const tf of TF_LIST) series[tf] = { candles: ast.series[tf].candles.slice(-60) };
      out.assets[a.id] = {
        lastPrice: ast.lastPrice, open: ast.open, hi: ast.hi, lo: ast.lo,
        volume: ast.volume, fv: ast.fv,
        history: ast.history.slice(-120),
        series,
        volumeHist: ast.volumeHist.slice(-120),
      };
    });
    const data = JSON.stringify(out);
    // Atomic write: tmp file → rename. Keep a .bak of last good save.
    await fsp.writeFile(TMP_FILE, data);
    if (fs.existsSync(SAVE_FILE)) {
      try { await fsp.rename(SAVE_FILE, BAK_FILE); } catch { /* ignore */ }
    }
    await fsp.rename(TMP_FILE, SAVE_FILE);
  } catch (e) {
    console.error('save error:', (e as Error).message);
  }
}

function nonZeroHoldings(h: Record<string, Holding>): Record<string, Holding> {
  const out: Record<string, Holding> = {};
  for (const aid of Object.keys(h)) {
    const x = h[aid];
    if (x && (x.shares !== 0 || (x.slPct && x.slPct > 0) || (x.tpPct && x.tpPct > 0))) out[aid] = x;
  }
  return out;
}

export function diskLoad(target: GameState): boolean {
  // Try main; fall back to .bak if main is truncated/corrupt.
  return loadFrom(target, SAVE_FILE) || loadFrom(target, BAK_FILE);
}

function loadFrom(target: GameState, file: string): boolean {
  try {
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    if (!raw.trim()) return false;
    const d = JSON.parse(raw);
    // Accept v2, v3, v4 — older discarded. Missing fields default-fill.
    if (d.v !== FORMAT_VERSION && d.v !== 2 && d.v !== 3) {
      console.log(`🗑 incompatible save format v${d.v} in ${path.basename(file)} — ignoring`);
      return false;
    }
    if (d.v !== FORMAT_VERSION) console.log(`⚙ migrating v${d.v} → v${FORMAT_VERSION} save`);
    // Build valid-asset-id set once for stale pickedAssets filtering.
    const validAssetIds = new Set(ASSETS.map(a => a.id));
    d.traders.forEach((td: Partial<Trader>, i: number) => {
      if (!target.traders[i]) return;
      const t = target.traders[i];
      Object.assign(t, td);
      // Drop pickedAssets entries that no longer exist (old asset universe).
      if (Array.isArray(t.pickedAssets)) {
        t.pickedAssets = t.pickedAssets.filter(id => validAssetIds.has(id));
        if (t.pickedAssets.length === 0) t.pickedAssets = null;
      }
      t.cooldown = 0;
      t.openOrders = [];
      // CRITICAL FIX: Object.assign(t, td) above replaced t.holdings with the
      // SPARSE saved holdings (only non-zero). Rebuild a FULL holdings map so
      // every current asset has an entry — otherwise trading a zero-held asset
      // hits holdings[aid] === undefined and crashes executeTrade (.shares).
      const incoming = (td as any).holdings || {};
      const rebuilt: Record<string, Holding> = {};
      for (const a of ASSETS) {
        const h = incoming[a.id];
        rebuilt[a.id] = (h && typeof h.shares === 'number')
          ? { shares: h.shares, avgCost: h.avgCost || 0, slPct: h.slPct, tpPct: h.tpPct, sl: h.sl, tp: h.tp }
          : { shares: 0, avgCost: 0 };
      }
      t.holdings = rebuilt;
      if (!t.indicators) {
        t.indicators = {};
        ASSETS.forEach(a => { t.indicators[a.id] = { emaFast: null, emaSlow: null }; });
      }
    });
    ASSETS.forEach(a => {
      const sa = d.assets?.[a.id];
      if (sa) {
        target.assets[a.id].lastPrice = sa.lastPrice ?? target.assets[a.id].lastPrice;
        target.assets[a.id].open = sa.open ?? target.assets[a.id].open;
        target.assets[a.id].hi = sa.hi ?? target.assets[a.id].hi;
        target.assets[a.id].lo = sa.lo ?? target.assets[a.id].lo;
        target.assets[a.id].volume = sa.volume ?? 0;
        target.assets[a.id].fv = sa.fv ?? target.assets[a.id].fv;
        if (Array.isArray(sa.history)) target.assets[a.id].history = sa.history;
        if (Array.isArray(sa.volumeHist)) target.assets[a.id].volumeHist = sa.volumeHist;
        const series: Record<TFKey, CandleSeries> = target.assets[a.id].series;
        for (const tf of TF_LIST) {
          const old = sa.series?.[tf];
          series[tf] = {
            candles: Array.isArray(old?.candles) ? old.candles : [],
            curCandle: null,
            candleStartT: 0,
          };
        }
        target.assets[a.id].book = makeBook();
      }
    });
    target.events = d.events || [];
    target.active = (d.active && target.assets[d.active]) ? d.active : (ASSETS[0]?.id || 'NEXA');
    console.log(`💾 loaded from ${path.basename(file)}`);
    return true;
  } catch (e) {
    console.error(`load error from ${path.basename(file)}:`, (e as Error).message);
    return false;
  }
}
