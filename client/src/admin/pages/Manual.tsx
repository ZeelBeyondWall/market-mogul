import { useMemo, useState } from 'react';

interface DocSection {
  id: string;
  title: string;
  icon: string;
  body: string;
}

// Single source of truth — extend as new admin features ship.
const SECTIONS: DocSection[] = [
  { id: 'overview', title: 'Overview', icon: '◧', body: `
The Market Mogul Admin Center is a multi-tab control plane for the live engine.
All admin requests authenticate via the X-Admin-Token header (set in the topbar
profile menu). Each action is recorded in the Audit Log.

Layout:
• Sidebar — section navigation grouped Overview / Operations / System.
• Topbar — search, notifications, profile.
• Main — current page content.
• Banner — broadcast messages appear at the top of every page.
`.trim() },

  { id: 'usermgmt', title: 'User Management', icon: '👥', body: `
The Users page lists every trader (player + bots) with search + filter.

How to use:
1. Filter bar: search by name/id, set minimum level, pick strategy, status (active/rekt).
2. Click any row to open the detail drawer (right side).
3. Drawer shows: profile KV, holdings table with P/L, recent trade history.

Quick actions (inside drawer):
• Give Cash — POST $amount to user's wallet (negative = remove)
• Give XP — Add/remove XP. Level auto-recomputes.
• Set Level — Direct level override (1-99). XP snaps to threshold.
• Reset Missions — Wipes daily+weekly, regenerates fresh.
• Reset Portfolio — Zeros all holdings + trade history. NUCLEAR.
• Close All Positions — Market-sells/buys to flatten user.
• Ban / Unban — Toggle .rekt flag. Banned bots can't trade; unbanned regain $100.

Tip: To bulk-give cash, use Economy → Inject (distributes across 5K bots).
`.trim() },

  { id: 'economy', title: 'Economy Controls', icon: '$', body: `
The Economy page surfaces real-time market stats and global tuning.

Stats: total registered, online, cash, net, market volume, open positions,
richest player. Per-market breakdown by stocks/crypto/forex.

Controls:
• Inject Liquidity — Adds $X distributed across up to 5,000 random bots.
  Use to revive a stalled market or fund mission rewards.
• Remove Liquidity — Inverse (capped at bot's current cash). DANGER.
• Volatility Multiplier — Scales asset.vol globally (0.1-3.0). v6 reads but
  doesn't yet apply to tickMarket — planned hookup.
• Spread Multiplier — Scales MM bot quote spread.
• Activity Multiplier — Scales bot cooldown decay.
• Events Toggle — Enable/disable scheduled news events.

Tip: Multipliers are stored as ENGINE_FLAGS. Restart resets them to defaults
unless you bake them into the engine config persistence.
`.trim() },

  { id: 'gm', title: 'Game Master Controls', icon: '⚙', body: `
The Game Master page is for balancing + testing without touching the database.

XP Operations: give/remove XP, force a level. Useful for QA-promoting a tester
to L20 to verify forex unlock UX.

Market Access: explicitly unlock or lock a market for a user. Lock = drops them
just under the unlock threshold for that market.

Mission Control: force-complete or reset missions. Use to test reward flow.

Event Triggers: 12 quick buttons for common events (EARNINGS BEAT, TECH SECTOR
BOOM, CRYPTO RALLY, etc.) plus a random fire button.

Time Simulation: fast-forward engine by 1h/6h/24h/7d. Ticks queue into the main
loop (no race). Long fast-forwards may make the live UI feel laggy for ~30s.

Tip: GM actions all flow through the audit log. Don't worry about losing trail.
`.trim() },

  { id: 'emergency', title: 'Emergency Controls', icon: '🚨', body: `
The Emergency page contains break-glass controls. Every action requires confirm.

Trading Controls:
• Halt All Trading — Rejects every player order with "Trading halted by admin".
  Bots continue trading among themselves unless also disabled below.
• Disable Bot Trading — engine.config.botsEnabled = false. Bots freeze; player
  can still trade (against existing limit orders).
• Disable News Events — Stops scheduled event firing. Admin can still manually
  fire from GM page.

System Controls:
• Maintenance Mode — Flag flipped; gateway/connect logic can read it.
• Block New Registrations — Flag for future gateway integration.

Broadcast: pushes a banner (max 280 chars) to every connected client snapshot.
Rate-limited to 1 per 2s.

Server Health: live uptime, memory, traders, clients. Memory >80% turns the
bar amber.

Nuclear Options:
• Reset Game State — Wipes state.json + reinitializes engine in-place. Requires
  typing RESET to confirm.
• Purge REKT Bots — Removes bots flagged .rekt + clears their book orders.
`.trim() },

  { id: 'analytics', title: 'Analytics Dashboard', icon: '📊', body: `
The Analytics page renders live charts from the rolling buffer.

Time Filter: 1H (5s resolution from in-memory buffer), 6H/24H/7D (hourly
rollup buffer kept for 7 days).

KPI Row: online now, total trades sum, total volume, active traders.

Main Chart: trade frequency over time. Spikes correlate with news events.

Side Charts: volume trend + online users.

Heatmap: union of top gainers + losers + most-volume assets, colored by % chg.

Top Lists: top gainers (green), top losers (red), most active (volume).

Per-Market Bars: volume share between stocks/crypto/forex.

Export CSV: downloads the visible time series.

Note: data is in-memory only. Server restart wipes the buffer.
`.trim() },

  { id: 'news', title: 'News Management', icon: '📰', body: `
News firing is scheduled by the engine every 20-45s (when eventsEnabled=true).
The catalog has 44 event types covering earnings, analyst, industry, economy,
regulatory, product, supply, sentiment, and cross-market scenarios.

Admin paths:
• GM page → Event Triggers → click any preset → POST /admin/event {title}
• GM page → "Fire Random Event" → POST /admin/event {} → engine picks weighted
• Emergency → Disable News Events stops scheduled firing entirely.

To add a new event type, edit shared/engine/constants.ts NEWS_EVENTS and rebuild
the client + restart the engine.

Each fired event tags assetIds at fire-time so the per-stock News filter works.
`.trim() },

  { id: 'bots', title: 'Bot Management', icon: '🤖', body: `
Bots are stored in engine.state.traders[1..N] (index 0 is the player).

Spawn: legacy endpoint POST /admin/spawn {n, strategy?} — n capped at 1M.

Kill by strategy: POST /admin/kill-strategy {strategy} — sets cash + holdings to 0
for every bot of that strategy. They become REKT (cannot trade).

Purge: POST /admin/purge-rekt — removes REKT entries from the array entirely
(re-indexes IDs, clears all book orders so owner IDs stay valid).

Bot levels: weighted random at spawn (50% L1-5, 5% L26-50). Bots earn XP each
2s cleanup sweep (5 XP × trades since last sweep). They mutate strategies based
on win/loss/grind transitions in shared/engine/constants.ts TRANSITIONS.

Scaling: BOTS_PER_TICK env var (default 5000) caps per-tick bot decisions.
At 100K bots this gives 2s full rotation; at 500K, 10s.
`.trim() },

  { id: 'markets', title: 'Market Controls', icon: '📈', body: `
Three markets are configured: stocks (60), crypto (25), forex (15).
ASSETS array lives in shared/engine/constants.ts. Each asset has:
  id, name, icon, cat, market, minLevel, fairValue, div, vol, float, desc

Add a new asset:
1. Append to ASSETS array with all fields.
2. The engine seeds it on next freshState() or as a fresh entry in current state.
3. Restart engine to pick up new assets in initialized state.

Unlock thresholds (UNLOCK_LEVELS):
• stocksBasic: 1   stocksAll: 5
• crypto: 10
• forex: 20
• advanced: 30 (reserved)
• premium: 50 (meme coins + exotic forex)
`.trim() },

  { id: 'permissions', title: 'Permissions System', icon: '🔑', body: `
v6 ships with single-token auth — no roles yet.

How auth works:
1. Operator sets MM_ADMIN_TOKEN env var on the engine process.
2. Admin client adds X-Admin-Token header to every /admin/* request.
3. Global middleware in services/engine/src/index.ts rejects mismatch with 401.

Dev mode: if MM_ADMIN_TOKEN is unset, the gate is OPEN. A loud startup banner
warns every 60s. NEVER deploy without setting the token.

Topbar profile menu → Settings sets token + actor name. Both stored in
localStorage (mm_admin_token, mm_admin_actor). Actor name is logged with each
audit entry.

Future roles: extend the gate middleware to read role from a JWT payload or
DB lookup; add per-endpoint role requirements.
`.trim() },

  { id: 'audit', title: 'Audit Logs', icon: '◰', body: `
Every mutating admin action goes through the wrap() helper in services/engine/
src/admin/api.ts. It logs: timestamp, actor, action, target, sanitized payload,
result (ok/error), reason on error.

Storage:
• In-memory ring of 1000 most-recent entries (fast UI reads).
• Append-only JSONL file at services/engine/admin-audit.jsonl on disk.
• Sensitive keys (token/password/secret/apikey) are scrubbed before writing.

Audit Log page:
• Pulls /admin/audit?limit=500 every 5s.
• Filter by actor/action/target substring + result + action prefix.
• Export filtered set as JSON.

Legacy endpoints (/admin/event, /admin/spawn, /admin/reset, /admin/purge-rekt,
/admin/kill-strategy) currently DO NOT log to audit — they were registered
before the wrap() helper existed. Future: migrate them too.
`.trim() },

  { id: 'deploy', title: 'Deployment Information', icon: '🚀', body: `
Current deployment: AWS Lightsail Mumbai, 16GB RAM / 4 vCPU / 320GB SSD.

Stack (3 processes via pm2):
• mm-engine — engine (port 8788, internal). Owns state, ticks 10Hz.
• mm-gateway — WS+HTTP reverse proxy (port 8787, public). Bridges browser → engine.
• nginx — serves static client dist + proxies API → gateway.

Deploy command (saved as ~/deploy.sh on VPS):
  git pull && npm install --no-audit --no-fund
  npm --prefix services/engine install
  npm --prefix services/gateway install
  npm --prefix client install
  npm --prefix client run build
  sudo cp -r client/dist/* /var/www/marketmogul/
  pm2 restart mm-engine mm-gateway

One-liner from your laptop:
  ssh -i "C:\\Users\\Zeel\\Downloads\\3112.pem" ubuntu@52.66.176.80 "~/deploy.sh"

Set admin token (one-time):
  pm2 set mm-engine:env.MM_ADMIN_TOKEN <long-random-string>
  pm2 restart mm-engine

Bots tuning:
  pm2 set mm-engine:env.MM_BOTS_PER_TICK 8000
  pm2 restart mm-engine
`.trim() },

  { id: 'trouble', title: 'Troubleshooting', icon: '🔧', body: `
Common issues:

1. "Server unreachable" in admin
   → Check engine process is running: pm2 list
   → Check port 8787 is reachable from your IP (Lightsail firewall)
   → Check gateway logs: pm2 logs mm-gateway

2. "Invalid admin token"
   → Token in profile menu mismatches MM_ADMIN_TOKEN env on server.
   → pm2 env mm-engine | grep ADMIN to verify what's set.

3. Bots stop ticking / chart frozen
   → Check Emergency page: Disable Bot Trading might be ON.
   → Check engine CPU: pm2 monit. If at 100%, lower MM_BOTS_PER_TICK.

4. Player level not updating after trades
   → Check the trade actually CLOSED (not just opened). XP only awarded on close.
   → Verify in Stats tab "Total Trades" counter ticks.

5. Mission progress not moving
   → Daily missions only count trades closed since UTC 00:00.
   → "distinct" goals count unique assets — repeated trades on same asset = no progress.

6. State.json grows huge
   → Run /admin/purge-rekt to compact bot list.
   → Save interval auto-scales to 60s at 100K+ bots.

7. Out-of-memory
   → 100K bots ≈ 1-2GB RAM. 500K ≈ 5-6GB.
   → Indicators are lazy (only trend bots), so memory shouldn't balloon.
   → Restart engine if it crosses 90% heap; check leak with pm2 monit.

8. Game UI not loading
   → Browser console errors?
   → nginx logs: sudo tail -f /var/log/nginx/error.log
   → Rebuild client: cd client && npm run build, then deploy.
`.trim() },
];

