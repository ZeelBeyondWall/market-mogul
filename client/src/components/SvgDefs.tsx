export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#f5b942"/><stop offset="100%" stopColor="#7a5a18"/></linearGradient>
        <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80"/><stop offset="100%" stopColor="#15803d"/></linearGradient>
        <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f87171"/><stop offset="100%" stopColor="#991b1b"/></linearGradient>
        <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc"/><stop offset="100%" stopColor="#0369a1"/></linearGradient>
        <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c084fc"/><stop offset="100%" stopColor="#6b21a8"/></linearGradient>
        <linearGradient id="gSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2e8f0"/><stop offset="100%" stopColor="#475569"/></linearGradient>

        <symbol id="logoFull" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#gGold)" strokeWidth="2"/>
          <circle cx="100" cy="100" r="80" fill="#05080d"/>
          <path d="M55 70 Q40 50 50 35 Q70 50 80 70 Z" fill="url(#gGold)"/>
          <path d="M145 70 Q160 50 150 35 Q130 50 120 70 Z" fill="url(#gGold)"/>
          <path d="M65 75 Q100 65 135 75 Q140 110 130 130 Q115 150 100 150 Q85 150 70 130 Q60 110 65 75 Z" fill="url(#gGold)"/>
          <circle cx="85" cy="100" r="3" fill="#000"/>
          <circle cx="115" cy="100" r="3" fill="#000"/>
          <rect x="50" y="160" width="6" height="14" fill="#22c55e"/>
          <rect x="62" y="155" width="6" height="19" fill="#22c55e"/>
          <rect x="74" y="148" width="6" height="26" fill="#22c55e"/>
          <rect x="86" y="142" width="6" height="32" fill="#22c55e"/>
          <rect x="98" y="135" width="6" height="39" fill="#fde68a"/>
          <rect x="110" y="130" width="6" height="44" fill="#fde68a"/>
          <rect x="122" y="125" width="6" height="49" fill="#fde68a"/>
          <rect x="134" y="120" width="6" height="54" fill="#f5b942"/>
          <rect x="146" y="115" width="6" height="59" fill="#f5b942"/>
        </symbol>
        <symbol id="logoMini" viewBox="0 0 32 32">
          <rect x="1" y="1" width="30" height="30" rx="6" fill="#05080d" stroke="url(#gGold)" strokeWidth="1.5"/>
          <text x="16" y="22" textAnchor="middle" fontFamily="serif" fontWeight="900" fontSize="18" fill="url(#gGold)">M</text>
        </symbol>

        <symbol id="t-penny" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="url(#gSilver)" stroke="#94a3b8"/><text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill="#1e293b">¢</text></symbol>
        <symbol id="t-blue" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="1" fill="url(#gBlue)" stroke="#0369a1"/><rect x="6" y="9" width="2" height="8" fill="#fff" opacity=".6"/><rect x="9" y="11" width="2" height="6" fill="#fff" opacity=".6"/><rect x="12" y="8" width="2" height="9" fill="#fff" opacity=".8"/><rect x="15" y="10" width="2" height="7" fill="#fff" opacity=".6"/><path d="M3 6 L12 2 L21 6" fill="#1e3a5f" stroke="#0369a1"/></symbol>
        <symbol id="t-index" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="url(#gGreen)" strokeWidth="2"/><path d="M5 16 L9 12 L13 14 L19 7" fill="none" stroke="url(#gGreen)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="19" cy="7" r="2" fill="url(#gGreen)"/></symbol>
        <symbol id="t-options" viewBox="0 0 24 24"><path d="M4 20 L4 4 L20 20 Z" fill="url(#gPurple)" opacity=".7"/><path d="M4 20 L20 4 L20 20 Z" fill="url(#gPurple)"/><text x="12" y="17" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">Ω</text></symbol>
        <symbol id="t-hedge" viewBox="0 0 24 24"><path d="M12 2 L20 6 L20 14 Q20 19 12 22 Q4 19 4 14 L4 6 Z" fill="url(#gGold)" stroke="#7a5a18"/><text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="900" fill="#000">H</text></symbol>
        <symbol id="t-ib" viewBox="0 0 24 24"><rect x="2" y="9" width="20" height="12" fill="url(#gSilver)" stroke="#475569"/><path d="M2 9 L12 3 L22 9 Z" fill="#cbd5e1" stroke="#475569"/><rect x="5" y="13" width="2" height="6" fill="#1e293b"/><rect x="9" y="13" width="2" height="6" fill="#1e293b"/><rect x="13" y="13" width="2" height="6" fill="#1e293b"/><rect x="17" y="13" width="2" height="6" fill="#1e293b"/></symbol>
        <symbol id="t-mm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#0c121b" stroke="url(#gGold)" strokeWidth="1.5"/><path d="M6 12 L18 12 M12 6 L12 18" stroke="url(#gGold)" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" fill="url(#gGold)"/></symbol>
        <symbol id="t-fed" viewBox="0 0 24 24"><path d="M2 20 L22 20" stroke="url(#gGold)" strokeWidth="1.5"/><path d="M3 20 L3 10 M7 20 L7 10 M11 20 L11 10 M15 20 L15 10 M19 20 L19 10 M21 20 L21 10" stroke="url(#gGold)" strokeWidth="1.5"/><path d="M2 10 L22 10 L22 8 L2 8 Z" fill="url(#gGold)"/><path d="M2 8 L12 2 L22 8 Z" fill="url(#gGold)"/></symbol>
        <symbol id="t-crypto" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="url(#gPurple)" stroke="#6b21a8"/><path d="M14 6 L9 13 L13 13 L10 18 L15 11 L11 11 Z" fill="#fff"/></symbol>
        <symbol id="t-forex" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="url(#gGreen)" stroke="#15803d"/><text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">$</text><path d="M7 7 L17 7 M7 17 L17 17" stroke="#fff" strokeWidth=".5" opacity=".6"/></symbol>
        <symbol id="t-commodity" viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="1" fill="url(#gGold)" stroke="#7a5a18"/><rect x="3" y="9" width="18" height="2" fill="#fde68a"/><path d="M5 11 L19 11 M5 13 L19 13" stroke="#7a5a18" strokeWidth=".5"/></symbol>
        <symbol id="t-bond" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#fef3c7" stroke="#92400e"/><path d="M6 8 L18 8 M6 11 L18 11 M6 14 L18 14 M6 17 L13 17" stroke="#92400e" strokeWidth="1"/><circle cx="17" cy="17" r="2.5" fill="url(#gGold)" stroke="#7a5a18"/></symbol>

        <symbol id="i-mute" viewBox="0 0 24 24"><path d="M4 9 L4 15 L8 15 L13 19 L13 5 L8 9 Z" fill="currentColor"/><path d="M16 9 L21 14 M21 9 L16 14" stroke="currentColor" strokeWidth="1.5"/></symbol>
        <symbol id="i-sound" viewBox="0 0 24 24"><path d="M4 9 L4 15 L8 15 L13 19 L13 5 L8 9 Z" fill="currentColor"/><path d="M16 8 Q19 12 16 16 M18 6 Q22 12 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"/></symbol>
        <symbol id="i-reset" viewBox="0 0 24 24"><path d="M4 12 A8 8 0 1 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5 L4 9 L8 9" fill="none" stroke="currentColor" strokeWidth="1.5"/></symbol>
      </defs>
    </svg>
  );
}
