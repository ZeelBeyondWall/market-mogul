import type { ComponentType } from 'react';
import { useGame, type TabId } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { PositionsTab } from './PositionsTab';
import { OrderBook } from './OrderBook';
import { BotsTab } from './BotsTab';
import { NewsTab } from './NewsTab';
import { StockDetailsTab } from './StockDetailsTab';
import { StatsTab } from './StatsTab';
import { MissionsTab } from './MissionsTab';
import { MoversTab } from './MoversTab';
import { HelpTab } from './HelpTab';
import { TradeHistoryTab } from './TradeHistoryTab';
import {
  IconBriefcase, IconSearch, IconBars, IconBook, IconTarget,
  IconClock, IconStar, IconRobot, IconNews, type IconProps,
} from '../ui/icons';
import '../styles/arcade-trading.css';

// v8.3: icon + label tabs in a wrapping grid — all visible, no scroll.
// Neon Arcade: emoji glyphs replaced with the shared SVG icon set.
const TABS: { id: TabId; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'positions', label: 'Positions', icon: IconBriefcase },
  { id: 'details',   label: 'Details',   icon: IconSearch },
  { id: 'movers',    label: 'Movers',    icon: IconBars },
  { id: 'book',      label: 'Book',      icon: IconBook },
  { id: 'stats',     label: 'Stats',     icon: IconTarget },
  { id: 'history',   label: 'History',   icon: IconClock },
  { id: 'missions',  label: 'Missions',  icon: IconStar },
  { id: 'bots',      label: 'Traders',   icon: IconRobot },
  { id: 'news',      label: 'News',      icon: IconNews },
];

export function Tabs() {
  const active = useGame(s => s.activeTab);
  const setActive = useGame(s => s.setActiveTab);
  return (
    <>
      <div className="tabgrid arcade-tabgrid">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={'tabgrid-btn' + (active === t.id ? ' active' : '')}
              onClick={() => { setActive(t.id); Audio.click(); }}
            >
              <span className="tabgrid-icon"><Icon size={16} /></span>
              <span className="tabgrid-label">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="tabcontent">
        {active === 'positions' && <PositionsTab />}
        {active === 'details' && <StockDetailsTab />}
        {active === 'movers' && <MoversTab />}
        {active === 'book' && <OrderBook />}
        {active === 'stats' && <StatsTab />}
        {active === 'history' && <TradeHistoryTab />}
        {active === 'missions' && <MissionsTab />}
        {active === 'bots' && <BotsTab />}
        {active === 'news' && <NewsTab />}
        {active === 'help' && <HelpTab />}
      </div>
    </>
  );
}
