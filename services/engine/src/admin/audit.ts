import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'admin-audit.jsonl');
const MAX_IN_MEMORY = 1000;

export interface AuditEntry {
  ts: number;
  actor: string;            // admin identifier (env or 'system')
  action: string;           // 'user.ban', 'economy.inject', etc.
  target?: string | number; // optional target id (userId, market, etc.)
  payload?: any;            // sanitized request body
  result?: 'ok' | 'error';
  reason?: string;
}

// In-memory ring of recent entries for fast UI queries.
const ring: AuditEntry[] = [];

// Append-only fire-and-forget. Failures log but don't block admin actions.
let pendingWrite = '';
let writing = false;
async function flushPending() {
  if (writing || !pendingWrite) return;
  writing = true;
  const data = pendingWrite;
  pendingWrite = '';
  try { await fsp.appendFile(LOG_FILE, data); }
  catch (e) { console.error('audit append failed:', (e as Error).message); }
  finally { writing = false; if (pendingWrite) flushPending(); }
}

// FIX: scrub sensitive keys from payload before persisting.
const SENSITIVE_KEYS = ['token', 'password', 'secret', 'apikey', 'apiKey', 'authorization'];
function sanitize(p: any): any {
  if (!p || typeof p !== 'object') return p;
  const out: any = Array.isArray(p) ? [] : {};
  for (const k of Object.keys(p)) {
    if (SENSITIVE_KEYS.some(s => k.toLowerCase().includes(s))) { out[k] = '[redacted]'; continue; }
    const v = p[k];
    out[k] = (v && typeof v === 'object') ? sanitize(v) : v;
  }
  return out;
}

export function audit(entry: Omit<AuditEntry, 'ts'> & { ts?: number }): void {
  const e: AuditEntry = {
    ts: entry.ts ?? Date.now(),
    ...entry,
    payload: sanitize(entry.payload),
  };
  ring.unshift(e);
  if (ring.length > MAX_IN_MEMORY) ring.pop();
  pendingWrite += JSON.stringify(e) + '\n';
  void flushPending();
}

// Lazy-load up to N most-recent entries from disk for cold UI start.
export async function loadRecent(n: number = 200): Promise<AuditEntry[]> {
  // Prefer in-memory ring if it has enough.
  if (ring.length >= n) return ring.slice(0, n);
  try {
    if (!fs.existsSync(LOG_FILE)) return ring.slice(0, n);
    const raw = await fsp.readFile(LOG_FILE, 'utf-8');
    const lines = raw.trim().split('\n').slice(-n);
    const parsed: AuditEntry[] = [];
    for (const ln of lines) { try { parsed.push(JSON.parse(ln)); } catch { /* skip */ } }
    // Merge: most-recent in-memory wins; fill from disk for older.
    const seen = new Set(ring.map(e => e.ts + ':' + e.action));
    const out = [...ring];
    for (const e of parsed.reverse()) {
      const k = e.ts + ':' + e.action;
      if (!seen.has(k)) { out.push(e); seen.add(k); }
      if (out.length >= n) break;
    }
    return out.slice(0, n);
  } catch (e) {
    console.error('audit read failed:', (e as Error).message);
    return ring.slice(0, n);
  }
}

// Convenience: wrap a route handler so action is logged with outcome.
export function withAudit<T extends (req: any, res: any) => any>(
  action: string,
  actorOf: (req: any) => string,
  targetOf: (req: any) => string | number | undefined,
  fn: T,
): T {
  return (async (req: any, res: any) => {
    let result: 'ok' | 'error' = 'ok';
    let reason: string | undefined;
    const _send = res.json.bind(res);
    res.json = (body: any) => {
      if (body && body.ok === false) { result = 'error'; reason = body.reason; }
      audit({ actor: actorOf(req), action, target: targetOf(req), payload: req.body, result, reason });
      return _send(body);
    };
    try { return await fn(req, res); }
    catch (e: any) {
      audit({ actor: actorOf(req), action, target: targetOf(req), payload: req.body, result: 'error', reason: e?.message });
      throw e;
    }
  }) as T;
}
