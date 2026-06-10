import { MARKET_LABELS, MARKET_ORDER, marketUnlockLevel } from '../../../shared/engine/constants';
import type { Market } from '../../../shared/engine/types';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { NotificationCenter } from './NotificationCenter';
import { IconCandles, IconCoin, IconGlobe, IconLock, IconChat, IconHelp, IconSettings } from '../ui/icons';

const MARKET_ICONS: Record<string, (p: { size?: number }) => JSX.Element> = {
  stocks: IconCandles,
  crypto: IconCoin,
  forex: IconGlobe,
};

// MARKET_LABELS is shared with the engine and keeps its emoji; strip at render.
const stripEmoji = (s: string) => s.replace(/[^\x20-\x7E]/g, '').trim();

// v8: Top-level market navigation. Big pill tabs across full width above main.
// Each pill shows: SVG market icon + name + lock badge if player can't access yet.
export function MarketBar() {
  const activeMarket = useGame(s => s.activeMarket);
  const setActiveMarket = useGame(s => s.setActiveMarket);
  const playerLevel = useGame(s => s.playerLevel);
  const setSettingsOpen = useGame(s => s.setSettingsOpen);
  const setActiveTab = useGame(s => s.setActiveTab);
  const setFeedbackOpen = useGame(s => s.setFeedbackOpen);

  return (
    <div className="mbar">
      <div className="mbar-pills">
        {MARKET_ORDER.map(m => {
          const lvl = marketUnlockLevel(m);
          const locked = playerLevel < lvl;
          const active = activeMarket === m;
          const MIcon = MARKET_ICONS[m] ?? IconCandles;
          return (
            <button
              key={m}
              className={'mbar-pill' + (active ? ' active' : '') + (locked ? ' locked' : '')}
              onClick={() => { if (!locked) { setActiveMarket(m as Market); Audio.click(); } }}
              title={locked ? `Unlocks at Level ${lvl}` : `Browse ${stripEmoji(MARKET_LABELS[m])}`}
            >
              <MIcon size={14} />
              <span className="mbar-pill-text">{stripEmoji(MARKET_LABELS[m])}</span>
              {locked && <span className="mbar-pill-lock"><IconLock size={11} /> L{lvl}</span>}
            </button>
          );
        })}
      </div>
      <div className="mbar-actions">
        <NotificationCenter />
        <button className="mbar-action" onClick={() => { setFeedbackOpen(true); Audio.click(); }} title="Send feedback / report bug">
          <IconChat size={13} /> Feedback
        </button>
        <button className="mbar-action" onClick={() => { setActiveTab('help'); Audio.click(); }} title="How to play">
          <IconHelp size={13} /> Help
        </button>
        <button className="mbar-action" onClick={() => { setSettingsOpen(true); Audio.click(); }} title="Settings">
          <IconSettings size={13} /> Settings
        </button>
      </div>
    </div>
  );
}
