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

// v7.2: tabs split by complexity. Beginner mode hides Book, Movers, Stats.
const TABS: { id: TabId; label: string; advanced?: boolean }[] = [
  { id: 'positions', label: 'Positions' },
  { id: 'details',   label: 'Details' },
  { id: 'movers',    label: 'Movers', advanced: true },
  { id: 'book',      label: 'Book',   advanced: true },
  { id: 'stats',     label: 'Stats' },
  { id: 'missions',  label: 'Missions' },
  { id: 'bots',      label: 'Traders' },
  { id: 'news',      label: 'News' },
  { id: 'help',      label: '? Help' },
];

export function Tabs() {
  const active = useGame(s => s.activeTab);
  const setActive = useGame(s => s.setActiveTab);
  const beginnerMode = useGame(s => s.beginnerMode);
  const visibleTabs = TABS.filter(t => !beginnerMode || !t.advanced);
  return (
    <>
      <div className="tabs tabs-scroll">
        {visibleTabs.map(t => (
          <div key={t.id} className={'tab' + (active === t.id ? ' active' : '')} onClick={() => { setActive(t.id); Audio.click(); }}>
            {t.label}
          </div>
        ))}
      </div>
      {active === 'positions' && <PositionsTab />}
      {active === 'details' && <StockDetailsTab />}
      {active === 'movers' && <MoversTab />}
      {active === 'book' && <OrderBook />}
      {active === 'stats' && <StatsTab />}
      {active === 'missions' && <MissionsTab />}
      {active === 'bots' && <BotsTab />}
      {active === 'news' && <NewsTab />}
      {active === 'help' && <HelpTab />}
    </>
  );
}
