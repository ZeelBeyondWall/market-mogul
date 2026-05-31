import { useEffect, useRef, useState } from 'react';
import { useGame, getAssetDef } from '../store/gameStore';
import { roundShares, fmt, fmtNum } from '../../../shared/engine/helpers';
import { send } from '../net/wsClient';

type Mode = 'buy' | 'short';

// v8.8: shorting is now PER-MARKET.
//   STOCKS  → no shorting. BUY to open/add long, SELL only to close/reduce
//             what you OWN (real cash-delivery behaviour).
//   CRYPTO/FOREX → full shorting. SELL opens/extends short, BUY covers.
// This kills the "SELL while flat = surprise negative holdings" confusion on
// stocks, while keeping the proper short concept where it makes sense.

function modeMaxQty(eng: any, aid: string, mode: Mode, shortAllowed: boolean): number {
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
  // mode === 'short' (the SELL side)
  const longPart = Math.max(0, hold.shares);
  if (longPart > 0) return longPart;     // close/reduce long — max = what you own
  if (!shortAllowed) return 0;           // STOCKS flat → nothing to sell
  // CRYPTO/FOREX: open short with 50% margin (matches server sellableQty)
  const px = ast.lastPrice || 0.01;
  const limit = Math.floor((eng.player().cash * 2) / px);
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
  const def = getAssetDef(aid);
  const shortAllowed = def?.market !== 'stocks'; // v8.8: only crypto + forex short
  const [qty, setQty] = useState(1);
  const [limitPx, setLimitPx] = useState('');
  const slRef = useRef<HTMLInputElement>(null);
  const tpRef = useRef<HTMLInputElement>(null);

  // FIX v7.3: re-sync limit to current asset's price on asset switch too.
  // Previously stale $180 from NEXA would carry over to e.g. an $80 stock,
  // and SELL Limit would rest in the book at $180 — confusing entries.
  useEffect(() => {
    if (orderType === 'limit') {
      setLimitPx(ast.lastPrice.toFixed(ast.lastPrice < 10 ? 4 : 2));
    }
  }, [orderType, aid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position state — drives button labels + warnings.
  const isLong  = hold.shares > 0;
  const isShort = hold.shares < 0;
  const isFlat  = hold.shares === 0;

  const submit = async (mode: Mode, useMax: boolean) => {
    // Always clamp to the legal max for this mode — prevents a stock SELL from
    // exceeding owned shares (which would otherwise open an unwanted short).
    const cap = modeMaxQty(eng, aid, mode, shortAllowed);
    const q = Math.min(useMax ? cap : qty, cap);
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

  const buyMax   = modeMaxQty(eng, aid, 'buy', shortAllowed);
  const shortMax = modeMaxQty(eng, aid, 'short', shortAllowed);
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

  const buyLabel  = isShort ? 'CLOSE SHORT' : isLong ? 'BUY MORE' : 'BUY';
  // SELL side label depends on market: stocks just SELL (close), crypto/forex short.
  const sellLabel = isLong
    ? 'SELL'
    : isShort ? 'ADD SHORT'
    : (shortAllowed ? 'SHORT' : 'SELL');

  // v7.4/v8.8: helpful reason text when a side is disabled.
  const buyReason = buyMax === 0
    ? (isShort ? 'Already flat' : `Need $${Math.max(0, ast.lastPrice - eng.player().cash).toFixed(0)} more cash`)
    : null;
  const sellReason = shortMax === 0
    ? (isFlat
        ? (shortAllowed
            ? `Need $${Math.max(0, ast.lastPrice * 0.5 - eng.player().cash).toFixed(0)} more for margin`
            : 'Nothing to sell — BUY first')
        : 'Nothing to sell')
    : null;

  // v8.2: HORIZONTAL trade bar docked under the chart (TradingView-style).
  return (
    <div className="tradebar">
      {/* LEFT: inputs */}
      <div className="tb-inputs">
        <div className="tb-ordertype">
          <button className={!isLimit ? 'on' : ''} onClick={() => setOrderType('market')}>MKT</button>
          <button className={isLimit ? 'on' : ''} onClick={() => setOrderType('limit')}>LMT</button>
        </div>
        {isLimit && (
          <div className="tb-field">
            <label>LIMIT $</label>
            <input type="number" value={limitPx} step="0.01" onChange={e => setLimitPx(e.target.value)} />
          </div>
        )}
        <div className="tb-field">
          <label>QTY</label>
          <input type="number" value={qty} min={1} step={1} onChange={e => setQty(+e.target.value || 0)} />
        </div>
        <div className="tb-field sl">
          <label>SL %</label>
          <input type="number" ref={slRef} step="0.01" min="0" placeholder="—" />
        </div>
        <div className="tb-field tp">
          <label>TP %</label>
          <input type="number" ref={tpRef} step="0.01" min="0" placeholder="—" />
        </div>
      </div>

      {/* CENTER: action buttons */}
      <div className="tb-actions">
        <button
          className="tb-btn buy"
          disabled={bq <= 0 || bCost < 0}
          onClick={() => submit('buy', false)}
          title={buyReason || ''}
        >
          <span className="tb-btn-label">{buyLabel}</span>
          <span className="tb-btn-sub">{buyReason || `${fmt(bCost < 0 ? 0 : bCost)} · ${fmtNum(bq)}sh`}</span>
        </button>
        <button className="tb-btn buy-max" disabled={buyMax <= 0} onClick={() => submit('buy', true)} title="Max you can afford">
          <span className="tb-btn-label">MAX</span>
          <span className="tb-btn-sub">{fmtNum(buyMax)}sh</span>
        </button>
        <button
          className="tb-btn sell"
          disabled={sq <= 0 || sRev < 0}
          onClick={() => submit('short', false)}
          title={sellReason || ''}
        >
          <span className="tb-btn-label">{sellLabel}</span>
          <span className="tb-btn-sub">{sellReason || `${fmt(sRev < 0 ? 0 : sRev)} · ${fmtNum(sq)}sh`}</span>
        </button>
        <button className="tb-btn sell-max" disabled={shortMax <= 0} onClick={() => submit('short', true)} title="Max with margin">
          <span className="tb-btn-label">MAX</span>
          <span className="tb-btn-sub">{fmtNum(shortMax)}sh</span>
        </button>
      </div>

      {/* RIGHT: position summary */}
      <div className="tb-pos">
        <div className="tb-pos-item"><span className="l">POS</span><span className={'v ' + posClass}>{(hold.shares > 0 ? '+' : '') + fmtNum(hold.shares)}</span></div>
        <div className="tb-pos-item"><span className="l">AVG</span><span className="v">{hold.avgCost > 0 ? fmt(hold.avgCost, hold.avgCost < 10 ? 3 : 2) : '—'}</span></div>
        <div className="tb-pos-item"><span className="l">P/L</span><span className={'v ' + (plLong >= 0 ? 'up' : 'dn')}>{(plLong >= 0 ? '+' : '') + fmt(plLong)}</span></div>
      </div>
    </div>
  );
}
