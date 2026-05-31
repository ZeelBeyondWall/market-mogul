import type { AssetDef, Market, NewsEventDef, StrategyId } from './types';

export const BOT_COUNT = 10000;
export const CANDLE_MS = 2000;
export const SAVE_KEY = 'marketMogul_v5';

// v5: Level progression. XP needed to REACH level N (cumulative from level 1).
// Formula: floor(100 * N^1.5). L1=100 (to reach L2), L5=1118, L10=3162,
// L20=8944, L30=16432, L50=35355.
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function levelFromXp(xp: number): number {
  // Cheap iterative — caps at L99.
  let lvl = 1;
  while (lvl < 99 && xp >= xpToReach(lvl + 1)) lvl++;
  return lvl;
}

// Market unlock thresholds (per user spec).
export const UNLOCK_LEVELS = {
  stocksBasic: 1,
  stocksAll: 5,
  crypto: 10,
  forex: 20,
  advanced: 30,
  premium: 50,
} as const;

export function marketUnlockLevel(m: Market): number {
  if (m === 'stocks') return UNLOCK_LEVELS.stocksBasic;
  if (m === 'crypto') return UNLOCK_LEVELS.crypto;
  return UNLOCK_LEVELS.forex;
}

// XP gained per closed trade. Caps so a single $10M whale doesn't level instantly.
export function xpForTrade(pnl: number): number {
  return Math.min(500, Math.max(1, Math.floor(Math.abs(pnl) / 10)));
}

