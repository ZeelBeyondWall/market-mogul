import { ASSETS, BOT_NAMES, NAME_FIRST, NAME_LAST, STRATEGY_MIX, STRATEGIES, xpToReach } from './constants';
import { rand } from './helpers';
import type { Holding, StrategyId, Trader } from './types';

// v5: Bot level distribution — most bots are early-game, rare whales at max level.
// Weighted: 50% L1-5, 30% L6-15, 15% L16-25, 5% L26-50.
function randomBotLevel(): number {
  const r = Math.random();
  if (r < 0.50) return 1 + Math.floor(Math.random() * 5);
  if (r < 0.80) return 6 + Math.floor(Math.random() * 10);
  if (r < 0.95) return 16 + Math.floor(Math.random() * 10);
  return 26 + Math.floor(Math.random() * 25);
}

let _stratPool: StrategyId[] | null = null;

export function resetStratPool(): void {
  _stratPool = null;
}

function getStratForBot(): StrategyId {
  if (!_stratPool) {
    _stratPool = [];
    Object.entries(STRATEGY_MIX).forEach(([s, n]) => {
      for (let i = 0; i < n; i++) _stratPool!.push(s as StrategyId);
    });
    for (let i = _stratPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_stratPool[i], _stratPool[j]] = [_stratPool[j], _stratPool[i]];
    }
  }
  return _stratPool.pop() ?? STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
}

export function genName(): string {
  return NAME_FIRST[Math.floor(Math.random() * NAME_FIRST.length)] +
    ' ' + NAME_LAST[Math.floor(Math.random() * NAME_LAST.length)];
}

// v5: pickAssetsFor takes level — bot can only target assets with minLevel <= level.
export function pickAssetsFor(strat: StrategyId, level: number = 1): string[] {
  const byCats = (cats: string[]) =>
    ASSETS.filter(a => cats.includes(a.cat) && a.minLevel <= level).map(a => a.id);
  let pool: string[];
  switch (strat) {
    case 'yolo':         pool = byCats(['gaming','crypto_mid','crypto_meme','tech']); break;
    case 'diamond':      pool = byCats(['tech','bank','crypto_large','health']); break;
    case 'paper':        pool = byCats(['tech','consumer','gaming']); break;
    case 'permabull':    pool = byCats(['tech','crypto_large','gaming','crypto_mid']); break;
    case 'permabear':    pool = byCats(['bank','forex_major','consumer']); break;
    case 'lazy':         pool = byCats(['bank','consumer','forex_major']); break;
    case 'newschase':    pool = byCats(['tech','crypto_large','energy']); break;
    case 'fomo':         pool = byCats(['crypto_mid','crypto_meme','gaming','tech']); break;
    case 'conservative': pool = byCats(['bank','consumer','forex_major','health']); break;
    case 'gambler':      pool = byCats(['crypto_meme','forex_cross','gaming','crypto_mid']); break;
    case 'value':        pool = byCats(['bank','tech','consumer','health']); break;
    case 'trend':        pool = byCats(['tech','crypto_large','energy','forex_major']); break;
    case 'mm':           pool = byCats(['crypto_large','forex_major','tech']); break;
    case 'copycat':      pool = byCats(['tech','crypto_large','consumer']); break;
    case 'revenge':      pool = byCats(['gaming','crypto_meme','crypto_mid']); break;
    default:             pool = byCats(['tech']);
  }
  // Fallback — if strategy's preferred cats are all gated, draw any accessible asset.
  if (pool.length === 0) pool = ASSETS.filter(a => a.minLevel <= level).map(a => a.id);
  pool = pool.slice();
  const n = 2 + Math.floor(Math.random() * 4);
  const picks: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picks;
}

