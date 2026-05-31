import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { roundShares, fmt, fmtNum } from '../../../shared/engine/helpers';
import { showModal } from './Modal';
import { send } from '../net/wsClient';

type Mode = 'buy' | 'short';

function modeMaxQty(eng: any, aid: string, mode: Mode): number {
  const book = eng.state.assets[aid].book;
  const hold = eng.player().holdings[aid];
  const ast = eng.state.assets[aid];
  if (mode === 'buy') {
    if (hold.shares < 0) return 0;
    let cash = eng.player().cash, qty = 0;
    for (const o of book.asks) {
      const aff = Math.floor(cash / o.px);
      const fq = Math.min(o.qty, aff);
      if (fq <= 0) break;
      qty += fq; cash -= fq * o.px;
    }
    return roundShares(qty);
  }
  if (hold.shares > 0) return 0;
  const px = ast.lastPrice || 0.01;
  const limit = Math.floor(eng.player().cash / px);
  let qty = 0;
  for (const o of book.bids) {
    const fq = Math.min(o.qty, limit - qty);
    if (fq <= 0) break;
    qty += fq;
    if (qty >= limit) break;
  }
  return roundShares(qty);
}

function modeCost(eng: any, aid: string, mode: Mode, qty: number): number {
  if (qty <= 0) return 0;
  const book = eng.state.assets[aid].book;
  let rem = qty, total = 0;
  const side = mode === 'buy' ? book.asks : book.bids;
  for (const o of side) {
    const fq = Math.min(rem, o.qty);
    if (fq <= 0) break;
    total += fq * o.px; rem -= fq;
    if (rem <= 0) break;
  }
  if (rem > 0) return -1;
  return total;
}

export function TradePanel() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const orderType = useGame(s => s.orderType);
  const setOrderType = useGame(s => s.setOrderType);
  const aid = eng.state.active;
  const ast = eng.state.assets[aid];
  const hold = eng.player().holdings[aid];
  const [qty, setQty] = useState(1);
  const [limitPx, setLimitPx] = useState('');
  const slRef = useRef<HTMLInputElement>(null);
  const tpRef = useRef<HTMLInputElement>(null);

  // sync limit price default to last when switching to limit
  useEffect(() => {
    if (orderType === 'limit' && !limitPx) setLimitPx(ast.lastPrice.toFixed(ast.lastPrice < 10 ? 4 : 2));
  }, [orderType]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (mode: Mode, useMax: boolean) => {
    const blocked = (mode === 'buy' && hold.shares < 0) || (mode === 'short' && hold.shares > 0);
    if (blocked) { await showModal('Blocked', mode === 'buy' ? 'Cover short via Positions CUT first' : 'Sell long via Positions CUT first'); return; }
    const q = useMax ? modeMaxQty(eng, aid, mode) : qty;
    if (q <= 0) return;
    const lpx = +limitPx || ast.lastPrice;
    const sl = +(slRef.current?.value || 0) || undefined;
    const tp = +(tpRef.current?.value || 0) || undefined;
    send({
      type: 'order',
      payload: {
        aid,
        side: mode === 'buy' ? 'buy' : 'sell',
        qty: q,
        orderType,
        limitPx: lpx,
        sl, tp,
      },
    });
  };

  const buyMax = modeMaxQty(eng, aid, 'buy');
  const shortMax = modeMaxQty(eng, aid, 'short');
  const buyAllowed = hold.shares >= 0;
  const sellAllowed = hold.shares <= 0;
  const isLimit = orderType === 'limit';
  const lpx = +limitPx || ast.lastPrice;

  const bq = Math.max(0, Math.min(qty, buyMax));
  const bCost = isLimit ? lpx * bq : modeCost(eng, aid, 'buy', bq);
  const bMaxCost = isLimit ? lpx * buyMax : modeCost(eng, aid, 'buy', buyMax);
  const sq = Math.max(0, Math.min(qty, shortMax));
  const sRev = isLimit ? lpx * sq : modeCost(eng, aid, 'short', sq);
  const sMaxRev = isLimit ? lpx * shortMax : modeCost(eng, aid, 'short', shortMax);

  const plLong = hold.shares >= 0
    ? hold.shares * (ast.lastPrice - hold.avgCost)
    : (-hold.shares) * (hold.avgCost - ast.lastPrice);
  const posClass = hold.shares > 0 ? 'up' : hold.shares < 0 ? 'dn' : 'flat';

  return (
    <div className="trade">
      <div className="order-type">
        <button className={!isLimit ? 'on' : ''} onClick={() => setOrderType('market')}>Market</button>
        <button className={isLimit ? 'on' : ''} onClick={() => setOrderType('limit')}>Limit</button>
      </div>
      {isLimit && (
        <div className="trade-row">
          <label>Limit $</label>
          <input type="number" className="limit-price" value={limitPx} step="0.01" onChange={e => setLimitPx(e.target.value)} />
        </div>
      )}
      <div className="trade-row">
        <label>Qty</label>
        <input type="number" className="qty" value={qty} min={1} step={1} onChange={e => setQty(+e.target.value || 0)} />
      </div>
      <div className="trade-row sltp-row">
        <label>SL $</label>
        <input type="number" className="limit-price" ref={slRef} step="0.01" placeholder="optional" />
        <label>TP $</label>
        <input type="number" className="limit-price" ref={tpRef} step="0.01" placeholder="optional" />
      </div>

      <div className="dbl-btn buy">
        <button className="a" disabled={!buyAllowed || bq <= 0 || bCost < 0} onClick={() => submit('buy', false)}>
          <span>BUY {fmt(bCost < 0 ? 0 : bCost)}</span><small>{fmtNum(bq)} sh</small>
        </button>
        <button className="b" disabled={!buyAllowed || buyMax <= 0} onClick={() => submit('buy', true)}>
          <span>MAX {fmt(bMaxCost < 0 ? 0 : bMaxCost)}</span><small>{fmtNum(buyMax)} sh</small>
        </button>
      </div>
      <div className="dbl-btn sell">
        <button className="a" disabled={!sellAllowed || sq <= 0 || sRev < 0} onClick={() => submit('short', false)}>
          <span>SELL {fmt(sRev < 0 ? 0 : sRev)}</span><small>{fmtNum(sq)} sh</small>
        </button>
        <button className="b" disabled={!sellAllowed || shortMax <= 0} onClick={() => submit('short', true)}>
          <span>MAX {fmt(sMaxRev < 0 ? 0 : sMaxRev)}</span><small>{fmtNum(shortMax)} sh</small>
        </button>
      </div>

      <div className="position-info">
        <div><span className="lbl">Position</span><span className={'v ' + posClass}>{(hold.shares > 0 ? '+' : '') + fmtNum(hold.shares)}</span></div>
        <div><span className="lbl">Avg Cost</span><span className="v">{hold.avgCost > 0 ? fmt(hold.avgCost, hold.avgCost < 10 ? 3 : 2) : '—'}</span></div>
        <div><span className="lbl">P/L</span><span className={'v ' + (plLong >= 0 ? 'up' : 'dn')}>{(plLong >= 0 ? '+' : '') + fmt(plLong)}</span></div>
        <div><span className="lbl">Value</span><span className="v">{fmt(Math.abs(hold.shares) * ast.lastPrice)}</span></div>
      </div>
    </div>
  );
}