// v5 ASSETS — fully renamed per spec: 60 stocks + 25 crypto + 15 forex = 100.
// minLevel maps to UNLOCK_LEVELS so the gating reads cleanly.
export const ASSETS: AssetDef[] = [
  // ============ STOCKS — TECHNOLOGY (10) ============
  { id:'NEXA', name:'NexaTech',       icon:'t-blue', cat:'tech', market:'stocks', minLevel:1, fairValue:180, div:0.0009, vol:0.013, float:9e8,  desc:'AI infrastructure' },
  { id:'QSFT', name:'QuantumSoft',    icon:'t-blue', cat:'tech', market:'stocks', minLevel:1, fairValue:340, div:0.0008, vol:0.012, float:7e8,  desc:'Enterprise software' },
  { id:'CYCR', name:'CyberCore',      icon:'t-blue', cat:'tech', market:'stocks', minLevel:1, fairValue:220, div:0,      vol:0.015, float:5e8,  desc:'Cybersecurity' },
  { id:'TTSY', name:'Titan Systems',  icon:'t-blue', cat:'tech', market:'stocks', minLevel:1, fairValue:155, div:0.0007, vol:0.013, float:8e8,  desc:'Systems integrator' },
  { id:'VTAI', name:'Vertex AI',      icon:'t-blue', cat:'tech', market:'stocks', minLevel:5, fairValue:520, div:0,      vol:0.020, float:4e8,  desc:'AI research lab' },
  { id:'NVLG', name:'Nova Logic',     icon:'t-blue', cat:'tech', market:'stocks', minLevel:5, fairValue:285, div:0.0006, vol:0.016, float:5e8,  desc:'Cloud compute' },
  { id:'SKNX', name:'SkyNetix',       icon:'t-blue', cat:'tech', market:'stocks', minLevel:5, fairValue:95,  div:0,      vol:0.018, float:6e8,  desc:'Satellite network' },
  { id:'PXDY', name:'Pixel Dynamics', icon:'t-blue', cat:'tech', market:'stocks', minLevel:5, fairValue:62,  div:0,      vol:0.017, float:7e8,  desc:'Graphics chips' },
  { id:'HYLK', name:'HyperLink',      icon:'t-blue', cat:'tech', market:'stocks', minLevel:5, fairValue:118, div:0.0005, vol:0.014, float:6e8,  desc:'Networking hardware' },
  { id:'OMCM', name:'OmniCompute',    icon:'t-blue', cat:'tech', market:'stocks', minLevel:5, fairValue:430, div:0.0007, vol:0.014, float:5e8,  desc:'HPC platforms' },

  // ============ STOCKS — BANKING & FINANCE (10) ============
  { id:'ABNK', name:'Apex Bank',         icon:'t-blue', cat:'bank', market:'stocks', minLevel:1, fairValue:140, div:0.0013, vol:0.012, float:6e8,  desc:'Money center bank' },
  { id:'GTST', name:'Global Trust',      icon:'t-blue', cat:'bank', market:'stocks', minLevel:1, fairValue:88,  div:0.0014, vol:0.011, float:7e8,  desc:'Custody bank' },
  { id:'COPX', name:'CapitalOneX',       icon:'t-blue', cat:'bank', market:'stocks', minLevel:1, fairValue:165, div:0.0011, vol:0.013, float:5e8,  desc:'Consumer credit' },
  { id:'ZFIN', name:'Zenith Finance',    icon:'t-blue', cat:'bank', market:'stocks', minLevel:1, fairValue:295, div:0.0010, vol:0.014, float:3e8,  desc:'Investment bank' },
  { id:'TBNK', name:'Titan Bank',        icon:'t-blue', cat:'bank', market:'stocks', minLevel:5, fairValue:62,  div:0.0013, vol:0.012, float:5e8,  desc:'Regional bank' },
  { id:'SECH', name:'Secure Holdings',   icon:'t-blue', cat:'bank', market:'stocks', minLevel:5, fairValue:48,  div:0.0012, vol:0.011, float:6e8,  desc:'Holding company' },
  { id:'PRCR', name:'Prime Credit',      icon:'t-blue', cat:'bank', market:'stocks', minLevel:5, fairValue:75,  div:0.0011, vol:0.012, float:4e8,  desc:'Lending platform' },
  { id:'UNCP', name:'Unity Capital',     icon:'t-blue', cat:'bank', market:'stocks', minLevel:5, fairValue:210, div:0.0010, vol:0.013, float:3e8,  desc:'Private equity' },
  { id:'STBK', name:'Sterling Bank',     icon:'t-blue', cat:'bank', market:'stocks', minLevel:5, fairValue:55,  div:0.0014, vol:0.011, float:5e8,  desc:'Community bank' },
  { id:'VTFN', name:'Vertex Financial',  icon:'t-blue', cat:'bank', market:'stocks', minLevel:5, fairValue:380, div:0.0009, vol:0.015, float:2e8,  desc:'Wealth advisory' },

  // ============ STOCKS — ENERGY (10) ============
  { id:'FENR', name:'Fusion Energy',  icon:'t-commodity', cat:'energy', market:'stocks', minLevel:1, fairValue:85,  div:0.0008, vol:0.018, float:5e8,  desc:'Fusion R&D' },
  { id:'SOLG', name:'SolarGrid',      icon:'t-commodity', cat:'energy', market:'stocks', minLevel:1, fairValue:42,  div:0.0010, vol:0.020, float:6e8,  desc:'Solar utility' },
  { id:'TOIL', name:'Titan Oil',      icon:'t-commodity', cat:'energy', market:'stocks', minLevel:1, fairValue:115, div:0.0018, vol:0.020, float:7e8,  desc:'Integrated oil' },
  { id:'GVLT', name:'GreenVolt',      icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:38,  div:0.0009, vol:0.022, float:5e8,  desc:'EV charging' },
  { id:'HYCR', name:'HydroCore',      icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:68,  div:0.0014, vol:0.014, float:4e8,  desc:'Hydroelectric' },
  { id:'QPWR', name:'Quantum Power',  icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:125, div:0.0007, vol:0.025, float:3e8,  desc:'Battery tech' },
  { id:'TENR', name:'Terra Energy',   icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:55,  div:0.0013, vol:0.016, float:5e8,  desc:'Geothermal' },
  { id:'INFL', name:'Infinite Fuel',  icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:95,  div:0.0011, vol:0.019, float:4e8,  desc:'Hydrogen fuel' },
  { id:'NVEL', name:'Nova Electric',  icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:72,  div:0.0012, vol:0.015, float:6e8,  desc:'Grid operator' },
  { id:'ECOG', name:'EcoGrid',        icon:'t-commodity', cat:'energy', market:'stocks', minLevel:5, fairValue:48,  div:0.0010, vol:0.018, float:5e8,  desc:'Smart grid' },

  // ============ STOCKS — HEALTHCARE (10) ============
  { id:'BNVA', name:'BioNova',         icon:'t-blue', cat:'health', market:'stocks', minLevel:1, fairValue:185, div:0.0008, vol:0.018, float:4e8,  desc:'Biotech research' },
  { id:'LFCR', name:'LifeCore',        icon:'t-blue', cat:'health', market:'stocks', minLevel:1, fairValue:240, div:0.0011, vol:0.014, float:5e8,  desc:'Medical devices' },
  { id:'TPHM', name:'Titan Pharma',    icon:'t-blue', cat:'health', market:'stocks', minLevel:1, fairValue:155, div:0.0014, vol:0.013, float:6e8,  desc:'Big pharma' },
  { id:'MDTC', name:'MediTech',        icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:88,  div:0.0009, vol:0.016, float:5e8,  desc:'Health IT' },
  { id:'QHLT', name:'Quantum Health',  icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:128, div:0.0010, vol:0.015, float:4e8,  desc:'Telehealth' },
  { id:'CRGN', name:'CureGen',         icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:325, div:0,      vol:0.025, float:2e8,  desc:'Gene therapy' },
  { id:'VTLB', name:'Vital Labs',      icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:72,  div:0.0010, vol:0.015, float:4e8,  desc:'Diagnostics' },
  { id:'OMCR', name:'OmniCare',        icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:55,  div:0.0012, vol:0.012, float:5e8,  desc:'Care management' },
  { id:'NBIO', name:'Nexa Biotech',    icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:215, div:0,      vol:0.022, float:3e8,  desc:'Biotech mid-cap' },
  { id:'HSPH', name:'HealthSphere',    icon:'t-blue', cat:'health', market:'stocks', minLevel:5, fairValue:42,  div:0.0008, vol:0.016, float:5e8,  desc:'Health insurance' },

  // ============ STOCKS — CONSUMER & RETAIL (10) ============
  { id:'MGMT', name:'MegaMart',     icon:'t-blue', cat:'consumer', market:'stocks', minLevel:1, fairValue:140, div:0.0011, vol:0.011, float:6e8,  desc:'Discount retail' },
  { id:'UBWR', name:'UrbanWear',    icon:'t-blue', cat:'consumer', market:'stocks', minLevel:1, fairValue:78,  div:0.0009, vol:0.014, float:5e8,  desc:'Apparel chain' },
  { id:'FCRT', name:'FastCart',     icon:'t-blue', cat:'consumer', market:'stocks', minLevel:1, fairValue:118, div:0,      vol:0.016, float:4e8,  desc:'E-commerce' },
  { id:'NVFD', name:'Nova Foods',   icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:62,  div:0.0013, vol:0.010, float:5e8,  desc:'Packaged foods' },
  { id:'ELTB', name:'Elite Brands', icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:215, div:0.0012, vol:0.012, float:3e8,  desc:'Luxury holding' },
  { id:'FRMT', name:'FreshMart',    icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:48,  div:0.0011, vol:0.011, float:5e8,  desc:'Grocery chain' },
  { id:'HNST', name:'HomeNest',     icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:185, div:0.0010, vol:0.013, float:4e8,  desc:'Home improvement' },
  { id:'PRTL', name:'Prime Retail', icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:92,  div:0.0010, vol:0.012, float:5e8,  desc:'REIT retail' },
  { id:'TRDF', name:'Trendify',     icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:35,  div:0,      vol:0.020, float:6e8,  desc:'Fast-fashion online' },
  { id:'HSTR', name:'HyperStore',   icon:'t-blue', cat:'consumer', market:'stocks', minLevel:5, fairValue:128, div:0.0009, vol:0.013, float:4e8,  desc:'Big-box electronics' },

  // ============ STOCKS — GAMING & ENTERTAINMENT (10) ============
  { id:'PXST', name:'Pixel Studios',       icon:'t-blue', cat:'gaming', market:'stocks', minLevel:1, fairValue:95,  div:0,      vol:0.020, float:4e8,  desc:'AAA game studio' },
  { id:'TGMS', name:'Titan Games',         icon:'t-blue', cat:'gaming', market:'stocks', minLevel:1, fairValue:165, div:0.0005, vol:0.018, float:3e8,  desc:'Game publisher' },
  { id:'STWV', name:'StreamWave',          icon:'t-blue', cat:'gaming', market:'stocks', minLevel:1, fairValue:285, div:0,      vol:0.020, float:4e8,  desc:'Streaming platform' },
  { id:'VVRS', name:'VirtualVerse',        icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:55,  div:0,      vol:0.025, float:5e8,  desc:'VR metaverse' },
  { id:'NXEN', name:'Nexa Entertainment',  icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:78,  div:0.0006, vol:0.017, float:4e8,  desc:'Film + TV' },
  { id:'QGMG', name:'Quantum Gaming',      icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:42,  div:0,      vol:0.022, float:5e8,  desc:'Mobile games' },
  { id:'SKPY', name:'SkyPlay',             icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:118, div:0,      vol:0.019, float:3e8,  desc:'Cloud gaming' },
  { id:'AINT', name:'Arena Interactive',   icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:62,  div:0,      vol:0.021, float:4e8,  desc:'Esports league' },
  { id:'NVMD', name:'Nova Media',          icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:98,  div:0.0007, vol:0.015, float:4e8,  desc:'Media conglomerate' },
  { id:'DRFG', name:'DreamForge',          icon:'t-blue', cat:'gaming', market:'stocks', minLevel:5, fairValue:155, div:0,      vol:0.018, float:3e8,  desc:'Indie publisher' },

  // ============ CRYPTO — LARGE CAP (10) ============
  { id:'NOVA', name:'NovaCoin',     icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:42000, div:0, vol:0.026, float:2.1e7, desc:'Reserve crypto' },
  { id:'TTNC', name:'TitanCoin',    icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:2800,  div:0, vol:0.028, float:1.2e8, desc:'Smart contracts' },
  { id:'QTMC', name:'QuantumCoin',  icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:380,   div:0, vol:0.030, float:1.5e8, desc:'Privacy chain' },
  { id:'APXC', name:'ApexChain',    icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:95,    div:0, vol:0.032, float:4e8,   desc:'L1 platform' },
  { id:'SOLR', name:'SolarCoin',    icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:28,    div:0, vol:0.034, float:3.5e8, desc:'Energy chain' },
  { id:'VTXC', name:'VertexCoin',   icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:18,    div:0, vol:0.031, float:8e8,   desc:'DeFi protocol' },
  { id:'OMNT', name:'OmniToken',    icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:6.20,  div:0, vol:0.033, float:6e8,   desc:'Cross-chain' },
  { id:'HYPC', name:'HyperCoin',    icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:1.25,  div:0, vol:0.030, float:2e10,  desc:'Payments coin' },
  { id:'ZNTC', name:'ZenithCoin',   icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:14,    div:0, vol:0.029, float:5e8,   desc:'Oracle network' },
  { id:'FSNC', name:'FusionCoin',   icon:'t-crypto', cat:'crypto_large', market:'crypto', minLevel:10, fairValue:75,    div:0, vol:0.028, float:7e7,   desc:'Silver-tier crypto' },

  // ============ CRYPTO — MID CAP (10) ============
  { id:'PXLC', name:'PixelCoin',    icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:8.50,  div:0, vol:0.038, float:1.2e9, desc:'Gaming token' },
  { id:'STRT', name:'StreamToken',  icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:0.85,  div:0, vol:0.040, float:9e9,   desc:'Streaming pay' },
  { id:'CYBT', name:'CyberToken',   icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:4.20,  div:0, vol:0.042, float:1e9,   desc:'Security audit' },
  { id:'GRDC', name:'GridCoin',     icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:0.55,  div:0, vol:0.038, float:3.5e10,desc:'Compute grid' },
  { id:'VOLC', name:'VoltCoin',     icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:0.62,  div:0, vol:0.040, float:5e10,  desc:'Energy DAO' },
  { id:'ARNT', name:'ArenaToken',   icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:10,    div:0, vol:0.042, float:3e8,   desc:'Esports stakes' },
  { id:'LGCC', name:'LogicCoin',    icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:4.20,  div:0, vol:0.045, float:1e9,   desc:'AI compute' },
  { id:'TRRT', name:'TerraToken',   icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:8.80,  div:0, vol:0.044, float:5e8,   desc:'Real-asset tokens' },
  { id:'CORC', name:'CoreCoin',     icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:2.40,  div:0, vol:0.040, float:1.5e9, desc:'Base layer' },
  { id:'ALFC', name:'AlphaChain',   icon:'t-crypto', cat:'crypto_mid', market:'crypto', minLevel:10, fairValue:6.50,  div:0, vol:0.041, float:8e8,   desc:'Hedge chain' },

  // ============ CRYPTO — MEME COINS (5) — PREMIUM L50 ============
  { id:'DGNV', name:'DogeNova',    icon:'t-penny', cat:'crypto_meme', market:'crypto', minLevel:50, fairValue:0.18, div:0, vol:0.060, float:1.5e11, desc:'Dog-themed meme' },
  { id:'MNTT', name:'MoonTitan',   icon:'t-penny', cat:'crypto_meme', market:'crypto', minLevel:50, fairValue:0.04, div:0, vol:0.080, float:5e11,   desc:'Moon meme' },
  { id:'PEPX', name:'PepeX',       icon:'t-penny', cat:'crypto_meme', market:'crypto', minLevel:50, fairValue:0.22, div:0, vol:0.075, float:1e11,   desc:'Frog meme' },
  { id:'RKTC', name:'RocketCoin',  icon:'t-penny', cat:'crypto_meme', market:'crypto', minLevel:50, fairValue:0.012,div:0, vol:0.090, float:2e12,   desc:'Rocket meme' },
  { id:'BNNT', name:'BananaToken', icon:'t-penny', cat:'crypto_meme', market:'crypto', minLevel:50, fairValue:0.06, div:0, vol:0.085, float:8e11,   desc:'Fruit meme' },

  // ============ FOREX — USD PAIRS (5) — major ============
  { id:'USDNOVA', name:'USD/NOVA',  icon:'t-forex', cat:'forex_major', market:'forex', minLevel:20, fairValue:1.00,  div:0, vol:0.005, float:1e12, desc:'USD vs NOVA reserve' },
  { id:'USDTTN',  name:'USD/TITAN', icon:'t-forex', cat:'forex_major', market:'forex', minLevel:20, fairValue:1.18,  div:0, vol:0.006, float:8e11, desc:'USD vs Titan zone' },
  { id:'USDSLR',  name:'USD/SOLAR', icon:'t-forex', cat:'forex_major', market:'forex', minLevel:20, fairValue:0.92,  div:0, vol:0.007, float:6e11, desc:'USD vs Solar bloc' },
  { id:'USDAPX',  name:'USD/APEX',  icon:'t-forex', cat:'forex_major', market:'forex', minLevel:20, fairValue:1.45,  div:0, vol:0.008, float:5e11, desc:'USD vs Apex' },
  { id:'USDZTH',  name:'USD/ZENITH',icon:'t-forex', cat:'forex_major', market:'forex', minLevel:20, fairValue:0.74,  div:0, vol:0.007, float:4e11, desc:'USD vs Zenith' },

  // ============ FOREX — NOVA CROSSES (4) ============
  { id:'NVATTN', name:'NOVA/TITAN',  icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:1.18, div:0, vol:0.008, float:3e11, desc:'NOVA crossed Titan' },
  { id:'NVASLR', name:'NOVA/SOLAR',  icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:0.92, div:0, vol:0.009, float:3e11, desc:'NOVA crossed Solar' },
  { id:'NVAAPX', name:'NOVA/APEX',   icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:1.45, div:0, vol:0.010, float:2e11, desc:'NOVA crossed Apex' },
  { id:'NVAZTH', name:'NOVA/ZENITH', icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:0.74, div:0, vol:0.009, float:2e11, desc:'NOVA crossed Zenith' },

  // ============ FOREX — TITAN CROSSES (3) ============
  { id:'TTNSLR', name:'TITAN/SOLAR',  icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:0.78, div:0, vol:0.011, float:2e11, desc:'Titan crossed Solar' },
  { id:'TTNAPX', name:'TITAN/APEX',   icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:1.23, div:0, vol:0.012, float:2e11, desc:'Titan crossed Apex' },
  { id:'TTNZTH', name:'TITAN/ZENITH', icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:0.63, div:0, vol:0.010, float:2e11, desc:'Titan crossed Zenith' },

  // ============ FOREX — SOLAR CROSSES (2) ============
  { id:'SLRAPX', name:'SOLAR/APEX',   icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:1.58, div:0, vol:0.013, float:1e11, desc:'Solar crossed Apex' },
  { id:'SLRZTH', name:'SOLAR/ZENITH', icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:20, fairValue:0.80, div:0, vol:0.012, float:1e11, desc:'Solar crossed Zenith' },

  // ============ FOREX — APEX CROSS (1) — premium ============
  { id:'APXZTH', name:'APEX/ZENITH',  icon:'t-forex', cat:'forex_cross', market:'forex', minLevel:50, fairValue:0.51, div:0, vol:0.015, float:1e11, desc:'Apex crossed Zenith (exotic)' },
];

