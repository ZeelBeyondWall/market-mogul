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
const FORMAT_VERSION = 2;

let saving = false; // prevent overlapping saves

export function diskSave(S: GameState): void {
  if (saving) return;
  saving = true;
  // Serialize on next tick so we don't block the call site; await externally if needed.
  void doSave(S).finally(() => { saving = false; });
}

async function doSave(S: GameState): Promise<void> {
  try {
    const out = {
      v: FORMAT_VERSION,
      traders: S.traders.map(t => ({
        id: t.id, name: t.name, cash: t.cash,
        holdings: nonZeroHoldings(t.holdings), // ~20x smaller
        strat: t.strat,
        isPlayer: t.isPlayer, activity: t.activity, pickedAssets: t.pickedAssets,
        fairBias: t.fairBias, riskTol: t.riskTol, stopLoss: t.stopLoss, takeProfit: t.takeProfit,
        bornNet: t.bornNet, tradesSinceChange: t.tradesSinceChange, mutateCooldown: t.mutateCooldown,
        rekt: t.rekt,
      })),
      assets: {} as Record<string, any>,
      events: S.events.slice(0, 15),
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
    if (d.v !== FORMAT_VERSION) {
      console.log(`🗑 incompatible save format in ${path.basename(file)} — ignoring`);
      return false;
    }
    d.traders.forEach((td: Partial<Trader>, i: number) => {
      if (!target.traders[i]) return;
      const t = target.traders[i];
      Object.assign(t, td);
      t.cooldown = 0;
      t.openOrders = [];
      // Holdings: server now saves only non-zero — restore zeros for the rest
      const incoming = (td as any).holdings || {};
      for (const aid of Object.keys(t.holdings)) {
        if (incoming[aid]) t.holdings[aid] = incoming[aid];
        else { t.holdings[aid].shares = 0; t.holdings[aid].avgCost = 0; }
      }
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
    target.active = d.active || 'PUMP';
    console.log(`💾 loaded from ${path.basename(file)}`);
    return true;
  } catch (e) {
    console.error(`load error from ${path.basename(file)}:`, (e as Error).message);
    return false;
  }
}
