import { roundShares } from './helpers';
import { insertOrder, removeOrder } from './orderbook';
import type { GameState, Trade, Trader } from './types';

// v10: Trading fees — 0.1% commission on each side of every trade.
// Mutable so admin can adjust at runtime via ENGINE_FLAGS.
export let TRADE_FEE_RATE = 0.001; // 0.1%
export function setFeeRate(r: number) { TRADE_FEE_RATE = r; }

// v7.3: player + bots both enforce 50% margin collateral for shorts.
// Previously player was trusted blindly — letting them short unlimited shares
// regardless of cash. Now the same rule applies to everyone.
export function sellableQty(S: GameState, t: Trader, assetId: string, qty: number, px: number): number {
  const sh = t.holdings[assetId]?.shares || 0;
  const longPart = Math.max(0, sh);
  const uncovered = Math.max(0, qty - longPart);
  if (uncovered === 0) return qty;                // entirely covered by long position

  // Calculate current short liabilities value across all assets
  let shortLiabilitiesValue = 0;
  for (const aid of Object.keys(t.holdings)) {
    const h = t.holdings[aid];
    if (h && h.shares < 0) {
      const lastPrice = S.assets[aid]?.lastPrice || S.assets[aid]?.fv || 0;
      shortLiabilitiesValue += (-h.shares) * lastPrice;
    }
  }

  // Margin equity: Cash - Short Market Value
  const marginEquity = t.cash - shortLiabilitiesValue;
  
  // Total short maintenance margin required (50% of short market value)
  const currentMarginRequired = shortLiabilitiesValue * 0.5;
  const newShortMarginRequired = uncovered * px * 0.5;
  
  // Available margin for new short positions
  const availableMargin = marginEquity - currentMarginRequired;

  if (availableMargin >= newShortMarginRequired) return qty;

  const allowedShort = roundShares(Math.max(0, availableMargin * 2) / Math.max(0.01, px));
  return longPart + allowedShort;
}

