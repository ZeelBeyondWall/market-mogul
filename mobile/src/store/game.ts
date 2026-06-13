import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { TFKey, CandleSeries, GameState as EngineState } from '../engine/types';
import { TF_LIST } from '../engine/types';
import { ASSETS } from '../engine/constants';
import { makeBook } from '../engine/orderbook';
import { makeTrader } from '../engine/traders';

// Hermes exposes performance.now(), but guard in case a runtime doesn't —
// the Engine constructor calls it. Must run before `new Engine()`.
if (typeof (globalThis as any).performance === 'undefined') {
  (globalThis as any).performance = { now: () => Date.now() };
}
// eslint-disable-next-line import/first
import { Engine } from '../engine/engine';

function emptySeries(): Record<TFKey, CandleSeries> {
  const out = {} as Record<TFKey, CandleSeries>;
  for (const tf of TF_LIST) out[tf] = { candles: [], curCandle: null, candleStartT: 0 };
  return out;
}

// Lightweight state for the CLIENT: assets + a single player, NO bots and NO
// order-book seeding. The web client's Engine.freshState() spins up 10,000
// bots + seeds their books — fine on desktop, but it OOMs/crashes a phone at
// launch. The server is authoritative and streams everything via snapshots, so
// the mobile client only needs a shell to hydrate into.
function makeClientState(): EngineState {
  const player = makeTrader(0, true);
  const assets: any = {};
  for (const a of ASSETS) {
    assets[a.id] = {
      book: makeBook(),
      lastPrice: a.fairValue,
      open: a.fairValue,
      hi: a.fairValue,
      lo: a.fairValue,
      volume: 0,
      volumeHist: Array(120).fill(0),
      history: Array(120).fill(a.fairValue),
      series: emptySeries(),
      fv: a.fairValue,
      fvDelta: 0,
      fvEventTicks: 0,
      volMult: 1,
      volEventTicks: 0,
    };
  }
  return {
    traders: [player],
    assets,
    events: [],
    active: ASSETS[0]?.id || 'NEXA',
    orderId: 1,
    houseId: -1,
  } as EngineState;
}

export type Toast = { msg: string; kind: 'ok' | 'err' | 'info' } | null;

interface GameStore {
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

export const useGame = create<GameStore>((set) => ({
  engine: new Engine(makeClientState()),
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
