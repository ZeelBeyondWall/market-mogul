import { useGame } from '../store/gameStore';
import { initAudio, resumeAudio } from '../audio/audio';
import { fmt } from '../../../shared/engine/helpers';
import { showModal } from './Modal';

export function Splash() {
  const shown = useGame(s => s.splashShown);
  const hide = useGame(s => s.hideSplash);
  const eng = useGame(s => s.engine);
  const muted = useGame(s => s.muted);
  const nw = eng.netWorth();
  const isReturning = nw > 100.01 || eng.state.events.length > 0;

  const onEnter = () => {
    initAudio(muted);
    resumeAudio();
    hide();
    if (!isReturning) {
      setTimeout(() => showModal('💼 Welcome to MarketVerseX',
        'You start with <b>$1,000</b> alongside <b>10,000 AI traders</b> — most are flawed humans (YOLO, FOMO, paper hands, perma-bulls/bears, gamblers). A few are smart (value, trend, MM).<br/><br/>• <b style="color:var(--green)">BUY</b> opens/extends long · <b style="color:var(--red)">SELL</b> opens/extends short · MAX uses your full buying power<br/>• Whole shares only — grow cash to afford pricier tickers<br/>• <b>Positions</b> tab → CUT to close any position. Set <b>SL/TP</b> per position.<br/>• Bots evolve personalities — wins make bolder, losses make paper-handed/vengeful<br/>• Real order book — every price is a real trade<br/><br/>Climb the leaderboard.',
      ), 600);
    }
  };

  return (
    <div id="splash" className={shown ? 'hide' : ''}>
      <div className="bg-grid" />
      <div className="splash-logo">
        <svg className="bigLogo"><use href="#logoFull" /></svg>
        <h1>MARKETVERSEX</h1>
        <div className="sub">Live Order Book · 500 AI Traders · Real Bid/Ask</div>
        <div className="features">
          <span><span className="dot"/>Real Matching Engine</span>
          <span><span className="dot"/>500 AI Competitors</span>
          <span><span className="dot"/>SL/TP + Positions</span>
          <span><span className="dot"/>Personalities Evolve</span>
        </div>
        <button id="enterBtn" onClick={onEnter}>ENTER MARKET</button>
        <div className="savedNote">{isReturning ? `💾 Save loaded — Net Worth: ${fmt(nw)}` : ''}</div>
      </div>
    </div>
  );
}