export function executeTrade(
  S: GameState,
  buyerId: number,
  sellerId: number,
  assetId: string,
  qty: number,
  px: number,
  onPlayerBuy?: (qty: number) => void,
  onPlayerSellProfit?: () => void,
  onPlayerSellLoss?: () => void,
  onPlayerTradeClosed?: (t: Trade) => void,
): number {
  const buyer = S.traders[buyerId];
  const seller = S.traders[sellerId];

  if (!buyer || !seller) {
    console.error(`Trade execution failed: buyer/seller undefined. buyerId=${buyerId}, sellerId=${sellerId}`);
    return 0;
  }

  // DEFENSIVE: ensure both sides have a holdings entry for this asset. A missing
  // entry (e.g. from a sparse save load) would crash the whole tick loop.
  if (!seller.holdings[assetId]) seller.holdings[assetId] = { shares: 0, avgCost: 0 };
  if (!buyer.holdings[assetId]) buyer.holdings[assetId] = { shares: 0, avgCost: 0 };

  // v8.9: House is an infinite counterparty — skip all affordability/margin
  // limits when it's the buyer or seller.
  const buyerHouse = !!buyer.isHouse;
  const sellerHouse = !!seller.isHouse;

  const sh0 = seller.holdings[assetId];
  // v7.3: margin check applies to everyone (except the House).
  if (!sellerHouse) {
    const uncovered = Math.max(0, qty - Math.max(0, sh0.shares));
    if (uncovered > 0) {
      const needed = uncovered * px * 0.5;
      if (seller.cash < needed) {
        const maxUncovered = roundShares((seller.cash * 2) / px);
        const allowed = Math.max(0, sh0.shares) + maxUncovered;
        qty = Math.min(qty, allowed);
      }
    }
  }
  if (qty <= 0) return 0;
  if (!buyer.isPlayer && !buyerHouse) {
    const aff = roundShares(buyer.cash / px);
    if (aff < qty) qty = aff;
  }
  if (qty <= 0) return 0;

  const cash = px * qty;
  // House cash is never mutated (it accumulates nothing → no pollution).
  if (!buyerHouse) buyer.cash -= cash;
  if (!sellerHouse) seller.cash += cash;

  // v10: deduct trading fees (0.1% per side). House is exempt.
  const fee = cash * TRADE_FEE_RATE;
  if (!buyerHouse) { buyer.cash -= fee; buyer.totalFeesPaid = (buyer.totalFeesPaid || 0) + fee; }
  if (!sellerHouse) { seller.cash -= fee; seller.totalFeesPaid = (seller.totalFeesPaid || 0) + fee; }

  // Capture pre-trade state for player closed-trade detection.
  const bh = buyer.holdings[assetId];
  const sh = seller.holdings[assetId];
  const bhSharesBefore = bh.shares;
  const bhAvgBefore = bh.avgCost;
  const shSharesBefore = sh.shares;
  const shAvgBefore = sh.avgCost;

  // BUYER side (House holdings never change)
  if (!buyerHouse) {
    if (bh.shares < 0) {
      bh.shares += qty;
      if (bh.shares === 0) bh.avgCost = 0;
    } else if (bh.shares === 0) {
      bh.shares = qty;
      bh.avgCost = px;
    } else {
      bh.avgCost = (bh.avgCost * bh.shares + px * qty) / (bh.shares + qty);
      bh.shares += qty;
    }
  }

  // SELLER side (House holdings never change)
  if (!sellerHouse) {
    if (sh.shares > 0) {
      sh.shares -= qty;
      if (sh.shares === 0) sh.avgCost = 0;
      else if (sh.shares < 0) {
        const excess = -sh.shares;
        sh.shares = -excess;
        sh.avgCost = px;
      }
    } else if (sh.shares === 0) {
      sh.shares = -qty;
      sh.avgCost = px;
    } else {
      const absSh = -sh.shares;
      sh.avgCost = (sh.avgCost * absSh + px * qty) / (absSh + qty);
      sh.shares -= qty;
    }
  }

  // PLAYER closed-trade detection. Fires whenever any portion of the player's
  // existing position is exited (long sold, short covered, or sign-flipped).
  if (buyer.isPlayer && bhSharesBefore < 0) {
    const coveredQty = Math.min(qty, -bhSharesBefore);
    const entry = buyer.playerEntryTs?.[assetId] ?? Date.now();
    onPlayerTradeClosed?.({
      assetId, side: 'short', qty: coveredQty,
      entryPx: bhAvgBefore, exitPx: px,
      entryTs: entry, exitTs: Date.now(),
      pnl: (bhAvgBefore - px) * coveredQty,
    });
  }
  if (seller.isPlayer && shSharesBefore > 0) {
    const soldQty = Math.min(qty, shSharesBefore);
    const entry = seller.playerEntryTs?.[assetId] ?? Date.now();
    onPlayerTradeClosed?.({
      assetId, side: 'long', qty: soldQty,
      entryPx: shAvgBefore, exitPx: px,
      entryTs: entry, exitTs: Date.now(),
      pnl: (px - shAvgBefore) * soldQty,
    });
  }
  // Track entry timestamps — set on 0 → nonzero, clear on → 0.
  if (buyer.isPlayer) {
    if (!buyer.playerEntryTs) buyer.playerEntryTs = {};
    if (bhSharesBefore <= 0 && bh.shares > 0) buyer.playerEntryTs[assetId] = Date.now();
    else if (bh.shares === 0) delete buyer.playerEntryTs[assetId];
  }
  if (seller.isPlayer) {
    if (!seller.playerEntryTs) seller.playerEntryTs = {};
    if (shSharesBefore >= 0 && sh.shares < 0) seller.playerEntryTs[assetId] = Date.now();
    else if (sh.shares === 0) delete seller.playerEntryTs[assetId];
  }

  const ast = S.assets[assetId];
  // v8.7: clamp the printed price into the fair-value band so a single trade
  // can't detach lastPrice to 100x fv. Trades still move price freely WITHIN
  // the band; tickMarket reinforces the same band + mean-reverts each tick.
  const fvRef = ast.fv > 0 ? ast.fv : px;
  const printPx = Math.max(fvRef * 0.25, Math.min(fvRef * 4, px));
  ast.lastPrice = printPx;
  ast.hi = Math.max(ast.hi, printPx);
  ast.lo = Math.min(ast.lo, printPx);
  ast.volume += qty;
  // Capture every trade print into ALL TF current candles so wicks form between samples
  for (const tf in ast.series) {
    const s = ast.series[tf as keyof typeof ast.series];
    if (s.curCandle) {
      s.curCandle.h = Math.max(s.curCandle.h, printPx);
      s.curCandle.l = Math.min(s.curCandle.l, printPx);
      s.curCandle.c = printPx;
    }
  }

  // PERF: invalidate cached net worth for both sides
  buyer._netDirty = true;
  seller._netDirty = true;

  if (buyer.isPlayer && onPlayerBuy) onPlayerBuy(qty);
  else if (seller.isPlayer && onPlayerSellProfit) onPlayerSellProfit();

  return qty;
}

