import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { connect } from '../net/wsClient';

// Connects WS on mount. Engine is hydrated by snapshots/ticks from the
// server. The old 30Hz notifyTick RAF is gone — Chart drives its own canvas
// repaint loop now, so nothing subscribes to `tick` for rendering anymore.
export function useGameLoop(): void {
  const session = useGame(s => s.session);
  const engine = useGame.getState().engine;

  useEffect(() => {
    if (!session) return;
    connect(engine);
  }, [engine, session]);
}
