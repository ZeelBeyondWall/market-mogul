import { ASSETS, BOT_COUNT, levelFromXp, xpForTrade } from './constants';
import { rand, roundShares } from './helpers';
import { applyEvent, maybeFireEvent, payDividends, provideLiquidity, tickMarket } from './market';
import { cancelTraderOrders, cleanupBooks, placeOrder, TRADE_FEE_RATE } from './matching';
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
  // v6: fires per trade (player or bot) — used by analytics + audit.
  onAnyTrade?: (buyerId: number, sellerId: number, assetId: string) => void;
}

const MAX_PLAYER_TRADES = 500;

// v6: runtime-toggleable config. Admin API mutates this — engine reads from it
// each tick. Kept on the Engine instance so multiple engines (tests) stay isolated.
export interface EngineConfig {
  botsEnabled: boolean;
  eventsEnabled: boolean;
  volMult: number;
  activityMult: number;
  // v7.1: when true, bots can only trade assets with minLevel <= player.level.
  // Default false — bots use their OWN level for asset access (design).
  strictBotLevelGate: boolean;
  borrowRate: number;
}

export class Engine {
  state: GameState;
  hooks: EngineHooks = {};
  config: EngineConfig = { botsEnabled: true, eventsEnabled: true, volMult: 1, activityMult: 1, strictBotLevelGate: false, borrowRate: 0.005 };
  private eventCD = { cooldown: 25 };
  private divAcc = 0;
  private tickAcc = 0;
  private cleanAcc = 0;
  private rektAcc = 0;
  private lastT = 0;
  private rektShard = 0;
  private liqAcc = 0;
  houseId = -1; // v8.9: index of the House Market Maker trader
  tickFrac = 0;

  constructor(loaded?: GameState) {
    this.state = loaded ?? this.freshState();
    if (!loaded) this.seedBooks();
    // v9.4: a loaded save never ran freshState(), so recover the House index —
    // prefer the persisted value, else find the isHouse trader. Without this the
    // House stays -1 after a server restart and liquidity silently stops.
    if (loaded) {
      this.houseId = (typeof this.state.houseId === 'number' && this.state.houseId >= 0)
        ? this.state.houseId
        : this.state.traders.findIndex(t => t.isHouse);
    }
    this.state.houseId = this.houseId; // keep state in sync for the matcher
    this.lastT = performance.now();
  }

