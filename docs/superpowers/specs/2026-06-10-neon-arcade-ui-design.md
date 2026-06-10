# Neon Arcade HUD — UI Reskin Design

**Date:** 2026-06-10
**Status:** Approved by user (mockup + direction)
**Phase:** 2 of roadmap pulled forward at user request (UI before engagement implementation)
**Scope:** client-only visual reskin. Engine, gateway, gameplay logic, WS protocol untouched.

## Direction
"Game HUD — neon arcade": mobile-game feel (Clash Royale × trading terminal) on both desktop and mobile.

## Visual system

**Palette (evolution of existing, not replacement):**
- Base layers deepen: page `#070a12`, panel `#0c1120`, inset `#0a0e17`, border `#233052` / `#1c2438`
- Gold `#dfa637` stays = reward color (gems, milestones, premium)
- New neon accents: cyan `#22d3ee` (XP / interactive / active states), green `#34d399` (buy/gain), rose `#f43f5e` (short/loss/streak flame), purple `#a78bfa` (events/secondary)
- Text contrast ≥ 4.5:1 everywhere

**Typography:**
- Russo One (Google Fonts) = display only: page titles, level numbers, buttons, big counters
- Plus Jakarta Sans = body (unchanged); JetBrains Mono = numerics (unchanged)
- No pixel fonts (rejected: unreadable for trading data)

**Game elements:**
- Header → HUD strip: hexagonal level shield (inline SVG), glowing XP bar with shimmer, gem/streak pills, count-up animation on cash changes
- Buttons → chunky arcade: flat top + 3px darker bottom edge (pressable 3D), `:active` translateY(2px), Russo One caps
- Cards → HUD panels: subtle angular corner accents, hover = border glow (never scale — no layout shift)
- Mobile bottom nav → console dock: active tab glow, raised circular center trade button
- Emoji icons → single inline-SVG icon set (`client/src/ui/icons.tsx`, Lucide-style outline, 24×24 viewBox)
- Juice: skeleton shimmer for loading, win/loss flash on trade close, upgraded confetti celebrations
- `prefers-reduced-motion`: all decorative animation disabled

## Architecture (conflict-free parallel implementation)
- `client/src/styles/arcade.css` — NEW shared token + utility layer (CSS variables, `.hud-panel`, `.arcade-btn`, `.xp-bar`, `.hud-pill`, `.dock`, shimmer/glow keyframes, reduced-motion guards). Imported once in `main.tsx` after `index.css`; overrides via higher specificity/late cascade, existing `index.css`/`Pages.css` untouched where possible.
- `client/src/ui/` — NEW: `icons.tsx` (SVG set), `LevelShield.tsx`, `useCountUp.ts`
- Per-surface override stylesheets imported by their component: `arcade-header.css`, `arcade-dashboard.css`, `arcade-trading.css`, `arcade-portfolio.css`, `arcade-leaderboard.css`, `arcade-store.css`
- Component edits: Header, BottomNav, DashboardPage, TradePanel, Tabs, AssetList, MobileTradingPage, PortfolioPage, LeaderboardPage, StorePage
- **Out of scope:** Chart.tsx internals (1681L canvas logic — only surrounding chrome), admin SPA, theme-switcher mechanics (additive classes only, existing theme hooks preserved)

## Acceptance
- `tsc -b && vite build` clean
- No horizontal scroll at 375px; desktop 3-col grid intact at 1440px
- All interactive elements: cursor-pointer, visible focus, ≥44px touch targets (mobile)
- No emoji glyphs left as UI icons on reskinned surfaces
- Functionality identical (no WS/store logic changes)
