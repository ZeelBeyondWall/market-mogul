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
import { Auth } from './components/Auth';
import { supabase } from './net/supabase';
import { connect } from './net/wsClient';

export function App() {
  useGameLoop();
  const session = useGame(s => s.session);
  const setSession = useGame(s => s.setSession);
  const splashShown = useGame(s => s.splashShown);
  const mobileView = useGame(s => s.mobileView);
  const engine = useGame(s => s.engine);

  // Initialize and listen to Auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) connect(engine);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) connect(engine);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, engine]);

  // resume audio on any user interaction after first gesture
  useEffect(() => {
    const handler = () => resumeAudio();
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  if (!session) {
    return (
      <>
        <SvgDefs />
        <Auth />
        <ModalRoot />
        <OrderToast />
      </>
    );
  }

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
