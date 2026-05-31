import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';

// Auto-dismissing transient toast for order results.
// Stacks bottom-right above the STOP button area.
export function OrderToast() {
  const toast = useGame(s => s.toast);
  const [shown, setShown] = useState<typeof toast>(null);

  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const id = setTimeout(() => setShown(null), 3500);
    return () => clearTimeout(id);
  }, [toast?.ts]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown) return null;
  return (
    <div className={'order-toast order-toast-' + shown.kind}>
      <span className="ot-icon">{shown.kind === 'ok' ? '✓' : shown.kind === 'err' ? '✗' : 'ⓘ'}</span>
      <span>{shown.msg}</span>
    </div>
  );
}