// ===== LEGACY ASSET BLOCK REMOVED in v5 — see git history (commit a813a7a~1) =====
const _OLD_ASSETS_STRIPPED: never[] = [];
void _OLD_ASSETS_STRIPPED;
// The block below is intentionally typed-out to be erased; kept as comment for ref.
/* eslint-disable */
const _legacy_ref = () => ([
  // ====== PENNY / MEME (12) ======
  { id:'PUMP', name:'PumpCoin',    icon:'t-penny', cat:'penny', fairValue:0.50, div:0, vol:0.045, float:5e7,  desc:'Meme penny' },
  { id:'SHIB', name:'GameShibe',   icon:'t-penny', cat:'penny', fairValue:0.12, div:0, vol:0.05,  float:1e8,  desc:'Microcap' },
  { id:'JUNK', name:'JunkBio',     icon:'t-penny', cat:'penny', fairValue:2.40, div:0, vol:0.035, float:2e7,  desc:'Biotech speculation' },
  { id:'RUGS', name:'RugPullX',    icon:'t-penny', cat:'penny', fairValue:0.08, div:0, vol:0.06,  float:5e7,  desc:'Sketchy token' },
  { id:'MOON', name:'MoonBoy',     icon:'t-penny', cat:'penny', fairValue:0.35, div:0, vol:0.05,  float:8e7,  desc:'Hype play' },
  { id:'APES', name:'ApeStock',    icon:'t-penny', cat:'penny', fairValue:1.10, div:0, vol:0.04,  float:3e7,  desc:'Retail favorite' },
  { id:'YOLO', name:'YoloFinance', icon:'t-penny', cat:'penny', fairValue:0.65, div:0, vol:0.055, float:6e7,  desc:'Reddit meme' },
  { id:'DGCN', name:'DogeWow',     icon:'t-penny', cat:'penny', fairValue:0.18, div:0, vol:0.05,  float:1.5e8,desc:'Dog coin' },
  { id:'KEKS', name:'KekStock',    icon:'t-penny', cat:'penny', fairValue:0.04, div:0, vol:0.07,  float:2e8,  desc:'Microcap chaos' },
  { id:'PEPE', name:'PepeMeme',    icon:'t-penny', cat:'penny', fairValue:0.22, div:0, vol:0.06,  float:1e8,  desc:'Frog meme' },
  { id:'FOMO', name:'FomoIndex',   icon:'t-penny', cat:'penny', fairValue:0.85, div:0, vol:0.045, float:4e7,  desc:'Hype tracker' },
  { id:'MEME', name:'MemeCorp',    icon:'t-penny', cat:'penny', fairValue:1.80, div:0, vol:0.04,  float:3e7,  desc:'Meme conglomerate' },

  // ====== TECH (12) ======
  { id:'APPL', name:'Appellon',    icon:'t-blue', cat:'tech', fairValue:180,  div:0.0008, vol:0.012, float:1e9,  desc:'Tech megacap' },
  { id:'MSFT', name:'MicroSoftly', icon:'t-blue', cat:'tech', fairValue:340,  div:0.0009, vol:0.011, float:8e8,  desc:'Cloud giant' },
  { id:'NVDA', name:'NVidGen',     icon:'t-blue', cat:'tech', fairValue:520,  div:0.0005, vol:0.018, float:7e8,  desc:'GPU AI' },
  { id:'GOOG', name:'GoogleNet',   icon:'t-blue', cat:'tech', fairValue:145,  div:0.0006, vol:0.013, float:1.2e9,desc:'Ad search' },
  { id:'META', name:'MetaGram',    icon:'t-blue', cat:'tech', fairValue:480,  div:0.0007, vol:0.014, float:9e8,  desc:'Social' },
  { id:'AMZN', name:'AmazingX',    icon:'t-blue', cat:'tech', fairValue:175,  div:0,      vol:0.013, float:1e9,  desc:'E-commerce cloud' },
  { id:'AMD',  name:'AdvMicro',    icon:'t-blue', cat:'tech', fairValue:130,  div:0.0004, vol:0.017, float:6e8,  desc:'Chips' },
  { id:'INTC', name:'IntelCore',   icon:'t-blue', cat:'tech', fairValue:45,   div:0.0010, vol:0.014, float:4e8,  desc:'Legacy chips' },
  { id:'TSLA', name:'TeslaMega',   icon:'t-blue', cat:'tech', fairValue:250,  div:0,      vol:0.025, float:8e8,  desc:'EV memes' },
  { id:'NFLX', name:'NetFlixin',   icon:'t-blue', cat:'tech', fairValue:480,  div:0,      vol:0.016, float:5e8,  desc:'Streaming' },
  { id:'ORCL', name:'OracleDB',    icon:'t-blue', cat:'tech', fairValue:115,  div:0.0008, vol:0.011, float:7e8,  desc:'Database giant' },
  { id:'CSCO', name:'CiscoSys',    icon:'t-blue', cat:'tech', fairValue:55,   div:0.0011, vol:0.010, float:5e8,  desc:'Networking' },

  // ====== BANKING (8) ======
  { id:'JPMC', name:'JPMorganCh',  icon:'t-blue', cat:'bank', fairValue:155, div:0.0012, vol:0.013, float:6e8,  desc:'Big bank' },
  { id:'GOLM', name:'GoldenSaks',  icon:'t-blue', cat:'bank', fairValue:380, div:0.0010, vol:0.014, float:4e8,  desc:'Investment bank' },
  { id:'MOST', name:'MorganTaylor',icon:'t-blue', cat:'bank', fairValue:95,  div:0.0011, vol:0.012, float:5e8,  desc:'Wealth mgmt' },
  { id:'CHAS', name:'ChaseBros',   icon:'t-blue', cat:'bank', fairValue:60,  div:0.0013, vol:0.011, float:6e8,  desc:'Consumer bank' },
  { id:'WELL', name:'WellsForce',  icon:'t-blue', cat:'bank', fairValue:48,  div:0.0012, vol:0.013, float:5e8,  desc:'Regional bank' },
  { id:'CITI', name:'CitiCorps',   icon:'t-blue', cat:'bank', fairValue:65,  div:0.0011, vol:0.014, float:4e8,  desc:'Global bank' },
  { id:'BOFA', name:'BankOfAme',   icon:'t-blue', cat:'bank', fairValue:38,  div:0.0014, vol:0.012, float:7e8,  desc:'Retail bank' },
  { id:'USBC', name:'USBankcorp',  icon:'t-blue', cat:'bank', fairValue:42,  div:0.0013, vol:0.012, float:5e8,  desc:'Regional' },

  // ====== INDEX (8) ======
  { id:'SP500',name:'S&P Index',   icon:'t-index', cat:'index', fairValue:4500,  div:0.0015, vol:0.005, float:1e10, desc:'Broad market' },
  { id:'QQQ',  name:'NasdaqIdx',   icon:'t-index', cat:'index', fairValue:380,   div:0.0011, vol:0.008, float:5e9,  desc:'Tech index' },
  { id:'DJIA', name:'DowJonesG',   icon:'t-index', cat:'index', fairValue:35000, div:0.0014, vol:0.006, float:1e10, desc:'30 blue chips' },
  { id:'RUSS', name:'RusselTwo',   icon:'t-index', cat:'index', fairValue:2000,  div:0.0010, vol:0.009, float:8e9,  desc:'Small cap idx' },
  { id:'FTSE', name:'FTSE Game',   icon:'t-index', cat:'index', fairValue:7500,  div:0.0016, vol:0.006, float:9e9,  desc:'UK index' },
  { id:'NIK',  name:'NikkeiIdx',   icon:'t-index', cat:'index', fairValue:32000, div:0.0012, vol:0.007, float:8e9,  desc:'Japan idx' },
  { id:'DAX',  name:'DAX Index',   icon:'t-index', cat:'index', fairValue:15000, div:0.0015, vol:0.007, float:7e9,  desc:'Germany' },
  { id:'HKSI', name:'HangKong',    icon:'t-index', cat:'index', fairValue:18000, div:0.0013, vol:0.012, float:6e9,  desc:'HK index' },

  // ====== CRYPTO (15) ======
  { id:'BTC',  name:'BitGameCoin', icon:'t-crypto', cat:'crypto', fairValue:45000, div:0, vol:0.025, float:2e7, desc:'OG crypto' },
  { id:'ETH',  name:'EtherealX',   icon:'t-crypto', cat:'crypto', fairValue:2800,  div:0, vol:0.028, float:1.2e8,desc:'Smart contracts' },
  { id:'BNB',  name:'BinanceX',    icon:'t-crypto', cat:'crypto', fairValue:320,   div:0, vol:0.030, float:1.5e8,desc:'Exchange token' },
  { id:'SOL',  name:'SolanaSky',   icon:'t-crypto', cat:'crypto', fairValue:95,    div:0, vol:0.035, float:4e8,  desc:'L1 chain' },
  { id:'ADA',  name:'CardanoY',    icon:'t-crypto', cat:'crypto', fairValue:0.55,  div:0, vol:0.032, float:3.5e10,desc:'Academic chain' },
  { id:'AVAX', name:'AvalancheZ',  icon:'t-crypto', cat:'crypto', fairValue:28,    div:0, vol:0.034, float:3.5e8,desc:'Subnet chain' },
  { id:'DOT',  name:'PolkadotX',   icon:'t-crypto', cat:'crypto', fairValue:8.50,  div:0, vol:0.033, float:1.2e9,desc:'Multichain' },
  { id:'MATIC',name:'PolygonX',    icon:'t-crypto', cat:'crypto', fairValue:0.85,  div:0, vol:0.036, float:9e9,  desc:'L2 chain' },
  { id:'LINK', name:'ChainLinker', icon:'t-crypto', cat:'crypto', fairValue:14,    div:0, vol:0.030, float:5e8,  desc:'Oracle network' },
  { id:'UNI',  name:'UniChainSw',  icon:'t-crypto', cat:'crypto', fairValue:6.20,  div:0, vol:0.032, float:6e8,  desc:'DEX token' },
  { id:'LTC',  name:'LiteGameCoin',icon:'t-crypto', cat:'crypto', fairValue:75,    div:0, vol:0.028, float:7e7,  desc:'Silver crypto' },
  { id:'XRP',  name:'RippleNet',   icon:'t-crypto', cat:'crypto', fairValue:0.62,  div:0, vol:0.030, float:5e10, desc:'Payments' },
  { id:'ATOM', name:'CosmosIdx',   icon:'t-crypto', cat:'crypto', fairValue:10,    div:0, vol:0.034, float:3e8,  desc:'IBC chain' },
  { id:'NEAR', name:'NearProto',   icon:'t-crypto', cat:'crypto', fairValue:4.20,  div:0, vol:0.036, float:1e9,  desc:'L1 chain' },
  { id:'APT',  name:'AptosNet',    icon:'t-crypto', cat:'crypto', fairValue:8.80,  div:0, vol:0.038, float:5e8,  desc:'Move chain' },

  // ====== FOREX (12) — game-styled fiat units ======
  { id:'GDR',  name:'GameDollar',  icon:'t-forex', cat:'forex', fairValue:1.00,   div:0, vol:0.004, float:1e12, desc:'Reserve currency' },
  { id:'EUC',  name:'EuroCoin',    icon:'t-forex', cat:'forex', fairValue:1.08,   div:0, vol:0.005, float:8e11, desc:'Eurozone' },
  { id:'YST',  name:'YenStone',    icon:'t-forex', cat:'forex', fairValue:0.0067, div:0, vol:0.006, float:5e13, desc:'Japan' },
  { id:'PND',  name:'PoundSter',   icon:'t-forex', cat:'forex', fairValue:1.27,   div:0, vol:0.006, float:5e11, desc:'British' },
  { id:'RPI',  name:'RupeeIdx',    icon:'t-forex', cat:'forex', fairValue:0.012,  div:0, vol:0.005, float:2e13, desc:'India' },
  { id:'RBN',  name:'RubleNet',    icon:'t-forex', cat:'forex', fairValue:0.011,  div:0, vol:0.020, float:8e12, desc:'Russia (vol)' },
  { id:'YCN',  name:'YuanChain',   icon:'t-forex', cat:'forex', fairValue:0.14,   div:0, vol:0.005, float:1.5e13,desc:'China' },
  { id:'ABK',  name:'AusBuck',     icon:'t-forex', cat:'forex', fairValue:0.66,   div:0, vol:0.007, float:8e11, desc:'Australia' },
  { id:'CBK',  name:'CanucksBuck', icon:'t-forex', cat:'forex', fairValue:0.74,   div:0, vol:0.006, float:6e11, desc:'Canada' },
  { id:'SWF',  name:'SwissFranc',  icon:'t-forex', cat:'forex', fairValue:1.12,   div:0, vol:0.005, float:4e11, desc:'Safe haven' },
  { id:'SGD',  name:'SingDollar',  icon:'t-forex', cat:'forex', fairValue:0.74,   div:0, vol:0.005, float:3e11, desc:'Singapore' },
  { id:'BRL',  name:'BrazilReal',  icon:'t-forex', cat:'forex', fairValue:0.20,   div:0, vol:0.015, float:2e12, desc:'Brazil (vol)' },

  // ====== COMMODITIES (10) ======
  { id:'GLD',  name:'GoldNugget',  icon:'t-commodity', cat:'commodity', fairValue:2050, div:0, vol:0.008, float:1e9, desc:'Gold (oz)' },
  { id:'SLV',  name:'SilverShine', icon:'t-commodity', cat:'commodity', fairValue:24,   div:0, vol:0.014, float:5e9, desc:'Silver (oz)' },
  { id:'PLT',  name:'PlatinumZ',   icon:'t-commodity', cat:'commodity', fairValue:950,  div:0, vol:0.012, float:1e8, desc:'Platinum' },
  { id:'OIL',  name:'OilDrop',     icon:'t-commodity', cat:'commodity', fairValue:78,   div:0, vol:0.022, float:1e10,desc:'Crude (bbl)' },
  { id:'GAS',  name:'GasFlame',    icon:'t-commodity', cat:'commodity', fairValue:2.85, div:0, vol:0.035, float:5e10,desc:'Nat gas' },
  { id:'WHT',  name:'WheatField',  icon:'t-commodity', cat:'commodity', fairValue:615,  div:0, vol:0.015, float:1e9, desc:'Wheat (bu)' },
  { id:'CRN',  name:'CornCob',     icon:'t-commodity', cat:'commodity', fairValue:480,  div:0, vol:0.015, float:2e9, desc:'Corn' },
  { id:'COF',  name:'CoffeeBean',  icon:'t-commodity', cat:'commodity', fairValue:175,  div:0, vol:0.025, float:5e8, desc:'Coffee (lb)' },
  { id:'SGR',  name:'SugarRush',   icon:'t-commodity', cat:'commodity', fairValue:22,   div:0, vol:0.020, float:8e9, desc:'Sugar' },
  { id:'COP',  name:'CopperOre',   icon:'t-commodity', cat:'commodity', fairValue:4.20, div:0, vol:0.013, float:3e10,desc:'Copper (lb)' },

  // ====== OPTIONS / DERIVATIVES (8) ======
  { id:'CALL', name:'TSLA Calls',  icon:'t-options', cat:'options', fairValue:25, div:0, vol:0.045, float:1e6, desc:'Leveraged calls' },
  { id:'PUTS', name:'SPY Puts',    icon:'t-options', cat:'options', fairValue:12, div:0, vol:0.05,  float:2e6, desc:'Hedge puts' },
  { id:'LCAL', name:'LongCalls',   icon:'t-options', cat:'options', fairValue:8,  div:0, vol:0.06,  float:1e6, desc:'OTM calls' },
  { id:'SPUT', name:'ShortPuts',   icon:'t-options', cat:'options', fairValue:5,  div:0, vol:0.07,  float:1e6, desc:'Premium seller' },
  { id:'STRD', name:'Straddles',   icon:'t-options', cat:'options', fairValue:18, div:0, vol:0.05,  float:8e5, desc:'Both directions' },
  { id:'STGL', name:'Strangles',   icon:'t-options', cat:'options', fairValue:12, div:0, vol:0.055, float:8e5, desc:'OTM both' },
  { id:'IRNB', name:'IronButter',  icon:'t-options', cat:'options', fairValue:22, div:0, vol:0.04,  float:5e5, desc:'4-leg spread' },
  { id:'CRSD', name:'CredSpread',  icon:'t-options', cat:'options', fairValue:14, div:0, vol:0.04,  float:6e5, desc:'Credit spread' },

  // ====== HEDGE / IB (5) ======
  { id:'HEDG', name:'Citadel-X',   icon:'t-hedge', cat:'hedge', fairValue:500,   div:0.002, vol:0.018, float:2e7, desc:'Multi-strat hedge' },
  { id:'TIGR', name:'Tiger-X',     icon:'t-hedge', cat:'hedge', fairValue:380,   div:0.0018,vol:0.020, float:1.5e7,desc:'Tiger cub' },
  { id:'PRSH', name:'Pershing-Y',  icon:'t-hedge', cat:'hedge', fairValue:420,   div:0.0019,vol:0.019, float:1.5e7,desc:'Activist' },
  { id:'IPO',  name:'IPO Pipeline',icon:'t-ib',    cat:'hedge', fairValue:8000,  div:0.0015,vol:0.025, float:5e5,  desc:'IPO desk' },
  { id:'MMKR', name:'MarketMaker', icon:'t-mm',    cat:'hedge', fairValue:50000, div:0.003, vol:0.008, float:1e5,  desc:'MM equity' },

  // ====== BONDS / MACRO (10) ======
  { id:'FED',  name:'FedRate Bond',icon:'t-bond', cat:'bond', fairValue:1e6, div:0.004, vol:0.004, float:1e3, desc:'Macro instrument' },
  { id:'GTB',  name:'GovTBill',    icon:'t-bond', cat:'bond', fairValue:100, div:0.005, vol:0.002, float:1e10,desc:'T-Bill' },
  { id:'MUNI', name:'MunicipalB',  icon:'t-bond', cat:'bond', fairValue:105, div:0.004, vol:0.003, float:5e9, desc:'Tax-free muni' },
  { id:'JNKB', name:'JunkBondX',   icon:'t-bond', cat:'bond', fairValue:85,  div:0.008, vol:0.008, float:2e9, desc:'High-yield' },
  { id:'TIPS', name:'InflProtect', icon:'t-bond', cat:'bond', fairValue:100, div:0.004, vol:0.003, float:3e9, desc:'TIPS' },
  { id:'EMG',  name:'EmergingMkt', icon:'t-bond', cat:'bond', fairValue:65,  div:0.006, vol:0.012, float:2e9, desc:'EM debt' },
  { id:'CORP', name:'CorpInvest',  icon:'t-bond', cat:'bond', fairValue:110, div:0.005, vol:0.004, float:4e9, desc:'IG corp' },
  { id:'INTL', name:'IntlBondY',   icon:'t-bond', cat:'bond', fairValue:95,  div:0.004, vol:0.005, float:2e9, desc:'Intl debt' },
  { id:'HYLD', name:'HighYield',   icon:'t-bond', cat:'bond', fairValue:75,  div:0.009, vol:0.010, float:1.5e9,desc:'High-yield ETF' },
  { id:'SHRT', name:'ShortBnd',    icon:'t-bond', cat:'bond', fairValue:99,  div:0.003, vol:0.002, float:5e9, desc:'Short-duration' },
]);
void _legacy_ref;
/* eslint-enable */

