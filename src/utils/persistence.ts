import { ASSETS, SAVE_KEY } from '../engine/constants';
import { makeBook } from '../engine/orderbook';
import type { GameState, Trader } from '../engine/types';

interface SaveBlob {
  traders: Partial<Trader>[];
  assets: Record<string, any>;
  events: GameState['events'];
  active: string;
  muted: boolean;
  chartLine: boolean;
  chartCandles: boolean;
  chartVol: boolean;
  saveTime: number;
}

let WIPING = false;

export function setWiping(): void {
  WIPING = true;
}

export function save(S: GameState, ui: { muted: boolean; chartLine: boolean; chartCandles: boolean; chartVol: boolean }): void {
  if (WIPING) return;
  const out: SaveBlob = {
    traders: S.traders.map(t => ({
      id: t.id, name: t.name, cash: t.cash, holdings: t.holdings, strat: t.strat,
      isPlayer: t.isPlayer, activity: t.activity, pickedAssets: t.pickedAssets,
      fairBias: t.fairBias, riskTol: t.riskTol, stopLoss: t.stopLoss, takeProfit: t.takeProfit,
      bornNet: t.bornNet, tradesSinceChange: t.tradesSinceChange, mutateCooldown: t.mutateCooldown,
      rekt: t.rekt,
    })),
    assets: {},
    events: S.events.slice(0, 15),
    active: S.active,
    muted: ui.muted, chartLine: ui.chartLine, chartCandles: ui.chartCandles, chartVol: ui.chartVol,
    saveTime: Date.now(),
  };
  ASSETS.forEach(a => {
    const ast = S.assets[a.id];
    out.assets[a.id] = {
      lastPrice: ast.lastPrice, open: ast.open, hi: ast.hi, lo: ast.lo,
      volume: ast.volume, fv: ast.fv,
      history: ast.history.slice(-120),
      candles: ast.candles.slice(-40),
      volumeHist: ast.volumeHist.slice(-120),
    };
  });
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(out)); } catch { /* ignore */ }
}

export interface LoadResult {
  raw: SaveBlob;
  uiPrefs: { muted: boolean; chartLine: boolean; chartCandles: boolean; chartVol: boolean };
}

export function load(): LoadResult | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d: SaveBlob = JSON.parse(raw);
    return {
      raw: d,
      uiPrefs: {
        muted: !!d.muted,
        chartLine: d.chartLine !== false,
        chartCandles: d.chartCandles !== false,
        chartVol: d.chartVol !== false,
      },
    };
  } catch { return null; }
}

export function hydrateState(target: GameState, d: SaveBlob): void {
  d.traders.forEach((td, i) => {
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
}

export function wipe(): void {
  WIPING = true;
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('marketMogul_v1');
    localStorage.removeItem('marketMogul_v2');
  } catch { /* ignore */ }
  location.reload();
}