export interface OrderCallbacks {
  onPlayerBuy?: (qty: number) => void;
  onPlayerSellProfit?: () => void;
  onPlayerSellLoss?: () => void;
  onTrade?: (buyerId: number, sellerId: number, assetId: string) => void;
  onPlayerTradeClosed?: (t: Trade) => void;
}

export function placeOrder(
  S: GameState,
  traderId: number,
  assetId: string,
  side: 'buy' | 'sell',
  qty: number,
  limitPx: number,
  type: 'market' | 'limit' = 'limit',
  cb?: OrderCallbacks,
): { filled: number; cost: number } {
  const t = S.traders[traderId];
  if (!t) {
    console.error(`placeOrder failed: trader undefined. traderId=${traderId}`);
    return { filled: 0, cost: 0 };
  }
  const ast = S.assets[assetId];
  const book = ast.book;
  qty = roundShares(qty);
  if (qty <= 0) return { filled: 0, cost: 0 };

  let totalCost = 0;
  let totalQty = 0;

  const onBuy = cb?.onPlayerBuy;
  const onProfit = cb?.onPlayerSellProfit;
  const onLoss = cb?.onPlayerSellLoss;
  const onClosed = cb?.onPlayerTradeClosed;
  const trigger = (buyerId: number, sellerId: number, q: number, fp: number): number => {
    const actual = executeTrade(S, buyerId, sellerId, assetId, q, fp, onBuy, onProfit, onLoss, onClosed);
    cb?.onTrade?.(buyerId, sellerId, assetId);
    return actual;
  };

  if (type === 'market') {
    let remaining = qty;
    const opp = side === 'buy' ? book.asks : book.bids;
    while (remaining > 0 && opp.length > 0) {
      const top = opp[0];
      const fillQty = Math.min(remaining, top.qty);
      const fillPx = top.px;
      if (fillQty <= 0) { opp.shift(); continue; }
      if (side === 'buy') {
        const cost = fillPx * fillQty;
        if (t.cash < cost) {
          const affordQty = roundShares(t.cash / fillPx);
          if (affordQty <= 0) break;
          const actual = trigger(traderId, top.ownerId, affordQty, fillPx);
          top.qty -= actual;
          totalCost += fillPx * actual;
          totalQty += actual;
          if (top.qty <= 0 || actual < affordQty) opp.shift();
          break;
        }
        const actual = trigger(traderId, top.ownerId, fillQty, fillPx);
        top.qty -= actual;
        totalCost += fillPx * actual;
        totalQty += actual;
        remaining -= actual;
        if (top.qty <= 0 || actual < fillQty) opp.shift();
      } else {
        const allowed = sellableQty(S, t, assetId, fillQty, fillPx);
        if (allowed <= 0) break;
        const sellQ = Math.min(fillQty, allowed);
        const actual = trigger(top.ownerId, traderId, sellQ, fillPx);
        top.qty -= actual;
        totalCost += fillPx * actual;
        totalQty += actual;
        remaining -= actual;
        if (top.qty <= 0 || actual < sellQ) opp.shift();
      }
    }
    // v9.4: GUARANTEED liquidity. If the book ran dry (truncation, timing, or a
    // just-restarted save), fill the remainder directly against the House at a
    // tight band around the last price. The House is an infinite counterparty,
    // so the player can ALWAYS buy/sell — no more "empty book, can't trade".
    if (remaining > 0 && typeof S.houseId === 'number' && S.houseId >= 0 && S.houseId !== traderId) {
      const mid = ast.lastPrice > 0 ? ast.lastPrice : (ast.fv > 0 ? ast.fv : 0);
      if (mid > 0) {
        const dec = mid < 10 ? 4 : 2;
        const spread = 0.0035; // matches HOUSE_SPREAD
        if (side === 'buy') {
          const fillPx = +(mid * (1 + spread)).toFixed(dec);
          let q = remaining;
          if (t.cash < fillPx * q) q = roundShares(t.cash / fillPx);
          if (q > 0) {
            const actual = trigger(traderId, S.houseId, q, fillPx);
            totalCost += fillPx * actual; totalQty += actual; remaining -= actual;
          }
        } else {
          const fillPx = +(mid * (1 - spread)).toFixed(dec);
          const q = Math.min(remaining, sellableQty(S, t, assetId, remaining, fillPx));
          if (q > 0) {
            const actual = trigger(S.houseId, traderId, q, fillPx);
            totalCost += fillPx * actual; totalQty += actual; remaining -= actual;
          }
        }
      }
    }
    return { filled: totalQty, cost: totalCost };
  }

  // limit
  let remaining = qty;
  const opp = side === 'buy' ? book.asks : book.bids;
  while (remaining > 0 && opp.length > 0) {
    const top = opp[0];
    const cross = side === 'buy' ? top.px <= limitPx : top.px >= limitPx;
    if (!cross) break;
    const fillQty = Math.min(remaining, top.qty);
    const fillPx = top.px;
    if (side === 'buy') {
      if (t.cash < fillPx * fillQty) {
        const aff = roundShares(t.cash / fillPx);
        if (aff <= 0) break;
        const actual = trigger(traderId, top.ownerId, aff, fillPx);
        top.qty -= actual;
        totalCost += fillPx * actual;
        totalQty += actual;
        if (top.qty <= 0 || actual < aff) opp.shift();
        break;
      }
      const actual = trigger(traderId, top.ownerId, fillQty, fillPx);
      top.qty -= actual;
      totalCost += fillPx * actual;
      totalQty += actual;
      remaining -= actual;
      if (top.qty <= 0 || actual < fillQty) opp.shift();
    } else {
      const allowed = sellableQty(S, t, assetId, fillQty, fillPx);
      if (allowed <= 0) break;
      const sellQ = Math.min(fillQty, allowed);
      const actual = trigger(top.ownerId, traderId, sellQ, fillPx);
      top.qty -= actual;
      totalCost += fillPx * actual;
      totalQty += actual;
      remaining -= actual;
      if (top.qty <= 0 || actual < sellQ) opp.shift();
    }
  }
  // Unfilled remainder rests on the book — for BOTH players and bots.
  if (remaining > 0) {
    const ord = { id: S.orderId++, ownerId: traderId, px: +limitPx.toFixed(4), qty: remaining, ts: Date.now() };
    insertOrder(book, side === 'buy' ? 'bids' : 'asks', ord);
    t.openOrders.push({ assetId, side: side === 'buy' ? 'bids' : 'asks', id: ord.id });
  }
  return { filled: totalQty, cost: totalCost };
}

