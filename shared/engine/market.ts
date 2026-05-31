import { ASSETS, CANDLE_MS, NEWS_EVENTS } from './constants';
import { rand } from './helpers';
import type { GameState, NewsEvent, NewsEventDef } from './types';

export function tickMarket(S: GameState, dt: number, now: number): void {
  ASSETS.forEach(a => {
    const ast = S.assets[a.id];
    ast.fv += (a.fairValue - ast.fv) * 0.0005;
    if (ast.fvEventTicks > 0) {
      ast.fv *= (1 + ast.fvDelta);
      ast.fvEventTicks--;
    }
    if (ast.volEventTicks > 0) {
      ast.volEventTicks--;
      if (ast.volEventTicks <= 0) ast.volMult = 1;
    }
    ast.history.push(ast.lastPrice);
    if (ast.history.length > 240) ast.history.shift();
    if (!ast.curCandle) {
      ast.curCandle = { o: ast.lastPrice, h: ast.lastPrice, l: ast.lastPrice, c: ast.lastPrice, v: 0 };
      ast.candleStartT = now;
      ast._candleVolStart = ast.volume;
    }
    const c = ast.curCandle;
    c.h = Math.max(c.h, ast.lastPrice);
    c.l = Math.min(c.l, ast.lastPrice);
    c.c = ast.lastPrice;
    c.v = ast.volume - (ast._candleVolStart || 0);
    if (now - ast.candleStartT >= CANDLE_MS) {
      ast.candles.push(c);
      if (ast.candles.length > 120) ast.candles.shift();
      ast.curCandle = null;
    }
    ast.volumeHist.push(ast.volume - (ast._lastVolSnap || 0));
    if (ast.volumeHist.length > 240) ast.volumeHist.shift();
    ast._lastVolSnap = ast.volume;
  });
}

export function payDividends(S: GameState, dt: number): void {
  ASSETS.forEach(a => {
    if (a.div <= 0) return;
    const ast = S.assets[a.id];
    S.traders.forEach(t => {
      const h = t.holdings[a.id];
      if (h && h.shares > 0) {
        t.cash += h.shares * ast.lastPrice * a.div * dt;
      }
    });
  });
}

export function maybeFireEvent(S: GameState, dt: number, state: { cooldown: number }): NewsEventDef | null {
  state.cooldown -= dt;
  if (state.cooldown > 0) return null;
  state.cooldown = rand(20, 45);
  const totalW = NEWS_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalW;
  let ev = NEWS_EVENTS[0];
  for (const e of NEWS_EVENTS) { r -= e.weight; if (r <= 0) { ev = e; break; } }
  return ev;
}

export function applyEvent(S: GameState, ev: NewsEventDef): NewsEvent {
  ASSETS.forEach(a => {
    if (ev.filter && !ev.filter.includes(a.id)) return;
    const ast = S.assets[a.id];
    ast.fvDelta = ev.fvDelta / ev.dur;
    ast.fvEventTicks = ev.dur;
    ast.volMult = ev.vol;
    ast.volEventTicks = ev.dur * 1.5;
  });
  const log: NewsEvent = { type: ev.type, title: ev.title, desc: ev.desc, t: Date.now() };
  S.events.unshift(log);
  if (S.events.length > 30) S.events.pop();
  return log;
}
