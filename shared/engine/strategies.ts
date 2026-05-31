import { ASSETS, TRANSITIONS } from './constants';
import { calcEMA, rand, roundShares } from './helpers';
import { cullStaleOrders, placeOrder } from './matching';
import { bestBid, bestAsk, insertOrder, midPrice } from './orderbook';
import { activityFor, pickAssetsFor, stopLossFor, takeProfitFor } from './traders';
import type { GameState, StrategyId, Trader } from './types';

// Pre-built id list (avoid ASSETS.map(a=>a.id) every botDecide call)
const ASSET_IDS: string[] = ASSETS.map(a => a.id);

// PERF: cached traderNet — invalidate via markNetDirty(traderId). Most calls are
// O(1) cache hit; cold miss is O(assets).
export function traderNet(t: Trader, S: GameState): number {
  if (!t._netDirty && t._netCache != null) return t._netCache;
  let v = t.cash;
  for (let i = 0; i < ASSET_IDS.length; i++) {
    const h = t.holdings[ASSET_IDS[i]];
    if (h && h.shares !== 0) v += h.shares * S.assets[ASSET_IDS[i]].lastPrice;
  }
  t._netCache = v;
  t._netDirty = false;
  return v;
}

export function markNetDirty(t: Trader): void {
  t._netDirty = true;
}

export function checkRekt(t: Trader, S: GameState): void {
  if (t.isPlayer || t.rekt) return;
  // Use cache (marked dirty on trades) — cheap.
  const nw = traderNet(t, S);
  if (nw < 1) {
    t.rekt = true;
    t.activity = 0;
    for (let i = 0; i < ASSET_IDS.length; i++) {
      const book = S.assets[ASSET_IDS[i]].book;
      // Compact in-place rather than allocating new arrays
      let w = 0;
      for (let k = 0; k < book.bids.length; k++) if (book.bids[k].ownerId !== t.id) book.bids[w++] = book.bids[k];
      book.bids.length = w;
      w = 0;
      for (let k = 0; k < book.asks.length; k++) if (book.asks[k].ownerId !== t.id) book.asks[w++] = book.asks[k];
      book.asks.length = w;
    }
    t.openOrders = [];
  }
}

function pickTransition(t: Trader, deltaPct: number, trades: number): StrategyId | null {
  const map = TRANSITIONS[t.strat];
  if (!map) return null;
  if (deltaPct > 0.30 && Math.random() < 0.6) return map.win;
  if (deltaPct < -0.25 && Math.random() < 0.7) return map.loss;
  if (trades > 30 && Math.abs(deltaPct) < 0.05 && Math.random() < 0.2) return map.grind;
  return null;
}

export function maybeMutate(t: Trader, S: GameState): void {
  if (t.isPlayer) return;
  if (t.tradesSinceChange < 5) return;
  if (t.mutateCooldown-- > 0) return;
  const now = traderNet(t, S); // cached
  const base = Math.max(1, t.bornNet);
  const delta = (now - base) / base;
  const newStrat = pickTransition(t, delta, t.tradesSinceChange);
  if (!newStrat || newStrat === t.strat) {
    t.mutateCooldown = Math.floor(rand(8, 25));
    return;
  }
  t.strat = newStrat;
  t.bornNet = now;
  t.tradesSinceChange = 0;
  t.mutateCooldown = Math.floor(rand(15, 50));
  t.activity = activityFor(newStrat);
  t.stopLoss = stopLossFor(newStrat);
  t.takeProfit = takeProfitFor(newStrat);
  if (Math.random() < 0.4) t.pickedAssets = pickAssetsFor(newStrat);
}

// PERF: variance/sigma only computed for strategies that actually use them.
const NEEDS_VARIANCE: Set<string> = new Set(['mm', 'reversion', 'contrarian', 'scalper']);