export function cleanupBooks(S: GameState, assetIds: string[]): void {
  assetIds.forEach(aid => {
    const ast = S.assets[aid];
    ast.book.bids = ast.book.bids.filter(o => {
      if (o.qty <= 0 || !isFinite(o.px) || o.px <= 0) return false;
      const t = S.traders[o.ownerId];
      if (!t) return false;
      if (t.isHouse) return true; // v8.9: House liquidity is never culled
      return t.cash >= o.px * o.qty * 0.99;
    });
    ast.book.asks = ast.book.asks.filter(o => {
      if (o.qty <= 0 || !isFinite(o.px) || o.px <= 0) return false;
      const t = S.traders[o.ownerId];
      if (!t) return false;
      if (t.isHouse) return true; // v8.9: House liquidity is never culled
      const sh = t.holdings[aid]?.shares || 0;
      if (sh >= o.qty) return true;
      const uncovered = o.qty - Math.max(0, sh);
      return t.cash >= uncovered * o.px * 0.5;
    });
  });
}

export function cancelTraderOrders(S: GameState, t: Trader): void {
  const seen = new Set<string>();
  t.openOrders.forEach(o => seen.add(o.assetId));
  seen.forEach(aid => {
    const book = S.assets[aid].book;
    book.bids = book.bids.filter(o => o.ownerId !== t.id);
    book.asks = book.asks.filter(o => o.ownerId !== t.id);
  });
  t.openOrders = [];
}

export function cullStaleOrders(S: GameState, t: Trader): void {
  if (t.openOrders.length <= 8) return;
  const old = t.openOrders.shift();
  if (old) {
    const book = S.assets[old.assetId]?.book;
    if (book) removeOrder(book, old.side, old.id);
  }
}
