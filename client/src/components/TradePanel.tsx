import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { roundShares, fmt, fmtNum, fmtPct } from '../../../shared/engine/helpers';
import { send } from '../net/wsClient';
import { TRADE_FEE_RATE } from '../../../shared/engine/matching';
import { Audio } from '../audio/audio';

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
    // v9.2: new longs limited by DISPLAY cash (short proceeds are earmarked to
    // buy back, not free to spend) so buying power matches the shown cash.
    let cash = Math.max(0, eng.displayCash()), qty = 0;
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
  // v9.2: opening a short stakes qty×price (like a buy), so cap by display cash.
  const px = ast.lastPrice || 0.01;
  const limit = Math.floor(Math.max(0, eng.displayCash()) / px);
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
  useGame(s => s.dataTick);
  const orderType = useGame(s => s.orderType);
  const setOrderType = useGame(s => s.setOrderType);
  const aid = eng.state.active;
  const ast = eng.state.assets[aid];
  const hold = eng.player().holdings[aid];
  const shortAllowed = true; // v8.10: shorting allowed on ALL markets (user choice)
  const [qty, setQty] = useState(1);
  const [limitPx, setLimitPx] = useState('');
  const slRef = useRef<HTMLInputElement>(null);
  const tpRef = useRef<HTMLInputElement>(null);

  // Mobile drawer states
  const [orderSheetMode, setOrderSheetMode] = useState<'buy' | 'short' | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 820);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sheet on asset change
  useEffect(() => {
    setOrderSheetMode(null);
  }, [aid]);

  // Reset qty to 1 when sheet opens
  useEffect(() => {
    if (orderSheetMode) {
      setQty(1);
    }
  }, [orderSheetMode]);

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

  // v8.9: helpful reason text — distinguish "no liquidity" (empty book) from
  // "not enough cash". An empty book can't fill at ANY cash level.
  const hasAsks = ast.book.asks.length > 0;
  const hasBids = ast.book.bids.length > 0;
  const cashShort = Math.max(0, ast.lastPrice - eng.player().cash);
  const buyReason = buyMax === 0
    ? (isShort ? 'Already flat'
       : !hasAsks ? 'No sellers yet — building liquidity'
       : cashShort > 0 ? `Need $${cashShort.toFixed(0)} more cash`
       : 'No sellers at your price')
    : null;
  const sellReason = shortMax === 0
    ? (isFlat
        ? (!shortAllowed ? 'Nothing to sell — BUY first'
           : !hasBids ? 'No buyers yet — building liquidity'
           : `Need $${Math.max(0, ast.lastPrice * 0.5 - eng.player().cash).toFixed(0)} more for margin`)
        : 'Nothing to sell')
    : null;

  // v9.7 mobile layout switch
  if (isMobile) {
    const activeMax = orderSheetMode === 'buy' ? buyMax : shortMax;
    const activeReason = orderSheetMode === 'buy' ? buyReason : sellReason;
    const activeCost = orderSheetMode === 'buy' 
      ? (isLimit ? lpx * qty : modeCost(eng, aid, 'buy', qty))
      : (isLimit ? lpx * qty : modeCost(eng, aid, 'short', qty));

    const handleSetQty = (value: number) => {
      const clamped = Math.max(1, Math.min(value, activeMax || 1));
      setQty(clamped);
    };

    const confirmBtnText = activeMax <= 0 && activeReason
      ? activeReason
      : `Confirm ${orderSheetMode === 'buy' ? (isShort ? 'Cover' : 'Buy') : (isLong ? 'Sell' : 'Short')}`;

    return (
      <div className="mobile-trade-panel">
        {/* Compact Sticky Bottom Bar */}
        <div className="mobile-bottom-bar">
          {/* Position summary card (if not flat) */}
          {!isFlat && (
            <div className="mobile-pos-card" onClick={(e) => {
              if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                useGame.getState().setMobileView('panel');
                Audio.click();
              }
            }}>
              <div className="pos-info">
                <span className={`pos-tag ${posClass}`}>{hold.shares > 0 ? 'LONG' : 'SHORT'}</span>
                <span className="pos-shares"><b>{fmtNum(Math.abs(hold.shares))}</b> sh</span>
                <span className="pos-avg">avg {fmt(hold.avgCost, hold.avgCost < 10 ? 3 : 2)}</span>
              </div>
              <div className="pos-pl-section">
                <span className={`pos-pl-val ${plLong >= 0 ? 'up' : 'dn'}`}>
                  {plLong >= 0 ? '+' : ''}{fmt(plLong)} ({fmtPct(hold.avgCost > 0 ? (plLong / (hold.avgCost * Math.abs(hold.shares))) * 100 : 0)})
                </span>
              </div>
              <button 
                className="pos-quick-close-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  send({ type: 'close', payload: { aid } });
                  Audio.click();
                }}
              >
                CLOSE
              </button>
            </div>
          )}

          {/* Quick Action buttons */}
          <div className="mobile-action-buttons">
            <button className="mobile-action-btn buy" onClick={() => { setOrderSheetMode('buy'); Audio.click(); }}>
              <span className="btn-title">{isShort ? 'COVER' : 'BUY'}</span>
              <span className="btn-sub">{buyReason || `Max ${fmtNum(buyMax)}sh`}</span>
            </button>
            <button className="mobile-action-btn sell" onClick={() => { setOrderSheetMode('short'); Audio.click(); }}>
              <span className="btn-title">{isLong ? 'SELL' : 'SHORT'}</span>
              <span className="btn-sub">{sellReason || `Max ${fmtNum(shortMax)}sh`}</span>
            </button>
          </div>
        </div>

        {/* Drawer overlay / bottom-sheet */}
        {orderSheetMode && (
          <div className="mobile-order-drawer-backdrop" onClick={() => setOrderSheetMode(null)}>
            <div className="mobile-order-drawer" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="mod-header">
                <div className="mod-title">
                  <span className={`mod-side-tag ${orderSheetMode}`}>{orderSheetMode === 'buy' ? (isShort ? 'COVER' : 'BUY') : (isLong ? 'SELL' : 'SHORT')}</span>
                  <span className="mod-asset-id">{aid}</span>
                </div>
                <div className="mod-cash">
                  Cash: <b>{fmt(eng.player().cash)}</b>
                </div>
                <button className="mod-close" onClick={() => setOrderSheetMode(null)}>×</button>
              </div>

              {/* Form fields */}
              <div className="mod-body">
                {/* Order Type Selector */}
                <div className="mod-row">
                  <label className="mod-label">Order Type</label>
                  <div className="tb-ordertype">
                    <button className={!isLimit ? 'on' : ''} onClick={() => { setOrderType('market'); Audio.click(); }}>MKT</button>
                    <button className={isLimit ? 'on' : ''} onClick={() => { setOrderType('limit'); Audio.click(); }}>LMT</button>
                  </div>
                </div>

                {/* Limit Price (if LMT) */}
                {isLimit && (
                  <div className="mod-row">
                    <label className="mod-label">Limit Price ($)</label>
                    <input 
                      type="number" 
                      value={limitPx} 
                      step="0.01" 
                      className="mod-input-field"
                      onChange={e => setLimitPx(e.target.value)} 
                    />
                  </div>
                )}

                {/* Quantity and presets */}
                <div className="mod-row qty-row">
                  <div className="qty-label-container">
                    <label className="mod-label">Quantity</label>
                    <span className="max-qty-label">Max: {fmtNum(activeMax)}sh</span>
                  </div>
                  <div className="qty-input-container">
                    <button type="button" className="qty-adj-btn" onClick={() => { handleSetQty(qty - 1); Audio.click(); }}>-</button>
                    <input 
                      type="number" 
                      value={qty} 
                      min={1} 
                      className="mod-input-field qty-input"
                      onChange={e => handleSetQty(+e.target.value || 0)} 
                    />
                    <button type="button" className="qty-adj-btn" onClick={() => { handleSetQty(qty + 1); Audio.click(); }}>+</button>
                  </div>
                  <div className="mod-presets">
                    <button type="button" className="preset-btn" onClick={() => { handleSetQty(Math.max(1, Math.floor(Math.max(1, activeMax) * 0.1))); Audio.click(); }}>10%</button>
                    <button type="button" className="preset-btn" onClick={() => { handleSetQty(Math.max(1, Math.floor(Math.max(1, activeMax) * 0.25))); Audio.click(); }}>25%</button>
                    <button type="button" className="preset-btn" onClick={() => { handleSetQty(Math.max(1, Math.floor(Math.max(1, activeMax) * 0.5))); Audio.click(); }}>50%</button>
                    <button type="button" className="preset-btn" onClick={() => { handleSetQty(Math.max(1, Math.floor(activeMax))); Audio.click(); }}>MAX</button>
                  </div>
                </div>

                {/* SL / TP targets */}
                <div className="mod-row sltp-row">
                  <div className="sltp-col">
                    <label className="mod-label">Stop Loss (SL %)</label>
                    <input type="number" ref={slRef} step="0.01" min="0" placeholder="None" className="mod-input-field compact" />
                  </div>
                  <div className="sltp-col">
                    <label className="mod-label">Take Profit (TP %)</label>
                    <input type="number" ref={tpRef} step="0.01" min="0" placeholder="None" className="mod-input-field compact" />
                  </div>
                </div>

                {/* Cost Summary */}
                <div className="mod-summary">
                  <div className="summary-item">
                    <span>Est. {orderSheetMode === 'buy' ? 'Cost' : 'Proceeds'}</span>
                    <b className="val">{fmt(activeCost < 0 ? 0 : activeCost)}</b>
                  </div>
                  <div className="summary-item">
                    <span>Fee (0.1%)</span>
                    <b className="val">{fmt((activeCost < 0 ? 0 : activeCost) * TRADE_FEE_RATE)}</b>
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  className={`mod-submit-btn ${orderSheetMode}`}
                  disabled={activeMax <= 0 || qty <= 0 || qty > activeMax || activeCost < 0}
                  onClick={() => {
                    submit(orderSheetMode, false);
                    setOrderSheetMode(null);
                  }}
                  title={activeReason || ''}
                >
                  {confirmBtnText}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
        <div className="tb-field qty-field">
          <label>QTY</label>
          <div className="tb-qty-input-wrap">
            <input type="number" value={qty} min={1} step={1} onChange={e => setQty(+e.target.value || 0)} />
            <div className="tb-qty-presets">
              <button type="button" className="preset-btn" onClick={() => setQty(Math.max(1, Math.floor(Math.max(1, buyMax) * 0.1)))}>10%</button>
              <button type="button" className="preset-btn" onClick={() => setQty(Math.max(1, Math.floor(Math.max(1, buyMax) * 0.25)))}>25%</button>
              <button type="button" className="preset-btn" onClick={() => setQty(Math.max(1, Math.floor(Math.max(1, buyMax) * 0.5)))}>50%</button>
              <button type="button" className="preset-btn" onClick={() => setQty(Math.max(1, Math.floor(buyMax)))}>MAX</button>
            </div>
          </div>
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
        <div className="tb-pos-item"><span className="l">FEE</span><span className="v fee">{fmt(Math.max(bCost, sRev) * TRADE_FEE_RATE)}</span></div>
      </div>
    </div>
  );
}
