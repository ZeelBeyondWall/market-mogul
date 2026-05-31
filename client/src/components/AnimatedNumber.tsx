import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';

interface Props {
  value: number;
  format: (n: number) => string;
  className?: string;
  ms?: number;
}

// Tween between consecutive `value`s over `ms` for satisfying counter feedback.
// Falls back to instant updates when reduceMotion is on.
export function AnimatedNumber({ value, format, className, ms = 350 }: Props) {
  const reduceMotion = useGame(s => s.reduceMotion);
  const [display, setDisplay] = useState(value);
  const startVal = useRef(value);
  const startT = useRef(performance.now());

  useEffect(() => {
    if (reduceMotion) { setDisplay(value); return; }
    startVal.current = display;
    startT.current = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startT.current) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = startVal.current + (value - startVal.current) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className={className}>{format(display)}</span>;
}
