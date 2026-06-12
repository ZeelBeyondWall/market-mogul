import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';

// Small bull/bear SVG that flips based on player's net worth trend.
// Bull when up vs starting cash, bear when down. Idle bounce animation.
export function Mascot() {
  const eng = useGame(s => s.engine);
  useGame(s => s.dataTick);
  const reduceMotion = useGame(s => s.reduceMotion);
  const [mood, setMood] = useState<'bull' | 'bear' | 'flat'>('flat');

  useEffect(() => {
    const net = eng.netWorth();
    if (net > 110) setMood('bull');
    else if (net < 90) setMood('bear');
    else setMood('flat');
  }, [eng, eng.netWorth()]);

  const color = mood === 'bull' ? '#10b981' : mood === 'bear' ? '#f43f5e' : '#fbbf24';
  const img = mood === 'bull' ? 'mascot_bull' : mood === 'bear' ? 'mascot_bear' : 'mascot_neutral';
  const label = mood === 'bull' ? 'BULLISH' : mood === 'bear' ? 'BEARISH' : 'NEUTRAL';

  return (
    <div className={'mascot' + (reduceMotion ? ' no-bounce' : '')} title={label} style={{ '--mood': color } as React.CSSProperties}>
      <div className="mascot-face">
        <img src={`/assets/mascot/${img}.webp`} alt={label} draggable={false} style={{ width: '1.4em', height: '1.4em', objectFit: 'contain', display: 'block' }} />
      </div>
      <div className="mascot-label">{label}</div>
    </div>
  );
}