export default function Manual() {
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState<string>('overview');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SECTIONS;
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(needle) ||
      s.body.toLowerCase().includes(needle) ||
      s.id.includes(needle)
    );
  }, [q]);

  const active = SECTIONS.find(s => s.id === activeId) || SECTIONS[0];

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Admin Manual</h1>
          <div className="a-page-sub">Operations runbook + reference for every admin function</div>
        </div>
        <div className="a-page-actions">
          <div className="a-topbar-search" style={{ width: 260 }}>
            <span style={{ color: 'var(--a-text-mute)' }}>⌕</span>
            <input
              placeholder="Search the manual…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="a-card glass" style={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 600 }}>
          <div style={{ borderRight: '1px solid var(--a-border)', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)', padding: '10px 6px' }}>
            {filtered.map(s => (
              <div
                key={s.id}
                className={'a-nav-item' + (s.id === activeId ? ' active' : '')}
                onClick={() => setActiveId(s.id)}
              >
                <span className="a-nav-icon">{s.icon}</span>
                <span>{s.title}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="a-empty" style={{ padding: 18 }}>No matches for "{q}"</div>
            )}
          </div>
          <div style={{ padding: '20px 28px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            <div style={{ fontSize: 11, color: 'var(--a-text-mute)', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>
              {active.icon} Section
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 18px', letterSpacing: '-.3px' }}>
              {active.title}
            </h2>
            <pre style={{
              fontFamily: 'var(--a-font)',
              fontSize: 13,
              lineHeight: 1.65,
              color: 'var(--a-text)',
              whiteSpace: 'pre-wrap',
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
            }}>{active.body}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
