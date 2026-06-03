export const infoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MARKETVERSEX // ARCHIVE TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;800;900&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg: #030509;
        --panel: rgba(10, 15, 26, 0.65);
        --border: rgba(0, 240, 255, 0.12);
        --border-focus: rgba(0, 240, 255, 0.4);
        --text: #c8d0e0;
        --text-muted: #64748b;
        --white: #ffffff;
        
        --cyan: #00f0ff;
        --green: #00ff9d;
        --red: #ff0055;
        --gold: #f5b942;
        --purple: #e879f9;
        --silver: #94a3b8;
        
        --font-display: 'Outfit', sans-serif;
        --font-body: 'Inter', sans-serif;
        --font-mono: 'Fira Code', monospace;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        background-color: var(--bg);
        color: var(--text);
        font-family: var(--font-body);
        overflow-x: hidden;
        line-height: 1.6;
      }

      .bg-grid {
        position: fixed;
        inset: 0;
        background-image: 
          linear-gradient(rgba(0, 240, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 240, 255, 0.02) 1px, transparent 1px);
        background-size: 32px 32px;
        background-position: center center;
        pointer-events: none;
        z-index: -2;
      }

      .bg-glow {
        position: fixed;
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(0, 240, 255, 0.04) 0%, rgba(232, 121, 249, 0.01) 70%, transparent 100%);
        top: -10%;
        right: -10%;
        pointer-events: none;
        z-index: -1;
        filter: blur(80px);
      }

      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: var(--bg);
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(0, 240, 255, 0.15);
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 240, 255, 0.3);
      }

      header {
        border-bottom: 1px solid var(--border);
        background: rgba(3, 5, 9, 0.85);
        backdrop-filter: blur(12px);
        position: sticky;
        top: 0;
        z-index: 100;
        padding: 16px 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo-container {
        width: 32px;
        height: 32px;
        border: 1.5px solid var(--gold);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-display);
        font-weight: 900;
        font-size: 18px;
        color: var(--gold);
        text-shadow: 0 0 8px rgba(245, 185, 66, 0.5);
        box-shadow: 0 0 10px rgba(245, 185, 66, 0.15);
      }

      .brand h1 {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 20px;
        letter-spacing: 2px;
        background: linear-gradient(135deg, #fff 40%, var(--cyan) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .badge {
        background: rgba(0, 240, 255, 0.08);
        border: 1px solid var(--cyan);
        color: var(--cyan);
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        text-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
        transition: all 0.3s ease;
      }

      .ping-badge {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-muted);
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-family: var(--font-mono);
      }

      .ping-badge span {
        color: var(--green);
        font-weight: bold;
      }

      .container {
        max-width: 1400px;
        margin: 0 auto;
        display: flex;
        gap: 40px;
        padding: 40px;
      }

      .sidebar {
        width: 280px;
        flex-shrink: 0;
        position: sticky;
        top: 100px;
        height: calc(100vh - 140px);
        overflow-y: auto;
        padding-right: 10px;
      }

      .nav-group {
        margin-bottom: 24px;
      }

      .nav-group h4 {
        font-family: var(--font-display);
        text-transform: uppercase;
        font-size: 11px;
        color: var(--text-muted);
        letter-spacing: 1.5px;
        margin-bottom: 10px;
        padding-left: 12px;
      }

      .nav-link {
        display: block;
        padding: 10px 12px;
        color: var(--text-muted);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        border-radius: 6px;
        transition: all 0.2s ease;
        margin-bottom: 4px;
        border-left: 3px solid transparent;
      }

      .nav-link:hover {
        background: rgba(255, 255, 255, 0.02);
        color: var(--text);
        padding-left: 16px;
      }

      .nav-link.active {
        background: rgba(0, 240, 255, 0.05);
        border-left-color: var(--cyan);
        color: var(--white);
        font-weight: 600;
        text-shadow: 0 0 10px rgba(0, 240, 255, 0.25);
      }

      .content {
        flex-grow: 1;
        min-width: 0;
      }

      section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 40px;
        margin-bottom: 40px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      }

      h2 {
        font-family: var(--font-display);
        font-size: 26px;
        font-weight: 800;
        color: var(--white);
        margin-bottom: 24px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      h3 {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 700;
        color: var(--white);
        margin: 30px 0 15px 0;
      }

      p {
        margin-bottom: 20px;
        color: var(--text);
        font-size: 15px;
        line-height: 1.7;
      }

      ul, ol {
        margin-left: 24px;
        margin-bottom: 24px;
      }

      li {
        margin-bottom: 8px;
        color: var(--text);
        font-size: 15px;
      }

      .categories-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
        margin-top: 24px;
      }

      .category-card {
        background: rgba(3, 5, 9, 0.6);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 24px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
      }

      .category-card:hover {
        transform: translateY(-4px);
        border-color: var(--hover-color, var(--cyan));
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 20px var(--glow-color, rgba(0, 240, 255, 0.05));
      }

      .cat-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }

      .cat-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--icon-bg, rgba(0, 240, 255, 0.05));
        border: 1.5px solid var(--hover-color, var(--cyan));
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px var(--glow-color, rgba(0, 240, 255, 0.15));
      }

      .cat-icon-wrap svg {
        width: 22px;
        height: 22px;
      }

      .cat-meta {
        display: flex;
        flex-direction: column;
      }

      .cat-name {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 15px;
        color: var(--white);
        letter-spacing: 0.5px;
      }

      .cat-unlock {
        font-size: 10px;
        color: var(--hover-color, var(--cyan));
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .cat-desc {
        font-size: 13px;
        color: var(--text-muted);
        line-height: 1.5;
        flex-grow: 1;
      }

      .cat-vol-pill {
        margin-top: 16px;
        align-self: flex-start;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border: 1px solid var(--vol-border, var(--cyan));
        color: var(--vol-color, var(--cyan));
        background: var(--vol-bg, rgba(0,240,255,0.05));
      }

      .endpoint-card {
        background: rgba(3, 5, 9, 0.4);
        border: 1px solid var(--border);
        border-radius: 8px;
        margin-bottom: 16px;
        overflow: hidden;
      }

      .endpoint-header {
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(255, 255, 255, 0.01);
        border-bottom: 1px solid var(--border);
      }

      .method {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 800;
        font-family: var(--font-mono);
      }

      .method.get {
        background: rgba(0, 255, 157, 0.1);
        color: var(--green);
        border: 1px solid var(--green);
      }

      .method.post {
        background: rgba(0, 240, 255, 0.1);
        color: var(--cyan);
        border: 1px solid var(--cyan);
      }

      .method.all {
        background: rgba(232, 121, 249, 0.1);
        color: var(--purple);
        border: 1px solid var(--purple);
      }

      .path {
        font-family: var(--font-mono);
        font-size: 14px;
        font-weight: 500;
        color: var(--white);
      }

      .endpoint-body {
        padding: 20px;
      }

      .code-block {
        background: #010204;
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 16px;
        font-family: var(--font-mono);
        font-size: 13px;
        color: #8babf1;
        overflow-x: auto;
        margin-top: 10px;
      }

      .highlight {
        color: var(--cyan);
        font-weight: 600;
      }

      .green-text {
        color: var(--green);
      }

      .gold-text {
        color: var(--gold);
      }

      .purple-text {
        color: var(--purple);
      }

      .red-text {
        color: var(--red);
      }

      @media (max-width: 1024px) {
        .container {
          flex-direction: column;
          padding: 20px;
        }
        .sidebar {
          width: 100%;
          height: auto;
          position: relative;
          top: 0;
          margin-bottom: 30px;
        }
      }
    </style>
</head>
<body>
    <div class="bg-grid"></div>
    <div class="bg-glow"></div>

    <header>
      <div class="brand">
        <div class="logo-container">M</div>
        <h1>MARKETVERSEX</h1>
      </div>
      <div class="header-right">
        <div class="ping-badge">GATEWAY_PING: <span id="ping-val">connecting...</span></div>
        <div class="badge" id="status-badge">Live Terminal</div>
      </div>
    </header>

    <div class="container">
      <aside class="sidebar">
        <div class="nav-group">
          <h4>Simulation Docs</h4>
          <a href="#welcome" class="nav-link active">🚀 Getting Started</a>
          <a href="#categories" class="nav-link">📊 Asset Tiers</a>
          <a href="#orderbook" class="nav-link">🎯 Order Book & Execution</a>
          <a href="#sltp" class="nav-link">🛑 Stop-Loss & Take-Profit</a>
          <a href="#progression" class="nav-link">⭐ Progression & Missions</a>
          <a href="#leaderboard" class="nav-link">🏆 Leaderboard & AI</a>
          <a href="#risk" class="nav-link">⚠ Risk Management</a>
          <a href="#strategy" class="nav-link">💡 Pro Strategy Rules</a>
        </div>
        <div class="nav-group">
          <h4>Interface Spec</h4>
          <a href="#endpoints" class="nav-link">🛠 REST & WebSocket APIs</a>
        </div>
      </aside>

      <main class="content">
        <section id="welcome">
          <h2>🚀 Getting Started</h2>
          <p>Welcome to <span class="highlight">MARKETVERSEX</span> — a real-time, multi-market trading simulation and liquidity engine designed to test trade logic, speed, and automation routines.</p>
          <p>You begin your terminal access at <span class="highlight">Level 1</span> with a clean slate of <span class="green-text">$1,000</span> in cash and basic stock indexes. Grow your portfolio, compete against thousands of concurrent AI bots, and climb the leaderboard.</p>
          <p><strong>Primary Objectives:</strong></p>
          <ul>
            <li>Earn XP and Level Up to unlock advanced categories (Crypto at L10, Forex at L20, Speculative Assets at L50).</li>
            <li>Use the order book directly for efficient market-making or arbitrage.</li>
            <li>Configure automated Stop-Loss and Take-Profit limits to secure wins.</li>
            <li>Participate in daily and weekly missions to secure reward drops.</li>
          </ul>
        </section>

        <section id="categories">
          <h2>📊 Asset Tiers & Categories</h2>
          <p>The MarketVerseX engine evaluates 12 unique asset categories, each styled with curated neon gradients, custom vectors, and baseline volatility metrics.</p>
          
          <div class="categories-grid">
            <!-- Penny Stocks -->
            <div class="category-card" style="--hover-color: var(--silver); --glow-color: rgba(255,255,255,0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(255,255,255,0.02);">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="3,2"/>
                    <circle cx="12" cy="12" r="8.5" fill="#030712" stroke="#94a3b8" stroke-width="1.5" />
                    <path d="M6 12h2 M16 12h2 M12 6v2 M12 16v2 M8 8l1.5 1.5 M16 16l-1.5-1.5 M16 8l-1.5 1.5 M8 16l1.5-1.5" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                    <circle cx="12" cy="12" r="5" fill="#020617" stroke="#cbd5e1" stroke-width="1"/>
                    <path d="M14 9.5a2.5 2.5 0 0 0-4 2 2.5 2.5 0 0 0 4 2" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M12 7v10" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Penny Stocks</span>
                  <span class="cat-unlock" style="color: var(--silver)">Unlock: Level 1</span>
                </div>
              </div>
              <p class="cat-desc">Exotic microcaps and meme-driven assets. High spreads and sudden pump/dump cycles.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--red); --vol-color: var(--red); --vol-bg: rgba(255, 0, 85, 0.05);">Volatility: High</span>
            </div>

            <!-- Blue Chips -->
            <div class="category-card" style="--hover-color: var(--cyan); --glow-color: rgba(0, 240, 255, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(0, 240, 255, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <path d="M 12 1.5 L 22.5 7.5 L 22.5 16.5 L 12 22.5 L 1.5 16.5 L 1.5 7.5 Z" fill="none" stroke="rgba(0, 240, 255, 0.2)" stroke-width="1"/>
                    <path d="M 12 3 L 21 8.2 L 21 15.8 L 12 21 L 3 15.8 L 3 8.2 Z" fill="#020617" stroke="#0072ff" stroke-width="2"/>
                    <path d="M12 3v2 M21 8.2l-1.73 1 M21 15.8l-1.73-1 M12 21v-2 M3 15.8l1.73-1 M3 8.2l1.73 1" stroke="#00f0ff" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Blue Chips</span>
                  <span class="cat-unlock">Unlock: Level 1</span>
                </div>
              </div>
              <p class="cat-desc">Stable, highly capitalized corporate entities. Deep liquidity tables and steady trends.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>

            <!-- Index Funds -->
            <div class="category-card" style="--hover-color: var(--green); --glow-color: rgba(0, 255, 157, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(0, 255, 157, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="4" fill="#020806" stroke="#05452a" stroke-width="1.5"/>
                    <path d="M4 15l4-5 4 3 8-10" fill="none" stroke="#00ff9d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M16 3h4v4" fill="none" stroke="#00ff9d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Index Funds</span>
                  <span class="cat-unlock" style="color: var(--green)">Unlock: Level 1</span>
                </div>
              </div>
              <p class="cat-desc">Bundled sector trackers. Perfect for macro-trend analysis and baseline portfolio hedging.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>

            <!-- Options -->
            <div class="category-card" style="--hover-color: var(--purple); --glow-color: rgba(232, 121, 249, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(232, 121, 249, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <rect x="4" y="6" width="12" height="14" rx="2" fill="#07040d" stroke="#4c1d95" stroke-width="2"/>
                    <path d="M6 16q4-1 6-5t6-3" fill="none" stroke="#e879f9" stroke-width="2" stroke-linecap="round"/>
                    <path d="M15 8h3v3" fill="none" stroke="#e879f9" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Options Contracts</span>
                  <span class="cat-unlock" style="color: var(--purple)">Unlock: Level 30</span>
                </div>
              </div>
              <p class="cat-desc">Leveraged options derivatives. Subject to intense time decay (theta) and swing leverage.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--red); --vol-color: var(--red); --vol-bg: rgba(255, 0, 85, 0.05);">Volatility: Extreme</span>
            </div>

            <!-- Hedge Funds -->
            <div class="category-card" style="--hover-color: var(--gold); --glow-color: rgba(245, 185, 66, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(245, 185, 66, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2 L21 6.5 L21 14.5 Q21 19.5 12 22 Q3 19.5 3 14.5 L3 6.5 Z" fill="#060503" stroke="#7a5a18" stroke-width="2"/>
                    <path d="M9 16h6v-4h-1v-1.5h-1V11h-1v.5h-1V12H9z" fill="#f5b942"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Hedge Pools</span>
                  <span class="cat-unlock" style="color: var(--gold)">Unlock: Level 5</span>
                </div>
              </div>
              <p class="cat-desc">Complex institutional positions managed with protection grids and high margin ratios.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--gold); --vol-color: var(--gold); --vol-bg: rgba(245, 185, 66, 0.05);">Volatility: Medium</span>
            </div>

            <!-- Investment Banks -->
            <div class="category-card" style="--hover-color: var(--cyan); --glow-color: rgba(0, 240, 255, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(0, 240, 255, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 21V9.5L12 3.5l8 6V21Z" fill="#02050c" stroke="#00186e" stroke-width="2"/>
                    <line x1="7.5" y1="10" x2="7.5" y2="18" stroke="#00f0ff" stroke-width="1.5" stroke-linecap="round"/>
                    <line x1="12" y1="9" x2="12" y2="18" stroke="#00f0ff" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Investment Banks</span>
                  <span class="cat-unlock">Unlock: Level 5</span>
                </div>
              </div>
              <p class="cat-desc">Asset vaulting. Low baseline spreads, heavy block limits, and structural resilience.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>

            <!-- Market Makers -->
            <div class="category-card" style="--hover-color: var(--gold); --glow-color: rgba(245, 185, 66, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(245, 185, 66, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" fill="#030408" stroke="#7a5a18" stroke-width="1.8"/>
                    <path d="M12 2v3.5 M12 18.5v3.5 M2 12h3.5 M18.5 12h3.5" stroke="#f5b942" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Market Makers</span>
                  <span class="cat-unlock" style="color: var(--gold)">Unlock: Level 30</span>
                </div>
              </div>
              <p class="cat-desc">Liquidity pools and spreads. Direct access to order-book matching telemetry.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--gold); --vol-color: var(--gold); --vol-bg: rgba(245, 185, 66, 0.05);">Volatility: Medium</span>
            </div>

            <!-- Fed Reserve -->
            <div class="category-card" style="--hover-color: var(--gold); --glow-color: rgba(245, 185, 66, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(245, 185, 66, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <path d="M2.5 10 L12 2 L21.5 10 Z" fill="#7a5a18" stroke="#7a5a18" stroke-width="1.5" opacity="0.4"/>
                    <line x1="5" y1="12.5" x2="5" y2="18.5" stroke="#f5b942" stroke-width="2.5"/>
                    <line x1="12" y1="12.5" x2="12" y2="18.5" stroke="#f5b942" stroke-width="2.5"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Federal Reserve</span>
                  <span class="cat-unlock" style="color: var(--gold)">Unlock: Level 5</span>
                </div>
              </div>
              <p class="cat-desc">Macro interest rates, structural reserves, and central banking system anchors.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>

            <!-- Cryptos -->
            <div class="category-card" style="--hover-color: var(--purple); --glow-color: rgba(232, 121, 249, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(232, 121, 249, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" fill="#04020a" stroke="#4c1d95" stroke-width="1.8"/>
                    <path d="M12 5.5L7 11.5L12 14L17 11.5Z" fill="none" stroke="#ffffff" stroke-width="1.2"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Cryptocurrencies</span>
                  <span class="cat-unlock" style="color: var(--purple)">Unlock: Level 10</span>
                </div>
              </div>
              <p class="cat-desc">Decentralized ledgers and tokens. Driven by global tech indicators and meme sentiment.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--red); --vol-color: var(--red); --vol-bg: rgba(255, 0, 85, 0.05);">Volatility: High</span>
            </div>

            <!-- Forex -->
            <div class="category-card" style="--hover-color: var(--green); --glow-color: rgba(0, 255, 157, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(0, 255, 157, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" fill="#010604" stroke="#064e3b" stroke-width="1.8"/>
                    <path d="M6 12a6 6 0 0 1 12 0" fill="none" stroke="#00ff9d" stroke-width="1.5"/>
                    <path d="M18 12a6 6 0 0 1-12 0" fill="none" stroke="#ffffff" stroke-width="1.5"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Forex Pairs</span>
                  <span class="cat-unlock" style="color: var(--green)">Unlock: Level 20</span>
                </div>
              </div>
              <p class="cat-desc">Global fiat exchanges. Minimal baseline spreads but susceptible to sudden macro shocks.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>

            <!-- Commodities -->
            <div class="category-card" style="--hover-color: var(--gold); --glow-color: rgba(245, 185, 66, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(245, 185, 66, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 13l2-5h6l2 5Z" fill="#f5b942" stroke="#7a5a18" stroke-width="1.5"/>
                    <path d="M8.5 12.5l5-5" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Commodities</span>
                  <span class="cat-unlock" style="color: var(--gold)">Unlock: Level 5</span>
                </div>
              </div>
              <p class="cat-desc">Hard assets (gold, oil, minerals). Acts as a primary store of value during market-wide routs.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>

            <!-- Bonds -->
            <div class="category-card" style="--hover-color: var(--gold); --glow-color: rgba(245, 185, 66, 0.05);">
              <div class="cat-header">
                <div class="cat-icon-wrap" style="--icon-bg: rgba(245, 185, 66, 0.02);">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 5v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1z" fill="#070503" stroke="#7a5a18" stroke-width="1.8"/>
                    <circle cx="16" cy="16.5" r="2.5" fill="#f5b942" stroke="#ffd700" stroke-width="0.5"/>
                  </svg>
                </div>
                <div class="cat-meta">
                  <span class="cat-name">Bonds Certificates</span>
                  <span class="cat-unlock" style="color: var(--gold)">Unlock: Level 5</span>
                </div>
              </div>
              <p class="cat-desc">Debt instruments with yield seals. Fixed returns and negligible volatility indicators.</p>
              <span class="cat-vol-pill" style="--vol-border: var(--cyan); --vol-color: var(--cyan); --vol-bg: rgba(0, 240, 255, 0.05);">Volatility: Low</span>
            </div>
          </div>
        </section>

        <section id="orderbook">
          <h2>🎯 Order Book & Execution</h2>
          <p>The MarketVerseX engine relies on an authoritative, real-time <span class="highlight">Order Book</span> to match buyers and sellers. Unlike simple spreadsheet engines, prices are driven strictly by resting liquidity (bid/ask depth).</p>
          <h3>1. Bid / Ask Spread</h3>
          <p>The spread represents the difference between the highest price a buyer is willing to pay (Bid) and the lowest price a seller will accept (Ask). Liquid assets (e.g. Blue Chips) have razor-thin spreads, while volatile assets (e.g. Meme Coins) show wide spreads, increasing slippage risk.</p>
          <h3>2. Market Orders</h3>
          <p>Executes immediately at the best available price on the book. Recommended for rapid entries or emergency risk exits.</p>
          <h3>3. Limit Orders</h3>
          <p>Rests on the order book at a target price. Fills only when market price reaches your specification. Rest on the book to get filled without paying the spread.</p>
        </section>

        <section id="sltp">
          <h2>🛑 Stop-Loss (SL) & Take-Profit (TP)</h2>
          <p>Automated risk management is compiled at the engine layer. You can assign SL and TP thresholds as percentage offsets from your position's average entry cost.</p>
          <ul>
            <li><strong>Stop-Loss (SL)</strong>: Automatically covers/sells a position when losses hit your threshold. Restricts downside risk.</li>
            <li><strong>Take-Profit (TP)</strong>: Automatically sells/covers when gains hit your target, locking in profits.</li>
          </ul>
          <p><em>Example: Bought NEXA at $180 with SL 2% and TP 5%. The engine will auto-close the position if price drops to $176.40 or rallies to $189.00.</em></p>
        </section>

        <section id="progression">
          <h2>⭐ Progression & Missions</h2>
          <p>Earn XP on every closed position based on absolute profit. Your level determines what markets and features are unlocked on your dashboard terminal.</p>
          <h3>Missions Engine</h3>
          <ul>
            <li><strong>Daily Missions</strong>: 3 dynamic objectives resetting UTC midnight (e.g., execute 5 trades, close 3 winners). Awards bonus cash.</li>
            <li><strong>Weekly Missions</strong>: 2 macro-objectives resetting Monday UTC (e.g., maintain 5% portfolio growth, execute 50 trades).</li>
            <li><strong>Daily Login Streak</strong>: Escalating cash bonuses for consecutive daily logins.</li>
          </ul>
        </section>

        <section id="leaderboard">
          <h2>🏆 Leaderboard & AI Personalities</h2>
          <p>You are competing against <span class="highlight">10,000+ active AI bots</span> running in the background. Each bot has a distinct level, capital size, and trading strategy:</p>
          <ul>
            <li><span class="purple-text">YOLO / FOMO</span>: Chases sudden momentum breakouts; highly aggressive.</li>
            <li><span class="green-text">Value / Conservative</span>: Steady, disciplined value traders with narrow profit targets.</li>
            <li><span class="gold-text">Diamond Hands</span>: Exceptionally patient, holding blocks through multi-hour trends.</li>
            <li><span class="red-text">Gambler / Paper</span>: Unpredictable, high-frequency scalping.</li>
          </ul>
          <p>The leaderboard displays the top 200 traders in real time, factoring in cash reserves and position valuations.</p>
        </section>

        <section id="risk">
          <h2>⚠ Risk Management</h2>
          <p>Disciplined position sizing is critical to survive market cycles:</p>
          <ol>
            <li><strong>Collateral Cap</strong>: Never allocate more than 20% of net worth to a single stock, or 5% to high-volatility assets.</li>
            <li><strong>Collateral Borrow Cost</strong>: Short positions require 50% cash collateral. If collateral thresholds drop below margin minimums, the engine triggers an automatic liquidation cut to prevent bankruptcy.</li>
          </ol>
        </section>

        <section id="strategy">
          <h2>💡 Pro Strategy Rules</h2>
          <p>Follow these rules to maximize returns:</p>
          <ul>
            <li><strong>Spread Coverage</strong>: Use limit orders to capture buy entries on pullbacks.</li>
            <li><strong>Macro News</strong>: Sector alerts (e.g. <em>"GLOBAL ROUT"</em>, <em>"TECH SECTOR RALLY"</em>) move prices immediately. Bots react within 30 seconds of an alert. Beat them to the trade.</li>
            <li><strong>Shorting</strong>: Profit in down weeks. Don't sit in cash when sectors turn red.</li>
          </ul>
        </section>

        <section id="endpoints">
          <h2>🛠 REST & WebSocket APIs</h2>
          <p>For developers and automation engineers, the MarketVerseX gateway routes the following interfaces:</p>
          
          <div class="endpoint-card">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="path">/health</span>
            </div>
            <div class="endpoint-body">
              <p>Performs health checks on the API Gateway and underlying Trading Engine.</p>
              <div class="code-block">Response:
{
  "gateway": { "ok": true, "port": 8787 },
  "engine": { "ok": true, "time": 1780458617 }
}</div>
            </div>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="path">/state</span>
            </div>
            <div class="endpoint-body">
              <p>Retrieves a read-only dump of the engine's public state parameters.</p>
            </div>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-header">
              <span class="method all">WS</span>
              <span class="path">/ws</span>
            </div>
            <div class="endpoint-body">
              <p>Establish a client WebSocket connection to stream live quotes and execute trades. Messages must be formatted as JSON payloads.</p>
              <div class="code-block">Client Authentication Payload:
{
  "type": "auth",
  "payload": {
    "token": "SUPABASE_JWT_ACCESS_TOKEN"
  }
}</div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <script>
      // Scrollspy active state for navigation sidebar
      window.addEventListener('DOMContentLoaded', () => {
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-link');
        
        window.addEventListener('scroll', () => {
          let current = '';
          sections.forEach(s => {
            const top = s.offsetTop;
            if (window.pageYOffset >= top - 150) {
              current = s.getAttribute('id');
            }
          });
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
              link.classList.add('active');
            }
          });
        });

        // WebSocket ping utility
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = location.hostname ? (location.hostname + (location.port ? ':' + location.port : '')) : 'localhost:8787';
        const wsUrl = wsProtocol + '//' + wsHost + '/ws';
        
        const statusEl = document.getElementById('status-badge');
        const pingEl = document.getElementById('ping-val');

        let startT = Date.now();
        let socket = null;

        function connectWs() {
          socket = new WebSocket(wsUrl);
          
          socket.onopen = () => {
            statusEl.innerText = 'Online Terminal';
            statusEl.style.borderColor = '#00ff9d';
            statusEl.style.color = '#00ff9d';
            statusEl.style.textShadow = '0 0 8px rgba(0, 255, 157, 0.4)';
            statusEl.style.background = 'rgba(0, 255, 157, 0.08)';
            
            // Start ping loop
            setInterval(() => {
              startT = performance.now();
              // send standard client setActive message to trigger message roundtrip
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'setActive', payload: { aid: 'NEXA' } }));
              }
            }, 3000);
          };

          socket.onmessage = () => {
            const diff = Math.round(performance.now() - startT);
            pingEl.innerText = diff + ' ms';
          };

          socket.onclose = () => {
            statusEl.innerText = 'Offline';
            statusEl.style.borderColor = '#ff0055';
            statusEl.style.color = '#ff0055';
            statusEl.style.textShadow = '0 0 8px rgba(255, 0, 85, 0.4)';
            statusEl.style.background = 'rgba(255, 0, 85, 0.08)';
            pingEl.innerText = '—';
            // Auto-reconnect after 5s
            setTimeout(connectWs, 5000);
          };

          socket.onerror = () => {
            socket.close();
          };
        }

        connectWs();
      });
    </script>
</body>
</html>
`;
