import fs from 'fs';
import path from 'path';
import { ASSETS } from '../../shared/engine/constants';
import { makeBook } from '../../shared/engine/orderbook';
import type { GameState, Trader } from '../../shared/engine/types';

const SAVE_FILE = path.resolve(process.cwd(), 'state.json');

export function diskSave(S: GameState): void {
  try {
    const out = {
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
      out.assets[a.id] = {
        lastPrice: ast.lastPrice, open: ast.open, hi: ast.hi, lo: ast.lo,
        volume: ast.volume, fv: ast.fv,
        history: ast.history.slice(-120),
        candles: ast.candles.slice(-60),
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
        Object.assign(target.assets[a.id], sa);
        target.assets[a.id].book = makeBook();
        target.assets[a.id].curCandle = null;
        target.assets[a.id].candleStartT = 0;
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
