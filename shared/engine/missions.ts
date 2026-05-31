import type { MissionDef, MissionState, Trade, Trader } from './types';

// ===== Day / Week math (UTC) =====
const MS_PER_DAY = 86_400_000;

export function utcDayNumber(ts: number): number {
  return Math.floor(ts / MS_PER_DAY);
}

// ISO week number — Monday-start. Reasonable approximation; rollover at UTC Monday 00:00.
export function isoWeekNumber(ts: number): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  // Thursday of current week = unique week anchor
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);
}

// ===== Mission catalog =====
// Daily pool — small targets, reset every UTC midnight.
const DAILY_POOL: MissionDef[] = [
  { id: 'd-trade5',     period: 'daily', title: 'Active Trader',     desc: 'Execute 5 trades',                 goal: { kind: 'trades',      target: 5 },  reward: 50 },
  { id: 'd-trade10',    period: 'daily', title: 'Volume Pump',       desc: 'Execute 10 trades',                goal: { kind: 'trades',      target: 10 }, reward: 100 },
  { id: 'd-prof3',      period: 'daily', title: 'Profit Hunter',     desc: 'Close 3 profitable trades',        goal: { kind: 'profitable',  target: 3 },  reward: 80 },
  { id: 'd-prof5',      period: 'daily', title: 'Green Streak',      desc: 'Close 5 profitable trades',        goal: { kind: 'profitable',  target: 5 },  reward: 150 },
  { id: 'd-distinct3',  period: 'daily', title: 'Diversifier',       desc: 'Trade 3 different stocks',         goal: { kind: 'distinct',    target: 3 },  reward: 60 },
  { id: 'd-distinct5',  period: 'daily', title: 'Sector Scout',      desc: 'Trade 5 different stocks',         goal: { kind: 'distinct',    target: 5 },  reward: 120 },
  { id: 'd-grow1',      period: 'daily', title: 'Steady Gains',      desc: 'Grow portfolio by 1%',             goal: { kind: 'portfolioPct',target: 1 },  reward: 75 },
  { id: 'd-grow2',      period: 'daily', title: 'Big Day',           desc: 'Grow portfolio by 2%',             goal: { kind: 'portfolioPct',target: 2 },  reward: 150 },
  { id: 'd-hold1',      period: 'daily', title: 'Patient Hand',      desc: 'Hold any position 1 hour',         goal: { kind: 'holdHours',   target: 1 },  reward: 50 },
];

// Weekly pool — bigger targets, reset every ISO Monday.
const WEEKLY_POOL: MissionDef[] = [
  { id: 'w-trade50',    period: 'weekly', title: 'Power Trader',     desc: 'Execute 50 trades this week',      goal: { kind: 'trades',      target: 50 }, reward: 500 },
  { id: 'w-prof20',     period: 'weekly', title: 'Weekly Winner',    desc: '20 profitable trades',             goal: { kind: 'profitable',  target: 20 }, reward: 750 },
  { id: 'w-distinct10', period: 'weekly', title: 'Wide Net',         desc: 'Trade 10 different stocks',        goal: { kind: 'distinct',    target: 10 }, reward: 400 },
  { id: 'w-grow5',      period: 'weekly', title: 'Outperform',       desc: 'Grow portfolio 5% in a week',      goal: { kind: 'portfolioPct',target: 5 },  reward: 1000 },
  { id: 'w-hold24',     period: 'weekly', title: 'Long Hold',        desc: 'Hold any position 24 hours',       goal: { kind: 'holdHours',   target: 24 }, reward: 600 },
];

const DAILY_COUNT = 3;
const WEEKLY_COUNT = 2;

