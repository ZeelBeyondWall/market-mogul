import type { AssetDef, NewsEventDef, StrategyId } from './types';

export const BOT_COUNT = 2000;
export const CANDLE_MS = 2000;
export const SAVE_KEY = 'marketMogul_v3';

export const ASSETS: AssetDef[] = [
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
];

// Category labels for UI grouping
export const CATEGORY_LABELS: Record<string, string> = {
  penny: '🪙 Penny', tech: '💻 Tech', bank: '🏦 Banking', index: '📊 Index',
  crypto: '⚡ Crypto', forex: '💱 Forex', commodity: '🌾 Commodity',
  options: '🎲 Options', hedge: '🦾 Hedge/IB', bond: '📜 Bonds',
};
export const CATEGORY_ORDER: string[] = ['penny','tech','bank','index','crypto','forex','commodity','options','hedge','bond'];

export const NEWS_EVENTS: NewsEventDef[] = [
  { type:'boom',  title:'FED CUTS RATES',     desc:'Dovish Fed rallies markets',  weight:.6, fvDelta:0.08,  vol:1.5, dur:30 },
  { type:'boom',  title:'EARNINGS BEAT',      desc:'Blowout quarter',             weight:.6, fvDelta:0.06,  vol:1.3, dur:25 },
  { type:'boom',  title:'TRADE DEAL',         desc:'Global tensions ease',        weight:.4, fvDelta:0.05,  vol:1.2, dur:20 },
  { type:'boom',  title:'AI BREAKTHROUGH',    desc:'Tech euphoria',               weight:.5, fvDelta:0.12,  vol:1.8, dur:35, filter:['APPL','MSFT','QQQ'] },
  { type:'crash', title:'FLASH CRASH',        desc:'Algos panic-sell',            weight:.5, fvDelta:-0.10, vol:2.5, dur:20 },
  { type:'crash', title:'RECESSION FEARS',    desc:'Yield curve inverts',         weight:.4, fvDelta:-0.07, vol:1.8, dur:30 },
  { type:'crash', title:'GEOPOLITICAL SHOCK', desc:'War headlines',               weight:.3, fvDelta:-0.09, vol:2.0, dur:25 },
  { type:'crash', title:'BUBBLE POPS',        desc:'Speculative froth wipes out', weight:.25,fvDelta:-0.18, vol:3.0, dur:40, filter:['PUMP','SHIB','JUNK','CALL'] },
  { type:'news',  title:'ANALYST UPGRADE',    desc:'Buy coverage initiated',      weight:.8, fvDelta:0.03,  vol:1.1, dur:15 },
  { type:'news',  title:'INSIDER SELLING',    desc:'Execs dump shares',           weight:.5, fvDelta:-0.03, vol:1.2, dur:15 },
  { type:'news',  title:'CEO STEPS DOWN',     desc:'Leadership shake-up',         weight:.4, fvDelta:-0.04, vol:1.3, dur:18 },
  { type:'news',  title:'DIVIDEND HIKE',      desc:'Boards raise payouts',        weight:.6, fvDelta:0.04,  vol:1.0, dur:60 },
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
