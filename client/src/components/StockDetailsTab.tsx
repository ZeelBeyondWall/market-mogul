import { useState } from 'react';
import { CATEGORY_LABELS } from '../../../shared/engine/constants';
import { fmt, fmtNum, fmtPct } from '../../../shared/engine/helpers';
import { useGame, getAssetDef } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { AssetIcon } from './AssetIcon';

function fmtBig(n: number): string {
  if (!isFinite(n) || n === 0) return '—';
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + 'K';
  return fmt(n);
}

export function StockDetailsTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const holders = useGame(s => s.activeHolders); // v9: live holders count for active asset
  const priceAlerts = useGame(s => s.priceAlerts);
  const addPriceAlert = useGame(s => s.addPriceAlert);
  const removePriceAlert = useGame(s => s.removePriceAlert);
  const [alertPx, setAlertPx] = useState('');
  const aid = eng.state.active;
  const a = getAssetDef(aid);
  const ast = eng.state.assets[aid];
  if (!a || !ast) return <div className="section"><div className="empty">No asset selected</div></div>;

  const dec = ast.lastPrice < 10 ? 4 : 2;
  const changeAbs = ast.lastPrice - ast.open;
  const changePct = ast.open > 0 ? (changeAbs / ast.open) * 100 : 0;
  const up = changeAbs >= 0;
  const marketCap = ast.lastPrice * a.float;

  // Per-stock news — filter global event log by assetIds tag.
  // The `!e.assetIds || length===0` branch handles legacy v2 events loaded from
  // disk that predate the assetIds tagging — treat them as market-wide.
  const newsForStock = eng.state.events
    .filter(e => !e.assetIds || e.assetIds.length === 0 || e.assetIds.includes(aid))
    .slice(0, 8);

  // Mini sparkline — last 40 history points. Guard against degenerate sizes.
  const hist = ast.history.slice(-40);
  let sparkPath = 'M0,50 L100,50';
  if (hist.length >= 2) {
    const min = Math.min(...hist), max = Math.max(...hist);
    const range = max - min || 1;
    sparkPath = hist.map((p, i) => {
      const x = (i / (hist.length - 1)) * 100;
      const y = 100 - ((p - min) / range) * 100;
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }

  return (
    <div className="section">
      <h3>Stock Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, padding: '4px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AssetIcon id={a.id} icon={a.icon} size={32} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{a.id} <span style={{ opacity: .6, fontWeight: 400 }}>{a.name}</span></div>
            <div style={{ fontSize: 11, opacity: .7 }}>{CATEGORY_LABELS[a.cat] || a.cat} · {a.desc}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(ast.lastPrice, dec)}</div>
          <div className={up ? 'up' : 'dn'} style={{ fontSize: 13, fontWeight: 600 }}>
            {(up ? '+' : '') + fmt(changeAbs, dec)} ({fmtPct(changePct)})
          </div>
        </div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 60, background: 'rgba(0,0,0,.2)', borderRadius: 4 }}>
          <path d={sparkPath} stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth="1.2" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="kv-grid">
          <KV label="Day High"     value={fmt(ast.hi, dec)} />
          <KV label="Day Low"      value={fmt(ast.lo, dec)} />
          <KV label="Open"         value={fmt(ast.open, dec)} />
          <KV label="Volume"       value={fmtNum(ast.volume)} />
          <KV label="Market Cap"   value={'$' + fmtBig(marketCap)} />
          <KV label="Float (Shares)" value={fmtBig(a.float)} />
          <KV label="Volatility"   value={(a.vol * 100).toFixed(2) + '%'} />
          <KV label="Dividend"     value={a.div > 0 ? (a.div * 100).toFixed(3) + '% / yr' : 'None'} />
          <KV label="Fair Value"   value={fmt(a.fairValue, dec)} />
          <KV label="Sector"       value={CATEGORY_LABELS[a.cat] || a.cat} />
          <KV label="Holders"      value={fmtNum(holders)} />
          <KV label="Unlock Lvl"   value={'L' + a.minLevel} />
        </div>

        {/* v9: price alerts for this asset */}
        <div className="pa-box">
          <div className="pa-title">🔔 Price Alerts</div>
          <div className="pa-add">
            <input
              type="number" className="pa-input" placeholder={fmt(ast.lastPrice, dec)} value={alertPx}
              onChange={e => setAlertPx(e.target.value)} step="0.01"
            />
            <button className="pa-btn" onClick={() => {
              const px = +alertPx; if (!px || px <= 0) return;
              addPriceAlert(aid, px, px >= ast.lastPrice ? 'above' : 'below');
              setAlertPx(''); Audio.click();
            }}>+ Add</button>
          </div>
          {priceAlerts.filter(al => al.aid === aid).map(al => (
            <div key={al.id} className="pa-row">
              <span>{al.dir === 'above' ? '↗' : '↘'} {al.dir} <b>{fmt(al.price, dec)}</b></span>
              <button className="pa-del" onClick={() => { removePriceAlert(al.id); Audio.click(); }}>✕</button>
            </div>
          ))}
          {priceAlerts.filter(al => al.aid === aid).length === 0 && (
            <div className="pa-empty">No alerts. Add a target price above.</div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: .8, marginBottom: 4 }}>Recent News</div>
          {newsForStock.length === 0 ? (
            <div className="empty" style={{ padding: 6, fontSize: 11 }}>No news for this stock yet…</div>
          ) : newsForStock.map((e, i) => {
            const elapsed = Math.floor((Date.now() - e.t) / 1000);
            const t = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm';
            return (
              <div key={i} className={'event ' + e.type} style={{ padding: '5px 8px', margin: '3px 0' }}>
                <div className="t" style={{ fontSize: 11 }}>{e.title} <span className="tm" style={{ fontSize: 9 }}>{t} ago</span></div>
                <div className="d" style={{ fontSize: 10 }}>{e.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <span className="kv-l">{label}</span>
      <span className="kv-v">{value}</span>
    </div>
  );
}
