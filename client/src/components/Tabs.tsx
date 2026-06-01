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

// v8.3: icon + label tabs in a wrapping grid — all visible, no scroll.
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'positions', label: 'Positions', icon: '📊' },
  { id: 'details',   label: 'Details',   icon: 'ℹ️' },
  { id: 'movers',    label: 'Movers',    icon: '🔥' },
  { id: 'book',      label: 'Book',      icon: '📖' },
  { id: 'stats',     label: 'Stats',     icon: '📈' },
  { id: 'history',   label: 'History',   icon: '🧾' },
  { id: 'missions',  label: 'Missions',  icon: '🎯' },
  { id: 'bots',      label: 'Traders',   icon: '👥' },
  { id: 'news',      label: 'News',      icon: '📰' },
];

export function Tabs() {
  const active = useGame(s => s.activeTab);
  const setActive = useGame(s => s.setActiveTab);
  return (
    <>
      <div className="tabgrid">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'tabgrid-btn' + (active === t.id ? ' active' : '')}
            onClick={() => { setActive(t.id); Audio.click(); }}
          >
            <span className="tabgrid-icon">{t.icon}</span>
            <span className="tabgrid-label">{t.label}</span>
          </button>
        ))}
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