// Category labels for UI grouping
export const CATEGORY_LABELS: Record<string, string> = {
  // legacy (kept for backward-compat references)
  penny: '🪙 Penny', index: '📊 Index', commodity: '🌾 Commodity',
  options: '🎲 Options', hedge: '🦾 Hedge', bond: '📜 Bonds',
  // v5 — stocks subcategories
  tech: '💻 Technology', bank: '🏦 Banking & Finance', energy: '⚡ Energy',
  health: '🧬 Healthcare', consumer: '🛒 Consumer & Retail', gaming: '🎮 Gaming & Media',
  // v5 — crypto subcategories
  crypto: '⚡ Crypto',
  crypto_large: '💎 Large Cap', crypto_mid: '🪙 Mid Cap', crypto_meme: '🚀 Meme Coins',
  // v5 — forex subcategories
  forex: '💱 Forex',
  forex_major: '💵 USD Pairs', forex_cross: '🔁 Cross Pairs',
};
export const CATEGORY_ORDER: string[] = [
  // stocks first
  'tech','bank','energy','health','consumer','gaming',
  // crypto
  'crypto_large','crypto_mid','crypto_meme',
  // forex
  'forex_major','forex_cross',
  // legacy
  'penny','index','crypto','forex','commodity','options','hedge','bond',
];

