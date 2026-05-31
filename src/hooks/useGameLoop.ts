import { useEffect } from 'react';
import { useGame } from '../store/gameStore';

// Drives the engine at every frame. Bumps store's tick to trigger React re-render.
export function useGameLoop(): void {
  const engine = useGame.getState().engine;
  const notifyTick = useGame.getState().notifyTick;

  useEffect(() => {
    let raf = 0;
    let lastNotify = 0;
    const loop = (now: number) => {
      engine.step(now);
      // re-render at ~30fps to avoid spamming React
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
