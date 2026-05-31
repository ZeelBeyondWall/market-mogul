import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { roundShares, fmt, fmtNum } from '../../../shared/engine/helpers';
import { showModal } from './Modal';
import { send } from '../net/wsClient';

type Mode = 'buy' | 'short';

// v7.2: Trade actions now context-aware. Three distinct intents shown by state:
//
//   NO POSITION:    [BUY (long)]  [SHORT (advanced — owes shares back)]
//   LONG POSITION:  [BUY MORE]    [CLOSE LONG (sell)]
//   SHORT POSITION: [CLOSE SHORT (buy back)]  [ADD TO SHORT (risky)]
//
// Eliminates the "I sold and my cash went UP" confusion — now SHORT is
// explicit + warned, and CLOSE is always labeled as exit not sell.

function modeMaxQty(eng: any, aid: string, mode: Mode): number {
  const book = eng.state.assets[aid].book;
  const hold = eng.player().holdings[aid];
  const ast = eng.state.assets[aid];
  if (mode === 'buy') {
    if (hold.shares < 0) return Math.abs(hold.shares); // covering short — max = position size
    let cash = eng.player().cash, qty = 0;
    for (const o of book.asks) {
      const aff = Math.floor(cash / o.px);
      const fq = Math.min(o.qty, aff);
      if (fq <= 0) break;
      qty += fq; cash -= fq * o.px;
    }
    return roundShares(qty);
  }
  // mode === 'short'
  if (hold.shares > 0) return hold.shares; // closing long — max = position size
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
  const beginnerMode = useGame(s => s.beginnerMode);
  const aid = eng.state.active;
  const ast = eng.state.assets[aid];
  const hold = eng.player().holdings[aid];
  const [qty, setQty] = useState(1);
  const [limitPx, setLimitPx] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(!beginnerMode);
  const slRef = useRef<HTMLInputElement>(null);
  const tpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orderType === 'limit' && !limitPx) setLimitPx(ast.lastPrice.toFixed(ast.lastPrice < 10 ? 4 : 2));
  }, [orderType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position state — drives button labels + warnings.
  const isLong  = hold.shares > 0;
  const isShort = hold.shares < 0;
  const isFlat  = hold.shares === 0;

  const submit = async (mode: Mode, useMax: boolean) => {
    // Opening a brand-new short → require explicit confirmation (UX safety).
    if (mode === 'short' && isFlat) {
      const body =
        '<b>You are about to SELL SHORT.</b><br><br>' +
        'You do not own this asset. The engine borrows shares for you.<br><br>' +
        '• Your CASH will <b>INCREASE</b> by the sale amount<br>' +
        '• You will <b>OWE</b> the shares back<br>' +
        '• You profit if price <b>DROPS</b>; lose if it RISES<br>' +
        '• Risk is UNLIMITED if price rockets — set a stop loss!<br><br>' +
        'Continue?';
      const ok = await showModal('⚠ OPEN SHORT POSITION', body, true);
      if (!ok) return;
    }
    const q = useMax ? modeMaxQty(eng, aid, mode) : qty;
    if (q <= 0) return;
    const lpx = +limitPx || ast.lastPrice;
    const slPct = +(slRef.current?.value || 0) || undefined;
    const tpPct = +(tpRef.current?.value || 0) || undefined;
    send({
      type: 'order',
      payload: {
        aid,
        side: mode === 'buy' ? 'buy' : 'sell',
        qty: q,
        orderType,
        limitPx: lpx,
        slPct, tpPct,
      },
    });
  };

  const buyMax   = modeMaxQty(eng, aid, 'buy');
  const shortMax = modeMaxQty(eng, aid, 'short');
  const isLimit  = orderType === 'limit';
  const lpx      = +limitPx || ast.lastPrice;

  const bq = Math.max(0, Math.min(qty, buyMax));
  const bCost = isLimit ? lpx * bq : modeCost(eng, aid, 'buy', bq);
  const bMaxCost = isLimit ? lpx * buyMax : modeCost(eng, aid, 'buy', buyMax);
  const sq = Math.max(0, Math.min(qty, shortMax));
  const sRev = isLimit ? lpx * sq : modeCost(eng, aid, 'short', sq);
  const sMaxRev = isLimit ? lpx * shortMax : modeCost(eng, aid, 'short', shortMax);

  const plLong = isLong
    ? hold.shares * (ast.lastPrice - hold.avgCost)
    : isShort ? (-hold.shares) * (hold.avgCost - ast.lastPrice) : 0;
  const posClass = isLong ? 'up' : isShort ? 'dn' : 'flat';

  // --- Button label rules ---
  // BUY button:
  //   FLAT  → "BUY"             (open long)
  //   LONG  → "BUY MORE"        (add to long)
  //   SHORT → "CLOSE SHORT"     (cover — pay cash, receive shares to flatten)
  // SHORT button:
  //   FLAT  → "OPEN SHORT" (red warn)
  //   LONG  → "CLOSE LONG"      (sell — flatten)
  //   SHORT → "ADD TO SHORT" (red warn)
  const buyLabel    = isShort ? 'CLOSE SHORT' : isLong ? 'BUY MORE' : 'BUY';
  const sellLabel   = isLong ? 'CLOSE LONG' : isShort ? 'ADD TO SHORT' : 'OPEN SHORT';
  const sellIsRisky = isFlat || isShort;

  return (
    <div className="trade">
      {beginnerMode && isFlat && (
        <div className="trade-hint">
          💡 <b>BUY</b> = bet price goes UP. <b>OPEN SHORT</b> = bet it goes DOWN (advanced).
        </div>
      )}
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

      {/* v7.2: SL/TP moved under "Advanced" toggle in beginner mode */}
      {beginnerMode ? (
        <button className="trade-advanced-toggle" onClick={() => setShowAdvanced(v => !v)}>
          {showAdvanced ? '▾ Hide' : '▸ Show'} Stop Loss / Take Profit
        </button>
      ) : null}
      {(showAdvanced || !beginnerMode) && (
        <div className="trade-row sltp-row">
          <label title="Auto-close if loss reaches this %">SL %</label>
          <input type="number" className="limit-price" ref={slRef} step="0.01" min="0" placeholder="e.g. 2" />
          <label title="Auto-close if gain reaches this %">TP %</label>
          <input type="number" className="limit-price" ref={tpRef} step="0.01" min="0" placeholder="e.g. 5" />
        </div>
      )}

      {/* BUY side */}
      <div className="dbl-btn buy">
        <button
          className="a"
          disabled={bq <= 0 || bCost < 0}
          onClick={() => submit('buy', false)}
          title={isShort ? 'Buy back shares to flatten short' : isLong ? 'Add to long position' : 'Open long — profit if price rises'}
        >
          <span>{buyLabel} {fmt(bCost < 0 ? 0 : bCost)}</span>
          <small>{fmtNum(bq)} sh</small>
        </button>
        <button className="b" disabled={buyMax <= 0} onClick={() => submit('buy', true)}>
          <span>MAX {fmt(bMaxCost < 0 ? 0 : bMaxCost)}</span>
          <small>{fmtNum(buyMax)} sh</small>
        </button>
      </div>

      {/* SELL / SHORT side */}
      <div className={'dbl-btn sell' + (sellIsRisky ? ' risky' : '')}>
        <button
          className="a"
          disabled={sq <= 0 || sRev < 0}
          onClick={() => submit('short', false)}
          title={isLong ? 'Sell shares to close your long' : isFlat ? '⚠ Opens a SHORT — you receive cash but owe shares back' : 'Add to short (risky)'}
        >
          <span>{sellLabel} {fmt(sRev < 0 ? 0 : sRev)}</span>
          <small>{fmtNum(sq)} sh{sellIsRisky ? ' ⚠' : ''}</small>
        </button>
        <button className="b" disabled={shortMax <= 0} onClick={() => submit('short', true)}>
          <span>MAX {fmt(sMaxRev < 0 ? 0 : sMaxRev)}</span>
          <small>{fmtNum(shortMax)} sh</small>
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
