import { ASSETS, TRANSITIONS } from './constants';
import { calcEMA, rand, roundShares } from './helpers';
import { cullStaleOrders, placeOrder } from './matching';
import { bestBid, bestAsk, insertOrder, midPrice } from './orderbook';
import { activityFor, pickAssetsFor, stopLossFor, takeProfitFor } from './traders';
import type { GameState, StrategyId, Trader } from './types';

export function traderNet(t: Trader, S: GameState): number {
  let v = t.cash;
  ASSETS.forEach(a => {
    v += (t.holdings[a.id]?.shares || 0) * S.assets[a.id].lastPrice;
  });
  return v;
}

export function checkRekt(t: Trader, S: GameState): void {
  if (t.isPlayer || t.rekt) return;
  const nw = traderNet(t, S);
  if (nw < 1) {
    t.rekt = true;
    t.activity = 0;
    ASSETS.forEach(a => {
      const book = S.assets[a.id].book;
      book.bids = book.bids.filter(o => o.ownerId !== t.id);
      book.asks = book.asks.filter(o => o.ownerId !== t.id);
    });
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
  t.tradesSinceChange++;
  if (t.tradesSinceChange < 5) return;
  if (t.mutateCooldown-- > 0) return;
  const now = traderNet(t, S);
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

export function botDecide(t: Trader, S: GameState): void {
  const assets = t.pickedAssets && t.pickedAssets.length ? t.pickedAssets : ASSETS.map(a => a.id);
  const aid = assets[Math.floor(Math.random() * assets.length)];
  const ast = S.assets[aid];
  const last = ast.lastPrice || ast.fv;
  const fv = ast.fv * t.fairBias;
  const hold = t.holdings[aid];

  if (t.cash < last && hold.shares <= 0) return;

  const hist = ast.history.slice(-40);
  const oldP = hist[0] || last;
  const ret = (last - oldP) / (oldP || 1);
  const mean = hist.reduce((s, x) => s + x, 0) / hist.length;
  const variance = hist.reduce((s, x) => s + (x - mean) * (x - mean), 0) / hist.length;
  const sigma = Math.sqrt(variance);

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
    case 'yolo': {
      if (Math.random() < 0.7 && t.cash > last) buyQty(positionSize(rand(0.3, 0.7)), 1.008);
      else if (hold.shares > 0) sellQty(Math.ceil(hold.shares * rand(0.7, 1)), 0.992);
      else openShort(positionSize(rand(0.1, 0.4)), 0.992);
      break;
    }
    case 'diamond': {
      if (ret < -0.015 && t.cash > last) buyQty(positionSize(rand(0.08, 0.2)), 1.001);
      else if (Math.random() < 0.3 && t.cash > last) buyQty(positionSize(rand(0.03, 0.08)), 1.0);
      break;
    }
    case 'paper': {
      if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (Math.abs(pnl) > 0.015) {
          sellQty(hold.shares, pnl >= 0 ? 0.999 : 0.995);
          return;
        }
      }
      if (t.cash > last && Math.random() < 0.3) buyQty(positionSize(rand(0.05, 0.12)));
      break;
    }
    case 'permabull': {
      if (t.cash > last) buyQty(positionSize(rand(0.05, 0.15)), 1.003);
      break;
    }
    case 'permabear': {
      if (hold.shares > 0) sellQty(hold.shares, 0.997);
      else if (t.cash > last * 2) openShort(positionSize(rand(0.08, 0.2)), 0.997);
      break;
    }
    case 'lazy': {
      if (Math.random() < 0.15 && t.cash > last * 5) buyQty(positionSize(rand(0.2, 0.4)), 1.001);
      break;
    }
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
    case 'fomo': {
      if (ret > 0.04 && t.cash > last) buyQty(positionSize(rand(0.2, 0.5)), 1.015);
      else if (ret < -0.02 && hold.shares > 0) sellQty(hold.shares, 0.985);
      break;
    }
    case 'conservative': {
      if (last < fv * 0.95 && t.cash > last) buyQty(positionSize(rand(0.03, 0.07)));
      else if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl > 0.15) sellQty(Math.ceil(hold.shares * 0.5), 1.002);
      }
      break;
    }
    case 'gambler': {
      if (Math.random() < 0.5 && t.cash > last) buyQty(positionSize(rand(0.5, 0.95)), 1.02);
      else if (hold.shares > 0) sellQty(hold.shares, 0.97);
      else if (t.cash > last * 2) openShort(positionSize(rand(0.3, 0.6)), 0.97);
      break;
    }
    case 'value': {
      const gap = (last - fv) / fv;
      if (gap < -0.10 && t.cash > last) buyQty(positionSize(rand(0.1, 0.2)));
      else if (gap > 0.12 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.7), 1.002);
      break;
    }
    case 'trend': {
      const ind = t.indicators[aid];
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
    case 'copycat': {
      if (ret > 0.01 && t.cash > last) buyQty(positionSize(rand(0.08, 0.18)), 1.005);
      else if (ret < -0.01 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.6), 0.995);
      break;
    }
    case 'revenge': {
      if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl < -0.08 && t.cash > last) buyQty(hold.shares, 1.002);
        else if (pnl > 0.10) sellQty(hold.shares, 1.001);
      } else if (t.cash > last && Math.random() < 0.4) {
        buyQty(positionSize(rand(0.1, 0.2)), 1.003);
      }
      break;
    }
  }
  cullStaleOrders(S, t);
}

export function tickBots(S: GameState, dt: number): void {
  for (let i = 1; i < S.traders.length; i++) {
    const t = S.traders[i];
    if (t.rekt) continue;
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    t.cooldown = rand(0.5, 2) / Math.max(0.05, t.activity);
    botDecide(t, S);
  }
}
