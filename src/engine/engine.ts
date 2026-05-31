import { ASSETS, BOT_COUNT } from './constants';
import { rand, roundShares } from './helpers';
import { applyEvent, maybeFireEvent, payDividends, tickMarket } from './market';
import { cancelTraderOrders, cleanupBooks, placeOrder } from './matching';
import { insertOrder, makeBook } from './orderbook';
import { checkRekt, maybeMutate, tickBots, traderNet } from './strategies';
import { makeTrader, resetStratPool } from './traders';
import type { AssetState, GameState, NewsEventDef, Trader } from './types';

export interface EngineHooks {
  onPlayerBuy?: (assetId: string, qty: number) => void;
  onPlayerSellProfit?: () => void;
  onPlayerSellLoss?: () => void;
  onEvent?: (ev: NewsEventDef) => void;
  onSLTPHit?: (assetId: string, kind: 'SL' | 'TP', price: number, refPrice: number) => void;
}

export class Engine {
  state: GameState;
  hooks: EngineHooks = {};
  private eventCD = { cooldown: 25 };
  private divAcc = 0;
  private tickAcc = 0;
  private cleanAcc = 0;
  private rektAcc = 0;
  private lastT = 0;
  tickFrac = 0;

  constructor(loaded?: GameState) {
    this.state = loaded ?? this.freshState();
    if (!loaded) this.seedBooks();
    this.lastT = performance.now();
  }

  freshState(): GameState {
    resetStratPool();
    const traders: Trader[] = [makeTrader(0, true)];
    for (let i = 1; i <= BOT_COUNT; i++) traders.push(makeTrader(i, false));
    const assets: Record<string, AssetState> = {};
    ASSETS.forEach(a => {
      assets[a.id] = {
        book: makeBook(),
        lastPrice: a.fairValue,
        open: a.fairValue,
        hi: a.fairValue,
        lo: a.fairValue,
        volume: 0,
        volumeHist: Array(120).fill(0),
        history: Array(120).fill(a.fairValue),
        candles: [],
        curCandle: null,
        candleStartT: 0,
        fv: a.fairValue,
        fvDelta: 0,
        fvEventTicks: 0,
        volMult: 1,
        volEventTicks: 0,
      };
    });
    return { traders, assets, events: [], active: 'PUMP', orderId: 1 };
  }

  seedBooks(): void {
    const S = this.state;
    for (let i = 1; i < S.traders.length; i++) {
      const t = S.traders[i];
      const picks = t.pickedAssets || [];
      picks.forEach(aid => {
        const a = ASSETS.find(x => x.id === aid)!;
        const ast = S.assets[aid];
        const allocCash = t.cash * rand(0.05, 0.25);
        const shares = roundShares(allocCash / a.fairValue);
        if (shares > 0) {
          t.holdings[aid] = { shares, avgCost: a.fairValue };
          t.cash -= shares * a.fairValue;
        }
        const mid = a.fairValue;
        const sp = mid * rand(0.005, 0.02);
        const bidCash = t.cash * rand(0.05, 0.3);
        const sz = roundShares(bidCash / mid);
        if (sz > 0 && t.cash > (mid - sp) * sz) {
          const bid = { id: S.orderId++, ownerId: t.id, px: +(mid - sp).toFixed(4), qty: sz, ts: Date.now() };
          insertOrder(ast.book, 'bids', bid);
          t.openOrders.push({ assetId: aid, side: 'bids', id: bid.id });
        }
        if (shares > 0) {
          const askSz = roundShares(shares * rand(0.1, 0.4));
          if (askSz > 0) {
            const ask = { id: S.orderId++, ownerId: t.id, px: +(mid + sp).toFixed(4), qty: askSz, ts: Date.now() };
            insertOrder(ast.book, 'asks', ask);
            t.openOrders.push({ assetId: aid, side: 'asks', id: ask.id });
          }
        }
      });
    }
    ASSETS.forEach(a => {
      const ast = S.assets[a.id];
      ast.open = ast.lastPrice;
      ast.hi = ast.lastPrice;
      ast.lo = ast.lastPrice;
    });
  }

  player(): Trader { return this.state.traders[0]; }

