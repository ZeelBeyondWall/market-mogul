import type { ComponentType } from 'react';
import { useGame, type TabId } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { PositionsTab } from './PositionsTab';
import { NewsTab } from './NewsTab';
import { StockDetailsTab } from './StockDetailsTab';
import { MoversTab } from './MoversTab';
import { HelpTab } from './HelpTab';
import {
  IconBriefcase, IconSearch, IconBars, IconNews, type IconProps,
} from '../ui/icons';
import '../styles/arcade-trading.css';

// Market-context tabs only. Relocated elsewhere: Book → chart context menu,
// Stats → Profile, History → Portfolio, Missions → Home dashboard,
// Traders → Leaderboard page.
const TABS: { id: TabId; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'positions', label: 'Positions', icon: IconBriefcase },
  { id: 'details',   label: 'Details',   icon: IconSearch },
  { id: 'movers',    label: 'Movers',    icon: IconBars },
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
        {active === 'news' && <NewsTab />}
        {active === 'help' && <HelpTab />}
      </div>
    </>
  );
}
