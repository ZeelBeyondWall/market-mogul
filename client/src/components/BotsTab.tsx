import { useState } from 'react';
import { STRATEGY_LABELS } from '../../../shared/engine/constants';
import { fmt } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

const FILTERS = ['all','yolo','fomo','gambler','diamond','paper','permabull','permabear','lazy','newschase','conservative','value','trend','mm','copycat','revenge'];

// v9: leaderboard split per spec — Bots (competition), You (player highlight),
// All (combined, clearly labeled). Bots is default since the player is the only
// human, so a "players only" board is just one row.
type View = 'bots' | 'players';

export function BotsTab() {
  useGame(s => s.dataTick);
  const leaderboard = useGame(s => s.leaderboard);
  const total = useGame(s => s.totalTraders);
  const playerRank = useGame(s => s.playerRank);
  const botFilter = useGame(s => s.botFilter);
  const setBotFilter = useGame(s => s.setBotFilter);
  const [view, setView] = useState<View>('bots');

  // Filter based on view
  const byView = leaderboard.filter(x => {
    if (view === 'players') return x.isPlayer;
    return !x.isPlayer; // bots
  });

  const filtered = (view === 'players' || botFilter === 'all')
    ? byView
    : byView.filter(x => x.strat === botFilter);

  const top = filtered.slice(0, 60);
  const playerIdx = filtered.findIndex(x => x.isPlayer);
  const showPlayerFooter = view === 'players' && playerIdx >= 60;

  const VIEWS: { id: View; label: string }[] = [
    { id: 'bots', label: '🤖 Bots Leaderboard' },
    { id: 'players', label: '👥 Players' },
  ];

  const renderTierBadge = (tier?: string) => {
    if (!tier) return null;
    let color = '#a1a1aa'; // Muted grey
    let label = 'RETAIL';
    let bg = 'rgba(161, 161, 170, 0.1)';
    let border = '1px solid rgba(161, 161, 170, 0.2)';
    if (tier === 'whale') {
      color = '#f59e0b'; // Gold / Amber
      label = 'WHALE';
      bg = 'rgba(245, 158, 11, 0.1)';
      border = '1px solid rgba(245, 158, 11, 0.3)';
    } else if (tier === 'institution') {
      color = '#0ea5e9'; // Sky blue
      label = 'INST';
      bg = 'rgba(14, 165, 233, 0.1)';
      border = '1px solid rgba(14, 165, 233, 0.3)';
    }
    return (
      <span style={{
        fontSize: '7.5px',
        fontWeight: 800,
        color,
        background: bg,
        border,
        borderRadius: '3px',
        padding: '1px 4px',
        marginLeft: '6px',
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        verticalAlign: 'middle',
        textTransform: 'uppercase'
      }}>
        <img
          src={`/assets/lb/tier_${tier}.webp`}
          alt=""
          style={{ width: 10, height: 10, objectFit: 'contain', borderRadius: 2 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {label}
      </span>
    );
  };

  return (
    <div className="section">
      <h3>
        Leaderboard
        <span className="badge">{view === 'players' ? '#' + playerRank : total}</span>
      </h3>

      {/* View toggle */}
      <div className="lb-views">
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={'lb-view-btn' + (view === v.id ? ' on' : '')}
            onClick={() => { setView(v.id); Audio.click(); }}
            style={{ flex: 1 }}
          >{v.label}</button>
        ))}
      </div>

      {/* Strategy filter — hidden in "players" view */}
      {view !== 'players' && (
        <div className="bot-filter">
          {FILTERS.map(s => (
            <button key={s} className={botFilter === s ? 'on' : ''} onClick={() => { setBotFilter(s); Audio.click(); }}>
              {s === 'all' ? 'All' : (STRATEGY_LABELS[s] || s)}
            </button>
          ))}
        </div>
      )}

      <div>
        {top.length === 0 ? (
          <div className="empty">No traders match this view.</div>
        ) : top.map((x, i) => {
          // Rank within current view list (1-based).
          const rank = i + 1;
          const me = x.isPlayer ? ' me' : '';
          const rekt = x.rekt ? ' rekt' : '';
          const strat = x.isPlayer ? 'YOU' : (STRATEGY_LABELS[x.strat] || x.strat).toUpperCase();
          return (
            <div key={x.id} className={'bot' + me + rekt}>
              <div className="bot-rank">#{rank}</div>
              <div className="bot-info">
                <div className="bot-name">
                  {x.isPlayer ? 'YOU' : x.name}
                  <span className="bot-lvl">L{x.level || 1}</span>
                  {x.rekt && <span style={{ color: 'var(--red)', fontSize: 9, fontWeight: 700, marginLeft: 6 }}>REKT</span>}
                  {!x.isPlayer && renderTierBadge(x.tier)}
                </div>
                <div className="bot-meta">{strat}</div>
              </div>
              <div className="bot-net">{fmt(x.net)}</div>
            </div>
          );
        })}
        {showPlayerFooter && (
          <>
            <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 10, padding: 6, letterSpacing: 1 }}>… {playerIdx - 59} more …</div>
            <div className="bot me">
              <div className="bot-rank">#{playerIdx + 1}</div>
              <div className="bot-info">
                <div className="bot-name">YOU <span className="bot-lvl">L{filtered[playerIdx].level || 1}</span></div>
                <div className="bot-meta">YOU</div>
              </div>
              <div className="bot-net">{fmt(filtered[playerIdx].net)}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
