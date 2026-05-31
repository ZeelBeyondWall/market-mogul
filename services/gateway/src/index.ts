// Gateway service — WS reverse proxy + HTTP admin proxy.
// Clients connect here (:8787). Each client gets a 1:1 WebSocket bridged to the
// engine service (:8788). HTTP /admin/*, /state, /reset, /health forwarded too.

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { spawn } from 'child_process';
import { WebSocketServer, WebSocket, type RawData } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const ENGINE_HOST = process.env.ENGINE_HOST || 'localhost';
const ENGINE_PORT = Number(process.env.ENGINE_PORT) || 8788;
const ENGINE_HTTP = `http://${ENGINE_HOST}:${ENGINE_PORT}`;
const ENGINE_WS = `ws://${ENGINE_HOST}:${ENGINE_PORT}/ws`;

const QUEUE_MAX = 64;             // max client→engine messages buffered while engine connecting
const QUEUE_BYTES_MAX = 1 << 20;  // 1 MiB queue cap
const ENGINE_CONNECT_TIMEOUT_MS = 5000;
const BODY_MAX = 1 << 20;          // 1 MiB request body cap

const app = express();
app.use(cors());

// ---- HTTP proxy (manual, streams through to engine) ----

// RFC 7230 §6.1 hop-by-hop headers + framing headers we control ourselves.
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

function sanitizeReqHeaders(raw: NodeJS.Dict<string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, val] of Object.entries(raw)) {
    if (val == null) continue;
    const k = rawKey.toLowerCase();
    if (k.startsWith(':')) continue;
    if (HOP_BY_HOP.has(k)) continue;
    out[k] = Array.isArray(val) ? val.join(', ') : val;
  }
  return out;
}

async function proxy(req: express.Request, res: express.Response): Promise<void> {
  const targetUrl = ENGINE_HTTP + req.originalUrl;
  let aborted = false;
  req.on('aborted', () => { aborted = true; });
  try {
    const init: RequestInit = { method: req.method, headers: sanitizeReqHeaders(req.headers) };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const c of req) {
        const b = c as Buffer;
        total += b.length;
        if (total > BODY_MAX) {
          res.status(413).json({ ok: false, error: 'body too large' });
          return;
        }
        chunks.push(b);
      }
      if (aborted) { try { res.destroy(); } catch {} return; }
      init.body = Buffer.concat(chunks);
    }
    const upstream = await fetch(targetUrl, init);
    const bodyBuf = Buffer.from(await upstream.arrayBuffer());
    if (res.headersSent) return;
    res.status(upstream.status);
    // Forward headers, dropping hop-by-hop + length/encoding (fetch already decoded body)
    upstream.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (HOP_BY_HOP.has(lk)) return;
      if (lk === 'content-length' || lk === 'content-encoding') return;
      if (lk === 'set-cookie') return;
      res.setHeader(k, v);
    });
    // Set-Cookie may be multi-value; preserve as array
    const headersAny = upstream.headers as unknown as { getSetCookie?: () => string[]; raw?: () => Record<string, string[]> };
    let setCookies: string[] | undefined;
    if (typeof headersAny.getSetCookie === 'function') setCookies = headersAny.getSetCookie();
    else if (typeof headersAny.raw === 'function') setCookies = headersAny.raw()['set-cookie'];
    if (setCookies && setCookies.length) res.setHeader('set-cookie', setCookies);
    res.send(bodyBuf);
  } catch (e: any) {
    if (!res.headersSent) {
      res.status(502).json({ ok: false, error: 'engine unreachable', detail: String(e?.message || e) });
    } else {
      try { res.destroy(e); } catch {}
    }
  }
}

app.get('/health', async (_, res) => {
  try {
    const r = await fetch(ENGINE_HTTP + '/health');
    let data: any;
    try { data = await r.json(); } catch { data = { ok: false, status: r.status, error: 'invalid JSON' }; }
    res.json({ gateway: { ok: true, port: PORT }, engine: data });
  } catch (e: any) {
    res.status(502).json({ gateway: { ok: true, port: PORT }, engine: { ok: false, error: String(e?.message || e) } });
  }
});

