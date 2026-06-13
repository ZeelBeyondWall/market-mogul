import { ASSETS, ASSET_BY_ID, TRANSITIONS } from './constants';
import { calcEMA, calcRSI, rand, roundShares } from './helpers';
import { cullStaleOrders, placeOrder } from './matching';
import { bestBid, bestAsk, insertOrder, midPrice, removeOrder } from './orderbook';
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
  if (Math.random() < 0.4) t.pickedAssets = pickAssetsFor(newStrat, t.level || 1);
}

// PERF: variance/sigma only computed for strategies that actually use them.
const NEEDS_VARIANCE: Set<string> = new Set(['mm', 'reversion', 'contrarian', 'scalper']);

export function botDecide(t: Trader, S: GameState): void {
  const assets = t.pickedAssets && t.pickedAssets.length ? t.pickedAssets : ASSET_IDS;
  const aid = assets[(Math.random() * assets.length) | 0];
  const ast = S.assets[aid];
  // GUARD: pickedAssets may contain stale ids from old saves (e.g. v2 PUMP).
  if (!ast) return;
  // v7.1: strict gate — if admin enabled "Bots respect player level", bots can
  // only trade assets whose minLevel <= player.level. Default off.
  if (S.playerLevelCap && S.playerLevelCap > 0) {
    const def = ASSET_BY_ID[aid];
    if (def && def.minLevel > S.playerLevelCap) return;
  }
  const last = ast.lastPrice || ast.fv;
  const fv = ast.fv * t.fairBias;
  const hold = t.holdings[aid];
  if (!hold) return;

  if (t.cash < last && hold.shares <= 0) return;

  // Fallbacks for emotions (handles old save games / initial loads)
  if (t.greed === undefined) t.greed = 0.5;
  if (t.fear === undefined) t.fear = 0.5;
  if (t.hype === undefined) t.hype = 0.0;
  if (t.tier === undefined) t.tier = 'retail';

  // 1. Cancel previous open orders for this asset before making a new decision.
  // This keeps the book clean and prevents stale order sniping by the player.
  const oldOrders = t.openOrders.filter(o => o.assetId === aid);
  if (oldOrders.length > 0) {
    oldOrders.forEach(o => {
      removeOrder(ast.book, o.side, o.id);
    });
    t.openOrders = t.openOrders.filter(o => o.assetId !== aid);
  }

  // === v10: SMART BOT — Technical Analysis for ALL strategies ===
  const hist = ast.history;
  const histLen = hist.length;
  const tailStart = Math.max(0, histLen - 40);
  const oldP = hist[tailStart] || last;
  const ret = (last - oldP) / (oldP || 1);

  // RSI (14-period) — all bots can read this cheaply
  const rsi = calcRSI(hist);

  // EMA crossover — lazy-init indicators for ANY strategy (not just 'trend')
  let ind = t.indicators[aid];
  if (!ind) { ind = { emaFast: null, emaSlow: null }; t.indicators[aid] = ind; }
  ind.emaFast = calcEMA(ind.emaFast, last, 0.15);
  ind.emaSlow = calcEMA(ind.emaSlow, last, 0.04);
  const emaSignal = (ind.emaFast || 0) - (ind.emaSlow || 0);
  const emaBullish = emaSignal > last * 0.003;
  const emaBearish = emaSignal < -last * 0.003;

  // Momentum — short-term velocity over last 10 ticks
  const momStart = Math.max(0, histLen - 10);
  const momOldP = hist[momStart] || last;
  const momentum = (last - momOldP) / (momOldP || 1);

  // News awareness — check most recent event, how old it is, and if it affects THIS asset
  let newsType: 'boom' | 'crash' | 'news' | null = null;
  let newsAge = Infinity;
  let newsAffectsMe = false;
  if (S.events.length > 0) {
    const ev = S.events[0];
    newsAge = (Date.now() - ev.t) / 1000;
    if (newsAge < 45) { // react to events within 45s
      newsType = ev.type;
      newsAffectsMe = !ev.assetIds || ev.assetIds.length === 0 || ev.assetIds.includes(aid);
    }
  }

  // --- v11: AI EMOTIONS UPDATE ENGINE ---
  // Hype decays 5% per step
  t.hype = Math.max(0, (t.hype || 0.0) * 0.95 - 0.01);
  if (newsType && newsAffectsMe && newsAge < 30) {
    t.hype = Math.max(t.hype, 1.0 - (newsAge / 30));
  }

  // Greed and fear shift based on returns and momentum
  const sentimentChange = (ret * 0.2) + (momentum * 0.8);
  t.greed = Math.min(1.0, Math.max(0.0, (t.greed || 0.5) + sentimentChange));
  t.fear = Math.min(1.0, Math.max(0.0, (t.fear || 0.5) - sentimentChange));

  // News shock overrides
  if (newsType === 'boom' && newsAffectsMe && newsAge < 30) {
    t.greed = Math.min(1.0, t.greed + 0.25 * (1 - newsAge / 30));
    t.fear = Math.max(0.0, t.fear - 0.25 * (1 - newsAge / 30));
  } else if (newsType === 'crash' && newsAffectsMe && newsAge < 30) {
    t.fear = Math.min(1.0, t.fear + 0.25 * (1 - newsAge / 30));
    t.greed = Math.max(0.0, t.greed - 0.25 * (1 - newsAge / 30));
  }

  // Pull emotions back to baseline 0.5 slowly
  t.greed = t.greed * 0.98 + 0.5 * 0.02;
  t.fear = t.fear * 0.98 + 0.5 * 0.02;

  const gVal = t.greed;
  const fVal = t.fear;

  // Determine preferred order execution type based on degen strat, active news panics, or high hype
  const isDegen = ['yolo', 'fomo', 'paper', 'gambler', 'copycat', 'revenge', 'newschase'].includes(t.strat);
  const preferredType = (isDegen || (newsType && newsAffectsMe && newsAge < 15) || t.hype > 0.7) ? 'market' : 'limit';

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
    const emotionMult = 1 + gVal - fVal * 0.5; // range: 0.5 to 2.0
    let budget = t.cash * Math.min(0.99, frac * emotionMult);
    if (!t.isPlayer) {
      const maxBudget = t.tier === 'whale' ? 100000 : (t.tier === 'institution' ? 25000 : 5000);
      if (budget > maxBudget) budget = maxBudget;
    }
    const px = Math.max(0.01, last);
    const def = ASSET_BY_ID[aid];
    const float = def?.float || 1e9;
    const maxQty = Math.max(10, float * 0.0001); // cap single order to 0.01% of float
    const raw = Math.min(maxQty, budget / px);
    const minQty = Math.min(1, 0.5 / px);
    return roundShares(Math.max(minQty, raw));
  };
  const sellQty = (qty: number, pxMult = 0.998, orderType: 'market' | 'limit' = preferredType) => {
    qty = Math.min(qty, hold.shares);
    if (qty <= 0) return;
    placeOrder(S, t.id, aid, 'sell', qty, +(last * pxMult).toFixed(4), orderType);
  };
  const buyQty = (qty: number, pxMult = 1.002, orderType: 'market' | 'limit' = preferredType) => {
    if (qty <= 0) return;
    if (t.cash < last * qty) qty = roundShares(t.cash / last);
    if (qty <= 0) return;
    placeOrder(S, t.id, aid, 'buy', qty, +(last * pxMult).toFixed(4), orderType);
  };
  const openShort = (qty: number, pxMult = 0.998, orderType: 'market' | 'limit' = preferredType) => {
    if (qty <= 0) return;
    if (hold.shares > 0) return;
    if (t.cash < last * qty * 0.5) qty = roundShares((t.cash * 2) / last);
    if (qty <= 0) return;
    placeOrder(S, t.id, aid, 'sell', qty, +(last * pxMult).toFixed(4), orderType);
  };

  // SL/TP enforcement with emotional scaling (SL always uses market order for quick panic exit)
  if (hold.shares > 0 && hold.avgCost > 0 && t.stopLoss > 0) {
    const pnl = (last - hold.avgCost) / hold.avgCost;
    const currentSL = t.stopLoss * (1 - fVal * 0.5); // fear tightens stop losses
    const currentTP = t.takeProfit > 0 ? t.takeProfit * (1 + gVal) : 0; // greed widens take profits

    if (pnl < -currentSL) { sellQty(hold.shares, 0.992, 'market'); return; }
    if (currentTP > 0 && pnl > currentTP) {
      sellQty(Math.ceil(hold.shares * (t.strat === 'paper' ? 1 : 0.5)), 1.002, preferredType); return;
    }
    // Panic exit before SL if fear is high and losses are growing
    if (fVal > 0.7) {
      const panicThreshold = -currentSL * (1.2 - fVal);
      if (pnl < panicThreshold) {
        sellQty(hold.shares, 0.99, 'market');
        return;
      }
    }
  }
  if (hold.shares < 0 && hold.avgCost > 0 && t.stopLoss > 0) {
    const pnl = (hold.avgCost - last) / hold.avgCost;
    const currentSL = t.stopLoss * (1 - fVal * 0.5);

    if (pnl < -currentSL) {
      const qty = -hold.shares;
      if (t.cash > qty * last * 0.95) buyQty(qty, 1.005, 'market');
      return;
    }
    // Panic cover before SL if fear is high
    if (fVal > 0.7) {
      const panicThreshold = -currentSL * (1.2 - fVal);
      if (pnl < panicThreshold) {
        const qty = -hold.shares;
        if (t.cash > qty * last * 0.95) buyQty(qty, 1.005, 'market');
        return;
      }
    }
  }

  switch (t.strat) {
    case 'yolo':
      // v10: YOLO now checks momentum — buys harder on uptrends, shorts harder on downtrends
      if (momentum > 0.01 && t.cash > last) buyQty(positionSize(rand(0.4, 0.8)), 1.008);
      else if (momentum < -0.01 && hold.shares <= 0) openShort(positionSize(rand(0.2, 0.5)), 0.992);
      else if (Math.random() < 0.6 && t.cash > last) buyQty(positionSize(rand(0.3, 0.7)), 1.008);
      else if (hold.shares > 0) sellQty(Math.ceil(hold.shares * rand(0.7, 1)), 0.992);
      else openShort(positionSize(rand(0.1, 0.4)), 0.992);
      // News reaction: YOLO goes ALL IN on boom news
      if (newsType === 'boom' && newsAffectsMe && newsAge < 15 && t.cash > last)
        buyQty(positionSize(rand(0.5, 0.9)), 1.02);
      break;

    case 'diamond':
      // v10: Diamond hands buys dips more aggressively when RSI is oversold
      if (rsi < 30 && t.cash > last) buyQty(positionSize(rand(0.15, 0.35)), 1.001);
      else if (ret < -0.015 && t.cash > last) buyQty(positionSize(rand(0.08, 0.2)), 1.001);
      else if (Math.random() < 0.3 && t.cash > last) buyQty(positionSize(rand(0.03, 0.08)), 1.0);
      // Diamond hands ignores crash news — holds through everything
      break;

    case 'paper':
      // v10: Paper hands now panic-sells faster with RSI overbought or on bad news
      if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (rsi > 70 || (newsType === 'crash' && newsAffectsMe && newsAge < 20)) {
          sellQty(hold.shares, 0.995); return;
        }
        if (Math.abs(pnl) > 0.012) { sellQty(hold.shares, pnl >= 0 ? 0.999 : 0.995); return; }
      }
      if (t.cash > last && Math.random() < 0.3 && rsi < 60) buyQty(positionSize(rand(0.05, 0.12)));
      break;

    case 'permabull':
      // v10: Permabull now uses EMA — buys more when EMA is bullish, less when bearish
      if (emaBullish && t.cash > last) buyQty(positionSize(rand(0.08, 0.2)), 1.003);
      else if (t.cash > last && rsi < 65) buyQty(positionSize(rand(0.05, 0.15)), 1.003);
      // Reacts to boom news by doubling position
      if (newsType === 'boom' && newsAffectsMe && newsAge < 20 && t.cash > last)
        buyQty(positionSize(rand(0.1, 0.25)), 1.005);
      break;

    case 'permabear':
      // v10: Permabear uses RSI — shorts more aggressively when overbought
      if (rsi > 70 && t.cash > last * 2) openShort(positionSize(rand(0.12, 0.3)), 0.997);
      else if (hold.shares > 0) sellQty(hold.shares, 0.997);
      else if (emaBearish && t.cash > last * 2) openShort(positionSize(rand(0.1, 0.25)), 0.997);
      else if (t.cash > last * 2) openShort(positionSize(rand(0.08, 0.2)), 0.997);
      // Reacts to crash news
      if (newsType === 'crash' && newsAffectsMe && newsAge < 20 && t.cash > last * 2)
        openShort(positionSize(rand(0.15, 0.4)), 0.985);
      break;

    case 'lazy':
      // v10: Lazy now checks if conditions are "obviously" good before bothering
      if (rsi < 40 && emaBullish && Math.random() < 0.3 && t.cash > last * 5)
        buyQty(positionSize(rand(0.2, 0.4)), 1.001);
      else if (Math.random() < 0.1 && t.cash > last * 5)
        buyQty(positionSize(rand(0.15, 0.3)), 1.001);
      break;

    case 'newschase': {
      // v10: News chaser is now MUCH smarter — considers RSI/momentum alongside news
      if (!newsType || newsAge > 30) {
        // No news: fall back to momentum/RSI based trading
        if (rsi < 30 && t.cash > last) buyQty(positionSize(rand(0.1, 0.2)), 1.003);
        else if (rsi > 75 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.5), 0.998);
        return;
      }
      if (newsAffectsMe) {
        if (newsType === 'boom') {
          const aggression = newsAge < 10 ? rand(0.3, 0.6) : rand(0.15, 0.35);
          if (t.cash > last) buyQty(positionSize(aggression), newsAge < 10 ? 1.02 : 1.01);
        } else if (newsType === 'crash') {
          if (hold.shares > 0) sellQty(hold.shares, newsAge < 10 ? 0.98 : 0.985);
          else if (t.cash > last * 2) openShort(positionSize(rand(0.2, 0.5)), 0.985);
        }
      } else {
        // Sector rotation: buy unaffected assets during crashes (flight to quality)
        if (newsType === 'crash' && t.cash > last && rsi < 50)
          buyQty(positionSize(rand(0.05, 0.15)), 1.002);
      }
      break;
    }

    case 'fomo':
      // v10: FOMO now also reacts to RSI extremes and news momentum
      if (momentum > 0.03 && t.cash > last) buyQty(positionSize(rand(0.25, 0.55)), 1.015);
      else if (ret > 0.04 && t.cash > last) buyQty(positionSize(rand(0.2, 0.5)), 1.015);
      else if (ret < -0.02 && hold.shares > 0) sellQty(hold.shares, 0.985);
      // FOMO panic: RSI extreme + crash news = instant dump
      if (rsi > 80 && newsType === 'crash' && hold.shares > 0) sellQty(hold.shares, 0.975);
      // FOMO also chases boom news aggressively
      if (newsType === 'boom' && newsAffectsMe && newsAge < 15 && t.cash > last)
        buyQty(positionSize(rand(0.3, 0.6)), 1.02);
      break;

    case 'conservative':
      // v10: Conservative now uses value gap + RSI + EMA confirmation for entries
      if (last < fv * 0.93 && rsi < 45 && t.cash > last)
        buyQty(positionSize(rand(0.04, 0.09)));
      else if (last < fv * 0.95 && emaBullish && t.cash > last)
        buyQty(positionSize(rand(0.03, 0.07)));
      else if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl > 0.12 || rsi > 75) sellQty(Math.ceil(hold.shares * 0.5), 1.002);
      }
      // Conservative sells on crash news if in profit
      if (newsType === 'crash' && newsAffectsMe && hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl > 0) sellQty(Math.ceil(hold.shares * 0.3), 0.998);
      }
      break;

    case 'gambler':
      // v10: Gambler now has slightly smarter coin-flip logic using momentum
      if (momentum > 0 && Math.random() < 0.55 && t.cash > last)
        buyQty(positionSize(rand(0.5, 0.95)), 1.02);
      else if (momentum < 0 && Math.random() < 0.45 && t.cash > last)
        buyQty(positionSize(rand(0.3, 0.6)), 1.01);
      else if (hold.shares > 0 && (rsi > 70 || Math.random() < 0.4))
        sellQty(hold.shares, 0.97);
      else if (t.cash > last * 2 && rsi > 65)
        openShort(positionSize(rand(0.3, 0.6)), 0.97);
      // Gambler goes ALL IN on any news
      if (newsType && newsAffectsMe && newsAge < 10) {
        if (newsType === 'boom' && t.cash > last) buyQty(positionSize(rand(0.6, 0.95)), 1.025);
        else if (newsType === 'crash') {
          if (hold.shares > 0) sellQty(hold.shares, 0.97);
          else if (t.cash > last * 2) openShort(positionSize(rand(0.4, 0.7)), 0.97);
        }
      }
      break;

    case 'value': {
      // v10: Value investor now uses RSI as confirmation + reacts to extreme dislocation from FV
      const gap = (last - fv) / fv;
      if (gap < -0.15 && rsi < 35 && t.cash > last)
        buyQty(positionSize(rand(0.15, 0.3))); // deep value + oversold = aggressive
      else if (gap < -0.10 && t.cash > last)
        buyQty(positionSize(rand(0.1, 0.2)));
      else if (gap > 0.10 && rsi > 65 && hold.shares > 0)
        sellQty(Math.ceil(hold.shares * 0.7), 1.002);
      else if (gap > 0.15 && hold.shares > 0)
        sellQty(Math.ceil(hold.shares * 0.9), 1.001);
      break;
    }

    case 'trend': {
      // v10: Trend follower now uses RSI + EMA crossover + momentum for stronger signals
      const strongBull = emaBullish && momentum > 0.01 && rsi < 70;
      const strongBear = emaBearish && momentum < -0.01 && rsi > 30;
      if (strongBull && t.cash > last) buyQty(positionSize(rand(0.12, 0.25)), 1.003);
      else if (emaBullish && t.cash > last) buyQty(positionSize(rand(0.08, 0.15)), 1.003);
      else if (strongBear && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.9), 0.997);
      else if (emaBearish && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.7), 0.997);
      // Trend follows news direction
      if (newsType === 'boom' && newsAffectsMe && newsAge < 20 && t.cash > last)
        buyQty(positionSize(rand(0.1, 0.2)), 1.005);
      else if (newsType === 'crash' && newsAffectsMe && newsAge < 20 && hold.shares > 0)
        sellQty(Math.ceil(hold.shares * 0.5), 0.995);
      break;
    }

    case 'mm': {
      // v10: Market maker now adjusts spread based on RSI + volatility + news
      const mid = midPrice(ast.book) || last;
      const dynSp = Math.max(0.002, Math.min(0.03, sigma / mid));
      // Widen spread during news events (more risk)
      const newsSpreadMult = (newsType && newsAffectsMe && newsAge < 20) ? 1.5 : 1.0;
      // Skew quotes based on RSI (lean bid-heavy when oversold, ask-heavy when overbought)
      const rsiSkew = (rsi - 50) / 500; // small skew: ±0.1 at extremes
      const sp = mid * dynSp * newsSpreadMult;
      const sz = positionSize(0.015);
      if (sz > 0 && t.cash > (mid - sp) * sz) {
        const bidPx = +(mid - sp * (1 + rsiSkew)).toFixed(4);
        const bid = { id: S.orderId++, ownerId: t.id, px: bidPx, qty: sz, ts: Date.now() };
        insertOrder(ast.book, 'bids', bid);
        t.openOrders.push({ assetId: aid, side: 'bids', id: bid.id });
      }
      if (hold.shares > 0) {
        const askSize = Math.min(hold.shares, sz);
        const askPx = +(mid + sp * (1 - rsiSkew)).toFixed(4);
        const ask = { id: S.orderId++, ownerId: t.id, px: askPx, qty: askSize, ts: Date.now() };
        insertOrder(ast.book, 'asks', ask);
        t.openOrders.push({ assetId: aid, side: 'asks', id: ask.id });
      }
      return;
    }

    case 'copycat':
      // v10: Copycat now follows momentum + EMA trend more precisely
      if (emaBullish && momentum > 0.005 && t.cash > last) buyQty(positionSize(rand(0.1, 0.2)), 1.005);
      else if (ret > 0.01 && t.cash > last) buyQty(positionSize(rand(0.08, 0.18)), 1.005);
      else if (emaBearish && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.7), 0.995);
      else if (ret < -0.01 && hold.shares > 0) sellQty(Math.ceil(hold.shares * 0.6), 0.995);
      // Copycat follows news crowd
      if (newsType === 'boom' && newsAffectsMe && newsAge < 25 && t.cash > last)
        buyQty(positionSize(rand(0.1, 0.2)), 1.008);
      else if (newsType === 'crash' && newsAffectsMe && newsAge < 25 && hold.shares > 0)
        sellQty(Math.ceil(hold.shares * 0.5), 0.99);
      break;

    case 'revenge':
      // v10: Revenge trader now doubles down smarter — only when RSI confirms opportunity
      if (hold.shares > 0 && hold.avgCost > 0) {
        const pnl = (last - hold.avgCost) / hold.avgCost;
        if (pnl < -0.06 && rsi < 40 && t.cash > last)
          buyQty(hold.shares, 1.002); // double down on oversold dip
        else if (pnl < -0.08 && t.cash > last)
          buyQty(Math.ceil(hold.shares * 0.5), 1.002); // reduced doubling if RSI neutral
        else if (pnl > 0.10) sellQty(hold.shares, 1.001);
      } else if (t.cash > last && Math.random() < 0.4) {
        // Enter on momentum or oversold conditions
        if (rsi < 35 || emaBullish) buyQty(positionSize(rand(0.12, 0.25)), 1.003);
        else buyQty(positionSize(rand(0.1, 0.2)), 1.003);
      }
      break;
  }
  cullStaleOrders(S, t);
}

