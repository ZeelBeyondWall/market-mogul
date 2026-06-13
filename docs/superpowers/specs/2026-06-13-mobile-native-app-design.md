# Native Mobile App (React Native + Expo) — Milestone 1: Core Trading Loop

**Date:** 2026-06-13
**Status:** Approved by Zeel ("tu kar de")

## Goal

A real native Android/iOS app (not a WebView wrap) for MarketVerseX, reusing
the existing Node server unchanged. Milestone 1 delivers the core trading
loop end-to-end to prove the architecture before adding the rest of the
screens.

## Decisions (locked)

- **Tech:** React Native + Expo (managed), TypeScript.
- **Repo:** new `mobile/` folder in the SAME monorepo, so it imports
  `shared/engine/*` directly (the key reuse). Metro configured to watch
  `../shared`.
- **Server:** unchanged. Mobile connects to the same WS gateway
  (`ws://52.66.176.80:8787/ws` in dev; `wss://<domain>` for production later).
- **State:** zustand (reused, AsyncStorage instead of localStorage).
- **Auth:** `@supabase/supabase-js` + AsyncStorage, same Supabase project.
- **Chart:** `@shopify/react-native-skia` (port the web canvas draw logic).
- **Nav:** react-navigation bottom tabs.

## Milestone 1 scope (core loop only)

| Screen | What |
|---|---|
| Auth | Supabase email login/signup |
| Markets | asset list with live price + % change, tap to select |
| Chart | Skia candlestick chart for active asset, live ticks, TF row |
| Trade | Buy / Sell / Short + qty input → `order` WS message |
| Positions | open positions with live P&L, close button |

Bottom tabs: Markets · Trade · Positions.

## Reuse strategy

- **Import as-is:** `shared/engine/types.ts`, `constants.ts`, `helpers.ts`,
  `orderbook.ts` (pure TS, no DOM/web deps).
- **Port (adapt) from web client:**
  - `net/wsClient.ts` → `mobile/src/net/ws.ts`: RN has global `WebSocket`;
    connection/auth/snapshot/tick/merge logic is ~90% identical. Drop
    `location`/`import.meta` (use a config constant).
  - `store/gameStore.ts` → `mobile/src/store/game.ts`: same zustand shape,
    minus UI-only prefs; persistence via AsyncStorage; no DOM theme code.
- **Rewrite:** all UI in RN primitives (View/Text/Pressable/FlatList) and the
  chart in Skia.

## Architecture / data flow

```
App boot → Supabase session restore
  → WS connect to gateway (send auth token)
    → server: snapshot (assets, candles, holdings) + 10Hz ticks
      → zustand store updates
        → screens read store; Chart self-draws on a Skia frame loop
Buy/Sell tap → send {type:'order', payload:{aid, side, qty, orderType}}
  → server fills → next tick reflects new position/cash
```

## Dev / run

- `cd mobile && npm install && npx expo start` → scan QR with Expo Go on the
  phone. App connects directly to the VPS public IP (works on any network;
  Android cleartext allowed in Expo dev).
- The anon Supabase key + VPS WS URL live in `mobile/src/config.ts`.

## Out of scope (later milestones)

Portfolio, Leaderboard, Store, Dashboard, Missions, Profile, cosmetics,
indicators, notifications, push, store-access gating, deep chart interactions
(pinch/pan), watchlist. Production prerequisites: a domain + `wss://` (TLS)
so the production build (no cleartext) can connect, plus a release signing
config in Android Studio for the Play Store AAB.

## Error handling

- WS reconnect with backoff (port existing logic).
- Auth failure → stay on Auth screen with message.
- No snapshot yet → loading state on screens.
- Order rejected (`order_result` ok:false) → toast with reason.

## Testing

- `tsc` typecheck of the mobile project.
- Manual on device: login → see live prices → open chart → buy → see position
  → close. Verify reconnect by toggling airplane mode.
