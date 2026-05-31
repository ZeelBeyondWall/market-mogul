// In-memory rolling buffer of game metrics — ~1 hour at 5s sample interval.
// Frontend pulls /admin/analytics and renders time-series sparklines from this.
import { ASSETS } from '../../../../shared/engine/constants';
import type { GameState, Market } from '../../../../shared/engine/types';

const SAMPLE_MS = 5000;
const BUFFER_LEN = 720;        // 720 × 5s = 1 hour
const SAMPLE_KEEP_DAYS = 7;    // longer-term hourly rollup

export interface AnalyticsSample {
  ts: number;
  online: number;
  totalTraders: number;
  totalCash: number;
  totalNet: number;
  totalVolume: number;
  openOrders: number;
  trades5sBucket: number;     // count of trades in this 5s sample
}

export interface AnalyticsSnapshot {
  current: AnalyticsSample;
  series: AnalyticsSample[];                       // last hour (5s resolution)
  hourly: { ts: number; volume: number; trades: number; users: number }[]; // last 7 days
  topGainers: { id: string; chgPct: number; lastPrice: number }[];
  topLosers: { id: string; chgPct: number; lastPrice: number }[];
  topVolume: { id: string; volume: number; lastPrice: number }[];
  perMarket: Record<Market, { count: number; volume: number; openInterest: number }>;
}

const series: AnalyticsSample[] = [];
const hourly: { ts: number; volume: number; trades: number; users: number }[] = [];
let tradesBucket = 0;              // incremented externally on every trade
let lastSampleAt = 0;
let lastTotalVolume = 0;

export function recordTrade(): void { tradesBucket++; }

export function sample(state: GameState, clientCount: number): void {
  const now = Date.now();
  if (now - lastSampleAt < SAMPLE_MS) return;
  lastSampleAt = now;

  let totalCash = 0, totalNet = 0, openOrders = 0;
  // PERF: at 100K+ bots, this is the heaviest part of sampling — but only every 5s.
  const traders = state.traders;
  for (let i = 0; i < traders.length; i++) {
    const t = traders[i];
    totalCash += t.cash || 0;
    openOrders += (t.openOrders?.length || 0);
  }
  let totalVolume = 0;
  for (const a of ASSETS) totalVolume += state.assets[a.id]?.volume || 0;
  // traderNet is cached — cheap to call.
  // We only sum top-N for total net or just skip (heavy at scale).
  totalNet = totalCash; // approximation; full traderNet sum costs O(N*assets).

  const s: AnalyticsSample = {
    ts: now,
    online: clientCount,
    totalTraders: traders.length,
    totalCash,
    totalNet,
    totalVolume,
    openOrders,
    trades5sBucket: tradesBucket,
  };
  series.push(s);
  if (series.length > BUFFER_LEN) series.shift();
  tradesBucket = 0;
  lastTotalVolume = totalVolume;

  // Hourly rollup — average across last 720 samples each hour boundary.
  const hr = Math.floor(now / 3_600_000) * 3_600_000;
  const top = hourly[hourly.length - 1];
  if (!top || top.ts !== hr) {
    hourly.push({ ts: hr, volume: 0, trades: 0, users: 0 });
    if (hourly.length > SAMPLE_KEEP_DAYS * 24) hourly.shift();
  }
  const cur = hourly[hourly.length - 1];
  cur.volume = Math.max(cur.volume, totalVolume);  // monotonic max
  cur.trades += tradesBucket;
  cur.users = Math.max(cur.users, clientCount);
}

export function snapshot(state: GameState): AnalyticsSnapshot {
  // Per-asset % change + volume for top lists.
  const ranked = ASSETS.map(a => {
    const ast = state.assets[a.id];
    if (!ast) return null;
    const chg = ast.open > 0 ? ((ast.lastPrice - ast.open) / ast.open) * 100 : 0;
    return { id: a.id, chgPct: chg, lastPrice: ast.lastPrice, volume: ast.volume };
  }).filter(Boolean) as { id: string; chgPct: number; lastPrice: number; volume: number }[];

  const topGainers = [...ranked].sort((a, b) => b.chgPct - a.chgPct).slice(0, 10);
  const topLosers  = [...ranked].sort((a, b) => a.chgPct - b.chgPct).slice(0, 10);
  const topVolume  = [...ranked].sort((a, b) => b.volume - a.volume).slice(0, 10);

  const perMarket: Record<Market, { count: number; volume: number; openInterest: number }> = {
    stocks: { count: 0, volume: 0, openInterest: 0 },
    crypto: { count: 0, volume: 0, openInterest: 0 },
    forex:  { count: 0, volume: 0, openInterest: 0 },
  };
  for (const a of ASSETS) {
    const ast = state.assets[a.id];
    if (!ast) continue;
    perMarket[a.market].count += 1;
    perMarket[a.market].volume += ast.volume;
    perMarket[a.market].openInterest += ast.book.bids.length + ast.book.asks.length;
  }

  const cur = series[series.length - 1] || {
    ts: Date.now(), online: 0, totalTraders: state.traders.length,
    totalCash: 0, totalNet: 0, totalVolume: lastTotalVolume,
    openOrders: 0, trades5sBucket: 0,
  };
  return { current: cur, series: series.slice(), hourly: hourly.slice(), topGainers, topLosers, topVolume, perMarket };
}
