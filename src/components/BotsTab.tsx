import { STRATEGY_LABELS } from '../engine/constants';
import { fmt } from '../engine/helpers';
import { traderNet } from '../engine/strategies';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

const FILTERS = ['all','yolo','fomo','gambler','diamond','paper','permabull','permabear','lazy','newschase','conservative','value','trend','mm','copycat','revenge'];

export function BotsTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const botFilter = useGame(s => s.botFilter);
  const setBotFilter = useGame(s => s.setBotFilter);

  const sorted = eng.state.traders.map(t => ({ t, net: traderNet(t, eng.state) })).sort((a, b) => b.net - a.net);
  const filtered = botFilter === 'all' ? sorted : sorted.filter(x => x.t.isPlayer || x.t.strat === botFilter);
  const top = filtered.slice(0, 60);
  const playerIdx = filtered.findIndex(x => x.t.isPlayer);
  const showPlayer = playerIdx >= 60;

  return (
    <div className="section">
      <h3>Leaderboard <span className="badge">{sorted.length}</span></h3>
      <div className="bot-filter">
        {FILTERS.map(s => (
          <button key={s} className={botFilter === s ? 'on' : ''} onClick={() => { setBotFilter(s); Audio.click(); }}>
            {s === 'all' ? 'All' : (STRATEGY_LABELS[s] || s)}
          </button>
        ))}
      </div>
      <div>
        {top.map(x => {
          const rank = sorted.indexOf(x) + 1;
          const me = x.t.isPlayer ? ' me' : '';
          const rekt = x.t.rekt ? ' rekt' : '';
          const strat = x.t.isPlayer ? 'YOU' : (STRATEGY_LABELS[x.t.strat] || x.t.strat).toUpperCase();
          return (
            <div key={x.t.id} className={'bot' + me + rekt}>
              <div className="bot-rank">#{rank}</div>
              <div className="bot-info">
                <div className="bot-name">{x.t.name}{x.t.rekt && <span style={{ color: 'var(--red)', fontSize: 9, fontWeight: 700, marginLeft: 6 }}>REKT</span>}</div>
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
