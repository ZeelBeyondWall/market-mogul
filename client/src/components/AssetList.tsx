import { useState } from 'react';
import { ASSETS, CATEGORY_LABELS, CATEGORY_ORDER, MARKET_LABELS, marketUnlockLevel } from '../../../shared/engine/constants';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

// v8: AssetList — Watchlist always-on-top, Browse grouped below.
// Market switcher moved to top-level MarketBar; this just renders the active market.

export function AssetList() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const setActive = useGame(s => s.setActive);
  const activeMarket = useGame(s => s.activeMarket);
  const watchlist = useGame(s => s.watchlist);
  const toggleWatchlist = useGame(s => s.toggleWatchlist);
  const playerLevel = useGame(s => s.playerLevel);
  const active = eng.state.active;
  const nw = eng.netWorth();
  const [query, setQuery] = useState('');
  // v8.1: default ALL categories CLOSED — user expands what they want to browse.
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => ({}));

  const q = query.trim().toUpperCase();
  const inMarket = ASSETS.filter(a => a.market === activeMarket);
  const visible = inMarket.filter(a =>
    !q || a.id.includes(q) || a.name.toUpperCase().includes(q) || a.cat.toUpperCase().includes(q)
  );

  const grouped: Record<string, typeof ASSETS> = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  visible.forEach(a => { (grouped[a.cat] ||= []).push(a); });

  const toggleCat = (c: string) => setOpenCats(s => ({ ...s, [c]: !s[c] }));
  const marketLocked = playerLevel < marketUnlockLevel(activeMarket);
  const watchInMarket = inMarket.filter(a => watchlist.includes(a.id));

  if (marketLocked) {
    return (
      <div className="section">
        <div className="market-locked-v8">
          <div className="ml-icon">🔒</div>
          <div className="ml-text">
            <div className="ml-t">{MARKET_LABELS[activeMarket]} Locked</div>
            <div className="ml-d">Reach Level {marketUnlockLevel(activeMarket)} to unlock</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="al-v8">
      {/* WATCHLIST — always visible at top */}
      <div className="al-section watch">
        <div className="al-section-head">
          <span>⭐ Watchlist</span>
          <span className="al-count">{watchInMarket.length}</span>
        </div>
        {watchInMarket.length === 0 ? (
          <div className="al-empty">Click ☆ on any asset to pin it here</div>
        ) : (
          watchInMarket.map(a => (
            <AssetRow key={a.id} a={a} eng={eng} nw={nw} active={active}
              playerLevel={playerLevel} setActive={setActive}
              watched={true} toggleWatch={toggleWatchlist} />
          ))
        )}
      </div>

      {/* BROWSE */}
      <div className="al-section">
        <div className="al-section-head">
          <span>{MARKET_LABELS[activeMarket]}</span>
          <span className="al-count">{inMarket.length}</span>
        </div>
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="al-search"
        />
        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat];
          if (!items || !items.length) return null;
          const open = openCats[cat] === true;
          return (
            <div key={cat} className="al-cat">
              <button className="al-cat-head" onClick={() => { toggleCat(cat); Audio.click(); }}>
                <span>{CATEGORY_LABELS[cat] || cat}</span>
                <span className="al-cat-count">{items.length}</span>
                <span className="al-chev">{open ? '▾' : '▸'}</span>
              </button>
              {open && items.map(a => (
                <AssetRow key={a.id} a={a} eng={eng} nw={nw} active={active}
                  playerLevel={playerLevel} setActive={setActive}
                  watched={watchlist.includes(a.id)} toggleWatch={toggleWatchlist} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetRow({ a, eng, nw, active, playerLevel, setActive, watched, toggleWatch }: any) {
  const ast = eng.state.assets[a.id];
  if (!ast) return null;
  const locked = a.minLevel > playerLevel;
  const chg = ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100;
  const chgClass = chg > 0 ? 'up' : chg < 0 ? 'dn' : 'flat';
  const prevHist = ast.history[ast.history.length - 2] || ast.lastPrice;
  const tick = ast.lastPrice > prevHist ? '▲' : ast.lastPrice < prevHist ? '▼' : '·';
  const tickClass = ast.lastPrice > prevHist ? 'up' : ast.lastPrice < prevHist ? 'dn' : 'flat';
  const sh = eng.player().holdings[a.id]?.shares || 0;
  const hpct = sh !== 0 && nw > 0 ? Math.min(100, Math.abs(sh) * ast.lastPrice / nw * 100) : 0;
  return (
    <div
      className={'asset-v8' + (active === a.id ? ' active' : '') + (locked ? ' locked' : '')}
      onClick={() => { if (locked) { Audio.click(); return; } setActive(a.id); Audio.click(); }}
      title={locked ? `Requires Level ${a.minLevel}` : ''}
    >
      <div className="av-top">
        <div className="av-left">
          <svg className="av-icon"><use href={`#${a.icon}`}/></svg>
          <div className="av-id">
            {a.id}
            {locked && <span className="av-lock">🔒L{a.minLevel}</span>}
          </div>
        </div>
        <div className={'av-price ' + tickClass}>{fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2)}</div>
      </div>
      <div className="av-meta">
        <span className="av-name">{a.name}</span>
        <span className={'av-chg ' + chgClass}>{tick} {fmtPct(chg)}</span>
      </div>
      {hpct > 0 && <div className="av-hold-bar" style={{ width: hpct + '%' }} />}
      <button
        className={'av-star' + (watched ? ' on' : '')}
        onClick={(e) => { e.stopPropagation(); toggleWatch(a.id); Audio.click(); }}
        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      >{watched ? '★' : '☆'}</button>
    </div>
  );
}
