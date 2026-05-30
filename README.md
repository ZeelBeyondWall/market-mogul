# Market Mogul

Single-file browser stock trading simulator. $100 vs 500 AI traders with evolving personalities and a real order-matching engine.

## Run

Open `index.html` in any modern browser. No build, no deps.

## Features

- Real order book per asset (bids/asks, limit + market orders)
- 500 AI traders, 15 personality types (YOLO, FOMO, paper, diamond, perma-bull/bear, gambler, value, trend, MM, revenge, copycat, etc.)
- **Personalities evolve** — wins make traders bolder, losses turn them paper-handed or vengeful
- Bots and player both trade through the same engine; player starts at #501 / 501
- Long + short positions, leveraged via cash collateral
- 14 markets: penny stocks, blue chips, index funds, options, hedge fund, IB, MM, Fed bonds
- Live candlestick + line + volume chart (smooth left-shift scroll, toggleable)
- Live news events drive fair value + volatility shifts
- localStorage auto-save (5s), offline dividend earnings
- Bloomberg-terminal aesthetic, procedural SVG icons, WebAudio (cash register, alarm, ambient floor noise, mute toggle)
- Mobile responsive

## Deploy

Static site. Drop on Vercel, Render, Netlify, GitHub Pages — works as-is.
