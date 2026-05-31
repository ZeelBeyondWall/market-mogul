import { create } from 'zustand';
import { Engine } from '../engine/engine';
import { ASSETS } from '../engine/constants';
import { hydrateState, load, save } from '../utils/persistence';
import { Audio, setMuted } from '../audio/audio';
import type { GameState, Trader } from '../engine/types';

type ChartToggles = { chartLine: boolean; chartCandles: boolean; chartVol: boolean };

export interface UIPrefs extends ChartToggles {
  muted: boolean;
  orderType: 'market' | 'limit';
  activeTab: 'positions' | 'book' | 'bots' | 'news';
  botFilter: string;
  splashShown: boolean;
}

interface GameStore extends UIPrefs {
  engine: Engine;
  // tick bumper — components subscribe to this to re-render on every frame
  tick: number;
  setActive: (aid: string) => void;
  setOrderType: (t: 'market' | 'limit') => void;
  setActiveTab: (t: UIPrefs['activeTab']) => void;
  setBotFilter: (f: string) => void;
  toggleChartLayer: (k: keyof ChartToggles) => void;
  toggleMute: () => void;
  hideSplash: () => void;
  notifyTick: () => void;
}

function bootEngine(): { engine: Engine; uiPrefs: UIPrefs } {
  const loaded = load();
  const engine = new Engine();
  if (loaded) hydrateState(engine.state, loaded.raw);
  // reseed any empty books after load so they have liquidity
  engine.seedBooks();
  const uiPrefs: UIPrefs = {
    muted: loaded?.uiPrefs.muted ?? false,
    chartLine: loaded?.uiPrefs.chartLine ?? true,
    chartCandles: loaded?.uiPrefs.chartCandles ?? true,
    chartVol: loaded?.uiPrefs.chartVol ?? true,
    orderType: 'market',
    activeTab: 'positions',
    botFilter: 'all',
    splashShown: false,
  };
  return { engine, uiPrefs };
}

const { engine, uiPrefs } = bootEngine();

// engine hooks bridged into Zustand for sound + log
engine.hooks.onPlayerBuy = () => Audio.buy();
engine.hooks.onPlayerSellProfit = () => Audio.sellProfit();
engine.hooks.onPlayerSellLoss = () => Audio.sellLoss();
engine.hooks.onEvent = (ev) => {
  if (ev.type === 'boom') Audio.boom();
  else if (ev.type === 'crash') Audio.crash();
};
engine.hooks.onSLTPHit = (aid, kind, ref, px) => {
  const msg = `${kind} HIT — ${aid} closed @ ${px.toFixed(px < 10 ? 3 : 2)} (${kind} ${ref.toFixed(ref < 10 ? 3 : 2)})`;
  engine.state.events.unshift({ type: 'news', title: `${kind === 'SL' ? '🛑' : '🎯'} ${kind} HIT`, desc: msg, t: Date.now() });
};

export const useGame = create<GameStore>((set, get) => ({
  engine,
  tick: 0,
  ...uiPrefs,
  setActive: (aid) => { engine.state.active = aid; set({ tick: get().tick + 1 }); },
  setOrderType: (t) => set({ orderType: t }),
  setActiveTab: (t) => set({ activeTab: t }),
  setBotFilter: (f) => set({ botFilter: f }),
  toggleChartLayer: (k) => set(s => ({ ...s, [k]: !s[k] })),
  toggleMute: () => {
    const m = !get().muted; setMuted(m); set({ muted: m });
  },
  hideSplash: () => set({ splashShown: true }),
  notifyTick: () => set(s => ({ tick: s.tick + 1 })),
}));

// autosave every 5s
setInterval(() => {
  const s = useGame.getState();
  save(engine.state, { muted: s.muted, chartLine: s.chartLine, chartCandles: s.chartCandles, chartVol: s.chartVol });
}, 5000);
window.addEventListener('beforeunload', () => {
  const s = useGame.getState();
  save(engine.state, { muted: s.muted, chartLine: s.chartLine, chartCandles: s.chartCandles, chartVol: s.chartVol });
});

// utility selectors
export function getAssetDef(id: string) { return ASSETS.find(a => a.id === id)!; }
export function playerOf(s: GameState): Trader { return s.traders[0]; }
