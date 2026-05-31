import { useEffect, useState } from 'react';
import { ASSETS } from '../../../shared/engine/constants';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';

export function Ticker() {
  const eng = useGame(s => s.engine);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 3000);
    return () => clearInterval(id);
  }, []);
  const items = ASSETS.map(a => {
    const ast = eng.state.assets[a.id];
    const chg = (ast.lastPrice - ast.open) / (ast.open || 1) * 100;
    const cls = chg >= 0 ? 'up' : 'dn';
    const tick = chg >= 0 ? '▲' : '▼';
    return (
      <span key={a.id}>
        <b className="sym">{a.id}</b>{' '}
        <b>{fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2)}</b>{' '}
        <b className={cls}>{tick} {fmtPct(chg)}</b>
      </span>
    );
  });
  return (
    <footer>
      <div className="ticker">{items}{items}</div>
    </footer>
  );
}
