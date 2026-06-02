import { fmt, fmtNum } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';

function ago(ts: number): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function dur(a: number, b: number): string {
  if (!a || !b) return '—';
  const s = Math.floor((b - a) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

export function TradeHistoryTab() {
  useGame(s => s.dataTick);
  const trades = useGame(s => s.recentTrades);

  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="section">
      <h3>Trade History <span className="badge">{trades.length}</span></h3>

      {trades.length === 0 ? (
        <div className="empty">No closed trades yet.<br />Open a position and close it — your history appears here.</div>
      ) : (
        <>
          <div className="th-summary">
            <div><span className="l">Closed</span><span className="v">{trades.length}</span></div>
            <div><span className="l">Wins</span><span className="v up">{wins}</span></div>
            <div><span className="l">Losses</span><span className="v dn">{losses}</span></div>
            <div><span className="l">Realized</span><span className={'v ' + (totalPnl >= 0 ? 'up' : 'dn')}>{(totalPnl >= 0 ? '+' : '') + fmt(totalPnl)}</span></div>
          </div>

          <div className="th-list">
            {trades.map((t, i) => {
              const win = t.pnl >= 0;
              const dec = t.entryPx < 10 ? 3 : 2;
              const pct = t.entryPx > 0
                ? (t.side === 'long' ? (t.exitPx - t.entryPx) / t.entryPx : (t.entryPx - t.exitPx) / t.entryPx) * 100
                : 0;
              return (
                <div key={`${t.assetId}-${t.entryTs}-${t.exitTs}-${i}`} className={'th-row ' + (win ? 'win' : 'loss')}>
                  <div className="th-main">
                    <div className="th-sym">
                      {t.assetId}
                      <span className={'th-side ' + t.side}>{t.side === 'long' ? 'LONG' : 'SHORT'}</span>
                    </div>
                    <div className="th-detail">
                      {fmtNum(t.qty)} sh · {fmt(t.entryPx, dec)} → {fmt(t.exitPx, dec)} · held {dur(t.entryTs, t.exitTs)}
                    </div>
                  </div>
                  <div className="th-pnl">
                    <div className={'th-pnl-v ' + (win ? 'up' : 'dn')}>{(win ? '+' : '') + fmt(t.pnl)}</div>
                    <div className={'th-pnl-pct ' + (win ? 'up' : 'dn')}>{(pct >= 0 ? '+' : '') + pct.toFixed(2)}%</div>
                    <div className="th-time">{ago(t.exitTs)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
