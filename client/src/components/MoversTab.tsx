import { ASSETS, MARKET_LABELS } from '../../../shared/engine/constants';
import { fmt, fmtPct } from '../../../shared/engine/helpers';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

export function MoversTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const market = useGame(s => s.activeMarket);
  const setActive = useGame(s => s.setActive);
  const playerLevel = useGame(s => s.playerLevel);

  // Compute % change for every asset in active market.
  const ranked = ASSETS
    .filter(a => a.market === market)
    .map(a => {
      const ast = eng.state.assets[a.id];
      if (!ast) return null;
      const chg = ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100;
      return { a, ast, chg };
    })
    .filter(Boolean) as { a: typeof ASSETS[0]; ast: any; chg: number }[];

  const gainers = [...ranked].sort((a, b) => b.chg - a.chg).slice(0, 8);
  const losers = [...ranked].sort((a, b) => a.chg - b.chg).slice(0, 8);
  // Most active by volume.
  const mostActive = [...ranked].sort((a, b) => b.ast.volume - a.ast.volume).slice(0, 8);

  return (
    <div className="section">
      <h3>{MARKET_LABELS[market]} Movers</h3>

      <div className="movers-group"><div className="mg-title up">📈 TOP GAINERS</div>
        {gainers.map(r => <MoverRow key={r.a.id} r={r} setActive={setActive} playerLevel={playerLevel} />)}
      </div>
      <div className="movers-group"><div className="mg-title dn">📉 TOP LOSERS</div>
        {losers.map(r => <MoverRow key={r.a.id} r={r} setActive={setActive} playerLevel={playerLevel} />)}
      </div>
      <div className="movers-group"><div className="mg-title">🔥 MOST ACTIVE</div>
        {mostActive.map(r => <MoverRow key={r.a.id} r={r} setActive={setActive} playerLevel={playerLevel} showVol={true} />)}
      </div>
    </div>
  );
}

function MoverRow({ r, setActive, playerLevel, showVol = false }: any) {
  const locked = r.a.minLevel > playerLevel;
  const dec = r.ast.lastPrice < 10 ? 3 : 2;
  return (
    <div
      className={'mover-row' + (locked ? ' locked' : '')}
      onClick={() => {
        if (!locked) {
          setActive(r.a.id);
          useGame.getState().setMobileView('trade');
          Audio.click();
        }
      }}
    >
      <div className="mv-sym">
        <svg><use href={`#${r.a.icon}`}/></svg>
        <div>
          <div className="mv-id">{r.a.id}{locked && <span className="lock-tag"> 🔒L{r.a.minLevel}</span>}</div>
          <div className="mv-name">{r.a.name}</div>
        </div>
      </div>
      <div className="mv-px">{fmt(r.ast.lastPrice, dec)}</div>
      {showVol ? (
        <div className="mv-vol">{Math.floor(r.ast.volume).toLocaleString()}</div>
      ) : (
        <div className={'mv-chg ' + (r.chg >= 0 ? 'up' : 'dn')}>{fmtPct(r.chg)}</div>
      )}
    </div>
  );
}