// v5: Market grouping for UI tabs.
export const MARKET_LABELS = { stocks: '📈 Stocks', crypto: '⚡ Crypto', forex: '💱 Forex' } as const;
export const MARKET_ORDER: Market[] = ['stocks', 'crypto', 'forex'];

// v7.1: O(1) asset lookup. Built once after ASSETS defined.
export const ASSET_BY_ID: Record<string, AssetDef> = (() => {
  const m: Record<string, AssetDef> = {};
  for (const a of ASSETS) m[a.id] = a;
  return m;
})();

export const NEWS_EVENTS: NewsEventDef[] = [
  // ===== ORIGINAL 12 (preserved, tagged with cat) =====
  { type:'boom',  title:'FED CUTS RATES',        desc:'Dovish Fed rallies markets',           weight:.6,  fvDelta:0.08,  vol:1.5, dur:30, cat:'macro' },
  { type:'boom',  title:'EARNINGS BEAT',         desc:'Blowout quarter',                      weight:.6,  fvDelta:0.06,  vol:1.3, dur:25, cat:'earnings' },
  { type:'boom',  title:'TRADE DEAL',            desc:'Global tensions ease',                 weight:.4,  fvDelta:0.05,  vol:1.2, dur:20, cat:'economy' },
  { type:'boom',  title:'AI BREAKTHROUGH',       desc:'Tech euphoria',                        weight:.5,  fvDelta:0.12,  vol:1.8, dur:35, sectorFilter:['tech'], cat:'product' },
  { type:'crash', title:'FLASH CRASH',           desc:'Algos panic-sell',                     weight:.5,  fvDelta:-0.10, vol:2.5, dur:20, cat:'sentiment' },
  { type:'crash', title:'RECESSION FEARS',       desc:'Yield curve inverts',                  weight:.4,  fvDelta:-0.07, vol:1.8, dur:30, cat:'economy' },
  { type:'crash', title:'GEOPOLITICAL SHOCK',    desc:'War headlines',                        weight:.3,  fvDelta:-0.09, vol:2.0, dur:25, cat:'macro' },
  { type:'crash', title:'BUBBLE POPS',           desc:'Speculative froth wipes out',          weight:.25, fvDelta:-0.18, vol:3.0, dur:40, sectorFilter:['crypto_meme'], cat:'sentiment' },
  { type:'news',  title:'ANALYST UPGRADE',       desc:'Buy coverage initiated',               weight:.8,  fvDelta:0.03,  vol:1.1, dur:15, cat:'analyst' },
  { type:'news',  title:'INSIDER SELLING',       desc:'Execs dump shares',                    weight:.5,  fvDelta:-0.03, vol:1.2, dur:15, cat:'other' },
  { type:'news',  title:'CEO STEPS DOWN',        desc:'Leadership shake-up',                  weight:.4,  fvDelta:-0.04, vol:1.3, dur:18, cat:'other' },
  { type:'news',  title:'DIVIDEND HIKE',         desc:'Boards raise payouts',                 weight:.6,  fvDelta:0.04,  vol:1.0, dur:60, cat:'earnings' },

  // ===== NEW: EARNINGS =====
  { type:'crash', title:'EARNINGS MISS',         desc:'Quarterly numbers disappoint',         weight:.55, fvDelta:-0.06, vol:1.4, dur:25, cat:'earnings' },
  { type:'boom',  title:'GUIDANCE RAISED',       desc:'Forward outlook upgraded',             weight:.45, fvDelta:0.05,  vol:1.2, dur:30, cat:'earnings' },
  { type:'crash', title:'GUIDANCE CUT',          desc:'Q-ahead outlook slashed',              weight:.45, fvDelta:-0.05, vol:1.4, dur:25, cat:'earnings' },

  // ===== NEW: ANALYST =====
  { type:'crash', title:'ANALYST DOWNGRADE',     desc:'Sell rating issued',                   weight:.7,  fvDelta:-0.03, vol:1.2, dur:15, cat:'analyst' },
  { type:'news',  title:'PRICE TARGET RAISED',   desc:'Street raises PT consensus',           weight:.5,  fvDelta:0.025, vol:1.0, dur:20, cat:'analyst' },

  // ===== NEW: INDUSTRY (sector-targeted) =====
  { type:'boom',  title:'TECH SECTOR BOOM',      desc:'Software & chips lead rally',          weight:.4,  fvDelta:0.07,  vol:1.4, dur:30, sectorFilter:['tech'], cat:'industry' },
  { type:'crash', title:'TECH SELLOFF',          desc:'Growth-stock rotation out',            weight:.35, fvDelta:-0.06, vol:1.5, dur:25, sectorFilter:['tech'], cat:'industry' },
  { type:'boom',  title:'BANK PROFITS SURGE',    desc:'Net interest margin expands',          weight:.35, fvDelta:0.05,  vol:1.2, dur:25, sectorFilter:['bank'], cat:'industry' },
  { type:'crash', title:'BANK CRISIS',           desc:'Regional banks under stress',          weight:.25, fvDelta:-0.09, vol:2.0, dur:30, sectorFilter:['bank'], cat:'industry' },
  { type:'boom',  title:'CRYPTO RALLY',          desc:'Risk-on sweeps digital assets',        weight:.5,  fvDelta:0.10,  vol:2.0, dur:30, sectorFilter:['crypto_large','crypto_mid','crypto_meme'], cat:'industry' },
  { type:'crash', title:'CRYPTO WINTER',         desc:'Liquidations cascade',                 weight:.4,  fvDelta:-0.12, vol:2.5, dur:35, sectorFilter:['crypto_large','crypto_mid','crypto_meme'], cat:'industry' },
  { type:'boom',  title:'ENERGY SECTOR SPIKE',   desc:'Supply tightness lifts energy assets', weight:.35, fvDelta:0.06,  vol:1.5, dur:30, sectorFilter:['energy'], cat:'industry' },
  { type:'crash', title:'OIL GLUT',              desc:'Inventories overflow, energy weak',    weight:.3,  fvDelta:-0.08, vol:1.6, dur:25, sectorFilter:['energy'], cat:'industry' },

  // ===== NEW: ECONOMY =====
  { type:'boom',  title:'GDP EXPANSION',         desc:'Growth surprises to the upside',       weight:.4,  fvDelta:0.05,  vol:1.1, dur:35, cat:'economy' },
  { type:'crash', title:'CONSUMER WEAKNESS',     desc:'Retail spending contracts',            weight:.35, fvDelta:-0.05, vol:1.3, dur:30, cat:'economy' },
  { type:'boom',  title:'JOBS BLOWOUT',          desc:'NFP smashes expectations',             weight:.4,  fvDelta:0.04,  vol:1.2, dur:25, cat:'economy' },

  // ===== NEW: REGULATORY =====
  { type:'crash', title:'REGULATORY CRACKDOWN',  desc:'Sweeping rules announced',             weight:.3,  fvDelta:-0.07, vol:1.6, dur:30, sectorFilter:['tech','crypto'], cat:'regulatory' },
  { type:'boom',  title:'DEREGULATION WIN',      desc:'Rules eased, capital flows',           weight:.3,  fvDelta:0.05,  vol:1.2, dur:25, sectorFilter:['bank','tech'], cat:'regulatory' },
  { type:'crash', title:'ANTITRUST PROBE',       desc:'DOJ targets big-tech monopolies',      weight:.25, fvDelta:-0.06, vol:1.4, dur:28, sectorFilter:['tech'], cat:'regulatory' },

  // ===== NEW: PRODUCT =====
  { type:'boom',  title:'PRODUCT LAUNCH HIT',    desc:'New release smashes pre-orders',       weight:.45, fvDelta:0.06,  vol:1.3, dur:25, sectorFilter:['tech'], cat:'product' },
  { type:'crash', title:'PRODUCT RECALL',        desc:'Mass recall hits revenue',             weight:.3,  fvDelta:-0.06, vol:1.4, dur:25, cat:'product' },

  // ===== NEW: SUPPLY CHAIN =====
  { type:'crash', title:'SUPPLY DISRUPTION',     desc:'Shipping chokepoint snarls deliveries',weight:.35, fvDelta:-0.05, vol:1.5, dur:30, sectorFilter:['tech','energy','consumer'], cat:'supply' },
  { type:'boom',  title:'SUPPLY EASES',          desc:'Bottlenecks clear, costs drop',        weight:.3,  fvDelta:0.04,  vol:1.1, dur:25, cat:'supply' },

  // ===== NEW: SENTIMENT (market-wide) =====
  { type:'boom',  title:'RISK-ON SENTIMENT',     desc:'Animal spirits return',                weight:.4,  fvDelta:0.04,  vol:1.3, dur:30, cat:'sentiment' },
  { type:'crash', title:'RISK-OFF FEAR',         desc:'Investors flee to safety',             weight:.4,  fvDelta:-0.05, vol:1.5, dur:30, cat:'sentiment' },

  // ===== v5: CROSS-MARKET EVENTS — affect multiple markets at once =====
  { type:'boom',  title:'TECH-CRYPTO RALLY',     desc:'Tech stocks + crypto move in lockstep',weight:.35, fvDelta:0.07,  vol:1.6, dur:30, sectorFilter:['tech','crypto_large','crypto_mid'], cat:'sentiment' },
  { type:'crash', title:'TECH-CRYPTO ROUT',      desc:'Risk assets crater together',          weight:.30, fvDelta:-0.08, vol:1.8, dur:30, sectorFilter:['tech','crypto_large','crypto_mid','crypto_meme'], cat:'sentiment' },
  { type:'boom',  title:'BANK + FOREX STRENGTH', desc:'Currency strength supports financials',weight:.25, fvDelta:0.05,  vol:1.3, dur:25, sectorFilter:['bank','forex_major'], cat:'macro' },
  { type:'crash', title:'BANKING + FX STRESS',   desc:'Credit squeeze hits banks + currencies',weight:.20,fvDelta:-0.07, vol:1.8, dur:30, sectorFilter:['bank','forex_major','forex_cross'], cat:'macro' },
  { type:'crash', title:'ENERGY CRISIS',         desc:'Crude shock ripples to fx + utilities',weight:.25, fvDelta:-0.08, vol:1.8, dur:35, sectorFilter:['energy','forex_cross'], cat:'macro' },
  { type:'boom',  title:'GLOBAL RECOVERY',       desc:'Every market lifts',                   weight:.20, fvDelta:0.06,  vol:1.4, dur:40, cat:'macro' },
  { type:'crash', title:'GLOBAL ROUT',           desc:'All markets sell off',                 weight:.15, fvDelta:-0.08, vol:2.0, dur:35, cat:'macro' },
];