  freshState(): GameState {
    resetStratPool();
    const traders: Trader[] = [makeTrader(0, true)];
    for (let i = 1; i <= BOT_COUNT; i++) traders.push(makeTrader(i, false));
    // v8.9: House Market Maker (last index). Provides liquidity on every asset.
    const house = makeTrader(traders.length, false);
    house.isHouse = true;
    house.name = 'House Liquidity';
    house.cash = 0;
    house.activity = 0;
    house.pickedAssets = [];
    this.houseId = traders.length;
    traders.push(house);
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
    return { traders, assets, events: [], active: ASSETS[0]?.id || 'NEXA', orderId: 1, houseId: this.houseId };
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
      onTrade: (b: number, s: number, aid: string) => {
        const buyer = this.state.traders[b]; const seller = this.state.traders[s];
        if (!buyer.isPlayer) buyer.tradesSinceChange++;
        if (!seller.isPlayer) seller.tradesSinceChange++;
        this.hooks.onAnyTrade?.(b, s, aid);
      },
      onPlayerTradeClosed: (trade: Trade) => {
        const p = this.player();
        if (!p.playerTrades) p.playerTrades = [];
        p.playerTrades.push(trade);
        if (p.playerTrades.length > MAX_PLAYER_TRADES) p.playerTrades.shift();
        recordClosedTradeForMissions(p, trade, Date.now());
        // v5: player gains XP per closed trade; level recomputed from cumulative XP.
        p.xp = (p.xp || 0) + xpForTrade(trade.pnl);
        const newLevel = levelFromXp(p.xp);
        if (newLevel > (p.level || 1)) p.level = newLevel;
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
    const wallNow = Date.now();
    ensureMissionsCurrent(this.player(), wallNow);
    rolloverDailyLogin(this.player(), wallNow);
    tickMissionProgress(this.player(), wallNow, () => this.netWorth());
    // v7.1: propagate strict-gate cap to state (read by botDecide each call).
    this.state.playerLevelCap = this.config.strictBotLevelGate ? (this.player().level || 1) : 0;
    this.tickAcc += dt;
    while (this.tickAcc >= 0.1) {
      tickMarket(this.state, 0.1, now);
      this.checkPlayerSLTP();
      this.tickAcc -= 0.1;
    }
    this.tickFrac = this.tickAcc / 0.1;
    // v6: admin can disable bots globally.
    if (this.config.botsEnabled) tickBots(this.state, dt);
    // v9.4: refresh House liquidity AFTER bots, every tick. Bots flood the book
    // and insertOrder truncates to 40 levels — running last keeps the House
    // quote on top so a side never goes empty. (Was every 0.5s BEFORE bots,
    // which let the House get evicted between refreshes → untradeable book.)
    if (this.houseId >= 0) provideLiquidity(this.state, this.houseId, now);
    this.divAcc += dt;
    if (this.divAcc >= 0.5) {
      payDividends(this.state, this.divAcc);
      // v10: short borrow cost — 0.5%/day charged proportionally each 0.5s tick.
      // 0.005 / 86400 * dt_seconds = per-second borrow rate.
      const borrowRatePerSec = (this.config.borrowRate ?? 0.005) / 86400;
      const dtSec = this.divAcc;
      for (let i = 0; i < this.state.traders.length; i++) {
        const t = this.state.traders[i];
        if (t.isHouse || t.rekt) continue;
        for (const aid of Object.keys(t.holdings)) {
          const h = t.holdings[aid];
          if (h && h.shares < 0) {
            const px = this.state.assets[aid]?.lastPrice || 0;
            const borrowCost = (-h.shares) * px * borrowRatePerSec * dtSec;
            if (borrowCost > 0 && t.cash > borrowCost) {
              t.cash -= borrowCost;
              t.totalBorrowPaid = (t.totalBorrowPaid || 0) + borrowCost;
            }
          }
        }
      }
      this.divAcc = 0;
    }
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
          if (t.rekt || t.isHouse) continue; // v8.9: never rekt the House
          t._netDirty = true;
          if (t.tradesSinceChange > 0) {
            // v5: bot earns 5 XP per trade since last sweep — slow level grind.
            t.xp = (t.xp || 0) + t.tradesSinceChange * 5;
            const newLevel = levelFromXp(t.xp);
            if (newLevel > (t.level || 1)) t.level = newLevel;
            maybeMutate(t, this.state);
            // CRITICAL: reset counter regardless of mutation outcome, otherwise
            // unmutated bots double-count trades next sweep (XP balloons).
            t.tradesSinceChange = 0;
          }
          checkRekt(t, this.state);
        }
      }
      this.cleanAcc = 0;
    }
    this.rektAcc += dt;
    // v6: admin can disable scheduled news events.
    if (this.config.eventsEnabled) {
      const ev = maybeFireEvent(this.state, dt, this.eventCD);
      if (ev) {
        applyEvent(this.state, ev);
        this.hooks.onEvent?.(ev);
      }
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

  // v9.2: SHORT shown exactly like a BUY — you "stake" qty×entry to open the
  // bearish bet (cash goes DOWN by the stake), and the position carries a market
  // value that rises when price falls. P&L = value − stake.
  //
  // Engine truth at open (short Q@P): trueCash += Q×P (sale proceeds), shares=-Q.
  // Display transform (proven to keep netWorth() identical):
  //   stake          = Σ short |shares|×avgCost          (what you "paid")
  //   displayCash     = trueCash − 2×stake               (= oldCash − stake)
  //   short value     = |shares|×(2·avgCost − price)      (= stake + P&L)
  //   displayPortfolio = Σ long(shares×price) + Σ short value
  //   displayCash + displayPortfolio === netWorth()       (invariant)
  private shortStake(): number {
    let p = 0;
    const h = this.player().holdings;
    ASSETS.forEach(a => {
      const pos = h[a.id];
      if (pos && pos.shares < 0) p += (-pos.shares) * pos.avgCost;
    });
    return p;
  }

  displayCash(): number {
    return this.player().cash - 2 * this.shortStake();
  }

  displayPortfolioValue(): number {
    let v = 0;
    const h = this.player().holdings;
    ASSETS.forEach(a => {
      const pos = h[a.id];
      if (!pos || pos.shares === 0) return;
      const px = this.state.assets[a.id].lastPrice;
      if (pos.shares > 0) v += pos.shares * px;                          // long: market value
      else v += (-pos.shares) * (2 * pos.avgCost - px);                  // short: stake + P&L
    });
    return v;
  }

  // Value to show for a single position row (long = market value, short = stake+P&L).
  positionDisplayValue(aid: string): number {
    const pos = this.player().holdings[aid];
    if (!pos || pos.shares === 0) return 0;
    const px = this.state.assets[aid].lastPrice;
    return pos.shares > 0 ? pos.shares * px : (-pos.shares) * (2 * pos.avgCost - px);
  }

  // Player-only "wallet" including mission bonus, shown in header alongside net.
  walletBonus(): number {
    return this.player().bonus || 0;
  }

  playerRank(): number {
    const me = traderNet(this.player(), this.state);
    let rank = 1;
    for (let i = 1; i < this.state.traders.length; i++) {
      const t = this.state.traders[i];
      if (t.isHouse) continue; // v8.9: House not ranked
      if (traderNet(t, this.state) > me) rank++;
    }
    return rank;
  }
}
