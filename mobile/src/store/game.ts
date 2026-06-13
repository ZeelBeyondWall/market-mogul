import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { TFKey } from '../../../shared/engine/types';

// Hermes exposes performance.now(), but guard in case a runtime doesn't —
// the Engine constructor calls it. Must run before `new Engine()`.
if (typeof (globalThis as any).performance === 'undefined') {
  (globalThis as any).performance = { now: () => Date.now() };
}
// eslint-disable-next-line import/first
import { Engine } from '../../../shared/engine/engine';

export type Toast = { msg: string; kind: 'ok' | 'err' | 'info' } | null;

interface GameState {
  engine: Engine;
  session: Session | null;
  connected: boolean;
  dataTick: number;            // bumped on every snapshot/tick → drives re-render
  activeTF: TFKey;
  toast: Toast;
  setSession: (s: Session | null) => void;
  setConnected: (v: boolean) => void;
  bumpData: () => void;
  setActiveTF: (tf: TFKey) => void;
  pushToast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
  clearToast: () => void;
}

export const useGame = create<GameState>((set) => ({
  engine: new Engine(),
  session: null,
  connected: false,
  dataTick: 0,
  activeTF: '5s',
  toast: null,
  setSession: (s) => set({ session: s }),
  setConnected: (v) => set({ connected: v }),
  bumpData: () => set((s) => ({ dataTick: s.dataTick + 1 })),
  setActiveTF: (tf) => set({ activeTF: tf }),
  pushToast: (msg, kind = 'info') => set({ toast: { msg, kind } }),
  clearToast: () => set({ toast: null }),
}));
