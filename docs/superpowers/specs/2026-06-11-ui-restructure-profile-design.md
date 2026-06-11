# UI Restructure: Trade Panel Cleanup + Profile Screen

**Date:** 2026-06-11
**Status:** Approved by Zeel

## Problem

The trade-panel tab grid (`Tabs.tsx`) holds 9 tabs, half of which are not
market-related: Missions is game-meta, Traders duplicates the Leaderboard
page, Stats/History are personal data, and Book is power-user-only. The grid
is a junk drawer and there is no dedicated place for player identity.

## Decisions (locked with user)

| Item | Decision |
|---|---|
| Trade panel tabs | Keep only `Positions · Details · Movers · News` |
| Order Book | Remove tab; open via Chart context menu → small modal |
| Missions | Move to Home dashboard as a section card |
| Traders tab | Delete usage (Leaderboard page is the ranking home) |
| History | Move into Portfolio page as a History section |
| Stats + identity | New Profile screen (option C: Portfolio = money, Profile = identity) |
| Profile entry point | Tap avatar/level in Header |
| Profile contents | Identity card + Stats + cosmetics showcase (option A) |
| BottomNav | Unchanged (6 buttons) |

## Design

### 1. Trade panel — `client/src/components/Tabs.tsx`

- `TABS` array trimmed to: positions, details, movers, news.
- `TabId` union type keeps all ids (persistence back-compat); only the
  rendered list shrinks. `help` content render stays (opened from Help
  button elsewhere).
- Sanitize persisted `activeTab`: if the saved tab is no longer in the
  rendered list (book/stats/history/missions/bots), fall back to
  `positions` on load (in `loadPrefs` or at render).
- `BotsTab` import/usage removed from Tabs.

### 2. Order Book via chart — `client/src/components/Chart.tsx`

- New item "Order Book" in the existing chart context menu
  (`.chart-ctx-menu`).
- Click → small modal reusing the existing `chart-modal-overlay` /
  `chart-modal` pattern, rendering `<OrderBook />`.
- Mobile: context menu opens on long-press (works on Android Chrome).
  Known limitation: iOS Safari long-press `contextmenu` is unreliable —
  if reported, add a small book icon to the chart header (out of scope
  now).

### 3. Missions on Home — `client/src/components/DashboardPage.tsx`

- Embed existing `<MissionsTab />` as a "Missions" section card in both
  the mobile dash container and the desktop dash layout.
- No changes to mission logic/claiming — same component, new home.

### 4. Portfolio History — `client/src/components/PortfolioPage.tsx`

- Add a "Trade History" section embedding existing `<TradeHistoryTab />`
  in the main content area (below holdings), mobile + desktop.

### 5. Profile screen (new) — `client/src/components/ProfilePage.tsx`

- New `activeScreen` value `'profile'`:
  - `gameStore.ts`: extend `activeScreen` union + setter type.
  - `App.tsx`: render `<ProfilePage />` for it.
  - `index.css` mobile block: add `#app > .profile-page` (root class) to
    the grid-row-4 pinning selector list — REQUIRED, otherwise the
    mobile void-gap bug returns.
- Entry point: in `Header`, tapping the avatar/username/LevelShield sets
  `activeScreen('profile')`.
- Contents (top to bottom):
  1. **Identity card** — name (with equipped name color), equipped frame
     around avatar, equipped badge, `LevelShield`, XP progress bar
     (`xpAtCurrent`/`xpToNext`), global rank (`playerRank`), streak
     (`playerStreak`).
  2. **Stats** — reuse `StatsTab` content (playerStats: trades, win rate,
     P&L, etc.).
  3. **Cosmetics showcase** — owned cosmetics grid (`ownedCosmetics`)
     with equip/unequip switching via existing setters
     (`setEquippedFrame/Badge/NameColor`). No purchasing — Store keeps
     that.
- Styling: follow neon-arcade HUD conventions (hud-panel etc.), new CSS
  scoped file `client/src/styles/arcade-profile.css` following the
  pattern of `arcade-portfolio.css`.

## Not changing

BottomNav layout, Store, LeaderboardPage, trading/order flow, server,
admin. No server/protocol changes at all — purely client.

## Error handling / edge cases

- Stale persisted `activeTab` → positions fallback.
- Profile with zero owned cosmetics → showcase shows empty-state hint
  ("Store se cosmetics lo").
- `playerStats` null (pre-first-snapshot) → StatsTab already handles.

## Testing

- Manual: each moved feature reachable in its new home (desktop +
  mobile ≤820px): Book via chart menu, Missions on Home, History in
  Portfolio, Stats/cosmetics in Profile.
- Mobile layout: Profile page fills the 1fr row (no void gap), scrolls
  internally.
- Stale `activeTab: 'book'` in localStorage loads without blank panel.
- `npx tsc -b` + `vite build` clean.