// Deterministic seeded shuffle so daily picks are stable across server restarts within a day.
function seededPicks<T>(pool: T[], n: number, seed: number): T[] {
  const arr = pool.slice();
  let s = seed | 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0;
    const j = ((s >>> 0) % (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, Math.min(n, arr.length));
}

function makeState(def: MissionDef): MissionState {
  return { def, progress: 0, completed: false, claimed: false };
}

// Regenerates daily/weekly mission sets when the day/week rolls over.
export function ensureMissionsCurrent(p: Trader, wallNow: number): void {
  if (!p.isPlayer) return;
  const day = utcDayNumber(wallNow);
  const week = isoWeekNumber(wallNow);
  if (p.dailyMissionDay !== day) {
    p.dailyMissions = seededPicks(DAILY_POOL, DAILY_COUNT, day).map(makeState);
    p.dailyMissionDay = day;
  }
  if (p.weeklyMissionWeek !== week) {
    p.weeklyMissions = seededPicks(WEEKLY_POOL, WEEKLY_COUNT, week * 31).map(makeState);
    p.weeklyMissionWeek = week;
  }
}

// Daily-login bonus + streak. Returns reward awarded this call (0 if none).
export function rolloverDailyLogin(p: Trader, wallNow: number): number {
  if (!p.isPlayer) return 0;
  const day = utcDayNumber(wallNow);
  if (p.lastClaimedDay === day) return 0;
  // Streak: continues only if last login was yesterday; else resets to 1.
  if (p.lastLoginDay !== undefined && p.lastLoginDay === day - 1) {
    p.loginStreak = (p.loginStreak || 0) + 1;
  } else {
    p.loginStreak = 1;
  }
  // Reward scales with streak — capped at day 7.
  const streak = Math.min(p.loginStreak, 7);
  const reward = 100 * streak;
  p.bonus = (p.bonus || 0) + reward;
  p.lastClaimedDay = day;
  p.lastLoginDay = day;
  return reward;
}

// Per-tick progress for goals that depend on time/portfolio, not trade events.
export function tickMissionProgress(p: Trader, wallNow: number, getNetWorth: () => number): void {
  if (!p.isPlayer) return;
  const day = utcDayNumber(wallNow);
  // Snapshot portfolio at day start (used by portfolioPct goal).
  if (p.dayStartDay !== day) {
    p.dayStartNet = getNetWorth();
    p.dayStartDay = day;
  }
  const startNet = p.dayStartNet || 1;
  const growthPct = ((getNetWorth() - startNet) / startNet) * 100;

  const updateOne = (m: MissionState) => {
    if (m.completed) return;
    if (m.def.goal.kind === 'portfolioPct') {
      m.progress = Math.max(m.progress, growthPct);
      if (m.progress >= m.def.goal.target) m.completed = true;
    } else if (m.def.goal.kind === 'holdHours') {
      // longest current hold across open positions
      let maxHoldHr = 0;
      if (p.playerEntryTs) {
        for (const aid of Object.keys(p.playerEntryTs)) {
          const ts = p.playerEntryTs[aid];
          if (ts > 0) maxHoldHr = Math.max(maxHoldHr, (wallNow - ts) / 3_600_000);
        }
      }
      m.progress = Math.max(m.progress, maxHoldHr);
      if (m.progress >= m.def.goal.target) m.completed = true;
    }
  };
  (p.dailyMissions || []).forEach(updateOne);
  (p.weeklyMissions || []).forEach(updateOne);
}

// Called from engine.callbacks().onPlayerTradeClosed — bumps trade-event goals.
// `wallNow` is the current wall-clock; required so day/week cutoffs measure from
// "now" rather than from the trade's exitTs (which can race day boundaries).
export function recordClosedTradeForMissions(p: Trader, trade: Trade, wallNow: number): void {
  if (!p.isPlayer) return;
  const apply = (m: MissionState) => {
    if (m.completed) return;
    const g = m.def.goal;
    if (g.kind === 'trades') {
      m.progress++;
      if (m.progress >= g.target) m.completed = true;
    } else if (g.kind === 'profitable' && trade.pnl > 0) {
      m.progress++;
      if (m.progress >= g.target) m.completed = true;
    } else if (g.kind === 'distinct') {
      // Current trade was already pushed to p.playerTrades before this call —
      // iterating it gives the full set; no explicit add needed.
      const trades = p.playerTrades || [];
      const cutoff = m.def.period === 'daily'
        ? wallNow - 86_400_000
        : wallNow - 7 * 86_400_000;
      const distinct = new Set<string>();
      for (const t of trades) if (t.exitTs >= cutoff) distinct.add(t.assetId);
      m.progress = distinct.size;
      if (m.progress >= g.target) m.completed = true;
    }
  };
  (p.dailyMissions || []).forEach(apply);
  (p.weeklyMissions || []).forEach(apply);
}

// Claim a completed mission — moves reward to player.bonus. Returns reward or 0.
export function claimMission(p: Trader, missionId: string): number {
  if (!p.isPlayer) return 0;
  const find = (arr?: MissionState[]) => arr?.find(m => m.def.id === missionId);
  const m = find(p.dailyMissions) || find(p.weeklyMissions);
  if (!m || !m.completed || m.claimed) return 0;
  m.claimed = true;
  p.bonus = (p.bonus || 0) + m.def.reward;
  return m.def.reward;
}
