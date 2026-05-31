import { ASSETS, BOT_COUNT } from './constants';
import { rand, roundShares } from './helpers';
import { applyEvent, maybeFireEvent, payDividends, tickMarket } from './market';
import { cancelTraderOrders, cleanupBooks, placeOrder } from './matching';
import { ensureMissionsCurrent, rolloverDailyLogin, tickMissionProgress, recordClosedTradeForMissions } from './missions';
import { insertOrder, makeBook } from './orderbook';
import { checkRekt, maybeMutate, tickBots, traderNet } from './strategies';
import { makeTrader, resetStratPool } from './traders';
import type { AssetState, CandleSeries, GameState, NewsEventDef, PlayerStats, TFKey, Trade, Trader } from './types';
import { TF_LIST } from './types';

function emptySeries(): Record<TFKey, CandleSeries> {
  const out = {} as Record<TFKey, CandleSeries>;
  TF_LIST.forEach(tf => { out[tf] = { candles: [], curCandle: null, candleStartT: 0 }; });
  return out;
}

export interface EngineHooks {
  onPlayerBuy?: (assetId: string, qty: number) => void;
  onPlayerSellProfit?: () => void;
  onPlayerSellLoss?: () => void;
  onEvent?: (ev: NewsEventDef) => void;
  onSLTPHit?: (assetId: string, kind: 'SL' | 'TP', price: number, refPrice: number) => void;
  onPlayerTradeClosed?: (trade: Trade) => void;
  onMissionClaim?: (missionId: string, reward: number) => void;
}

const MAX_PLAYER_TRADES = 500;