  checkPlayerSLTP(): void {
    const p = this.player();
    ASSETS.forEach(a => {
      const h = p.holdings[a.id];
      if (!h || h.shares === 0) return;
      const px = this.state.assets[a.id].lastPrice;
      if (h.shares > 0) {
        if (h.sl && h.sl > 0 && px <= h.sl) {
          const sl = h.sl; this.closePosition(a.id);
          this.hooks.onSLTPHit?.(a.id, 'SL', sl, px);
        } else if (h.tp && h.tp > 0 && px >= h.tp) {
          const tp = h.tp; this.closePosition(a.id);
          this.hooks.onSLTPHit?.(a.id, 'TP', tp, px);
        }
      } else {
        if (h.sl && h.sl > 0 && px >= h.sl) {
          const sl = h.sl; this.closePosition(a.id);
          this.hooks.onSLTPHit?.(a.id, 'SL', sl, px);
        } else if (h.tp && h.tp > 0 && px <= h.tp) {
          const tp = h.tp; this.closePosition(a.id);
          this.hooks.onSLTPHit?.(a.id, 'TP', tp, px);
        }
      }
    });
  }

  closePosition(aid: string): void {
    const hold = this.player().holdings[aid];
    if (!hold || hold.shares === 0) return;
    if (hold.shares > 0) placeOrder(this.state, 0, aid, 'sell', hold.shares, 0, 'market', this.callbacks());
    else placeOrder(this.state, 0, aid, 'buy', -hold.shares, 0, 'market', this.callbacks());
    const h = this.player().holdings[aid];
    if (h.shares === 0) { h.sl = 0; h.tp = 0; }
  }

  callbacks() {
    return {
      onPlayerBuy: (q: number) => this.hooks.onPlayerBuy?.(this.state.active, q),
      onPlayerSellProfit: () => this.hooks.onPlayerSellProfit?.(),
      onPlayerSellLoss: () => this.hooks.onPlayerSellLoss?.(),
      onTrade: (b: number, s: number) => {
        const buyer = this.state.traders[b]; const seller = this.state.traders[s];
        if (!buyer.isPlayer) { maybeMutate(buyer, this.state); checkRekt(buyer, this.state); }
        if (!seller.isPlayer) { maybeMutate(seller, this.state); checkRekt(seller, this.state); }
      },
    };
  }

  placeOrder(side: 'buy' | 'sell', qty: number, type: 'market' | 'limit', limitPx: number): void {
    placeOrder(this.state, 0, this.state.active, side, qty, limitPx, type, this.callbacks());
  }

  step(now: number): void {
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.tickAcc += dt;
    while (this.tickAcc >= 0.1) {
      tickMarket(this.state, 0.1, now);
      this.checkPlayerSLTP();
      this.tickAcc -= 0.1;
    }
    this.tickFrac = this.tickAcc / 0.1;
    tickBots(this.state, dt);
    this.divAcc += dt;
    if (this.divAcc >= 0.5) { payDividends(this.state, this.divAcc); this.divAcc = 0; }
    this.cleanAcc += dt;
    if (this.cleanAcc >= 2) {
      cleanupBooks(this.state, ASSETS.map(a => a.id));
      for (let i = 1; i < this.state.traders.length; i++) checkRekt(this.state.traders[i], this.state);
      this.cleanAcc = 0;
    }
    this.rektAcc += dt;
    const ev = maybeFireEvent(this.state, dt, this.eventCD);
    if (ev) {
      applyEvent(this.state, ev);
      this.hooks.onEvent?.(ev);
    }
  }

  playerIncomePerSec(): number {
    let total = 0;
    ASSETS.forEach(a => {
      if (a.div <= 0) return;
      const h = this.player().holdings[a.id];
      if (h && h.shares > 0) total += h.shares * this.state.assets[a.id].lastPrice * a.div;
    });
    return total;
  }

  portfolioValue(): number {
    let v = 0;
    ASSETS.forEach(a => {
      v += (this.player().holdings[a.id]?.shares || 0) * this.state.assets[a.id].lastPrice;
    });
    return v;
  }

  netWorth(): number {
    return this.player().cash + this.portfolioValue();
  }

  playerRank(): number {
    const me = traderNet(this.player(), this.state);
    let rank = 1;
    for (let i = 1; i < this.state.traders.length; i++) {
      if (traderNet(this.state.traders[i], this.state) > me) rank++;
    }
    return rank;
  }
}