export function botDecide(t: Trader, S: GameState): void {
  const assets = t.pickedAssets && t.pickedAssets.length ? t.pickedAssets : ASSET_IDS;
  const aid = assets[(Math.random() * assets.length) | 0];
  const ast = S.assets[aid];
  const last = ast.lastPrice || ast.fv;
  const fv = ast.fv * t.fairBias;
  const hold = t.holdings[aid];
  if (!hold) return;

  if (t.cash < last && hold.shares <= 0) return;

  // Cheap stats — single pass over history tail
  const hist = ast.history;
  const histLen = hist.length;
  const tailStart = Math.max(0, histLen - 40);
  const oldP = hist[tailStart] || last;
  const ret = (last - oldP) / (oldP || 1);

  // Variance/sigma only when needed
  let sigma = 0;
  if (NEEDS_VARIANCE.has(t.strat as string)) {
    let sum = 0; let count = 0;
    for (let i = tailStart; i < histLen; i++) { sum += hist[i]; count++; }
    if (count > 0) {
      const mean = sum / count;
      let v = 0;
      for (let i = tailStart; i < histLen; i++) { const d = hist[i] - mean; v += d * d; }
      sigma = Math.sqrt(v / count);
    }
  }

  const positionSize = (frac: number) => {
    const budget = t.cash * frac;
    const px = Math.max(0.01, last);
    const raw = budget / px;
    const minQty = Math.min(1, 0.5 / px);
    return roundShares(Math.max(minQty, raw));
  };
  const sellQty = (qty: number, pxMult = 0.998) => {
    qty = Math.min(qty, hold.shares);
    if (qty <= 0) return;
    placeOrder(S, t.id, aid, 'sell', qty, +(last * pxMult).toFixed(4), 'limit');
  };
  const buyQty = (qty: number, pxMult = 1.002) => {
    if (qty <= 0) return;
    if (t.cash < last * qty) qty = roundShares(t.cash / last);
    if (qty <= 0) return;
    placeOrder(S, t.id, aid, 'buy', qty, +(last * pxMult).toFixed(4), 'limit');
  };
  const openShort = (qty: number, pxMult = 0.998) => {
    if (qty <= 0) return;
    if (hold.shares > 0) return;
    if (t.cash < last * qty * 0.5) qty = roundShares((t.cash * 2) / last);
    if (qty <= 0) return;
    placeOrder(S, t.id, aid, 'sell', qty, +(last * pxMult).toFixed(4), 'limit');
  };

  if (hold.shares > 0 && hold.avgCost > 0 && t.stopLoss > 0) {
    const pnl = (last - hold.avgCost) / hold.avgCost;
    if (pnl < -t.stopLoss) { sellQty(hold.shares, 0.992); return; }
    if (t.takeProfit > 0 && pnl > t.takeProfit) {
      sellQty(Math.ceil(hold.shares * (t.strat === 'paper' ? 1 : 0.5)), 1.002); return;
    }
  }
  if (hold.shares < 0 && hold.avgCost > 0 && t.stopLoss > 0) {
    const pnl = (hold.avgCost - last) / hold.avgCost;
    if (pnl < -t.stopLoss) {
      const qty = -hold.shares;
      if (t.cash > qty * last * 0.95) buyQty(qty, 1.005);
      return;
    }
  }

  switch (t.strat) {
    case 'yolo':
      if (Math.random() < 0.7 && t.cash > last) buyQty(positionSize(rand(0.3, 0.7)), 1.008);
      else if (hold.shares > 0) sellQty(Math.ceil(hold.shares * rand(0.7, 1)), 0.992);
      else openShort(positionSize(rand(0.1, 0.4)), 0.992);
      break;
    case 'diamond':
      if (ret < -0.015 && t.cash > last) buyQty(positionSize(rand(0.08, 0.2)), 1.001);
      else if (Math.random() < 0.3 && t.cash > last) buyQty(positionSize(rand(0.03, 0.08)), 1.0);
      break;
    case 'paper':
      if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (Math.abs(pnl) > 0.015) { sellQty(hold.shares, pnl >= 0 ? 0.999 : 0.995); return; }
      }
      if (t.cash > last && Math.random() < 0.3) buyQty(positionSize(rand(0.05, 0.12)));
      break;
    case 'permabull':
      if (t.cash > last) buyQty(positionSize(rand(0.05, 0.15)), 1.003);
      break;
    case 'permabear':
      if (hold.shares > 0) sellQty(hold.shares, 0.997);
      else if (t.cash > last * 2) openShort(positionSize(rand(0.08, 0.2)), 0.997);
      break;
    case 'lazy':
      if (Math.random() < 0.15 && t.cash > last * 5) buyQty(positionSize(rand(0.2, 0.4)), 1.001);
      break;
    case 'newschase': {
      const ev = S.events[0];
      if (!ev) return;
      const age = (Date.now() - ev.t) / 1000;
      if (age > 30) return;
      if (ev.type === 'boom' && t.cash > last) buyQty(positionSize(rand(0.2, 0.5)), 1.015);
      else if (ev.type === 'crash') {
        if (hold.shares > 0) sellQty(hold.shares, 0.985);
        else if (t.cash > last * 2) openShort(positionSize(rand(0.15, 0.4)), 0.985);
      }
      break;
    }
    case 'fomo':
      if (ret > 0.04 && t.cash > last) buyQty(positionSize(rand(0.2, 0.5)), 1.015);
      else if (ret < -0.02 && hold.shares > 0) sellQty(hold.shares, 0.985);
      break;
    case 'conservative':
      if (last < fv * 0.95 && t.cash > last) buyQty(positionSize(rand(0.03, 0.07)));
      else if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl > 0.15) sellQty(Math.ceil(hold.shares * 0.5), 1.002);
      }
      break;
    case 'gambler':
      if (Math.random() < 0.5 && t.cash > last) buyQty(positionSize(rand(0.5, 0.95)), 1.02);
      else if (hold.shares > 0) sellQty(hold.shares, 0.97);
      else if (t.cash > last * 2) openShort(positionSize(rand(0.3, 0.6)), 0.97);
      break;
    case 'value': {
      const gap = (last - fv) / fv;
      if (gap < -0.10 && t.cash > last) buyQty(positionSize(rand(0.1, 0.2)));
      else if (gap > 0.12 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.7), 1.002);
      break;
    }
    case 'trend': {
      // Lazy-init: a bot mutated INTO 'trend' didn't have indicators allocated.
      let ind = t.indicators[aid];
      if (!ind) { ind = { emaFast: null, emaSlow: null }; t.indicators[aid] = ind; }
      ind.emaFast = calcEMA(ind.emaFast, last, 0.15);
      ind.emaSlow = calcEMA(ind.emaSlow, last, 0.04);
      const xover = (ind.emaFast || 0) - (ind.emaSlow || 0);
      if (xover > last * 0.005 && t.cash > last) buyQty(positionSize(rand(0.1, 0.2)), 1.003);
      else if (xover < -last * 0.005 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.8), 0.997);
      break;
    }
    case 'mm': {
      const mid = midPrice(ast.book) || last;
      const dynSp = Math.max(0.002, Math.min(0.03, sigma / mid));
      const sp = mid * dynSp;
      const sz = positionSize(0.015);
      if (sz > 0 && t.cash > (mid - sp) * sz) {
        const bid = { id: S.orderId++, ownerId: t.id, px: +(mid - sp).toFixed(4), qty: sz, ts: Date.now() };
        insertOrder(ast.book, 'bids', bid);
        t.openOrders.push({ assetId: aid, side: 'bids', id: bid.id });
      }
      if (hold.shares > 0) {
        const askSize = Math.min(hold.shares, sz);
        const ask = { id: S.orderId++, ownerId: t.id, px: +(mid + sp).toFixed(4), qty: askSize, ts: Date.now() };
        insertOrder(ast.book, 'asks', ask);
        t.openOrders.push({ assetId: aid, side: 'asks', id: ask.id });
      }
      return;
    }
    case 'copycat':
      if (ret > 0.01 && t.cash > last) buyQty(positionSize(rand(0.08, 0.18)), 1.005);
      else if (ret < -0.01 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.6), 0.995);
      break;
    case 'revenge':
      if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl < -0.08 && t.cash > last) buyQty(hold.shares, 1.002);
        else if (pnl > 0.10) sellQty(hold.shares, 1.001);
      } else if (t.cash > last && Math.random() < 0.4) {
        buyQty(positionSize(rand(0.1, 0.2)), 1.003);
      }
      break;
  }
  cullStaleOrders(S, t);
}

