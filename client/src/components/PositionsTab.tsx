import { ASSETS } from '../../../shared/engine/constants';
import { fmt, fmtNum, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { send } from '../net/wsClient';
import { AssetIcon } from './AssetIcon';

export function PositionsTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const setActive = useGame(s => s.setActive);

  const rows = ASSETS.flatMap(a => {
    const h = eng.player().holdings[a.id];
    if (!h || h.shares === 0) return [];
    const ast = eng.state.assets[a.id];
    const isLong = h.shares > 0;
    const qty = Math.abs(h.shares);
    // v9.2: short value shown like a long (stake + P&L) for a buy-style display.
    const val = eng.positionDisplayValue(a.id);
    const pl = isLong ? h.shares * (ast.lastPrice - h.avgCost) : qty * (h.avgCost - ast.lastPrice);
    const plPct = h.avgCost > 0 ? (pl / (h.avgCost * qty)) * 100 : 0;
    return [{ a, h, ast, isLong, qty, val, pl, plPct }];
  });

  const updateSLTP = (aid: string, key: 'slPct' | 'tpPct', val: string) => {
    const num = +val || 0;
    const h = eng.player().holdings[aid];
    if (h) h[key] = num; // optimistic
    send({ type: 'setSLTP', payload: { aid, [key]: num } as { aid: string; slPct?: number; tpPct?: number } });
  };

  const clearSLTP = (aid: string) => {
    const h = eng.player().holdings[aid];
    if (h) { h.slPct = 0; h.tpPct = 0; h.sl = 0; h.tp = 0; }
    send({ type: 'setSLTP', payload: { aid, slPct: 0, tpPct: 0 } });
    Audio.click();
  };

  // v9: asset allocation — value share per held asset (cash included as a slice).
  const cash = eng.player().cash;
  const palette = ['#6ea8ff', '#22c55e', '#f5b942', '#a76cf5', '#4dd0e1', '#ef4444', '#ff9f40', '#34d399'];
  const totalVal = rows.reduce((s, r) => s + r.val, 0) + Math.max(0, cash);
  const slices = [
    ...rows.map((r, i) => ({ id: r.a.id, val: r.val, color: palette[i % palette.length] })),
    { id: 'CASH', val: Math.max(0, cash), color: '#3a4a63' },
  ].filter(s => s.val > 0);

  // Build conic-gradient stops for the donut (guarded against totalVal=0).
  let stops = '#1a2438 0% 100%';
  if (totalVal > 0 && slices.length > 0) {
    let acc = 0;
    stops = slices.map(s => {
      const start = (acc / totalVal) * 100;
      acc += s.val;
      const end = (acc / totalVal) * 100;
      return `${s.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(', ');
  }

  return (
    <div className="section">
      <h3>Open Positions <span className="badge">{rows.length}</span></h3>

      {totalVal > 0 && (rows.length > 0) && (
        <div className="alloc">
          <div className="alloc-donut" style={{ background: `conic-gradient(${stops})` }}>
            <div className="alloc-hole">
              <span className="alloc-hole-l">Total</span>
              <span className="alloc-hole-v">{fmt(totalVal)}</span>
            </div>
          </div>
          <div className="alloc-legend">
            {slices.map(s => (
              <div key={s.id} className="alloc-leg-item">
                <span className="alloc-dot" style={{ background: s.color }} />
                <span className="alloc-leg-id">{s.id}</span>
                <span className="alloc-leg-pct">{((s.val / totalVal) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">No open positions. Click BUY or SELL.</div>
      ) : (
        <div>
          {rows.map(r => {
            const dec = r.h.avgCost < 10 ? 3 : 2;
            return (
              <div key={r.a.id} className="pos-row" onClick={(e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;
                setActive(r.a.id);
                useGame.getState().setMobileView('trade');
                Audio.click();
              }}>
                <AssetIcon id={r.a.id} icon={r.a.icon} size={20} />
                <div className="info">
                  <div className="sym">
                    {r.a.name}{' '}
                    <span className="tkr">{r.a.id}</span>{' '}
                    <span className={'tag ' + (r.isLong ? 'long' : 'short')}>{r.isLong ? 'LONG' : 'SHORT'}</span>
                    {eng.player().closing?.[r.a.id] && (
                      <span className="tag pending" style={{ background: 'var(--accent)', color: '#000' }}>⏳ PENDING</span>
                    )}
                  </div>
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
                  {eng.player().closing?.[r.a.id] ? (
                    <button
                      onClick={() => { send({ type: 'cancelClose', payload: { aid: r.a.id } }); Audio.click(); }}
                      style={{ background: '#3a2a0a', color: '#fbbf24', borderColor: '#fbbf24' }}
                    >CANCEL</button>
                  ) : (
                    <button onClick={() => { send({ type: 'close', payload: { aid: r.a.id } }); Audio.click(); }}>CUT</button>
                  )}
                </div>
                <div className="pos-sltp">
                  <label>SL %</label>
                  <input
                    type="number" className="sl" step="0.01" min="0" placeholder="e.g. 2"
                    defaultValue={r.h.slPct || ''}
                    onChange={e => updateSLTP(r.a.id, 'slPct', e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  <label>TP %</label>
                  <input
                    type="number" className="tp" step="0.01" min="0" placeholder="e.g. 5"
                    defaultValue={r.h.tpPct || ''}
                    onChange={e => updateSLTP(r.a.id, 'tpPct', e.target.value)}
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