// PERF: Fixed-budget scan — process at most BOTS_PER_TICK bots per call.
// Full rotation = (totalBots / BOTS_PER_TICK) ticks * 100ms.
// 10K → 200ms full pass. 100K → 2s. 500K → 10s.
// Engine CPU stays bounded by BOTS_PER_TICK regardless of population size.
// NOTE: cast via globalThis — this file is shared with the Vite client bundle
// where `process` does not exist as a typed global.
const BOTS_PER_TICK = Number((globalThis as any)?.process?.env?.MM_BOTS_PER_TICK) || 5000;
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
    if (!t.rekt && !t.isHouse) { // v8.9: House never acts as a bot
      t.cooldown -= effectiveDt;
      if (t.cooldown <= 0) {
        // News acceleration: if an active event exists, scale cooldown by 2.5x to trade faster
        const hasActiveEvent = S.events.length > 0 && (Date.now() - S.events[0].t) / 1000 < 30;
        const hype = t.hype || 0.0;
        const speedMult = (hasActiveEvent ? 2.5 : 1.0) * (1 + hype);
        t.cooldown = (rand(60, 300) / Math.max(0.05, t.activity)) / speedMult;
        botDecide(t, S);
      }
    }
    i++;
    scanned++;
  }
  scanCursor = i;
}