// PERF: Fixed-budget scan — process at most BOTS_PER_TICK bots per call.
// Full rotation = (totalBots / BOTS_PER_TICK) ticks * 100ms.
// 10K → 200ms full pass. 100K → 2s. 500K → 10s.
// Engine CPU stays bounded by BOTS_PER_TICK regardless of population size.
const BOTS_PER_TICK = Number(process.env.MM_BOTS_PER_TICK) || 5000;
let scanCursor = 1;

export function tickBots(S: GameState, dt: number): void {
  const total = S.traders.length;
  if (total <= 1) return;
  const popSize = total - 1;
  // Each bot is touched every (popSize/BOTS_PER_TICK) ticks. Scale dt so each
  // bot's cooldown decays at correct wall-clock rate even when starved.
  const visitGap = Math.max(1, popSize / BOTS_PER_TICK);
  const effectiveDt = dt * visitGap;
  const budget = Math.min(BOTS_PER_TICK, popSize);
  let i = scanCursor;
  let scanned = 0;
  while (scanned < budget) {
    if (i >= total) i = 1;
    const t = S.traders[i];
    if (!t.rekt) {
      t.cooldown -= effectiveDt;
      if (t.cooldown <= 0) {
        t.cooldown = rand(0.5, 2) / Math.max(0.05, t.activity);
        botDecide(t, S);
      }
    }
    i++;
    scanned++;
  }
  scanCursor = i;
}
