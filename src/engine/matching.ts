import { roundShares } from './helpers';
import { insertOrder, removeOrder } from './orderbook';
import type { GameState, Trader } from './types';

export function sellableQty(t: Trader, assetId: string, qty: number, px: number): number {
  const sh = t.holdings[assetId]?.shares || 0;
  const longPart = Math.max(0, sh);
  if (t.isPlayer) return qty;
  const uncovered = Math.max(0, qty - longPart);
  if (uncovered === 0) return qty;
  const needed = uncovered * px * 0.5;
  if (t.cash >= needed) return qty;
  const allowedShort = roundShares((t.cash * 2) / Math.max(0.01, px));
  return longPart + Math.max(0, allowedShort);
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
): void {
  const buyer = S.traders[buyerId];
  const seller = S.traders[sellerId];

  const sh0 = seller.holdings[assetId];
  if (!seller.isPlayer) {
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
  if (qty <= 0) return;
  if (!buyer.isPlayer) {
    const aff = roundShares(buyer.cash / px);
    if (aff < qty) qty = aff;
  }
  if (qty <= 0) return;

  const cash = px * qty;
  buyer.cash -= cash;
  seller.cash += cash;

  // BUYER side
  const bh = buyer.holdings[assetId];
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

  // SELLER side
  const sh = seller.holdings[assetId];
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

  const ast = S.assets[assetId];
  ast.lastPrice = px;
  ast.hi = Math.max(ast.hi, px);
  ast.lo = Math.min(ast.lo, px);
  ast.volume += qty;

  if (buyer.isPlayer && onPlayerBuy) onPlayerBuy(qty);
  else if (seller.isPlayer && onPlayerSellProfit) onPlayerSellProfit();
}

export interface OrderCallbacks {
  onPlayerBuy?: (qty: number) => void;
  onPlayerSellProfit?: () => void;
  onPlayerSellLoss?: () => void;
  onTrade?: (buyerId: number, sellerId: number, assetId: string) => void;
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
  const ast = S.assets[assetId];
  const book = ast.book;
  qty = roundShares(qty);
  if (qty <= 0) return { filled: 0, cost: 0 };

  let totalCost = 0;
  let totalQty = 0;

  const onBuy = cb?.onPlayerBuy;
  const onProfit = cb?.onPlayerSellProfit;
  const onLoss = cb?.onPlayerSellLoss;
  const trigger = (buyerId: number, sellerId: number, q: number, fp: number) => {
    executeTrade(S, buyerId, sellerId, assetId, q, fp, onBuy, onProfit, onLoss);
    cb?.onTrade?.(buyerId, sellerId, assetId);
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
          trigger(traderId, top.ownerId, affordQty, fillPx);
          top.qty -= affordQty;
          totalCost += fillPx * affordQty;
          totalQty += affordQty;
          if (top.qty <= 0) opp.shift();
          break;
        }
        trigger(traderId, top.ownerId, fillQty, fillPx);
        top.qty -= fillQty;
        totalCost += cost;
        totalQty += fillQty;
        remaining -= fillQty;
        if (top.qty <= 0) opp.shift();
      } else {
        const allowed = sellableQty(t, assetId, fillQty, fillPx);
        if (allowed <= 0) break;
        const sellQ = Math.min(fillQty, allowed);
        trigger(top.ownerId, traderId, sellQ, fillPx);
        top.qty -= sellQ;
        totalCost += fillPx * sellQ;
        totalQty += sellQ;
        remaining -= sellQ;
        if (top.qty <= 0) opp.shift();
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
        trigger(traderId, top.ownerId, aff, fillPx);
        top.qty -= aff;
        totalCost += fillPx * aff;
        totalQty += aff;
        if (top.qty <= 0) opp.shift();
        break;
      }
      trigger(traderId, top.ownerId, fillQty, fillPx);
    } else {
      const allowed = sellableQty(t, assetId, fillQty, fillPx);
      if (allowed <= 0) break;
      const sellQ = Math.min(fillQty, allowed);
      trigger(top.ownerId, traderId, sellQ, fillPx);
      top.qty -= sellQ;
      totalCost += fillPx * sellQ;
      totalQty += sellQ;
      if (top.qty <= 0) opp.shift();
      remaining -= sellQ;
      continue;
    }
    top.qty -= fillQty;
    totalCost += fillPx * fillQty;
    totalQty += fillQty;
    remaining -= fillQty;
    if (top.qty <= 0) opp.shift();
  }
  if (remaining > 0 && !t.isPlayer) {
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
      return t && t.cash >= o.px * o.qty * 0.99;
    });
    ast.book.asks = ast.book.asks.filter(o => {
      if (o.qty <= 0 || !isFinite(o.px) || o.px <= 0) return false;
      const t = S.traders[o.ownerId];
      if (!t) return false;
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
