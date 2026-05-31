import { fmt, fmtNum } from '../engine/helpers';
import { bestAsk, bestBid } from '../engine/orderbook';
import { useGame } from '../store/gameStore';

export function OrderBook() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const aid = eng.state.active;
  const ast = eng.state.assets[aid];
  const asks = ast.book.asks.slice(0, 10).slice().reverse();
  const bids = ast.book.bids.slice(0, 10);
  const maxQ = Math.max(1, ...ast.book.asks.slice(0, 10).map(o => o.qty), ...ast.book.bids.slice(0, 10).map(o => o.qty));
  const sp = bestAsk(ast.book) - bestBid(ast.book);
  const spPct = bestBid(ast.book) > 0 ? sp / bestBid(ast.book) * 100 : 0;

  return (
    <div className="section">
      <h3>{aid} Order Book</h3>
      <div className="ob">
        {asks.length === 0 ? (
          <div className="ob-row ask"><div className="p" style={{ gridColumn: '1/-1', color: 'var(--dim)', textAlign: 'center' }}>no asks</div></div>
        ) : asks.map(o => {
          const t = eng.state.traders[o.ownerId];
          return (
            <div key={o.id} className="ob-row ask">
              <div className="bar" style={{ width: o.qty / maxQ * 100 + '%' }} />
              <div className="p">{fmt(o.px, o.px < 10 ? 4 : 2)}</div>
              <div className="q">{fmtNum(o.qty)}</div>
              <div className="who">{t ? t.name.slice(0, 10) : ''}</div>
            </div>
          );
        })}
        <div className="ob-spread">
          <span className="last">{fmt(ast.lastPrice, ast.lastPrice < 10 ? 4 : 2)}</span>LAST
          <span className="sp">spread {isFinite(sp) ? fmt(sp, 4) : '—'} ({spPct.toFixed(2)}%)</span>
        </div>
        {bids.length === 0 ? (
          <div className="ob-row bid"><div className="p" style={{ gridColumn: '1/-1', color: 'var(--dim)', textAlign: 'center' }}>no bids</div></div>
        ) : bids.map(o => {
          const t = eng.state.traders[o.ownerId];
          return (
            <div key={o.id} className="ob-row bid">
              <div className="bar" style={{ width: o.qty / maxQ * 100 + '%' }} />
              <div className="p">{fmt(o.px, o.px < 10 ? 4 : 2)}</div>
              <div className="q">{fmtNum(o.qty)}</div>
              <div className="who">{t ? t.name.slice(0, 10) : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
