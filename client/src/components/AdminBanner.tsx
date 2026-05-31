import { useGame } from '../store/gameStore';

export function AdminBanner() {
  const banner = useGame(s => s.banner);
  const maintenance = useGame(s => s.maintenanceMode);
  const halted = useGame(s => s.tradingHalted);

  // Build banner stack — most severe first.
  const items: { text: string; kind: 'maint' | 'halt' | 'info' }[] = [];
  if (maintenance) items.push({ text: '🛠 MAINTENANCE MODE — admin is working on the server', kind: 'maint' });
  if (halted)      items.push({ text: '⛔ TRADING HALTED by admin', kind: 'halt' });
  if (banner)      items.push({ text: '📢 ' + banner, kind: 'info' });

  if (items.length === 0) return null;

  return (
    <div className="admin-banners">
      {items.map((b, i) => (
        <div key={i} className={'admin-banner admin-banner-' + b.kind}>
          {b.text}
        </div>
      ))}
    </div>
  );
}
