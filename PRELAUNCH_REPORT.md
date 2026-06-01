# Pre-Launch Audit Report — MarketVerseX (v9)
_For the 100-tester release._

A full audit of the spec'd player features, leaderboard, and mobile UX was run
against the live codebase. Below: what already existed, what was added/improved,
mobile work, bugs fixed, and remaining recommendations.

---

## 1. Existing features found (already working, untouched)

| Feature | Where |
|---|---|
| Portfolio holdings (qty, avg, current, unrealized P&L) | `PositionsTab.tsx` |
| Realized P&L + win rate + stats | `StatsTab.tsx`, server `getPlayerStats()` |
| Watchlist (add/remove ⭐, quick-trade) | `AssetList.tsx`, store `watchlist` |
| User profile data (level, XP, net worth, rank) | `Header.tsx`, `StatsTab.tsx` |
| Asset details (info, volume, news, price history, market cap) | `StockDetailsTab.tsx` |
| Market Movers (gainers/losers/most-active) | `MoversTab.tsx` |
| Order-fill + SL/TP transient toasts | `OrderToast.tsx`, `wsClient.ts` |
| News engine + per-asset news | `NewsTab.tsx`, server events |
| Closed-trade data captured server-side | `Trader.playerTrades` |

## 2. New features added

| Feature | Implementation |
|---|---|
| **Notification Center** (bell + history, unread badge) | `NotificationCenter.tsx`, store `notifications` |
| **Level-up / mission-complete / news notifications** | detected in `wsClient.ts` (`prevLevel`, `seenCompletedMissions`) |
| **Trade History tab** (asset/side/qty/entry→exit/pnl/%/duration + summary) | `TradeHistoryTab.tsx`, snapshot `recentTrades` |
| **Asset Allocation donut** (conic-gradient + legend, cash slice) | `PositionsTab.tsx` |
| **Price Alerts** (per-asset target, persisted, fires + notifies) | `StockDetailsTab.tsx`, `wsClient.ts` tick check |
| **Holders count** per asset (live, cached) | snapshot `activeHolders`, `StockDetailsTab.tsx` |
| **Feedback / Bug Report** (player modal → `/feedback`) | `FeedbackModal.tsx`, public server endpoint |
| **Admin Feedback viewer** (bugs/ideas/other, export JSON) | `admin/pages/Feedback.tsx`, `/admin/feedback` |
| **Leaderboard player/bot/combined split** | `BotsTab.tsx` view toggle + `isPlayer` flag in payload |

## 3. Features improved

- **Leaderboard**: was a single mixed list. Now a **Bots / You / All** toggle.
  `isPlayer` flag added to the leaderboard payload (server `computeLeaderboard`,
  `protocol`, store). Bots view = the real competition; You view = your rank;
  All = combined, clearly labelled. House MM already excluded.
- **Notifications**: were transient-only. Now persisted in a center with history
  and unread counts; every order fill, SL/TP, level-up, mission, news, and price
  alert lands there.
- **Asset details**: added Holders + Unlock-Level rows, and an inline Price
  Alerts box.

## 4. Mobile UI improvements (was desktop-only, unusable on phones)

- **Bottom navigation bar** (mobile-only): Markets · Trade · Portfolio · Alerts.
  Switches which single pane is visible (`#app[data-mv]` + CSS).
- **Single-pane mobile layout**: the 3-column desktop grid collapses; one pane at
  a time on ≤820px — no more negative-width center column.
- **Trade bar stacks vertically** on mobile (inputs → full-width buttons →
  position row); removed the `min-width:280px` that blocked wrapping.
- **Header compacts**: brand + level + stat cards wrap into rows; stats flex to
  fill width.
- **Market bar** scrolls horizontally; desktop-only action buttons hidden (moved
  to bottom nav / settings).
- **Tab grid** drops to 3 columns; bigger tap targets (watch star, tabs, view
  toggles bumped toward 44px).
- Extra `@media (max-width:380px)` pass for very small phones.
- Reuses existing `viewport` meta (`user-scalable=no`).

## 5. Bugs fixed (caught by adversarial review before commit)

| Sev | Bug | Fix |
|---|---|---|
| **Critical** | Price-alert loop mutated the alerts array while iterating → fired alerts skipped | collect hits first, remove after the loop |
| **Critical** | `activeHolders` scanned ALL traders per client per snapshot (≈50M ops at 100 clients × 500k bots) | cache holders-per-asset once / 1.5s, iterate only each trader's own sparse holdings |
| **High** | Allocation donut `conic-gradient` divided by `totalVal` with no zero guard → NaN stops | guard `totalVal>0`, fallback flat ring; dropped dead color reassignment |
| **Med** | `feedbackLast` rate-limit map grew unbounded | purge entries >10 min when size >5000 |
| **Med** | `require('fs')` in ESM context threw (feedback write + admin read failed) | top-level `import fs/path` in `index.ts` + `admin/api.ts` (also fixed latent `/reset`, `/admin/reset`) |
| **Low** | FeedbackModal showed "Could not reach server" on a 5xx with body | check `r.ok` + tolerate non-JSON |
| **Low** | TradeHistory rows keyed by array index | composite key `asset-entryTs-exitTs-i` |
| **Low** | Redundant `x.isPlayer ||` in bots-view filter | removed (player already excluded) |

## 6. Verification done

- `tsc --noEmit` clean: engine, gateway, client.
- `vite build` clean (377 KB JS / 79 KB CSS).
- Runtime smoke (engine on test port): `/feedback` POST + `/admin/feedback`
  read round-trip OK; WS snapshot confirmed `recentTrades` array, `activeHolders`
  (cached, =24), and `isPlayer` flag present on leaderboard entries.

---

## 7. Remaining recommendations before 100 testers

**Should-do (low effort, high value):**
1. **Run an admin Reset after deploy** so the House MM + banded economy + fresh
   $1000 traders are live (existing save still has old state).
2. **Set `MM_ADMIN_TOKEN`** in prod (`pm2 set mm-engine:env.MM_ADMIN_TOKEN …`) —
   without it the admin API is open.
3. **Manually test the mobile layout** on a real phone (Chrome dev-tools device
   mode at 375px is a good first pass) — confirm bottom-nav pane switching and
   the stacked trade bar feel right; tweak heights if the chart feels short.

**Nice-to-have (post-launch):**
4. Price alerts are **client-side only** — they fire only while the tab is open.
   For background alerts you'd need a server-side alert store + push. Fine for a
   test cohort; note it to testers.
5. Notification center is **session-only** (not persisted across reloads). Persist
   to localStorage if testers want history to survive refresh.
6. Bot leaderboard at 30k–500k bots returns top-200 only; that's intended, but
   consider a "your nearby ranks" slice so mid-pack players see neighbours.
7. The 5s full-snapshot resync is the main per-client cost; if 100 concurrent
   testers strain CPU, lower snapshot frequency or diff-encode.
8. Single-human architecture means the **"You" leaderboard is one row** — keep
   "Bots" as the default competition view (already is).

**Not blocking:** allocation donut, trade history, holders, feedback, and
notifications are all wired and built; no known correctness bugs remain after the
review pass.

---

### Deploy
```
ssh -i "C:\Users\Zeel\Downloads\3112.pem" ubuntu@52.66.176.80 "~/deploy.sh"
# then, once:
#   pm2 set mm-engine:env.MM_ADMIN_TOKEN "<random>"   (if not already)
#   admin → Emergency → Reset Game State
```
Hard-refresh the browser (Ctrl/Cmd+Shift+R) after deploy to bust the CSS cache.
