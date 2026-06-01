import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import type { NewsEventDef } from '../../../shared/engine/types';

export function EventBanner() {
  const eng = useGame(s => s.engine);
  const [shown, setShown] = useState(false);
  const [data, setData] = useState<{ title: string; desc: string; kind: string }>({ title: '', desc: '', kind: '' });
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = eng.hooks.onEvent;
    eng.hooks.onEvent = (ev: NewsEventDef) => {
      prev?.(ev);
      setData({ title: ev.title, desc: ev.desc, kind: ev.type });
      setShown(true);
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => setShown(false), 3000);
    };
    return () => { eng.hooks.onEvent = prev; };
  }, [eng]);

  // v9.3: only mount when active — a permanently-rendered box was peeking at the
  // top of the screen (translateY hid only most of it).
  if (!shown) return null;
  return (
    <div id="eventBanner" className={'show ' + data.kind}>
      <div className="title">{data.title}</div>
      <div className="desc">{data.desc}</div>
    </div>
  );
}
