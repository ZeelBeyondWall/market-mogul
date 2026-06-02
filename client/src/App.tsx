import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { useGameLoop } from './hooks/useGameLoop';
import { resumeAudio } from './audio/audio';
import { SvgDefs } from './components/SvgDefs';
import { Header } from './components/Header';
import { AssetList } from './components/AssetList';
import { Chart } from './components/Chart';
import { TradePanel } from './components/TradePanel';
import { Tabs } from './components/Tabs';
import { Ticker } from './components/Ticker';
import { Splash } from './components/Splash';
import { ModalRoot } from './components/Modal';
import { EventBanner } from './components/EventBanner';
import { Settings } from './components/Settings';
import { AdminBanner } from './components/AdminBanner';
import { MarketBar } from './components/MarketBar';
import { OrderToast } from './components/OrderToast';
import { FeedbackModal } from './components/FeedbackModal';
import { BottomNav } from './components/BottomNav';

export function App() {
  useGameLoop();
  const splashShown = useGame(s => s.splashShown);
  const mobileView = useGame(s => s.mobileView);

  // resume audio on any user interaction after first gesture
  useEffect(() => {
    const handler = () => resumeAudio();
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <>
      <SvgDefs />
      <Splash />
      {splashShown && (
        <div id="app" data-mv={mobileView}>
          <AdminBanner />
          <Header />
          <MarketBar />
          <main>
            <div className="col col-market"><AssetList /></div>
            <div className="col col-trade">
              <div className="chart-wrap">
                <Chart />
                <TradePanel />
              </div>
            </div>
            <div className="col col-panel">
              <Tabs />
            </div>
          </main>
          <Ticker />
          <BottomNav />
        </div>
      )}
      <EventBanner />
      <Settings />
      <ModalRoot />
      <OrderToast />
      <FeedbackModal />
    </>
  );
}
