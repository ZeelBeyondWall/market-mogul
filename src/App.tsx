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

export function App() {
  useGameLoop();
  const splashShown = useGame(s => s.splashShown);

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
        <div id="app">
          <Header />
          <main>
            <div className="col"><AssetList /></div>
            <div className="col">
              <div className="chart-wrap">
                <Chart />
                <TradePanel />
              </div>
            </div>
            <div className="col"><Tabs /></div>
          </main>
          <Ticker />
        </div>
      )}
      <EventBanner />
      <ModalRoot />
    </>
  );
}
