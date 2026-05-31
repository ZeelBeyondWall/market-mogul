import { useGame, type UIPrefs } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { PositionsTab } from './PositionsTab';
import { OrderBook } from './OrderBook';
import { BotsTab } from './BotsTab';
import { NewsTab } from './NewsTab';

const TABS: { id: UIPrefs['activeTab']; label: string }[] = [
  { id: 'positions', label: 'Positions' },
  { id: 'book',      label: 'Book' },
  { id: 'bots',      label: 'Traders' },
  { id: 'news',      label: 'News' },
];

export function Tabs() {
  const active = useGame(s => s.activeTab);
  const setActive = useGame(s => s.setActiveTab);
  return (
    <>
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={'tab' + (active === t.id ? ' active' : '')} onClick={() => { setActive(t.id); Audio.click(); }}>
            {t.label}
          </div>
        ))}
      </div>
      {active === 'positions' && <PositionsTab />}
      {active === 'book' && <OrderBook />}
      {active === 'bots' && <BotsTab />}
      {active === 'news' && <NewsTab />}
    </>
  );
}
