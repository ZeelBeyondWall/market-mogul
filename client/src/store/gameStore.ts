import { create } from 'zustand';
import { Engine } from '../../../shared/engine/engine';
import { ASSETS } from '../../../shared/engine/constants';
import type { Market, MissionState, PlayerStats, TFKey, Trade } from '../../../shared/engine/types';
import { setMuted } from '../audio/audio';
import type { IndicatorId } from '../utils/indicators';
import type { Session } from '@supabase/supabase-js';

export type Theme = 'game' | 'pro' | 'purple' | 'green' | 'gold' | 'blue';

type ChartToggles = { chartLine: boolean; chartCandles: boolean; chartVol: boolean };

export type TabId = 'positions' | 'book' | 'bots' | 'news' | 'details' | 'stats' | 'missions' | 'movers' | 'help' | 'history';

// v9: notification center entries.
export type NotifKind = 'fill' | 'cancel' | 'sl' | 'tp' | 'level' | 'mission' | 'news' | 'alert' | 'info';
export interface NotifItem { id: number; ts: number; kind: NotifKind; title: string; body?: string; }

// v9: user price alerts (client-side, persisted).
export interface PriceAlert { id: number; aid: string; price: number; dir: 'above' | 'below'; }

export interface UIPrefs extends ChartToggles {
  muted: boolean;
  orderType: 'market' | 'limit';
  activeTab: TabId;
  activeMarket: Market;
  botFilter: string;
  splashShown: boolean;
  theme: Theme;
  reduceMotion: boolean;
  showParticles: boolean;
  autoConfirm: boolean;
  activeTF: TFKey;
  watchlist: string[]; // user-pinned asset ids
  beginnerMode: boolean; // hides advanced UI when true (v7.2)
  priceAlerts: PriceAlert[]; // v9: persisted price alerts
  activeIndicators: IndicatorId[]; // v10: chart indicators
  activeScreen: 'dashboard' | 'trading' | 'portfolio' | 'leaderboard' | 'store';
  equippedFrame: string;
  equippedBadge: string;
  equippedNameColor: string;
  ownedCosmetics: string[];
}

export interface LeaderboardEntry {
  id: number; name: string; net: number; strat: string; rekt: boolean; level: number; isPlayer: boolean; tier?: string; trades?: number; bornNet?: number;
}

interface GameStore extends UIPrefs {
  engine: Engine;
  tick: number;
  dataTick: number;
  connected: boolean;
  session: Session | null;
  leaderboard: LeaderboardEntry[];
  totalTraders: number;
  playerRank: number;
  settingsOpen: boolean;
  // Player extras pushed via snapshots.
  playerStats: PlayerStats | null;
  playerBonus: number;
  playerStreak: number;
  playerLevel: number;
  playerXp: number;
  xpAtCurrent: number;
  xpToNext: number;
  banner: string;
  maintenanceMode: boolean;
  tradingHalted: boolean;
  dailyMissions: MissionState[];
  weeklyMissions: MissionState[];
  // v8.1: transient toast for order results (success / failure)
  toast: { msg: string; kind: 'ok' | 'err' | 'info'; ts: number } | null;
  // v9: persistent notification center
  notifications: NotifItem[];
  notifUnread: number;
  notifOpen: boolean;
  // v9: trade history + holders
  recentTrades: Trade[];
  activeHolders: number;
  feedbackOpen: boolean;
  // v9 mobile: which single pane is visible on phones (desktop shows all 3).
  mobileView: 'market' | 'trade' | 'panel';
  setActive: (aid: string) => void;
  setOrderType: (t: 'market' | 'limit') => void;
  setActiveTab: (t: TabId) => void;
  setActiveMarket: (m: Market) => void;
  toggleWatchlist: (aid: string) => void;
  setBotFilter: (f: string) => void;
  setPlayerExtras: (s: { stats: PlayerStats; bonus: number; streak: number; daily: MissionState[]; weekly: MissionState[]; level: number; xp: number; xpAtCurrent: number; xpToNext: number }) => void;
  setServerFlags: (s: { banner: string; maintenanceMode: boolean; tradingHalted: boolean }) => void;
  pushToast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
  pushNotif: (kind: NotifKind, title: string, body?: string) => void;
  setNotifOpen: (v: boolean) => void;
  clearNotifs: () => void;
  setTradeData: (trades: Trade[], holders: number) => void;
  setFeedbackOpen: (v: boolean) => void;
  addPriceAlert: (aid: string, price: number, dir: 'above' | 'below') => void;
  removePriceAlert: (id: number) => void;
  setMobileView: (v: 'market' | 'trade' | 'panel') => void;
  setActiveScreen: (s: 'dashboard' | 'trading' | 'portfolio' | 'leaderboard' | 'store') => void;
  setEquippedFrame: (frame: string) => void;
  setEquippedBadge: (badge: string) => void;
  setEquippedNameColor: (color: string) => void;
  addOwnedCosmetic: (id: string) => void;
  toggleChartLayer: (k: keyof ChartToggles) => void;
  toggleMute: () => void;
  hideSplash: () => void;
  notifyDataTick: () => void;
  notifyTick: () => void;
  setConnected: (v: boolean) => void;
  setSession: (s: Session | null) => void;
  setLeaderboard: (lb: LeaderboardEntry[], total: number, rank: number) => void;
  setTheme: (t: Theme) => void;
  setReduceMotion: (v: boolean) => void;
  setShowParticles: (v: boolean) => void;
  setAutoConfirm: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setActiveTF: (tf: TFKey) => void;
  setBeginnerMode: (v: boolean) => void;
  toggleIndicator: (id: IndicatorId) => void;
}

