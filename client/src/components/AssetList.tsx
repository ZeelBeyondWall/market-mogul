import { useState } from 'react';
import { ASSETS, CATEGORY_LABELS, CATEGORY_ORDER } from '../../../shared/engine/constants';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

export function AssetList() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const setActive = useGame(s => s.setActive);
  const active = eng.state.active;
  const nw = eng.netWorth();
  const [query, setQuery] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    CATEGORY_ORDER.forEach(c => { o[c] = true; });
    return o;
  });

  const q = query.trim().toUpperCase();
  const visible = ASSETS.filter(a =>
    !q || a.id.includes(q) || a.name.toUpperCase().includes(q) || a.cat.toUpperCase().includes(q)
  );

  const grouped: Record<string, typeof ASSETS> = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  visible.forEach(a => { (grouped[a.cat] ||= []).push(a); });

  const toggleCat = (c: string) => setOpenCats(s => ({ ...s, [c]: !s[c] }));

  return (
    <div className="section">
      <h3>Markets <span className="badge">{ASSETS.length}</span></h3>
      <input
        type="text"
        placeholder={`Search ${ASSETS.length} symbols…`}
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="asset-search"
      />
      {CATEGORY_ORDER.map(cat => {
        const items = grouped[cat];
        if (!items.length) return null;
        const open = openCats[cat] !== false;
        return (
          <div key={cat} className="cat-group">
            <div className="cat-header" onClick={() => { toggleCat(cat); Audio.click(); }}>
              <span>{CATEGORY_LABELS[cat] || cat}</span>
              <span className="cat-count">{items.length}</span>
              <span className="cat-chevron">{open ? '▾' : '▸'}</span>
            </div>
            {open && items.map(a => {
              const ast = eng.state.assets[a.id];
              if (!ast) return null;
              const chg = ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100;
              const chgClass = chg > 0 ? 'up' : chg < 0 ? 'dn' : 'flat';
              const prevHist = ast.history[ast.history.length - 2] || ast.lastPrice;
              const tick = ast.lastPrice > prevHist ? '▲' : ast.lastPrice < prevHist ? '▼' : '·';
              const tickClass = ast.lastPrice > prevHist ? 'up' : ast.lastPrice < prevHist ? 'dn' : 'flat';
              const sh = eng.player().holdings[a.id]?.shares || 0;
              const hpct = sh !== 0 && nw > 0 ? Math.min(100, Math.abs(sh) * ast.lastPrice / nw * 100) : 0;
              return (
                <div
                  key={a.id}
                  className={'asset' + (active === a.id ? ' active' : '')}
                  onClick={() => { setActive(a.id); Audio.click(); }}
                >
                  <div className="asset-top">
                    <div className="asset-left">
                      <svg className="asset-icon"><use href={`#${a.icon}`}/></svg>
                      <div className="sym">{a.id}</div>
                    </div>
                    <div className={'price ' + tickClass}>{fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2)}</div>
                  </div>
                  <div className="meta">
                    <span>{a.name}</span>
                    <span className={'chg ' + chgClass}>{tick} {fmtPct(chg)}</span>
                  </div>
                  <div className="holdings-bar" style={{ width: hpct + '%' }} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
