import { ASSETS } from '../../../shared/engine/constants';
import { fmt, fmtNum, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { send } from '../net/wsClient';

export function PositionsTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const setActive = useGame(s => s.setActive);

  const rows = ASSETS.flatMap(a => {
    const h = eng.player().holdings[a.id];
    if (!h || h.shares === 0) return [];
    const ast = eng.state.assets[a.id];
    const isLong = h.shares > 0;
    const qty = Math.abs(h.shares);
    const val = qty * ast.lastPrice;
    const pl = isLong ? h.shares * (ast.lastPrice - h.avgCost) : qty * (h.avgCost - ast.lastPrice);
    const plPct = h.avgCost > 0 ? (pl / (h.avgCost * qty)) * 100 : 0;
    return [{ a, h, ast, isLong, qty, val, pl, plPct }];
  });

  const updateSLTP = (aid: string, key: 'sl' | 'tp', val: string) => {
    const num = +val || 0;
    const h = eng.player().holdings[aid];
    if (h) h[key] = num; // optimistic
    send({ type: 'setSLTP', payload: { aid, [key]: num } as { aid: string; sl?: number; tp?: number } });
  };

  const clearSLTP = (aid: string) => {
    const h = eng.player().holdings[aid];
    if (h) { h.sl = 0; h.tp = 0; }
    send({ type: 'setSLTP', payload: { aid, sl: 0, tp: 0 } });
    Audio.click();
  };

  return (
    <div className="section">
      <h3>Open Positions <span className="badge">{rows.length}</span></h3>
      {rows.length === 0 ? (
        <div className="empty">No open positions. Click BUY or SELL.</div>
      ) : (
        <div>
          {rows.map(r => {
            const dec = r.h.avgCost < 10 ? 3 : 2;
            return (
              <div key={r.a.id} className="pos-row" onClick={(e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;
                setActive(r.a.id); Audio.click();
              }}>
                <svg><use href={`#${r.a.icon}`}/></svg>
                <div className="info">
                  <div className="sym">{r.a.id} <span className={'tag ' + (r.isLong ? 'long' : 'short')}>{r.isLong ? 'LONG' : 'SHORT'}</span></div>
                  <div className="stats">
                    <span>Qty <b>{fmtNum(r.qty)}</b></span>
                    <span>Avg <b>{fmt(r.h.avgCost, dec)}</b></span>
                    <span>Now <b>{fmt(r.ast.lastPrice, dec)}</b></span>
                    <span>Val <b>{fmt(r.val)}</b></span>
                  </div>
                </div>
                <div className="actions">
                  <div className={'pl ' + (r.pl >= 0 ? 'up' : 'dn')}>
                    {(r.pl >= 0 ? '+' : '') + fmt(r.pl)}<br/>
                    <small style={{ opacity: .7, fontSize: 9 }}>{fmtPct(r.plPct)}</small>
                  </div>
                  <button onClick={() => { send({ type: 'close', payload: { aid: r.a.id } }); Audio.click(); }}>CUT</button>
                </div>
                <div className="pos-sltp">
                  <label>SL</label>
                  <input
                    type="number" className="sl" step="0.01" placeholder="—" defaultValue={r.h.sl || ''}
                    onChange={e => updateSLTP(r.a.id, 'sl', e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  <label>TP</label>
                  <input
                    type="number" className="tp" step="0.01" placeholder="—" defaultValue={r.h.tp || ''}
                    onChange={e => updateSLTP(r.a.id, 'tp', e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  <button onClick={() => clearSLTP(r.a.id)} style={{ padding: '3px 8px', fontSize: 9 }}>CLR</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
