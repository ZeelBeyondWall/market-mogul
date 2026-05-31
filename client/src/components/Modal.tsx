import { useState, useEffect, useCallback } from 'react';

interface ModalState {
  title: string;
  body: string;
  confirm: boolean;
  resolver?: (ok: boolean) => void;
}

let setter: ((s: ModalState | null) => void) | null = null;

export function showModal(title: string, body: string, confirm = false): Promise<boolean> {
  return new Promise(res => {
    setter?.({ title, body, confirm, resolver: res });
  });
}

export function ModalRoot() {
  const [state, setState] = useState<ModalState | null>(null);
  useEffect(() => { setter = setState; return () => { setter = null; }; }, []);
  const close = useCallback((ok: boolean) => {
    state?.resolver?.(ok);
    setState(null);
  }, [state]);
  if (!state) return <div className="modal-bg" />;
  return (
    <div className="modal-bg show">
      <div className="modal">
        <h2>{state.title}</h2>
        <p dangerouslySetInnerHTML={{ __html: state.body }} />
        <div className="actions">
          {state.confirm && <button onClick={() => close(false)}>Cancel</button>}
          <button className="primary" onClick={() => close(true)}>OK</button>
        </div>
      </div>
    </div>
  );
}
