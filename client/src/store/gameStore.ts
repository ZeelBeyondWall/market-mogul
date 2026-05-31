import { create } from 'zustand';
import { Engine } from '../../../shared/engine/engine';
import { ASSETS } from '../../../shared/engine/constants';
import type { TFKey } from '../../../shared/engine/types';
import { setMuted } from '../audio/audio';

export type Theme = 'game' | 'pro';

type ChartToggles = { chartLine: boolean; chartCandles: boolean; chartVol: boolean };

export interface UIPrefs extends ChartToggles {
  muted: boolean;
  orderType: 'market' | 'limit';
  activeTab: 'positions' | 'book' | 'bots' | 'news';
  botFilter: string;
  splashShown: boolean;
  theme: Theme;
  reduceMotion: boolean;
  showParticles: boolean;
  autoConfirm: boolean;
  activeTF: TFKey;
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
  settingsOpen: boolean;
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
  setTheme: (t: Theme) => void;
  setReduceMotion: (v: boolean) => void;
  setShowParticles: (v: boolean) => void;
  setAutoConfirm: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setActiveTF: (tf: TFKey) => void;
}

const STORAGE = 'mm_ui_prefs_v2';
const UI_KEYS: (keyof UIPrefs)[] = [
  'muted','chartLine','chartCandles','chartVol','orderType','activeTab','botFilter','splashShown',
  'theme','reduceMotion','showParticles','autoConfirm','activeTF',
];
function defaultPrefs(): UIPrefs {
  return {
    muted: false, chartLine: true, chartCandles: true, chartVol: true,
    orderType: 'market', activeTab: 'positions', botFilter: 'all', splashShown: false,
    theme: 'game', reduceMotion: false, showParticles: true, autoConfirm: false,
    activeTF: '5s',
  };
}
function loadPrefs(): UIPrefs {
  try {
    localStorage.removeItem('mm_ui_prefs_v1');
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      const clean: any = {};
      for (const k of UI_KEYS) if (parsed[k] !== undefined) clean[k] = parsed[k];
      return { ...defaultPrefs(), ...clean };
    }
  } catch { /* ignore */ }
  return defaultPrefs();
}
function savePrefs(s: Partial<UIPrefs>): void {
  try {
    const out: any = {};
    for (const k of UI_KEYS) if (s[k] !== undefined) out[k] = s[k];
    localStorage.setItem(STORAGE, JSON.stringify(out));
  } catch { /* ignore */ }
}

const engine = new Engine();
const initialPrefs = loadPrefs();

// Apply theme attribute to <body> so CSS can switch styles cleanly
function applyTheme(t: Theme) {
  if (typeof document !== 'undefined') document.body.dataset.theme = t;
}
applyTheme(initialPrefs.theme);

export const useGame = create<GameStore>((set, get) => {
  const persist = () => {
    const s = get();
    savePrefs(s);
  };
  return {
    engine,
    tick: 0,
    connected: false,
    leaderboard: [],
    totalTraders: 0,
    playerRank: 1,
    settingsOpen: false,
    ...initialPrefs,
    setActive: (aid) => {
      engine.state.active = aid;
      set({ tick: get().tick + 1 });
      import('../net/wsClient').then(m => m.send({ type: 'setActive', payload: { aid } }));
    },
    setOrderType: (t) => { set({ orderType: t }); persist(); },
    setActiveTab: (t) => { set({ activeTab: t }); persist(); },
    setBotFilter: (f) => { set({ botFilter: f }); persist(); },
    toggleChartLayer: (k) => { set(s => ({ ...s, [k]: !s[k] } as GameStore)); persist(); },
    toggleMute: () => {
      const m = !get().muted; setMuted(m); set({ muted: m }); persist();
    },
    hideSplash: () => { set({ splashShown: true }); persist(); },
    notifyTick: () => set(s => ({ tick: s.tick + 1 })),
    setConnected: (v) => set({ connected: v }),
    setLeaderboard: (lb, total, rank) => set({ leaderboard: lb, totalTraders: total, playerRank: rank }),
    setTheme: (t) => { applyTheme(t); set({ theme: t }); persist(); },
    setReduceMotion: (v) => { set({ reduceMotion: v }); persist(); },
    setShowParticles: (v) => { set({ showParticles: v }); persist(); },
    setAutoConfirm: (v) => { set({ autoConfirm: v }); persist(); },
    setSettingsOpen: (v) => set({ settingsOpen: v }),
    setActiveTF: (tf) => {
      set({ activeTF: tf });
      persist();
      import('../net/wsClient').then(m => m.send({ type: 'setTF', payload: { tf } }));
    },
  };
});

export function getAssetDef(id: string) { return ASSETS.find(a => a.id === id)!; }
