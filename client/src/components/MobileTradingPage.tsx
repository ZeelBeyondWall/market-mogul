import { useGame } from '../store/gameStore';
import { AssetList } from './AssetList';
import { Chart } from './Chart';
import { TradePanel } from './TradePanel';
import { Tabs } from './Tabs';

export function MobileTradingPage() {
  const mobileView = useGame(s => s.mobileView);

  return (
    <div className="mobile-trading-page" data-mv={mobileView}>
      {mobileView === 'market' && (
        <div className="mobile-trading-pane market-pane">
          <AssetList />
        </div>
      )}

      {mobileView === 'trade' && (
        <div className="mobile-trading-pane trade-pane">
          <div className="mobile-chart-container">
            <Chart />
          </div>
          <div className="mobile-panel-container">
            <TradePanel />
          </div>
        </div>
      )}

      {mobileView === 'panel' && (
        <div className="mobile-trading-pane panel-pane">
          <Tabs />
        </div>
      )}
    </div>
  );
}
