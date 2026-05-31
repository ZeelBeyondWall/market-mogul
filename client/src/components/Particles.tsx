import { useEffect } from 'react';
import { useGame } from '../store/gameStore';

// Spawns +$XX floating particles when player buys/sells profitably.
// Hooks into engine's onPlayerBuy / onPlayerSellProfit (set in wsClient/gameStore).
let particleRoot: HTMLDivElement | null = null;
function ensureRoot(): HTMLDivElement {
  if (particleRoot) return particleRoot;
  const d = document.createElement('div');
  d.id = 'particle-root';
  d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:120';
  document.body.appendChild(d);
  particleRoot = d;
  return d;
}

export function spawnParticle(text: string, color: string, fromEl?: HTMLElement | null) {
  const root = ensureRoot();
  const el = document.createElement('div');
  el.className = 'particle';
  el.textContent = text;
  el.style.color = color;
  // start near trade panel buttons (or near top if no anchor)
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (fromEl) {
    const r = fromEl.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const dx = (Math.random() - 0.5) * 200;
  const dy = -100 - Math.random() * 80;
  el.style.setProperty('--dx', dx + 'px');
  el.style.setProperty('--dy', dy + 'px');
  root.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

export function ParticleSpawner() {
  const eng = useGame(s => s.engine);
  const showParticles = useGame(s => s.showParticles);

  useEffect(() => {
    if (!showParticles) return;
    const oBuy = eng.hooks.onPlayerBuy;
    const oSell = eng.hooks.onPlayerSellProfit;
    eng.hooks.onPlayerBuy = (aid, qty) => {
      oBuy?.(aid, qty);
      const anchor = document.getElementById('btnBuy') || document.querySelector('.dbl-btn.buy') as HTMLElement | null;
      spawnParticle(`+${qty} ${aid}`, '#10b981', anchor);
    };
    eng.hooks.onPlayerSellProfit = () => {
      oSell?.();
      const anchor = document.querySelector('.dbl-btn.sell') as HTMLElement | null;
      spawnParticle(`💰 SOLD`, '#fbbf24', anchor);
    };
    return () => {
      eng.hooks.onPlayerBuy = oBuy;
      eng.hooks.onPlayerSellProfit = oSell;
    };
  }, [eng, showParticles]);

  return null;
}
