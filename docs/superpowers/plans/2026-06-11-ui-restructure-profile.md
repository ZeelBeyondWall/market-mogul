# UI Restructure + Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim the trade-panel tab grid to market-only tabs and relocate Book/Missions/History/Stats/Traders to their proper homes, adding a new Profile screen.

**Architecture:** Pure client-side React/zustand changes. Existing tab components (`OrderBook`, `MissionsTab`, `TradeHistoryTab`, `StatsTab`) are re-hosted, not rewritten. New `ProfilePage` becomes a sixth `activeScreen` value entered from the Header avatar. Cosmetics catalog extracted from StorePage into a shared data module.

**Tech Stack:** React 18, zustand, plain CSS (neon-arcade HUD conventions). No test framework in repo — verification = `npx tsc -b` + `npx vite build` + manual checks.

**Spec:** `docs/superpowers/specs/2026-06-11-ui-restructure-profile-design.md`

---

### Task 1: Extract cosmetics catalog to shared module

**Files:**
- Create: `client/src/data/cosmetics.ts`
- Modify: `client/src/components/StorePage.tsx` (remove local copy, import shared)

- [ ] **Step 1: Create `client/src/data/cosmetics.ts`** — move `CosmeticItem` interface, `COSMETICS_LIST`, and `rarityClass` from `StorePage.tsx:13-51` verbatim, with exports:

```ts
export interface CosmeticItem {
  id: string;
  name: string;
  cost: number;
  type: 'frame' | 'badge' | 'name_color' | 'theme';
  previewUrl?: string;
  value: string; // The CSS class or style value
}

export const COSMETICS_LIST: CosmeticItem[] = [ /* …exact list from StorePage… */ ];

export const rarityClass = (cost: number) => (cost >= 400 ? 'rarity-gold' : cost >= 150 ? 'rarity-purple' : '');
```

- [ ] **Step 2:** In `StorePage.tsx` delete the local interface/list/helper and add `import { COSMETICS_LIST, rarityClass, type CosmeticItem } from '../data/cosmetics';`
- [ ] **Step 3:** `cd client && npx tsc -b --force --noEmit` → clean.
- [ ] **Step 4:** Commit `refactor: extract cosmetics catalog to shared data module`.

### Task 2: Trim trade-panel tabs + sanitize stale activeTab

**Files:**
- Modify: `client/src/components/Tabs.tsx`
- Modify: `client/src/store/gameStore.ts` (`loadPrefs`)

- [ ] **Step 1:** In `Tabs.tsx`, reduce `TABS` to positions/details/movers/news; delete content renders + imports for book, stats, history, missions, bots (keep `help` content render — opened externally). Remove now-unused icon imports.
- [ ] **Step 2:** In `gameStore.ts` `loadPrefs()`, after merging parsed prefs, sanitize:

```ts
const VALID_TABS: TabId[] = ['positions', 'details', 'movers', 'news', 'help'];
if (!VALID_TABS.includes(merged.activeTab)) merged.activeTab = 'positions';
```

(`TabId` union type keeps the removed ids so old persisted prefs still parse.)
- [ ] **Step 3:** Typecheck clean.
- [ ] **Step 4:** Commit `feat(ui): trim trade panel to market-only tabs`.

### Task 3: Order Book via chart context menu modal

**Files:**
- Modify: `client/src/components/Chart.tsx`

- [ ] **Step 1:** Import `OrderBook`; add `const [showBookModal, setShowBookModal] = useState(false);`
- [ ] **Step 2:** Add context-menu item after "Reset Chart View":

```tsx
<div className="chart-ctx-item" onClick={() => { setShowBookModal(true); setContextMenu(null); Audio.click(); }}>
  Order Book
</div>
```

- [ ] **Step 3:** Add modal (next to the indicators modal, same overlay pattern):