const STORAGE = 'mm_ui_prefs_v3';
const UI_KEYS: (keyof UIPrefs)[] = [
  'muted','chartLine','chartCandles','chartVol','orderType','activeTab','activeMarket','botFilter','splashShown',
  'theme','reduceMotion','showParticles','autoConfirm','activeTF','watchlist','beginnerMode','priceAlerts','activeIndicators',
  'activeScreen', 'equippedFrame', 'equippedBadge', 'equippedNameColor', 'ownedCosmetics',
];
function defaultPrefs(): UIPrefs {
  return {
    muted: false, chartLine: true, chartCandles: true, chartVol: true,
    orderType: 'market', activeTab: 'positions', activeMarket: 'stocks',
    botFilter: 'all', splashShown: false,
    theme: 'game', reduceMotion: false, showParticles: true, autoConfirm: false,
    activeTF: '5s',
    watchlist: [],
    beginnerMode: true, // v7.2: default ON for new users
    priceAlerts: [],
    activeIndicators: [],
    activeScreen: 'dashboard',
    equippedFrame: 'none',
    equippedBadge: 'none',
    equippedNameColor: 'none',
    ownedCosmetics: [],
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
      const merged = { ...defaultPrefs(), ...clean };
      // Tabs removed from the trade panel (book/stats/history/missions/bots)
      // may still be persisted from older sessions — fall back to positions.
      const VALID_TABS: TabId[] = ['positions', 'details', 'movers', 'news', 'help'];
      if (!VALID_TABS.includes(merged.activeTab)) merged.activeTab = 'positions';
      return merged;
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
    dataTick: 0,
    connected: false,
    session: null,
    leaderboard: [],
    totalTraders: 0,
    playerRank: 1,
    settingsOpen: false,
    playerStats: null,
    playerBonus: 0,
    playerStreak: 0,
    playerLevel: 1,
    playerXp: 0,
    xpAtCurrent: 0,
    xpToNext: 100,
    banner: '',
    maintenanceMode: false,
    tradingHalted: false,
    dailyMissions: [],
    weeklyMissions: [],
    toast: null,
    notifications: [],
    notifUnread: 0,
    notifOpen: false,
    recentTrades: [],
    activeHolders: 0,
    feedbackOpen: false,
    mobileView: 'trade',
    ...initialPrefs,
    setActive: (aid) => {
      engine.state.active = aid;
      set({ tick: get().tick + 1 });
      import('../net/wsClient').then(m => m.send({ type: 'setActive', payload: { aid } }));
    },
    setOrderType: (t) => { set({ orderType: t }); persist(); },
    setActiveTab: (t) => { set({ activeTab: t }); persist(); },
    setActiveMarket: (m) => {
      set({ activeMarket: m }); persist();
      // If current active asset isn't in new market, switch to first asset of new market.
      const cur = get().engine.state.active;
      const curDef = ASSETS.find(a => a.id === cur);
      if (!curDef || curDef.market !== m) {
        const first = ASSETS.find(a => a.market === m);
        if (first) get().setActive(first.id);
      }
    },
    toggleWatchlist: (aid) => {
      const cur = get().watchlist;
      const next = cur.includes(aid) ? cur.filter(x => x !== aid) : [...cur, aid];
      set({ watchlist: next }); persist();
    },
    setBotFilter: (f) => { set({ botFilter: f }); persist(); },
    toggleChartLayer: (k) => { set(s => ({ ...s, [k]: !s[k] } as GameStore)); persist(); },
    toggleMute: () => {
      const m = !get().muted; setMuted(m); set({ muted: m }); persist();
    },
    hideSplash: () => { set({ splashShown: true }); persist(); },
    notifyTick: () => set(s => ({ tick: s.tick + 1 })),
    notifyDataTick: () => set(s => ({ dataTick: s.dataTick + 1 })),
    setConnected: (v) => set({ connected: v }),
    setSession: (s) => set({ session: s }),
    setLeaderboard: (lb, total, rank) => set({ leaderboard: lb, totalTraders: total, playerRank: rank }),
    setPlayerExtras: (s) => set({
      playerStats: s.stats,
      playerBonus: s.bonus,
      playerStreak: s.streak,
      dailyMissions: s.daily,
      weeklyMissions: s.weekly,
      playerLevel: s.level,
      playerXp: s.xp,
      xpAtCurrent: s.xpAtCurrent,
      xpToNext: s.xpToNext,
    }),
    setServerFlags: (s) => set({ banner: s.banner, maintenanceMode: s.maintenanceMode, tradingHalted: s.tradingHalted }),
    pushToast: (msg, kind = 'info') => {
      // Use Date.now() inside callback (safe — not in render).
      const t = { msg, kind, ts: typeof performance !== 'undefined' ? performance.now() : 0 };
      set({ toast: t });
    },
    pushNotif: (kind, title, body) => {
      const now = Date.now();
      const item: NotifItem = { id: now + Math.floor(performance.now() % 1000), ts: now, kind, title, body };
      set(s => {
        const notifications = [item, ...s.notifications].slice(0, 50);
        return { notifications, notifUnread: s.notifOpen ? 0 : s.notifUnread + 1 };
      });
      // Also surface a transient toast so it's not missed.
      const tk = (kind === 'sl') ? 'err' : (kind === 'fill' || kind === 'tp' || kind === 'level' || kind === 'mission') ? 'ok' : 'info';
      set({ toast: { msg: title, kind: tk as any, ts: typeof performance !== 'undefined' ? performance.now() : 0 } });
    },
    setNotifOpen: (v) => set(s => ({ notifOpen: v, notifUnread: v ? 0 : s.notifUnread })),
    clearNotifs: () => set({ notifications: [], notifUnread: 0 }),
    setTradeData: (trades, holders) => set({ recentTrades: trades, activeHolders: holders }),
    setFeedbackOpen: (v) => set({ feedbackOpen: v }),
    addPriceAlert: (aid, price, dir) => {
      const id = Date.now() + Math.floor(performance.now() % 1000);
      set(s => ({ priceAlerts: [...s.priceAlerts, { id, aid, price, dir }] }));
      persist();
    },
    removePriceAlert: (id) => { set(s => ({ priceAlerts: s.priceAlerts.filter(a => a.id !== id) })); persist(); },
    setMobileView: (v) => set({ mobileView: v }),
    setActiveScreen: (s) => { set({ activeScreen: s }); persist(); },
    setEquippedFrame: (frame) => { set({ equippedFrame: frame }); persist(); },
    setEquippedBadge: (badge) => { set({ equippedBadge: badge }); persist(); },
    setEquippedNameColor: (color) => { set({ equippedNameColor: color }); persist(); },
    addOwnedCosmetic: (id) => {
      const cur = get().ownedCosmetics;
      if (!cur.includes(id)) {
        set({ ownedCosmetics: [...cur, id] });
        persist();
      }
    },
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
    setBeginnerMode: (v) => { set({ beginnerMode: v }); persist(); },
    toggleIndicator: (id) => {
      const cur = get().activeIndicators;
      const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      set({ activeIndicators: next }); persist();
    },
  };
});

export function getAssetDef(id: string) { return ASSETS.find(a => a.id === id)!; }
