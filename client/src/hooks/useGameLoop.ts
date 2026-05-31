import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { connect } from '../net/wsClient';

// Connects WS on mount + drives render-only RAF loop for chart smoothness.
// Engine is hydrated by snapshots/ticks coming from the server.
export function useGameLoop(): void {
  const engine = useGame.getState().engine;
  const notifyTick = useGame.getState().notifyTick;

  useEffect(() => {
    connect(engine);
    let raf = 0;
    let lastNotify = 0;
    const loop = (now: number) => {
      if (now - lastNotify > 33) {
        notifyTick();
        lastNotify = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, notifyTick]);
}
