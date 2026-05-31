# MarketVerseX

Browser stock-trading sim. $100 vs 500 evolving AI traders + real order matching. Now with **server-authoritative engine** — bots run 24/7 even when browser tab closed.

## Architecture

```
/
├── client/   — React + TS + Vite + Zustand (UI only)
├── server/   — Node + Express + ws (engine + matching + bots, 10 Hz tick)
└── shared/
    └── engine/  — pure TS engine, imported by both
```

## Run locally

```bash
npm install          # root deps (concurrently)
npm --prefix client install
npm --prefix server install
npm run dev          # starts both server (:8787) and client (:5173)
```

Open http://localhost:5173

## Deploy

- **Client (Vercel/Netlify):** `cd client && npm run build` → `dist/`
- **Server (Railway / Fly / Render):** `cd server && npm run build && npm start`. Set `VITE_WS_URL=wss://your-server.tld/ws` on client build.

## Features

- Real order book per asset (40 levels each side, bids/asks)
- 500 AI traders, 15 personality types (YOLO, FOMO, paper, diamond, perma-bull/bear, gambler, value, trend, MM, revenge, copycat, etc.)
- **Personalities evolve** based on cumulative P/L
- Long + short positions with cash collateral
- 14 markets: penny stocks, blue chips, index funds, options, hedge fund, IB, MM, Fed bonds
- Live candlestick + line + volume chart, smooth left-shift scroll
- News events drive fair-value + volatility shifts
- SL / TP per position (chart lines MT5-style, auto-close on hit)
- localStorage UI prefs, server-side disk persistence (state.json)
- WebAudio: cash register, alarm, ambient floor noise, mute toggle
- Mobile responsive

## Bundle

Client: ~209 KB JS / 18 KB CSS, 67 KB gzipped.
