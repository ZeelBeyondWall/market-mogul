export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* Glow Filters */}
        <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowPurple" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Premium Cyber Gradients */}
        <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffcf0"/>
          <stop offset="30%" stopColor="#fbbf24"/>
          <stop offset="70%" stopColor="#d97706"/>
          <stop offset="100%" stopColor="#78350f"/>
        </linearGradient>
        <linearGradient id="gGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399"/>
          <stop offset="50%" stopColor="#059669"/>
          <stop offset="100%" stopColor="#064e3b"/>
        </linearGradient>
        <linearGradient id="gRed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fca5a5"/>
          <stop offset="50%" stopColor="#dc2626"/>
          <stop offset="100%" stopColor="#7f1d1d"/>
        </linearGradient>
        <linearGradient id="gBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8"/>
          <stop offset="50%" stopColor="#2563eb"/>
          <stop offset="100%" stopColor="#1e3a8a"/>
        </linearGradient>
        <linearGradient id="gPurple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f472b6"/>
          <stop offset="50%" stopColor="#c084fc"/>
          <stop offset="80%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#4c1d95"/>
        </linearGradient>
        <linearGradient id="gSilver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc"/>
          <stop offset="40%" stopColor="#cbd5e1"/>
          <stop offset="75%" stopColor="#475569"/>
          <stop offset="100%" stopColor="#0f172a"/>
        </linearGradient>

        {/* Logo Icons */}
        <symbol id="logoFull" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#gGold)" strokeWidth="2" filter="url(#glowGold)"/>
          <circle cx="100" cy="100" r="80" fill="#030509" stroke="rgba(0, 240, 255, 0.1)" strokeWidth="1"/>
          {/* Cyber accents */}
          <path d="M 50 100 A 50 50 0 0 1 150 100" fill="none" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" strokeDasharray="5, 5"/>
          <path d="M55 70 Q40 50 50 35 Q70 50 80 70 Z" fill="url(#gGold)"/>
          <path d="M145 70 Q160 50 150 35 Q130 50 120 70 Z" fill="url(#gGold)"/>
          <path d="M65 75 Q100 65 135 75 Q140 110 130 130 Q115 150 100 150 Q85 150 70 130 Q60 110 65 75 Z" fill="url(#gGold)" filter="url(#glowGold)"/>
          <circle cx="85" cy="100" r="3.5" fill="#00f0ff" filter="url(#glowCyan)"/>
          <circle cx="115" cy="100" r="3.5" fill="#00f0ff" filter="url(#glowCyan)"/>
          <rect x="50" y="160" width="6" height="14" fill="#00ff9d" filter="url(#glowGreen)"/>
          <rect x="62" y="155" width="6" height="19" fill="#00ff9d" filter="url(#glowGreen)"/>
          <rect x="74" y="148" width="6" height="26" fill="#00ff9d" filter="url(#glowGreen)"/>
          <rect x="86" y="142" width="6" height="32" fill="#00ff9d" filter="url(#glowGreen)"/>
          <rect x="98" y="135" width="6" height="39" fill="#ffd700" filter="url(#glowGold)"/>
          <rect x="110" y="130" width="6" height="44" fill="#ffd700" filter="url(#glowGold)"/>
          <rect x="122" y="125" width="6" height="49" fill="#ffd700" filter="url(#glowGold)"/>
          <rect x="134" y="120" width="6" height="54" fill="#ff4500" filter="url(#glowGold)"/>
          <rect x="146" y="115" width="6" height="59" fill="#ff4500" filter="url(#glowGold)"/>
        </symbol>
        <symbol id="logoMini" viewBox="0 0 32 32">
          <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="#030509" stroke="url(#gGold)" strokeWidth="1.8" filter="url(#glowGold)"/>
          {/* Cybernetic circuit lines in background */}
          <path d="M4 16h24 M16 4v24" stroke="rgba(245, 185, 66, 0.1)" strokeWidth="1"/>
          {/* Sleek cyber M logo */}
          <path d="M 7 22 L 7 10 L 16 18.5 L 25 10 L 25 22" fill="none" stroke="url(#gGold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowGold)"/>
          {/* High-tech accent dots */}
          <circle cx="16" cy="7" r="1.5" fill="#ffffff" filter="url(#glowGold)"/>
          <path d="M12 22h8" stroke="#f5b942" strokeWidth="1.5" strokeLinecap="round"/>
        </symbol>

        {/* Symbol Category Icons - Redesigned & Glowing */}
        {/* Penny stocks */}
        <symbol id="t-penny" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" strokeDasharray="3,2"/>
          <circle cx="12" cy="12" r="8.5" fill="#030712" stroke="url(#gSilver)" strokeWidth="1.5" />
          <path d="M6 12h2 M16 12h2 M12 6v2 M12 16v2 M8 8l1.5 1.5 M16 16l-1.5-1.5 M16 8l-1.5 1.5 M8 16l1.5-1.5" stroke="rgba(0, 240, 255, 0.4)" strokeWidth="1"/>
          <circle cx="12" cy="12" r="5" fill="#020617" stroke="#00f0ff" strokeWidth="1" filter="url(#glowCyan)"/>
          <path d="M14 9.5a2.5 2.5 0 0 0-4 2 2.5 2.5 0 0 0 4 2" fill="none" stroke="url(#gSilver)" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M12 7v10" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowCyan)"/>
          <circle cx="12" cy="4" r="0.75" fill="#00f0ff"/>
          <circle cx="12" cy="20" r="0.75" fill="#00f0ff"/>
        </symbol>

        {/* Blue Chips */}
        <symbol id="t-blue" viewBox="0 0 24 24">
          <path d="M 12 1.5 L 22.5 7.5 L 22.5 16.5 L 12 22.5 L 1.5 16.5 L 1.5 7.5 Z" fill="none" stroke="rgba(0, 114, 255, 0.3)" strokeWidth="1"/>
          <path d="M 12 3 L 21 8.2 L 21 15.8 L 12 21 L 3 15.8 L 3 8.2 Z" fill="#020617" stroke="url(#gBlue)" strokeWidth="2" filter="url(#glowCyan)"/>
          <path d="M12 3v2 M21 8.2l-1.73 1 M21 15.8l-1.73-1 M12 21v-2 M3 15.8l1.73-1 M3 8.2l1.73 1" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="5" fill="none" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1"/>
          <path d="M10.5 8.5h2.5a1.5 1.5 0 0 1 0 3h-2.5v-3z M10.5 11.5h3a1.5 1.5 0 0 1 0 3h-3v-3z" fill="url(#gBlue)"/>
          <path d="M9.5 7.5v9h2.5 M13 8.5h.5 M13.5 14.5h.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M5.5 10l-1.5 2 1.5 2 M18.5 10l1.5 2-1.5 2" fill="none" stroke="#00f0ff" strokeWidth="1" filter="url(#glowCyan)"/>
        </symbol>

        {/* Index Funds */}
        <symbol id="t-index" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#020806" stroke="url(#gGreen)" strokeWidth="1.5"/>
          <line x1="2" y1="7" x2="22" y2="7" stroke="rgba(0, 255, 157, 0.08)" strokeWidth="1"/>
          <line x1="2" y1="12" x2="22" y2="12" stroke="rgba(0, 255, 157, 0.08)" strokeWidth="1"/>
          <line x1="2" y1="17" x2="22" y2="17" stroke="rgba(0, 255, 157, 0.08)" strokeWidth="1"/>
          <line x1="7" y1="2" x2="7" y2="22" stroke="rgba(0, 255, 157, 0.08)" strokeWidth="1"/>
          <line x1="12" y1="2" x2="12" y2="22" stroke="rgba(0, 255, 157, 0.08)" strokeWidth="1"/>
          <line x1="17" y1="2" x2="17" y2="22" stroke="rgba(0, 255, 157, 0.08)" strokeWidth="1"/>
          <path d="M4 18l4-2 4-5 4 1 4-6" fill="none" stroke="rgba(0, 255, 157, 0.25)" strokeWidth="1.5" strokeDasharray="2,2"/>
          <path d="M4 15l4-5 4 3 8-10" fill="none" stroke="#00ff9d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowGreen)"/>
          <path d="M16 3h4v4" fill="none" stroke="#00ff9d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowGreen)"/>
          <path d="M3 5V3h2 M19 3h2v2 M21 19v2h-2 M5 21H3v-2" fill="none" stroke="#00ff9d" strokeWidth="1"/>
        </symbol>

        {/* Options */}
        <symbol id="t-options" viewBox="0 0 24 24">
          <path d="M6 4h12a2 2 0 0 1 2 2v12" fill="none" stroke="rgba(232, 121, 249, 0.3)" strokeWidth="1.5"/>
          <rect x="4" y="6" width="12" height="14" rx="2" fill="#07040d" stroke="url(#gPurple)" strokeWidth="2" filter="url(#glowPurple)"/>
          <path d="M6 16q4-1 6-5t6-3" fill="none" stroke="#e879f9" strokeWidth="2" strokeLinecap="round" filter="url(#glowPurple)"/>
          <path d="M15 8h3v3" fill="none" stroke="#e879f9" strokeWidth="2" strokeLinecap="round" filter="url(#glowPurple)"/>
          <circle cx="10" cy="13" r="2.5" fill="none" stroke="#ffffff" strokeWidth="1"/>
          <line x1="8" y1="13" x2="12" y2="13" stroke="#ffffff" strokeWidth="1"/>
          <path d="M7 9h2M7 11h1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
        </symbol>

        {/* Hedge Fund */}
        <symbol id="t-hedge" viewBox="0 0 24 24">
          <path d="M12 2 L21 6.5 L21 14.5 Q21 19.5 12 22 Q3 19.5 3 14.5 L3 6.5 Z" fill="#060503" stroke="url(#gGold)" strokeWidth="2" filter="url(#glowGold)"/>
          <path d="M12 4.5 L18.5 8 L18.5 13.5 Q18.5 17.5 12 19.5 Q5.5 17.5 5.5 13.5 L5.5 8 Z" fill="none" stroke="rgba(245, 185, 66, 0.25)" strokeWidth="1"/>
          <path d="M9 16h6v-4h-1v-1.5h-1V11h-1v.5h-1V12H9z" fill="url(#gGold)"/>
          <path d="M12 7.5v3.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" filter="url(#glowGold)"/>
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(255, 249, 212, 0.15)" strokeWidth="1" strokeDasharray="4,2"/>
          <path d="M7.5 10l-1.5 1v3 M16.5 10l1.5 1v3" fill="none" stroke="#ffd43f" strokeWidth="1.2" filter="url(#glowGold)"/>
        </symbol>

        {/* Investment Bank */}
        <symbol id="t-ib" viewBox="0 0 24 24">
          <path d="M4 21V9.5L12 3.5l8 6V21Z" fill="#02050c" stroke="url(#gBlue)" strokeWidth="2" filter="url(#glowCyan)"/>
          <line x1="7.5" y1="10" x2="7.5" y2="18" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowCyan)"/>
          <line x1="12" y1="9" x2="12" y2="18" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowCyan)"/>
          <line x1="16.5" y1="10" x2="16.5" y2="18" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowCyan)"/>
          <path d="M3 21h18" stroke="url(#gBlue)" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M12 3.5v3" stroke="#ffffff" strokeWidth="1.5" filter="url(#glowCyan)"/>
          <circle cx="12" cy="13.5" r="2.5" fill="#02050c" stroke="#00f0ff" strokeWidth="1"/>
          <circle cx="12" cy="13.5" r="0.75" fill="#ffffff"/>
          <path d="M5 18h14M5 14h14M5 10h14" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="1"/>
        </symbol>

        {/* Market Maker */}
        <symbol id="t-mm" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="rgba(245, 185, 66, 0.15)" strokeWidth="1"/>
          <circle cx="12" cy="12" r="9" fill="#030408" stroke="url(#gGold)" strokeWidth="1.8" filter="url(#glowGold)"/>
          <path d="M12 2v3.5 M12 18.5v3.5 M2 12h3.5 M18.5 12h3.5" stroke="url(#gGold)" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowGold)"/>
          <path d="M5.64 5.64l1.41 1.41 M18.36 18.36l-1.41-1.41 M18.36 5.64l-1.41 1.41 M5.64 18.36l1.41-1.41" stroke="rgba(255, 249, 212, 0.4)" strokeWidth="1"/>
          <path d="M9.5 9.5l2.5-2.5 2.5 2.5" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" filter="url(#glowGold)"/>
          <path d="M14.5 14.5l-2.5 2.5-2.5-2.5" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" filter="url(#glowGold)"/>
          <circle cx="12" cy="12" r="1" fill="#ffffff" filter="url(#glowGold)"/>
        </symbol>

        {/* Federal Reserve */}
        <symbol id="t-fed" viewBox="0 0 24 24">
          <path d="M2.5 10 L12 2 L21.5 10 Z" fill="url(#gGold)" stroke="url(#gGold)" strokeWidth="1.5" filter="url(#glowGold)" opacity="0.4"/>
          <path d="M1.5 10h21v2.5H1.5z" fill="#0c0b05" stroke="url(#gGold)" strokeWidth="1.2"/>
          <line x1="5" y1="12.5" x2="5" y2="18.5" stroke="#f5b942" strokeWidth="2.5" filter="url(#glowGold)"/>
          <line x1="9.5" y1="12.5" x2="9.5" y2="18.5" stroke="#f5b942" strokeWidth="2.5" filter="url(#glowGold)"/>
          <line x1="14.5" y1="12.5" x2="14.5" y2="18.5" stroke="#f5b942" strokeWidth="2.5" filter="url(#glowGold)"/>
          <line x1="19" y1="12.5" x2="19" y2="18.5" stroke="#f5b942" strokeWidth="2.5" filter="url(#glowGold)"/>
          <rect x="1" y="18.5" width="22" height="2" rx="0.5" fill="url(#gGold)" filter="url(#glowGold)"/>
          <rect x="2.5" y="20.5" width="19" height="2" rx="0.5" fill="url(#gGold)"/>
          <circle cx="12" cy="15.5" r="3.5" fill="#0c0b05" stroke="#ffffff" strokeWidth="1"/>
          <text x="12" y="18.2" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">$</text>
        </symbol>

        {/* Crypto assets */}
        <symbol id="t-crypto" viewBox="0 0 24 24">
          <path d="M 12 1.5 L 18.5 4.5 L 22.5 11 L 20 17.5 L 12 22.5 L 4 17.5 L 1.5 11 L 5.5 4.5 Z" fill="none" stroke="rgba(232, 121, 249, 0.2)" strokeWidth="1"/>
          <path d="M12 1.5v21 M1.5 11h21 M5.5 4.5l13 13 M18.5 4.5L5.5 17.5" stroke="rgba(162, 28, 175, 0.15)" strokeWidth="1"/>
          <circle cx="12" cy="12" r="9" fill="#04020a" stroke="url(#gPurple)" strokeWidth="1.8" filter="url(#glowPurple)"/>
          <circle cx="12" cy="3" r="1" fill="#e879f9" filter="url(#glowPurple)"/>
          <circle cx="21" cy="12" r="1" fill="#e879f9" filter="url(#glowPurple)"/>
          <circle cx="12" cy="21" r="1" fill="#e879f9" filter="url(#glowPurple)"/>
          <circle cx="3" cy="12" r="1" fill="#e879f9" filter="url(#glowPurple)"/>
          <path d="M12 5.5L7 11.5h10z" fill="url(#gPurple)" opacity="0.6"/>
          <path d="M12 18.5l-5-7h10z" fill="url(#gPurple)" opacity="0.8"/>
          <path d="M12 5.5L7 11.5L12 14L17 11.5Z" fill="none" stroke="#ffffff" strokeWidth="1.2" filter="url(#glowPurple)"/>
          <line x1="7" y1="11.5" x2="17" y2="11.5" stroke="#ffffff" strokeWidth="1"/>
        </symbol>

        {/* Forex Markets */}
        <symbol id="t-forex" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="#010604" stroke="url(#gGreen)" strokeWidth="1.8" filter="url(#glowGreen)"/>
          <path d="M3.5 12h17 M12 3a9 9 0 0 0 0 18 M12 3a15 15 0 0 0 4 9 15 15 0 0 0-4 9 M12 3a15 15 0 0 1-4 9 15 15 0 0 1 4 9" fill="none" stroke="rgba(0, 255, 157, 0.15)" strokeWidth="1"/>
          <path d="M6 12a6 6 0 0 1 12 0" fill="none" stroke="#00ff9d" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowGreen)"/>
          <path d="M18 12a6 6 0 0 1-12 0" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M17 9.5l2.5 2.5-2.5 2.5" fill="none" stroke="#00ff9d" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowGreen)"/>
          <path d="M7 14.5L4.5 12 7 9.5" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#010604" stroke="rgba(0, 255, 157, 0.4)" strokeWidth="1"/>
          <text x="12" y="13.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#ffffff" fontFamily="sans-serif">$</text>
        </symbol>

        {/* Commodities */}
        <symbol id="t-commodity" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="rgba(245, 185, 66, 0.15)" strokeWidth="1"/>
          <path d="M3 19l2-5h6l2 5Z" fill="url(#gGold)" stroke="url(#gGold)" strokeWidth="1"/>
          <path d="M5 14h4.5" stroke="#ffffff" strokeWidth="0.8" opacity="0.5"/>
          <path d="M11 19l2-5h6l2 5Z" fill="url(#gGold)" stroke="url(#gGold)" strokeWidth="1"/>
          <path d="M13 14h4.5" stroke="#ffffff" strokeWidth="0.8" opacity="0.5"/>
          <path d="M7 13l2-5h6l2 5Z" fill="url(#gGold)" stroke="url(#gGold)" strokeWidth="1.5" filter="url(#glowGold)"/>
          <path d="M9 8h4" stroke="#ffffff" strokeWidth="1" opacity="0.7"/>
          <path d="M8.5 12.5l5-5" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" filter="url(#glowGold)"/>
          <path d="M4.5 18.5l3-3 M12.5 18.5l3-3" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6"/>
        </symbol>

        {/* Bonds */}
        <symbol id="t-bond" viewBox="0 0 24 24">
          <path d="M4 5v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1z" fill="#070503" stroke="url(#gGold)" strokeWidth="1.8" filter="url(#glowGold)"/>
          <path d="M5 8c2.5 1 5-1 7.5 0s5 1 7.5 0" fill="none" stroke="rgba(245, 185, 66, 0.15)" strokeWidth="1"/>
          <path d="M5 12c2.5 1 5-1 7.5 0s5 1 7.5 0" fill="none" stroke="rgba(245, 185, 66, 0.15)" strokeWidth="1"/>
          <line x1="6" y1="7.5" x2="14" y2="7.5" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="6" y1="10.5" x2="12" y2="10.5" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="6" y1="13.5" x2="13" y2="13.5" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M15 13.5h3.5v4H15z" fill="none" stroke="#ffffff" strokeWidth="1"/>
          <text x="16.75" y="16.5" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">%</text>
          <path d="M14.5 17.5l-1 2.5 1.5-1 1.5 1z M17.5 17.5l-1 2.5 1.5-1 1.5 1z" fill="url(#gGold)"/>
          <circle cx="16" cy="16.5" r="2.5" fill="url(#gGold)" stroke="#ffd700" strokeWidth="0.5" filter="url(#glowGold)"/>
        </symbol>

        {/* UI Indicators */}
        <symbol id="i-mute" viewBox="0 0 24 24"><path d="M4 9 L4 15 L8 15 L13 19 L13 5 L8 9 Z" fill="currentColor"/><path d="M16 9 L21 14 M21 9 L16 14" stroke="currentColor" strokeWidth="1.5"/></symbol>
        <symbol id="i-sound" viewBox="0 0 24 24"><path d="M4 9 L4 15 L8 15 L13 19 L13 5 L8 9 Z" fill="currentColor"/><path d="M16 8 Q19 12 16 16 M18 6 Q22 12 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"/></symbol>
        <symbol id="i-reset" viewBox="0 0 24 24"><path d="M4 12 A8 8 0 1 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5 L4 9 L8 9" fill="none" stroke="currentColor" strokeWidth="1.5"/></symbol>
      </defs>
    </svg>
  );
}
