import { STRATEGY_LABELS } from '../../../shared/engine/constants';
import { fmt } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

const FILTERS = ['all','yolo','fomo','gambler','diamond','paper','permabull','permabear','lazy','newschase','conservative','value','trend','mm','copycat','revenge'];

export function BotsTab() {
  useGame(s => s.tick);
  const leaderboard = useGame(s => s.leaderboard);
  const total = useGame(s => s.totalTraders);
  const botFilter = useGame(s => s.botFilter);
  const setBotFilter = useGame(s => s.setBotFilter);

  const filtered = botFilter === 'all'
    ? leaderboard
    : leaderboard.filter(x => x.id === 0 || x.strat === botFilter);
  const top = filtered.slice(0, 60);
  const playerIdx = filtered.findIndex(x => x.id === 0);
  const showPlayer = playerIdx >= 60;

  return (
    <div className="section">
      <h3>Leaderboard <span className="badge">{total}</span></h3>
      <div className="bot-filter">
        {FILTERS.map(s => (
          <button key={s} className={botFilter === s ? 'on' : ''} onClick={() => { setBotFilter(s); Audio.click(); }}>
            {s === 'all' ? 'All' : (STRATEGY_LABELS[s] || s)}
          </button>
        ))}
      </div>
      <div>
        {top.map(x => {
          const rank = leaderboard.indexOf(x) + 1;
          const me = x.id === 0 ? ' me' : '';
          const rekt = x.rekt ? ' rekt' : '';
          const strat = x.id === 0 ? 'YOU' : (STRATEGY_LABELS[x.strat] || x.strat).toUpperCase();
          return (
            <div key={x.id} className={'bot' + me + rekt}>
              <div className="bot-rank">#{rank}</div>
              <div className="bot-info">
                <div className="bot-name">
                  {x.name}
                  {x.rekt && <span style={{ color: 'var(--red)', fontSize: 9, fontWeight: 700, marginLeft: 6 }}>REKT</span>}
                </div>
                <div className="bot-meta">{strat}</div>
              </div>
              <div className="bot-net">{fmt(x.net)}</div>
            </div>
          );
        })}
        {showPlayer && (
          <>
            <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 10, padding: 6, letterSpacing: 1 }}>… {playerIdx - 59} more …</div>
            <div className="bot me">
              <div className="bot-rank">#{playerIdx + 1}</div>
              <div className="bot-info">
                <div className="bot-name">YOU</div>
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