export const STRATEGIES: StrategyId[] = [
  'yolo','diamond','paper','permabull','permabear','lazy','newschase',
  'fomo','conservative','gambler','value','trend','mm','copycat','revenge',
];

export const STRATEGY_MIX: Record<string, number> = {
  yolo:60, diamond:40, paper:50, permabull:50, permabear:30,
  lazy:50, newschase:30, fomo:60, conservative:40, gambler:40,
  value:20, trend:15, mm:10, copycat:25, revenge:30,
};

export const STRATEGY_LABELS: Record<string, string> = {
  yolo:'YOLO', diamond:'Diamond', paper:'Paper', permabull:'PermaBull', permabear:'PermaBear',
  lazy:'Lazy HODL', newschase:'NewsChase', fomo:'FOMO', conservative:'Cons.', gambler:'Gambler',
  value:'Value', trend:'Trend', mm:'MM', copycat:'Copycat', revenge:'Revenge',
};

export const TRANSITIONS: Record<string, { win: StrategyId | null; loss: StrategyId | null; grind: StrategyId | null }> = {
  yolo:        { win:'gambler',   loss:'paper',        grind:'revenge' },
  diamond:     { win:'lazy',      loss:'paper',        grind:null },
  paper:       { win:'fomo',      loss:'lazy',         grind:'conservative' },
  permabull:   { win:'diamond',   loss:'permabear',    grind:'paper' },
  permabear:   { win:'gambler',   loss:'permabull',    grind:'fomo' },
  lazy:        { win:'value',     loss:'paper',        grind:null },
  newschase:   { win:'fomo',      loss:'lazy',         grind:'conservative' },
  fomo:        { win:'permabull', loss:'paper',        grind:'revenge' },
  conservative:{ win:'value',     loss:'lazy',         grind:null },
  gambler:     { win:'yolo',      loss:'conservative', grind:'revenge' },
  value:       { win:'lazy',      loss:'revenge',      grind:'trend' },
  trend:       { win:'value',     loss:'paper',        grind:null },
  mm:          { win:null,        loss:'conservative', grind:null },
  copycat:     { win:'fomo',      loss:'paper',        grind:'lazy' },
  revenge:     { win:'gambler',   loss:'paper',        grind:'lazy' },
};

