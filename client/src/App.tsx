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
            <div className="col col-panel"><Tabs /></div>
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
      <KillButton />
    </>
  );
}

function KillButton() {
  const onKill = async () => {
    if (!confirm('Stop server + client?\n(Both cmd windows will close)')) return;
    try {
      await fetch(`http://${location.hostname}:8787/shutdown`, { method: 'POST' });
    } catch { /* server may already be gone */ }
    setTimeout(() => window.close(), 400);
  };
  return (
    <button
      onClick={onKill}
      title="Kill server + client"
      style={{
        position: 'fixed', right: 14, bottom: 36, zIndex: 400,
        background: 'linear-gradient(180deg,#ef4444,#991b1b)',
        color: '#fff', border: 'none', padding: '10px 16px',
        borderRadius: 6, fontFamily: 'inherit', fontWeight: 700,
        fontSize: 11, letterSpacing: 1.5, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(239,68,68,.4)',
        textTransform: 'uppercase',
      }}
    >■ STOP ALL</button>
  );
}
