import { ASSETS, BOT_NAMES, NAME_FIRST, NAME_LAST, STRATEGY_MIX, STRATEGIES } from './constants';
import { rand } from './helpers';
import type { Holding, StrategyId, Trader } from './types';

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

export function pickAssetsFor(strat: StrategyId): string[] {
  const cheap = ['PUMP', 'SHIB', 'JUNK', 'CALL', 'PUTS'];
  const mid = ['APPL', 'MSFT', 'JPMC', 'QQQ', 'HEDG'];
  let pool: string[];
  switch (strat) {
    case 'yolo':         pool = cheap; break;
    case 'diamond':      pool = cheap.concat(mid); break;
    case 'paper':        pool = cheap.concat(['APPL', 'MSFT', 'JPMC']); break;
    case 'permabull':    pool = cheap.concat(mid); break;
    case 'permabear':    pool = cheap.concat(mid); break;
    case 'lazy':         pool = ['APPL', 'MSFT', 'JPMC', 'SP500', 'QQQ']; break;
    case 'newschase':    pool = cheap.concat(mid); break;
    case 'fomo':         pool = cheap.concat(['APPL', 'MSFT', 'QQQ', 'CALL']); break;
    case 'conservative': pool = ['APPL', 'MSFT', 'JPMC', 'HEDG']; break;
    case 'gambler':      pool = cheap; break;
    case 'value':        pool = ['JUNK', 'APPL', 'MSFT', 'JPMC', 'HEDG']; break;
    case 'trend':        pool = cheap.concat(mid); break;
    case 'mm':           pool = cheap; break;
    case 'copycat':      pool = cheap.concat(mid); break;
    case 'revenge':      pool = cheap; break;
    default:             pool = cheap;
  }
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

export function makeTrader(i: number, isPlayer: boolean): Trader {
  const cash = 100;
  const strat: StrategyId = isPlayer ? 'player' : getStratForBot();
  const holdings: Record<string, Holding> = {};
  const indicators: Record<string, { emaFast: number | null; emaSlow: number | null }> = {};
  ASSETS.forEach(a => {
    holdings[a.id] = { shares: 0, avgCost: 0 };
    indicators[a.id] = { emaFast: null, emaSlow: null };
  });
  return {
    id: i,
    name: isPlayer ? 'YOU' : (BOT_NAMES[i - 1] || genName()),
    cash,
    holdings,
    strat,
    isPlayer,
    activity: isPlayer ? 0 : activityFor(strat),
    cooldown: isPlayer ? 0 : rand(0, 3),
    openOrders: [],
    pickedAssets: isPlayer ? null : pickAssetsFor(strat),
    fairBias: isPlayer ? 1 : rand(0.85, 1.15),
    riskTol: isPlayer ? 0 : rand(0.05, 0.3),
    stopLoss: isPlayer ? 0 : stopLossFor(strat),
    takeProfit: isPlayer ? 0 : takeProfitFor(strat),
    indicators,
    bornNet: cash,
    tradesSinceChange: 0,
    mutateCooldown: rand(10, 40),
    bornAt: 0,
  };
}
