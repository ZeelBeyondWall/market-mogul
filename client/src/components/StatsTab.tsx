import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';

function fmtDuration(ms: number): string {
  if (!ms || !isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

export function StatsTab() {
  const stats = useGame(s => s.playerStats);
  const bonus = useGame(s => s.playerBonus);
  const streak = useGame(s => s.playerStreak);
  if (!stats) return <div className="section"><div className="empty">Loading stats…</div></div>;

  const totalPL = stats.realizedPL + stats.unrealizedPL;
  const plSign = (n: number) => (n >= 0 ? '+' : '') + fmt(n);

  return (
    <div className="section">
      <h3>Trading Stats</h3>
      <div className="stats-grid">
        <StatCard label="Total Trades"     value={String(stats.totalTrades)} />
        <StatCard label="Win Rate"         value={stats.totalTrades ? fmtPct(stats.winRate) : '—'}
                                           tone={stats.winRate >= 50 ? 'up' : 'dn'} />
        <StatCard label="Wins"             value={String(stats.wins)}     tone="up" />
        <StatCard label="Losses"           value={String(stats.losses)}   tone="dn" />
        <StatCard label="Realized P/L"     value={plSign(stats.realizedPL)}     tone={stats.realizedPL >= 0 ? 'up' : 'dn'} />
        <StatCard label="Unrealized P/L"   value={plSign(stats.unrealizedPL)}   tone={stats.unrealizedPL >= 0 ? 'up' : 'dn'} />
        <StatCard label="Total P/L"        value={plSign(totalPL)}              tone={totalPL >= 0 ? 'up' : 'dn'} />
        <StatCard label="Largest Win"      value={plSign(stats.largestWin)}     tone="up" />
        <StatCard label="Largest Loss"     value={plSign(stats.largestLoss)}    tone="dn" />
        <StatCard label="Avg P/L per Trade" value={stats.totalTrades ? plSign(stats.avgPL) : '—'}
                                            tone={stats.avgPL >= 0 ? 'up' : 'dn'} />
        <StatCard label="Avg Hold Duration" value={fmtDuration(stats.avgHoldMs)} />
        <StatCard label="Best Stock"       value={stats.bestAsset || '—'}       tone="up" />
        <StatCard label="Worst Stock"      value={stats.worstAsset || '—'}      tone="dn" />
        <StatCard label="Rank"             value={`#${stats.rank}/${stats.total || '—'}`} />
        <StatCard label="Login Streak"     value={streak ? streak + 'd 🔥' : '—'} />
        <StatCard label="Mission Bonus"    value={'$' + fmt(bonus)} tone="up" />
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'dn' }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className={'stat-card-value' + (tone ? ' ' + tone : '')}>{value}</div>
    </div>
  );
}
