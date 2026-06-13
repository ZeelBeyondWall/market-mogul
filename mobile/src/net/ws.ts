import { WS_URL } from '../config';
import { useGame } from '../store/game';
import type { TFKey } from '../engine/types';

// Ported from the web client (client/src/net/wsClient.ts), trimmed to the
// core trading loop: auth → snapshot → 10Hz ticks → order results.

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let activeAsset = 'NEXA';
let activeTF = '5s';

const MERGE_CAP = 600;
function mergeCandles(existing: any[], incoming: any[]): any[] {
  if (!incoming?.length) return existing;
  if (incoming.some((c) => c.t == null) || existing.some((c) => c.t == null)) {
    return incoming.slice(-MERGE_CAP);
  }
  const byT = new Map<number, any>();
  for (const c of existing) byT.set(c.t, c);
  for (const c of incoming) byT.set(c.t, c);
  return [...byT.values()].sort((a, b) => a.t - b.t).slice(-MERGE_CAP);
}

export function send(msg: any): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// Server streams ticks at 10Hz. Triggering a React re-render of every screen
// 10×/s pegs the phone (100-item list + chart). Engine state is still updated
// live in place; we just throttle the bumpData() that drives re-renders to
// ~4Hz so the UI stays smooth.
let lastBump = 0;
let bumpTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleBump(): void {
  const now = Date.now();
  const since = now - lastBump;
  if (since >= 250) {
    lastBump = now;
    useGame.getState().bumpData();
  } else if (!bumpTimer) {
    bumpTimer = setTimeout(() => {
      bumpTimer = null;
      lastBump = Date.now();
      useGame.getState().bumpData();
    }, 250 - since);
  }
}

export function setActiveAsset(aid: string): void {
  activeAsset = aid;
  const { engine } = useGame.getState();
  engine.state.active = aid;
  send({ type: 'setActive', payload: { aid } });
  useGame.getState().bumpData(); // immediate — user action
}

export function setTF(tf: string): void {
  activeTF = tf;
  send({ type: 'setTF', payload: { tf } });
}

export function connect(): void {
  // Already connected/connecting — skip. onAuthStateChange fires repeatedly
  // (SIGNED_IN, TOKEN_REFRESHED…); without this each call opened a new socket.
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  if (ws) {
    try {
      ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;
      ws.close();
    } catch {}
  }
  const sock = new WebSocket(WS_URL);
  ws = sock;

  sock.onopen = () => {
    if (ws !== sock) return;
    reconnectAttempt = 0;
    useGame.getState().setConnected(true);
    const { session, activeTF: tf } = useGame.getState();
    if (session) send({ type: 'auth', payload: { token: session.access_token } });
    activeTF = tf;
    send({ type: 'setTF', payload: { tf } });
    send({ type: 'setActive', payload: { aid: activeAsset } });
  };

  sock.onclose = () => {
    if (ws !== sock) return;
    useGame.getState().setConnected(false);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectAttempt++;
    const base = Math.min(30000, 1000 * Math.pow(1.5, Math.min(reconnectAttempt, 8)));
    reconnectTimer = setTimeout(connect, base + Math.random() * 500);
  };

  sock.onerror = () => { /* onclose handles reconnect */ };

  sock.onmessage = (e: any) => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'snapshot') applySnapshot(msg.payload);
    else if (msg.type === 'tick') applyTick(msg.payload);
    else if (msg.type === 'order_result') {
      const p = msg.payload;
      if (!p.ok && p.reason) useGame.getState().pushToast(p.reason, 'err');
      else if (p.ok && p.filled > 0)
        useGame.getState().pushToast(`Filled ${p.filled} @ ${(p.cost / p.filled).toFixed(2)}`, 'ok');
      else if (p.ok) useGame.getState().pushToast('Order placed', 'info');
    }
  };
}

function applySnapshot(snap: any): void {
  const { engine } = useGame.getState();
  engine.state.active = snap.active;
  activeAsset = snap.active;
  const tf = (snap.tf || activeTF) as TFKey;

  const player = engine.player();
  player.name = snap.player?.name ?? player.name;
  player.cash = snap.player?.cash ?? player.cash;
  if (snap.player?.holdings) {
    for (const aid of Object.keys(snap.player.holdings)) {
      player.holdings[aid] = snap.player.holdings[aid];
    }
  }
  player.closing = snap.player?.closing || {};

  for (const aid of Object.keys(snap.assets || {})) {
    const sa = snap.assets[aid];
    const ast = engine.state.assets[aid];
    if (!ast) continue;
    ast.lastPrice = sa.lastPrice;
    ast.open = sa.open;
    ast.hi = sa.hi;
    ast.lo = sa.lo;
    ast.volume = sa.volume;
    if (sa.history?.length) ast.history = sa.history.slice();
    if (ast.series?.[tf]) {
      if (sa.candles?.length) ast.series[tf].candles = mergeCandles(ast.series[tf].candles, sa.candles);
      if (sa.curCandle) ast.series[tf].curCandle = { ...sa.curCandle };
      else if (aid === snap.active) ast.series[tf].curCandle = null;
      if (sa.candleStartT) ast.series[tf].candleStartT = sa.candleStartT;
    }
    if (sa.volumeHist?.length) ast.volumeHist = sa.volumeHist.slice();
  }
  scheduleBump();
}

function applyTick(tick: any): void {
  const { engine } = useGame.getState();
  const player = engine.player();
  player.cash = tick.cash;

  if (tick.playerHoldings) {
    for (const aid of Object.keys(player.holdings)) {
      const incoming = tick.playerHoldings[aid];
      if (incoming) Object.assign(player.holdings[aid], incoming);
      else if (player.holdings[aid].shares !== 0) {
        player.holdings[aid].shares = 0;
        player.holdings[aid].avgCost = 0;
      }
    }
  }
  if (tick.playerClosing) player.closing = tick.playerClosing;

  for (const aid of Object.keys(tick.prices || {})) {
    const ast = engine.state.assets[aid];
    if (ast) ast.lastPrice = tick.prices[aid];
  }

  if (tick.activeId && tick.activeId === engine.state.active) {
    const ast = engine.state.assets[tick.activeId];
    const tf = (tick.activeTF || activeTF) as TFKey;
    if (ast?.series?.[tf]) {
      ast.series[tf].candles = mergeCandles(ast.series[tf].candles, tick.activeCandles || []);
      ast.series[tf].curCandle = tick.activeCurCandle ? { ...tick.activeCurCandle } : null;
      ast.series[tf].candleStartT = tick.activeCandleStartT;
    }
    if (ast && tick.activeHistory) ast.history = tick.activeHistory.slice();
    if (ast && tick.activeVolumeHist) ast.volumeHist = tick.activeVolumeHist.slice();
  }
  scheduleBump();
}
