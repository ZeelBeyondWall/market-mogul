// Shared admin types — mirror server responses (loose, deliberately permissive).

export interface UserRow {
  id: number;
  name: string;
  strat: string;
  isPlayer: boolean;
  cash: number;
  net: number;
  rekt: boolean;
  level: number;
  xp: number;
  openOrders: number;
  bornAt: number;
}

export interface UserDetail extends UserRow {
  bonus: number;
  loginStreak: number;
  activity: number;
  stopLoss: number;
  takeProfit: number;
  openOrders: any; // overridden — server returns array on detail
  holdings: { aid: string; shares: number; avgCost: number; lastPrice: number; value: number; pnl: number }[];
  recentTrades: any[];
  dailyMissions: any[];
  weeklyMissions: any[];
}

export interface EconomyResp {
  ok: boolean;
  totalRegistered: number;
  totalActive: number;
  totalOnline: number;
  totalBots: number;
  totalCash: number;
  totalNet: number;
  totalMarketVolume: number;
  openPositions: number;
  openOrders: number;
  richest: { id: number; name: string; net: number };
  perMarket: Record<string, { volume: number; count: number }>;
  flags: {
    maintenanceMode: boolean; tradingHalted: boolean; botsEnabled: boolean;
    eventsEnabled: boolean; registrationDisabled: boolean;
    volatilityMult: number; spreadMult: number; activityMult: number;
    broadcastBanner: string;
  };
}

export interface AnalyticsSample {
  ts: number;
  online: number;
  totalTraders: number;
  totalCash: number;
  totalNet: number;
  totalVolume: number;
  openOrders: number;
  trades5sBucket: number;
}

export interface AnalyticsResp {
  ok: boolean;
  current: AnalyticsSample;
  series: AnalyticsSample[];
  hourly: { ts: number; volume: number; trades: number; users: number }[];
  topGainers: { id: string; chgPct: number; lastPrice: number }[];
  topLosers: { id: string; chgPct: number; lastPrice: number }[];
  topVolume: { id: string; volume: number; lastPrice: number }[];
  perMarket: Record<string, { count: number; volume: number; openInterest: number }>;
}

export interface AuditEntry {
  ts: number;
  actor: string;
  action: string;
  target?: string | number;
  payload?: any;
  result?: 'ok' | 'error';
  reason?: string;
}

export interface HealthResp {
  ok: boolean;
  uptimeSec: number;
  pid: number;
  mem: { rss: number; heapUsed: number; heapTotal: number; external: number };
  cpuLoad: { user: number; system: number };
  tradersCount: number;
  assetsCount: number;
  clientCount: number;
  flags: EconomyResp['flags'];
}
