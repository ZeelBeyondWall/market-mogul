import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

const API = `http://${location.hostname}:8787`;
type FType = 'bug' | 'idea' | 'other';

export function FeedbackModal() {
  const open = useGame(s => s.feedbackOpen);
  const setOpen = useGame(s => s.setFeedbackOpen);
  const level = useGame(s => s.playerLevel);
  const pushToast = useGame(s => s.pushToast);
  const [type, setType] = useState<FType>('bug');
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (msg.trim().length < 3) { pushToast('Please write a bit more', 'err'); return; }
    setSending(true);
    try {
      const r = await fetch(API + '/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: msg.trim(), name: name.trim(), level }),
      });
      let j: any = null;
      try { j = await r.json(); } catch { /* non-JSON error body */ }
      if (r.ok && j?.ok) { pushToast('✓ Thanks — feedback sent!', 'ok'); setMsg(''); setOpen(false); }
      else pushToast(j?.reason || `Server error (${r.status})`, 'err');
    } catch {
      pushToast('Could not reach server', 'err');
    } finally { setSending(false); }
  };

  return (
    <div className="fb-backdrop" onClick={() => setOpen(false)}>
      <div className="fb-modal" onClick={e => e.stopPropagation()}>
        <div className="fb-head">
          <h2>💬 Send Feedback</h2>
          <button className="fb-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="fb-body">
          <div className="fb-types">
            {([['bug', '🐞 Bug'], ['idea', '💡 Idea'], ['other', '💬 Other']] as [FType, string][]).map(([t, lbl]) => (
              <button key={t} className={'fb-type' + (type === t ? ' on' : '')} onClick={() => { setType(t); Audio.click(); }}>{lbl}</button>
            ))}
          </div>
          <input className="fb-input" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
          <textarea
            className="fb-textarea"
            placeholder={type === 'bug' ? 'What broke? What did you expect?' : type === 'idea' ? 'What would make the game better?' : 'Tell us anything…'}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            maxLength={2000}
            rows={5}
          />
          <div className="fb-count">{msg.length}/2000</div>
        </div>
        <div className="fb-foot">
          <button className="fb-cancel" onClick={() => setOpen(false)}>Cancel</button>
          <button className="fb-send" onClick={submit} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
