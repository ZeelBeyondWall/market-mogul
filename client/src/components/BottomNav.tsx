import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

// v9: mobile-only bottom navigation. Switches which single pane is visible.
// Hidden on desktop via CSS (≥821px).
const ITEMS: { id: 'market' | 'trade' | 'panel'; icon: string; label: string }[] = [
  { id: 'market', icon: '📋', label: 'Markets' },
  { id: 'trade',  icon: '📈', label: 'Trade' },
  { id: 'panel',  icon: '💼', label: 'Portfolio' },
];

export function BottomNav() {
  const mv = useGame(s => s.mobileView);
  const setMv = useGame(s => s.setMobileView);
  const unread = useGame(s => s.notifUnread);
  const setNotifOpen = useGame(s => s.setNotifOpen);
  const notifOpen = useGame(s => s.notifOpen);

  return (
    <nav className="bnav">
      {ITEMS.map(it => (
        <button
          key={it.id}
          className={'bnav-btn' + (mv === it.id ? ' on' : '')}
          onClick={() => { setMv(it.id); Audio.click(); }}
        >
          <span className="bnav-icon">{it.icon}</span>
          <span className="bnav-label">{it.label}</span>
        </button>
      ))}
      <button className={'bnav-btn' + (notifOpen ? ' on' : '')} onClick={() => { setNotifOpen(!notifOpen); Audio.click(); }}>
        <span className="bnav-icon">🔔{unread > 0 && <span className="bnav-dot" />}</span>
        <span className="bnav-label">Alerts</span>
      </button>
    </nav>
  );
}