export const BOT_NAMES = [
  'Quant Capital','Alpha Traders','BlueChip LLC','Tiger Global','Pershing Sq','Renaissance',
  'Two Sigma','Citadel Partners','Apollo Inv','Carlyle Bros','Bridgewater','Vanguard Pro',
  'Soros Fund','Cohen Mgmt','Icahn Ent','Ackman Cap','Burry Sci','Buffett Co',
  'Big Short LLC','WSB Diamond','Cathie ARK','Goldman Sax','Morgan St','Jane St',
  'DRW Trading','Optiver NV','SIG Tech','Susquehanna','Virtu Fin','Citadel Sec',
  'Joe6Pack','RetailKing','OptionsBro','HODL_GANG','MomentumDad','ValueGuy42',
  'ScalperBot','PanicSeller','WhaleWatcher','DiamondHand','PaperHand','MoonMission',
  'BearTrap99','BullRun_X','CryptoWolf','OldMoney','NewMoney','SmartBeta',
  'IndexFund','PassiveDan','TrendKing','ContraGuru','Arbitrageur','MeanRevert',
  'GammaSlayer','VolHunter','LiquidityCo','MicroCap Ltd','MacroDude','Riskoff Inc',
  'BondVigilante','EquityElite','GrowthGuy','DipBuyer42','TopCaller','BottomFisher',
  'TrendBreaker','PatternHunt','FibTrader','EllioTT_Wv','RSI_King','MACDmaster',
  'BollingerB','VWAP_Bot','TWAP_Algo','DarkPool','HighFreq','LowLatency',
  'Tape Reader','PrintReader','OrderFlow','LiquidLogic','SpreadHunter','GapTrader',
  'SwingShot','PositionTrader','DayTrader_X','SwingKing','EarnPlay','NewsTrader',
  'EventDriven','MergeArb','LongShortEq','MarketNeutral','GlobalMacro','EmergingMkt',
  'CommodityCo','ForexBot','RatesGuy','CreditAnalyst','EquityResearch','FundManager',
  'PrivateEq','VentureSeed','AngelInvestor','RetailHero',
];

