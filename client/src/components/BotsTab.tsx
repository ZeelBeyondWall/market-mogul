import { useState } from 'react';
import { STRATEGY_LABELS } from '../../../shared/engine/constants';
import { fmt } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

const FILTERS = ['all','yolo','fomo','gambler','diamond','paper','permabull','permabear','lazy','newschase','conservative','value','trend','mm','copycat','revenge'];

// v9: leaderboard split per spec — Bots (competition), You (player highlight),
// All (combined, clearly labeled). Bots is default since the player is the only
// human, so a "players only" board is just one row.
type View = 'bots' | 'you' | 'all';

export function BotsTab() {
  useGame(s => s.dataTick);
  const leaderboard = useGame(s => s.leaderboard);
  const total = useGame(s => s.totalTraders);
  const playerRank = useGame(s => s.playerRank);
  const botFilter = useGame(s => s.botFilter);
  const setBotFilter = useGame(s => s.setBotFilter);
  const [view, setView] = useState<View>('bots');

  // Apply view first, then strategy filter (strategy only meaningful on bots/all).
  const byView = leaderboard.filter(x => {
    if (view === 'you') return x.isPlayer;
    if (view === 'bots') return !x.isPlayer;
    return true; // all
  });
  const filtered = (view === 'you' || botFilter === 'all')
    ? byView
    : byView.filter(x => x.strat === botFilter); // player already excluded in 'bots' view

  const top = filtered.slice(0, 60);
  const playerIdx = filtered.findIndex(x => x.isPlayer);
  const showPlayerFooter = view !== 'you' && playerIdx >= 60;

  const VIEWS: { id: View; label: string }[] = [
    { id: 'bots', label: '🤖 Bots' },
    { id: 'you',  label: '👤 You' },
    { id: 'all',  label: '🌐 All' },
  ];

  return (
    <div className="section">
      <h3>
        Leaderboard
        <span className="badge">{view === 'you' ? '#' + playerRank : total}</span>
      </h3>

      {/* View toggle */}
      <div className="lb-views">
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={'lb-view-btn' + (view === v.id ? ' on' : '')}
            onClick={() => { setView(v.id); Audio.click(); }}
          >{v.label}</button>
        ))}
      </div>

      {/* Strategy filter — hidden in "you" view */}
      {view !== 'you' && (
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
