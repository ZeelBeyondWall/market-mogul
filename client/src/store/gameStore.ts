import { create } from 'zustand';
import { Engine } from '../../../shared/engine/engine';
import { ASSETS } from '../../../shared/engine/constants';
import { setMuted } from '../audio/audio';

type ChartToggles = { chartLine: boolean; chartCandles: boolean; chartVol: boolean };

export interface UIPrefs extends ChartToggles {
  muted: boolean;
  orderType: 'market' | 'limit';
  activeTab: 'positions' | 'book' | 'bots' | 'news';
  botFilter: string;
  splashShown: boolean;
}

export interface LeaderboardEntry {
  id: number; name: string; net: number; strat: string; rekt: boolean;
}

interface GameStore extends UIPrefs {
  engine: Engine;
  tick: number;
  connected: boolean;
  leaderboard: LeaderboardEntry[];
  totalTraders: number;
  playerRank: number;
  setActive: (aid: string) => void;
  setOrderType: (t: 'market' | 'limit') => void;
  setActiveTab: (t: UIPrefs['activeTab']) => void;
  setBotFilter: (f: string) => void;
  toggleChartLayer: (k: keyof ChartToggles) => void;
  toggleMute: () => void;
  hideSplash: () => void;
  notifyTick: () => void;
  setConnected: (v: boolean) => void;
  setLeaderboard: (lb: LeaderboardEntry[], total: number, rank: number) => void;
}

const STORAGE = 'mm_ui_prefs_v1';
function defaultPrefs(): UIPrefs {
  return {
    muted: false, chartLine: true, chartCandles: true, chartVol: true,
    orderType: 'market', activeTab: 'positions', botFilter: 'all', splashShown: false,
  };
}
function loadPrefs(): UIPrefs {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultPrefs();
}
function savePrefs(p: UIPrefs): void {
  try { localStorage.setItem(STORAGE, JSON.stringify(p)); } catch { /* ignore */ }
}

const engine = new Engine(); // client mirror — hydrated from server snapshots
const initialPrefs = loadPrefs();

export const useGame = create<GameStore>((set, get) => ({
  engine,
  tick: 0,
  connected: false,
  leaderboard: [],
  totalTraders: 0,
  playerRank: 1,
  ...initialPrefs,
  setActive: (aid) => {
    engine.state.active = aid;
    set({ tick: get().tick + 1 });
    import('../net/wsClient').then(m => m.send({ type: 'setActive', payload: { aid } }));
  },
  setOrderType: (t) => { set({ orderType: t }); savePrefs({ ...get(), orderType: t } as UIPrefs); },
  setActiveTab: (t) => { set({ activeTab: t }); savePrefs({ ...get(), activeTab: t } as UIPrefs); },
  setBotFilter: (f) => { set({ botFilter: f }); savePrefs({ ...get(), botFilter: f } as UIPrefs); },
  toggleChartLayer: (k) => set(s => {
    const next = { ...s, [k]: !s[k] };
    savePrefs(next as UIPrefs);
    return next as GameStore;
  }),
  toggleMute: () => {
    const m = !get().muted; setMuted(m); set({ muted: m });
    savePrefs({ ...get(), muted: m } as UIPrefs);
  },
  hideSplash: () => set({ splashShown: true }),
  notifyTick: () => set(s => ({ tick: s.tick + 1 })),
  setConnected: (v) => set({ connected: v }),
  setLeaderboard: (lb, total, rank) => set({ leaderboard: lb, totalTraders: total, playerRank: rank }),
}));

export function getAssetDef(id: string) { return ASSETS.find(a => a.id === id)!; }