app.all('/state', proxy);
app.all('/admin/*', proxy);
app.all('/reset', proxy); // SnEttings reset uses this

// Dev-only shutdown — kills both gateway + engine windows. Localhost only (binding below).
app.post('/shutdown', async (_, res) => {
  console.log('🛑 gateway /shutdown — forwarding + killing windows...');
  try { await fetch(ENGINE_HTTP + '/shutdown', { method: 'POST' }); } catch {}
  res.json({ ok: true });
  // Stop accepting new conns + close existing
  try { httpServer.close(); } catch {}
  for (const ws of wss.clients) { try { ws.close(1001, 'shutdown'); } catch {} }
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq MarketVerseX-Client*'], { detached: true, stdio: 'ignore' }).unref();
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq MarketVerseX-Engine*'], { detached: true, stdio: 'ignore' }).unref();
    } catch {}
  }
  // Let response flush then exit (do NOT taskkill our own window — exit naturally)
  setTimeout(() => process.exit(0), 600);
});

// ---- HTTP + WS bridge ----
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  if (!req.url || !req.url.startsWith('/ws')) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (clientWs) => bridgeClient(clientWs));
});

function normalize(data: RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return data as Buffer;
}

function bridgeClient(clientWs: WebSocket): void {
  const engineWs = new WebSocket(ENGINE_WS);
  const queue: { buf: Buffer; isBinary: boolean }[] = [];
  let queueBytes = 0;
  let engineReady = false;
  let clientGone = false;
  let torn = false;

  const tearDown = (reason: string) => {
    if (torn) return;
    torn = true;
    try { clientWs.removeAllListeners(); } catch {}
    try { engineWs.removeAllListeners(); } catch {}
    try { clientWs.terminate(); } catch {}
    try { engineWs.terminate(); } catch {}
    console.log(`- client bridge closed (${reason})`);
  };

  const connectTimer = setTimeout(() => {
    if (!engineReady) {
      console.warn('engine WS connect timeout — terminating client bridge');
      tearDown('engine timeout');
    }
  }, ENGINE_CONNECT_TIMEOUT_MS);

  engineWs.on('open', () => {
    clearTimeout(connectTimer);
    if (clientGone || clientWs.readyState !== WebSocket.OPEN) {
      tearDown('client gone before engine ready');
      return;
    }
    engineReady = true;
    for (const m of queue) engineWs.send(m.buf, { binary: m.isBinary });
    queue.length = 0;
    queueBytes = 0;
    console.log('+ client bridged');
  });

  engineWs.on('message', (data: RawData, isBinary: boolean) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    try { clientWs.send(normalize(data), { binary: isBinary }); }
    catch (e) { console.error('client.send failed:', (e as Error).message); }
  });

  engineWs.on('close', () => tearDown('engine closed'));
  engineWs.on('error', (err) => { console.error('engine WS error:', err.message); tearDown('engine error'); });

  clientWs.on('message', (data: RawData, isBinary: boolean) => {
    const buf = normalize(data);
    if (engineReady && engineWs.readyState === WebSocket.OPEN) {
      try { engineWs.send(buf, { binary: isBinary }); }
      catch (e) { console.error('engine.send failed:', (e as Error).message); }
    } else {
      // Cap queue to prevent OOM
      if (queue.length >= QUEUE_MAX || queueBytes + buf.length > QUEUE_BYTES_MAX) {
        try { clientWs.close(1013, 'gateway queue full'); } catch {}
        tearDown('queue overflow');
        return;
      }
      queue.push({ buf, isBinary });
      queueBytes += buf.length;
    }
  });

  clientWs.on('close', () => { clientGone = true; tearDown('client closed'); });
  clientWs.on('error', () => { clientGone = true; tearDown('client error'); });
}

// Bind to 0.0.0.0 so LAN devices can connect (matches client hostname auto-detect).
// In production add auth on /shutdown + /admin/*.
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🛂 gateway listening :${PORT}  →  engine ${ENGINE_HTTP}  (ws ${ENGINE_WS})`);
});
