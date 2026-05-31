import { useState } from 'react';
import { ASSETS, MARKET_LABELS } from '../../../shared/engine/constants';
import { useGame } from '../store/gameStore';

export function NewsTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const market = useGame(s => s.activeMarket);
  const [filterMarket, setFilterMarket] = useState(true);

  // Build set of asset ids in active market for filtering.
  const marketIds = new Set(ASSETS.filter(a => a.market === market).map(a => a.id));
  const allEvents = eng.state.events;
  const filtered = filterMarket
    ? allEvents.filter(e => !e.assetIds || e.assetIds.length === 0 || e.assetIds.some(id => marketIds.has(id)))
    : allEvents;
  const evs = filtered.slice(0, 20);

  return (
    <div className="section">
      <h3>News
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', float: 'right' }}>
          <button
            className={'news-filter-btn' + (filterMarket ? ' on' : '')}
            onClick={() => setFilterMarket(v => !v)}
            style={{ fontSize: 9, padding: '3px 8px', borderRadius: 3, border: '1px solid var(--border)', background: filterMarket ? 'var(--accent)' : 'transparent', color: filterMarket ? '#000' : 'var(--dim)', cursor: 'pointer' }}
          >{filterMarket ? `${MARKET_LABELS[market].split(' ')[1] || market} ONLY` : 'ALL MARKETS'}</button>
        </span>
      </h3>
      {evs.length === 0 ? <div className="empty">Markets quiet…</div> : (
        <div>
          {evs.map((e, i) => {
            const elapsed = Math.floor((Date.now() - e.t) / 1000);
            const t = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm';
            return (
              <div key={i} className={'event ' + e.type}>
                <div className="t">{e.title} <span className="tm">{t} ago</span></div>
                <div className="d">{e.desc}</div>
                {e.cat && <div className="event-cat" style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>#{e.cat}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
