import { useGame } from '../store/gameStore';
import type { NotifKind } from '../store/gameStore';
import { Audio } from '../audio/audio';

const ICON: Record<NotifKind, string> = {
  fill: '✅', cancel: '🚫', sl: '🛑', tp: '🎯',
  level: '⭐', mission: '🏆', news: '📰', alert: '🔔', info: 'ℹ️',
};

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

export function NotificationCenter() {
  const notifs = useGame(s => s.notifications);
  const unread = useGame(s => s.notifUnread);
  const open = useGame(s => s.notifOpen);
  const setOpen = useGame(s => s.setNotifOpen);
  const clear = useGame(s => s.clearNotifs);

  return (
    <div className="notif-wrap">
      <button className="notif-bell" onClick={() => { setOpen(!open); Audio.click(); }} title="Notifications">
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-panel">
            <div className="notif-head">
              <span>Notifications</span>
              {notifs.length > 0 && (
                <button className="notif-clear" onClick={() => { clear(); Audio.click(); }}>Clear all</button>
              )}
            </div>
            <div className="notif-list">
              {notifs.length === 0 ? (
                <div className="notif-empty">🔕 No notifications yet.<br />Trade, level up, or hit a mission to see updates here.</div>
              ) : notifs.map(n => (
                <div key={n.id} className={'notif-item k-' + n.kind}>
                  <div className="notif-icon">{ICON[n.kind] || 'ℹ️'}</div>
                  <div className="notif-body">
                    <div className="notif-title">{n.title}</div>
                    {n.body && <div className="notif-sub">{n.body}</div>}
                  </div>
                  <div className="notif-time">{ago(n.ts)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
