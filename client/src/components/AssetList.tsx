import { useState } from 'react';
import { ASSETS, CATEGORY_LABELS, CATEGORY_ORDER, MARKET_LABELS, MARKET_ORDER, marketUnlockLevel } from '../../../shared/engine/constants';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import type { Market } from '../../../shared/engine/types';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

export function AssetList() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const setActive = useGame(s => s.setActive);
  const activeMarket = useGame(s => s.activeMarket);
  const setActiveMarket = useGame(s => s.setActiveMarket);
  const watchlist = useGame(s => s.watchlist);
  const toggleWatchlist = useGame(s => s.toggleWatchlist);
  const playerLevel = useGame(s => s.playerLevel);
  const active = eng.state.active;
  const nw = eng.netWorth();
  const [query, setQuery] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    CATEGORY_ORDER.forEach(c => { o[c] = true; });
    return o;
  });

  const q = query.trim().toUpperCase();
  // Filter by market + search.
  const inMarket = ASSETS.filter(a => a.market === activeMarket);
  const visible = inMarket.filter(a =>
    !q || a.id.includes(q) || a.name.toUpperCase().includes(q) || a.cat.toUpperCase().includes(q)
  );

  const grouped: Record<string, typeof ASSETS> = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  visible.forEach(a => { (grouped[a.cat] ||= []).push(a); });

  const toggleCat = (c: string) => setOpenCats(s => ({ ...s, [c]: !s[c] }));

  const marketLocked = playerLevel < marketUnlockLevel(activeMarket);

  // Watchlist (current market only) shown as pinned group on top.
  const watchInMarket = inMarket.filter(a => watchlist.includes(a.id));

  return (
    <div className="section">
      <MarketSwitcher current={activeMarket} setMarket={setActiveMarket} playerLevel={playerLevel} />

      {marketLocked ? (
        <div className="market-locked">
          <div className="ml-icon">🔒</div>
          <div className="ml-text">
            <div className="ml-t">{MARKET_LABELS[activeMarket]} Locked</div>
            <div className="ml-d">Reach Level {marketUnlockLevel(activeMarket)} to unlock</div>
          </div>
        </div>
      ) : (
        <>
          <h3>{MARKET_LABELS[activeMarket]} <span className="badge">{inMarket.length}</span></h3>
          <input
            type="text"
            placeholder={`Search ${inMarket.length} ${activeMarket}…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="asset-search"
          />

          {watchInMarket.length > 0 && !q && (
            <div className="cat-group">
              <div className="cat-header"><span>⭐ Watchlist</span><span className="cat-count">{watchInMarket.length}</span></div>
              {watchInMarket.map(a => <AssetRow key={a.id} a={a} eng={eng} nw={nw} active={active} playerLevel={playerLevel} setActive={setActive} watched={true} toggleWatch={toggleWatchlist} />)}
            </div>
          )}

          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat];
            if (!items || !items.length) return null;
            const open = openCats[cat] !== false;
            return (
              <div key={cat} className="cat-group">
                <div className="cat-header" onClick={() => { toggleCat(cat); Audio.click(); }}>
                  <span>{CATEGORY_LABELS[cat] || cat}</span>
                  <span className="cat-count">{items.length}</span>
                  <span className="cat-chevron">{open ? '▾' : '▸'}</span>
                </div>
                {open && items.map(a => (
                  <AssetRow key={a.id} a={a} eng={eng} nw={nw} active={active} playerLevel={playerLevel} setActive={setActive} watched={watchlist.includes(a.id)} toggleWatch={toggleWatchlist} />
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function MarketSwitcher({ current, setMarket, playerLevel }: { current: Market; setMarket: (m: Market) => void; playerLevel: number }) {
  return (
    <div className="market-switcher">
      {MARKET_ORDER.map(m => {
        const lvl = marketUnlockLevel(m);
        const locked = playerLevel < lvl;
        return (
          <button
            key={m}
            className={'mkt-btn' + (current === m ? ' active' : '') + (locked ? ' locked' : '')}
            onClick={() => { if (!locked) { setMarket(m); Audio.click(); } }}
            title={locked ? `Unlocks at Level ${lvl}` : ''}
          >
            <span>{MARKET_LABELS[m]}</span>
            {locked && <span className="mkt-lock">🔒L{lvl}</span>}
          </button>
        );
      })}
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
      className={'asset' + (active === a.id ? ' active' : '') + (locked ? ' locked' : '')}
      onClick={() => {
        if (locked) { Audio.click(); return; }
        setActive(a.id); Audio.click();
      }}
      title={locked ? `Requires Level ${a.minLevel}` : ''}
    >
      <div className="asset-top">
        <div className="asset-left">
          <svg className="asset-icon"><use href={`#${a.icon}`}/></svg>
          <div className="sym">{a.id}</div>
        </div>
        <div className={'price ' + tickClass}>{fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2)}</div>
      </div>
      <div className="meta">
        <span>{a.name}{locked && <span className="lock-tag"> 🔒L{a.minLevel}</span>}</span>
        <span className={'chg ' + chgClass}>{tick} {fmtPct(chg)}</span>
      </div>
      <div className="holdings-bar" style={{ width: hpct + '%' }} />
      <button
        className={'watch-star' + (watched ? ' on' : '')}
        onClick={(e) => { e.stopPropagation(); toggleWatch(a.id); Audio.click(); }}
        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      >{watched ? '★' : '☆'}</button>
    </div>
  );
}