export function activityFor(s: StrategyId): number {
  switch (s) {
    case 'lazy': return 0.02;
    case 'diamond': return 0.06;
    case 'conservative': return 0.05;
    case 'value': return 0.12;
    case 'trend': return 0.2;
    case 'mm': return 0.8;
    case 'paper': return 0.6;
    case 'gambler': return 0.5;
    case 'yolo': return 0.35;
    case 'fomo': return 0.3;
    case 'permabull': return 0.18;
    case 'permabear': return 0.16;
    case 'newschase': return 0.1;
    case 'copycat': return 0.2;
    case 'revenge': return 0.15;
    default: return 0.25;
  }
}

export function stopLossFor(s: StrategyId): number {
  if (s === 'diamond' || s === 'lazy' || s === 'permabull') return 0;
  if (s === 'paper') return 0.02;
  if (s === 'gambler') return 0.35;
  if (s === 'yolo') return 0.3;
  return rand(0.10, 0.30);
}

export function takeProfitFor(s: StrategyId): number {
  if (s === 'diamond' || s === 'lazy' || s === 'permabull') return 0;
  if (s === 'paper') return 0.03;
  if (s === 'conservative') return 0.15;
  if (s === 'gambler') return 2.0;
  if (s === 'yolo') return 0.5;
  return rand(0.2, 0.8);
}

// v8.5: starting cash raised 100 -> 1000 so whole-share trading works across
// the asset price range (NEXA $180 etc). Bots can now afford + seed liquidity
// on pricier assets from a fresh game. Player + bots both start here.
export const STARTING_CASH = 1000;

export function makeTrader(i: number, isPlayer: boolean, forcedStrat?: StrategyId): Trader {
  let tier: 'retail' | 'whale' | 'institution' = 'retail';
  let cash = STARTING_CASH;
  let level = isPlayer ? 1 : randomBotLevel();

  if (!isPlayer) {
    const r = Math.random();
    if (r < 0.05) {
      tier = 'whale';
      cash = Math.floor(rand(50000, 250000));
      level = Math.max(level, 25 + Math.floor(Math.random() * 25));
    } else if (r < 0.20) {
      tier = 'institution';
      cash = Math.floor(rand(10000, 50000));
      level = Math.max(level, 10 + Math.floor(Math.random() * 15));
    } else {
      tier = 'retail';
      cash = Math.floor(rand(500, 2500));
    }
  }

  const strat: StrategyId = isPlayer ? 'player' : (forcedStrat || getStratForBot());
  const holdings: Record<string, Holding> = {};
  const indicators: Record<string, { emaFast: number | null; emaSlow: number | null }> = {};
  const needIndicators = strat === 'trend';
  ASSETS.forEach(a => {
    holdings[a.id] = { shares: 0, avgCost: 0 };
    if (needIndicators) indicators[a.id] = { emaFast: null, emaSlow: null };
  });

  const xp = isPlayer ? 0 : xpToReach(level);
  // v7.3: player name configurable via MM_PLAYER_NAME env var. Default 'Trader'.
  const playerName = (typeof globalThis !== 'undefined' && (globalThis as any)?.process?.env?.MM_PLAYER_NAME) || 'Trader';

  let activity = isPlayer ? 0 : activityFor(strat);
  if (!isPlayer && tier === 'whale') {
    activity = activity * 0.4; // Whales are patient block traders
  }

  return {
    id: i,
    name: isPlayer ? playerName : (BOT_NAMES[i - 1] || genName()),
    cash,
    holdings,
    strat,
    isPlayer,
    activity,
    cooldown: isPlayer ? 0 : rand(20, 300),
    openOrders: [],
    pickedAssets: isPlayer ? null : pickAssetsFor(strat, level),
    fairBias: isPlayer ? 1 : rand(0.85, 1.15),
    riskTol: isPlayer ? 0 : rand(0.05, 0.3),
    stopLoss: isPlayer ? 0 : stopLossFor(strat),
    takeProfit: isPlayer ? 0 : takeProfitFor(strat),
    indicators,
    bornNet: cash,
    tradesSinceChange: 0,
    mutateCooldown: rand(10, 40),
    bornAt: 0,
    closing: {},
    level,
    xp,
    tier,
    greed: 0.5,
    fear: 0.5,
    hype: 0.0,
  };
}