```tsx
{showBookModal && (
  <div className="chart-modal-overlay" onClick={() => setShowBookModal(false)}>
    <div className="chart-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
      <div className="chart-modal-header">
        <h3>Order Book — {a.id}</h3>
        <button className="chart-modal-close" onClick={() => setShowBookModal(false)}>×</button>
      </div>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px 14px' }}>
        <OrderBook />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4:** Reset `showBookModal` in the asset/TF-change reset effect.
- [ ] **Step 5:** Typecheck clean. Commit `feat(chart): order book opens from chart context menu`.

### Task 4: Missions on Home dashboard

**Files:**
- Modify: `client/src/components/DashboardPage.tsx`

- [ ] **Step 1:** Import `MissionsTab`. In the mobile dash container (`.mmo-mobile-dash-container`, main return), append as last section:

```tsx
<section className="mmo-mobile-card hud-panel dash-missions">
  <h4 className="dash-missions-title disp">MISSIONS</h4>
  <MissionsTab />
</section>
```

- [ ] **Step 2:** In the desktop layout (`.mmo-dash-layout`), append the same card (div instead of section) at the end of the sidebar column (or main column if no sidebar slot fits — match surrounding markup).
- [ ] **Step 3:** Typecheck + visual sanity. Commit `feat(dashboard): missions section on home`.

### Task 5: Trade History in Portfolio

**Files:**
- Modify: `client/src/components/PortfolioPage.tsx`

- [ ] **Step 1:** Import `TradeHistoryTab`. Append at end of `.page-main-content`:

```tsx
<div className="pf-history-card hud-panel" style={{ marginTop: 16 }}>
  <h3 className="section-title disp">TRADE HISTORY</h3>
  <TradeHistoryTab />
</div>
```

- [ ] **Step 2:** Typecheck. Commit `feat(portfolio): trade history section`.

### Task 6: Profile screen

**Files:**
- Modify: `client/src/store/gameStore.ts` (activeScreen union × 3 places)
- Create: `client/src/components/ProfilePage.tsx` (root class `profile-page page-container arcade-profile`)
- Create: `client/src/styles/arcade-profile.css`
- Modify: `client/src/App.tsx` (import + route)
- Modify: `client/src/components/Header.tsx` (avatar taps → profile)
- Modify: `client/src/index.css` (mobile grid-row pinning selector)

- [ ] **Step 1:** `gameStore.ts`: add `'profile'` to the `activeScreen` union in `UIPrefs`, the `setActiveScreen` signature, and anywhere else the literal union repeats.
- [ ] **Step 2:** Create `ProfilePage.tsx`:
  - Identity card: avatar emoji (same level thresholds as Header) wrapped in equipped frame class, username (session metadata fallback chain like Header) tinted with `equippedNameColor`, equipped badge img, `LevelShield`, XP bar from `playerXp/xpAtCurrent/xpToNext`, `#playerRank`, streak.
  - Stats section: render `<StatsTab />`.
  - Cosmetics showcase: `COSMETICS_LIST` filtered to OWNED items (frames/badges/colors; themes excluded), reusing `cosmetic-item-card` classes from `Pages.css`; equip toggle mirrors Store conventions (frames/badges equip by `item.id`, colors by `item.value`); empty state hint pointing to Store.
- [ ] **Step 3:** `arcade-profile.css`: page scroll container, identity card layout, XP bar, showcase grid — hud-panel conventions.
- [ ] **Step 4:** `App.tsx`: render `<ProfilePage />` when `activeScreen === 'profile'`.
- [ ] **Step 5:** `Header.tsx`: mobile `.mobile-hdr-profile` and desktop `.hdr-profile-card` onClick → `setActiveScreen('profile')` (Settings stays on the Settings button).
- [ ] **Step 6:** `index.css` mobile block: add `#app > .profile-page,` to the grid-row-4 pinning selector list (REQUIRED — see memory `mobile-grid-row-pinning`).
- [ ] **Step 7:** Typecheck + `npx vite build` clean. Commit `feat(profile): dedicated profile screen with identity, stats, cosmetics`.

### Task 7: Final verification + deploy

- [ ] **Step 1:** `cd client && npx tsc -b --force --noEmit && npx vite build` → clean.
- [ ] **Step 2:** Manual checklist (desktop + ≤820px): 4 tabs only; Book via chart right-click; Missions on Home; History in Portfolio; avatar tap → Profile (no mobile void gap, scrolls); stale `activeTab:'book'` localStorage → Positions.
- [ ] **Step 3:** Push + `bash ~/deploy.sh` on VPS.
