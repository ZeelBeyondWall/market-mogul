// Admin API client — wraps fetch with auth header + base URL.
// Engine listens on :8788; gateway proxies /admin/* to it on :8787.
const BASE = `http://${location.hostname}:8787`;

// Token + actor pulled from localStorage so each admin tab can set its own identity.
function token(): string { try { return localStorage.getItem('mm_admin_token') || ''; } catch { return ''; } }
function actor(): string { try { return localStorage.getItem('mm_admin_actor') || 'admin'; } catch { return 'admin'; } }

export function setToken(t: string) { try { localStorage.setItem('mm_admin_token', t); } catch {} }
export function setActor(a: string) { try { localStorage.setItem('mm_admin_actor', a); } catch {} }
export function getActor(): string { return actor(); }
export function getToken(): string { return token(); }

function headers(body?: boolean): HeadersInit {
  const h: any = { 'X-Admin-Token': token(), 'X-Admin-Actor': actor() };
  if (body) h['Content-Type'] = 'application/json';
  return h;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { headers: headers() });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    let reason = r.statusText;
    try { const j = await r.json(); if (j?.reason) reason = j.reason; } catch {}
    throw new Error(`${path}: ${reason}`);
  }
  return r.json();
}