export class Engine {
  state: GameState;
  hooks: EngineHooks = {};
  private eventCD = { cooldown: 25 };
  private divAcc = 0;
  private tickAcc = 0;
  private cleanAcc = 0;
  private rektAcc = 0;
  private lastT = 0;
  // Round-robin rekt/mutate sweep — 1/REKT_SHARDS of traders per 2s tick.
  private rektShard = 0;
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
        series: emptySeries(),
        fv: a.fairValue,
        fvDelta: 0,
        fvEventTicks: 0,
        volMult: 1,
        volEventTicks: 0,
      };
    });
    return { traders, assets, events: [], active: 'PUMP', orderId: 1 };
  }

  // Optional fromId — only seed traders whose id >= fromId (avoids re-seeding
  // existing bots on incremental spawn). Defaults to 1 (full re-seed).
  seedBooks(fromId: number = 1): void {
    const S = this.state;
    for (let i = fromId; i < S.traders.length; i++) {
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
      if (!h || h.shares === 0 || h.avgCost <= 0) return;
      const px = this.state.assets[a.id].lastPrice;
      // Convert % to absolute trigger price; fall back to legacy abs fields.
      const slAbs = h.slPct && h.slPct > 0
        ? (h.shares > 0 ? h.avgCost * (1 - h.slPct / 100) : h.avgCost * (1 + h.slPct / 100))
        : (h.sl && h.sl > 0 ? h.sl : 0);
      const tpAbs = h.tpPct && h.tpPct > 0
        ? (h.shares > 0 ? h.avgCost * (1 + h.tpPct / 100) : h.avgCost * (1 - h.tpPct / 100))
        : (h.tp && h.tp > 0 ? h.tp : 0);
      let hit: { kind: 'SL' | 'TP'; ref: number } | null = null;
      if (h.shares > 0) {
        if (slAbs > 0 && px <= slAbs) hit = { kind: 'SL', ref: slAbs };
        else if (tpAbs > 0 && px >= tpAbs) hit = { kind: 'TP', ref: tpAbs };
      } else {
        if (slAbs > 0 && px >= slAbs) hit = { kind: 'SL', ref: slAbs };
        else if (tpAbs > 0 && px <= tpAbs) hit = { kind: 'TP', ref: tpAbs };
      }
      if (hit) {
        // Mark as pending close so the server's drainCloses retries every tick
        // until thin book is consumed. Also fire one immediate attempt.
        if (!p.closing) p.closing = {};
        if (!p.closing[a.id]) {
          p.closing[a.id] = true;
          this.hooks.onSLTPHit?.(a.id, hit.kind, hit.ref, px);
        }
        this.closePosition(a.id);
      }
    });
  }

  closePosition(aid: string): void {
    const hold = this.player().holdings[aid];
    if (!hold || hold.shares === 0) return;
    if (hold.shares > 0) placeOrder(this.state, 0, aid, 'sell', hold.shares, 0, 'market', this.callbacks());
    else placeOrder(this.state, 0, aid, 'buy', -hold.shares, 0, 'market', this.callbacks());
    const h = this.player().holdings[aid];
    if (h.shares === 0) { h.sl = 0; h.tp = 0; h.slPct = 0; h.tpPct = 0; }
  }

  callbacks() {
    return {
      onPlayerBuy: (q: number) => this.hooks.onPlayerBuy?.(this.state.active, q),
      onPlayerSellProfit: () => this.hooks.onPlayerSellProfit?.(),
      onPlayerSellLoss: () => this.hooks.onPlayerSellLoss?.(),
      onTrade: (b: number, s: number) => {
        const buyer = this.state.traders[b]; const seller = this.state.traders[s];
        if (!buyer.isPlayer) buyer.tradesSinceChange++;
        if (!seller.isPlayer) seller.tradesSinceChange++;
      },
      onPlayerTradeClosed: (trade: Trade) => {
        const p = this.player();
        if (!p.playerTrades) p.playerTrades = [];
        p.playerTrades.push(trade);
        if (p.playerTrades.length > MAX_PLAYER_TRADES) p.playerTrades.shift();
        recordClosedTradeForMissions(p, trade, Date.now());
        this.hooks.onPlayerTradeClosed?.(trade);
      },
    };
  }

  // ===== STATS =====
  getPlayerStats(): PlayerStats {
    const p = this.player();
    const trades = p.playerTrades || [];
    let wins = 0, losses = 0, realizedPL = 0, largestWin = 0, largestLoss = 0, sumHold = 0;
    const perAsset: Record<string, number> = {};
    for (const t of trades) {
      realizedPL += t.pnl;
      if (t.pnl > 0) wins++;
      else if (t.pnl < 0) losses++;
      if (t.pnl > largestWin) largestWin = t.pnl;
      if (t.pnl < largestLoss) largestLoss = t.pnl;
      // Guard: legacy/missing entryTs (=0) would inflate sumHold by the wall-clock epoch.
      sumHold += t.entryTs > 0 ? Math.max(0, t.exitTs - t.entryTs) : 0;
      perAsset[t.assetId] = (perAsset[t.assetId] || 0) + t.pnl;
    }
    let bestAsset: string | null = null, worstAsset: string | null = null;
    let bestPL = -Infinity, worstPL = Infinity;
    for (const aid of Object.keys(perAsset)) {
      if (perAsset[aid] > bestPL) { bestPL = perAsset[aid]; bestAsset = aid; }
      if (perAsset[aid] < worstPL) { worstPL = perAsset[aid]; worstAsset = aid; }
    }
    // Unrealized — sum across open positions.
    let unrealized = 0;
    for (const a of ASSETS) {
      const h = p.holdings[a.id];
      if (!h || h.shares === 0) continue;
      const px = this.state.assets[a.id].lastPrice;
      unrealized += h.shares > 0
        ? h.shares * (px - h.avgCost)
        : (-h.shares) * (h.avgCost - px);
    }
    const totalTrades = trades.length;
    return {
      totalTrades, wins, losses,
      winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      realizedPL, unrealizedPL: unrealized,
      largestWin, largestLoss,
      avgPL: totalTrades > 0 ? realizedPL / totalTrades : 0,
      avgHoldMs: totalTrades > 0 ? sumHold / totalTrades : 0,
      bestAsset, worstAsset,
      rank: 0, total: 0, // filled by server with cached values
    };
  }

  placeOrder(side: 'buy' | 'sell', qty: number, type: 'market' | 'limit', limitPx: number): void {
    placeOrder(this.state, 0, this.state.active, side, qty, limitPx, type, this.callbacks());
  }

  step(now: number): void {
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    // Mission/login rollover runs once per tick. Cheap when nothing to do.
    const wallNow = Date.now();
    ensureMissionsCurrent(this.player(), wallNow);
    rolloverDailyLogin(this.player(), wallNow);
    tickMissionProgress(this.player(), wallNow, () => this.netWorth());
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
      // PERF: shard sweep — 1/REKT_SHARDS of population each 2s, full pass = 8s.
      // Cuts per-tick scan cost 4x on 100K+ bots.
      const REKT_SHARDS = 4;
      const total = this.state.traders.length;
      if (total > 1) {
        const sliceSize = Math.ceil((total - 1) / REKT_SHARDS);
        const start = 1 + this.rektShard * sliceSize;
        const end = Math.min(total, start + sliceSize);
        this.rektShard = (this.rektShard + 1) % REKT_SHARDS;
        for (let i = start; i < end; i++) {
          const t = this.state.traders[i];
          if (t.rekt) continue;
          // Mark dirty so checkRekt/maybeMutate re-prices vs current market.
          t._netDirty = true;
          if (t.tradesSinceChange > 0) maybeMutate(t, this.state);
          checkRekt(t, this.state);
        }
      }
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
    // NOTE: bonus deliberately excluded — keeps leaderboard fair vs bots.
    return this.player().cash + this.portfolioValue();
  }

  // Player-only "wallet" including mission bonus, shown in header alongside net.
  walletBonus(): number {
    return this.player().bonus || 0;
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