export const NAME_FIRST = [
  'Alpha','Beta','Quant','Bull','Bear','Iron','Steel','Silver','Golden','Crypto','Wall','Main',
  'Vega','Theta','Delta','Gamma','Sigma','Omega','Tau','Phi','Rho','Tiger','Eagle','Wolf','Lion',
  'Hawk','Fox','Shark','Whale','Cobra','Dragon','Phoenix','Storm','Thunder','Apex','Prime','Elite',
  'Bravo','Echo','Hyperion','Titan','Atlas','Hermes','Apollo','Zeus','Odin','Thor','Loki','Vortex',
  'Pulse','Wave','Edge','Peak','Summit','Crown','Royal','Imperial','Stellar','Cosmic','Nebula',
  'Galaxy','Nova','Quasar','Helix','Matrix','Vector','Logic','Cypher','Mega','Ultra','Hyper',
  'Power','Force','Equity','Brigade','Strike','Velocity','Momentum','Inertia','Tempo','Flux',
  'Stack','Loop','Spike','Trend','Pivot','Arc','Onyx','Obsidian','Ruby','Jade','Pearl','Sapphire',
  'Granite','Cobalt','Indigo','Crimson','Azure','Verdant','Amber','Hazel','Slate','Maverick',
  'Pioneer','Sentinel','Guardian','Watcher','Scout','Hunter','Prophet','Oracle','Sage','Mystic',
  'Rebel','Outlaw','Bandit','Saint','Knight','Baron','Duke','Lord','Phantom','Ghost','Shadow',
  'Specter','Mirage',
];

export const NAME_LAST = [
  'Capital','Partners','Trading','Holdings','Group','Ventures','Fund','LLC','Inc','Co','Bros',
  'Brothers','Wealth','Asset Mgmt','Advisors','Research','Securities','Bank','Exchange','Strategies',
  'Investments','Alpha','Beta','Quant','Algo','Bot','Edge','Pro','Plus','Prime','Elite','Hub',
  'Lab','Tech','AI','Equity','&Co','Trust','Sons','Allies','Network','Systems','Solutions',
  'Dynamics','Logic','Capital Mgmt','Global','Worldwide','International','National','Regional','Local',
];
