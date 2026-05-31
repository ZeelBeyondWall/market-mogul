import fs from 'fs';
import path from 'path';
import { ASSETS } from '../../../shared/engine/constants';
import { makeBook } from '../../../shared/engine/orderbook';
import type { CandleSeries, GameState, TFKey, Trader } from '../../../shared/engine/types';
import { TF_LIST } from '../../../shared/engine/types';

const SAVE_FILE = path.resolve(process.cwd(), 'state.json');
const FORMAT_VERSION = 2; // bump when shape changes incompatibly

export function diskSave(S: GameState): void {
  try {
    const out = {
      v: FORMAT_VERSION,
      traders: S.traders.map(t => ({
        id: t.id, name: t.name, cash: t.cash, holdings: t.holdings, strat: t.strat,
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
    fs.writeFileSync(SAVE_FILE, JSON.stringify(out));
  } catch (e) {
    console.error('save error', e);
  }
}

export function diskLoad(target: GameState): boolean {
  try {
    if (!fs.existsSync(SAVE_FILE)) return false;
    const d = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf-8'));
    if (d.v !== FORMAT_VERSION) {
      console.log('🗑 incompatible save format — starting fresh');
      try { fs.unlinkSync(SAVE_FILE); } catch { /* ignore */ }
      return false;
    }
    d.traders.forEach((td: Partial<Trader>, i: number) => {
      if (!target.traders[i]) return;
      const t = target.traders[i];
      Object.assign(t, td);
      t.cooldown = 0;
      t.openOrders = [];
      if (!t.indicators) {
        t.indicators = {};
        ASSETS.forEach(a => { t.indicators[a.id] = { emaFast: null, emaSlow: null }; });
      }
    });
    ASSETS.forEach(a => {
      const sa = d.assets?.[a.id];
      if (sa) {
        // copy scalar/array fields, then rebuild series
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
    return true;
  } catch (e) {
    console.error('load error', e);
    return false;
  }
}
