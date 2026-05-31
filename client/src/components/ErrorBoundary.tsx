import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { err: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };
  static getDerivedStateFromError(err: Error): State { return { err }; }
  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error('App crashed:', err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          position: 'fixed', inset: 0, padding: 24, overflow: 'auto',
          background: '#05080d', color: '#fca5a5', fontFamily: 'monospace', fontSize: 12,
          zIndex: 9999,
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: 12 }}>⚠ Frontend crashed</h2>
          <div style={{ marginBottom: 12, color: '#cbd5e1' }}>
            Likely a stale module cache after a hot reload.
            Press <b style={{ color: '#f5b942' }}>Ctrl+Shift+R</b> for a hard refresh.
            If it persists, kill both windows with <b>stop.bat</b> and rerun <b>start.bat</b>.
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#fca5a5', background: '#1c1010', padding: 12, borderRadius: 4 }}>
            {this.state.err.stack || this.state.err.message}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{
              marginTop: 12, padding: '10px 18px', background: '#f5b942', color: '#000',
              border: 'none', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer',
            }}
          >RELOAD</button>
        </div>
      );
    }
    return this.props.children;
  }
}
