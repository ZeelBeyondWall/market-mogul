import { ASSETS, NEWS_EVENTS } from './constants';
import { rand } from './helpers';
import type { AssetCategory, GameState, NewsEvent, NewsEventDef } from './types';
import { TF_LIST, TF_MS } from './types';

// Pre-computed category → asset-id list. Built once at module load — ASSETS is static.
const SECTOR_INDEX: Record<AssetCategory, string[]> = (() => {
  const out = {} as Record<AssetCategory, string[]>;
  for (const a of ASSETS) {
    (out[a.cat] = out[a.cat] || []).push(a.id);
  }
  return out;
})();

function resolveEventAssetIds(ev: NewsEventDef): string[] {
  if (ev.filter && ev.filter.length) {
    // Drop any filter ids that aren't real assets (stale legacy refs).
    const valid = ev.filter.filter(id => !!SECTOR_INDEX && ASSETS.find(a => a.id === id));
    if (valid.length !== ev.filter.length) {
      console.warn(`[news] event "${ev.title}" has ${ev.filter.length - valid.length} dead asset filter id(s)`);
    }
    if (valid.length) return valid;
    // fall through to sectorFilter / market-wide if filter resolved to nothing
  }
  if (ev.sectorFilter && ev.sectorFilter.length) {
    const ids = new Set<string>();
    for (const sec of ev.sectorFilter) {
      const list = SECTOR_INDEX[sec];
      if (!list || list.length === 0) {
        console.warn(`[news] event "${ev.title}" references unknown/empty sector "${sec}"`);
        continue;
      }
      for (const id of list) ids.add(id);
    }
    if (ids.size > 0) return [...ids];
  }
  return ASSETS.map(a => a.id); // market-wide fallback
}

export function tickMarket(S: GameState, _dt: number, now: number): void {
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

    // v8.7: PRICE STABILITY — circuit breaker + gentle mean reversion.
    // Price is trade-driven, but with no anchor a feedback loop (bots quoting
    // around lastPrice) let it detach to 100x+ fair value. Two guards:
    //   1. Hard band: lastPrice clamped to [0.25x, 4x] of fair value.
    //   2. Soft pull: nudge lastPrice ~0.08%/tick toward fair value so it
    //      drifts home after shocks instead of sticking at the band edge.
    const fv = ast.fv > 0 ? ast.fv : a.fairValue;
    const loBand = fv * 0.25, hiBand = fv * 4;
    if (ast.lastPrice < loBand) ast.lastPrice = loBand;
    else if (ast.lastPrice > hiBand) ast.lastPrice = hiBand;
    ast.lastPrice += (fv - ast.lastPrice) * 0.0008;

    ast.history.push(ast.lastPrice);
    if (ast.history.length > 240) ast.history.shift();

    // Update every TF's current candle. Promote when its window elapsed.
    for (const tf of TF_LIST) {
      const s = ast.series[tf];
      if (!s.curCandle) {
        s.curCandle = { o: ast.lastPrice, h: ast.lastPrice, l: ast.lastPrice, c: ast.lastPrice, v: 0 };
        s.candleStartT = now;
      }
      const c = s.curCandle;
      c.h = Math.max(c.h, ast.lastPrice);
      c.l = Math.min(c.l, ast.lastPrice);
      c.c = ast.lastPrice;
      if (now - s.candleStartT >= TF_MS[tf]) {
        s.candles.push(c);
        if (s.candles.length > 240) s.candles.shift();
        s.curCandle = null;
      }
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

export function maybeFireEvent(_S: GameState, dt: number, state: { cooldown: number }): NewsEventDef | null {
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
  const affected = resolveEventAssetIds(ev);
  const set = new Set(affected);
  ASSETS.forEach(a => {
    if (!set.has(a.id)) return;
    const ast = S.assets[a.id];
    ast.fvDelta = ev.fvDelta / ev.dur;
    ast.fvEventTicks = ev.dur;
    ast.volMult = ev.vol;
    ast.volEventTicks = ev.dur * 1.5;
  });
  const log: NewsEvent = {
    type: ev.type, title: ev.title, desc: ev.desc, t: Date.now(),
    assetIds: affected, cat: ev.cat,
  };
  S.events.unshift(log);
  if (S.events.length > 50) S.events.pop();
  return log;
}
