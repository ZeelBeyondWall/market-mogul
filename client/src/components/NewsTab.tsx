import { useGame } from '../store/gameStore';

export function NewsTab() {
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const evs = eng.state.events.slice(0, 15);
  return (
    <div className="section">
      <h3>Market News</h3>
      {evs.length === 0 ? <div className="empty">Markets quiet…</div> : (
        <div>
          {evs.map((e, i) => {
            const elapsed = Math.floor((Date.now() - e.t) / 1000);
            const t = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm';
            return (
              <div key={i} className={'event ' + e.type}>
                <div className="t">{e.title} <span className="tm">{t} ago</span></div>
                <div className="d">{e.desc}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
