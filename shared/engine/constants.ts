import type { AssetDef, NewsEventDef, StrategyId } from './types';

export const BOT_COUNT = 500;
export const CANDLE_MS = 2000;
export const SAVE_KEY = 'marketMogul_v3';

export const ASSETS: AssetDef[] = [
  { id:'PUMP', name:'PumpCoin',     icon:'t-penny',   fairValue:0.50,   div:0,       vol:0.04,  float:5e7,  desc:'Meme penny stock' },
  { id:'SHIB', name:'ShibInu',      icon:'t-penny',   fairValue:0.12,   div:0,       vol:0.05,  float:1e8,  desc:'Microcap' },
  { id:'JUNK', name:'JunkBio',      icon:'t-penny',   fairValue:2.40,   div:0,       vol:0.035, float:2e7,  desc:'Biotech speculation' },
  { id:'APPL', name:'Appellon',     icon:'t-blue',    fairValue:180,    div:0.0008,  vol:0.012, float:1e9,  desc:'Tech megacap' },
  { id:'MSFT', name:'MicroSoftly',  icon:'t-blue',    fairValue:340,    div:0.0009,  vol:0.011, float:8e8,  desc:'Cloud giant' },
  { id:'JPMC', name:'JPMorganCh',   icon:'t-blue',    fairValue:155,    div:0.0012,  vol:0.013, float:6e8,  desc:'Big bank' },
  { id:'SP500',name:'S&P Index',    icon:'t-index',   fairValue:4500,   div:0.0015,  vol:0.005, float:1e10, desc:'Broad index' },
  { id:'QQQ',  name:'NasdaqIdx',    icon:'t-index',   fairValue:380,    div:0.0011,  vol:0.008, float:5e9,  desc:'Tech index' },
  { id:'CALL', name:'TSLA Calls',   icon:'t-options', fairValue:25,     div:0,       vol:0.04,  float:1e6,  desc:'Leveraged calls' },
  { id:'PUTS', name:'SPY Puts',     icon:'t-options', fairValue:12,     div:0,       vol:0.045, float:2e6,  desc:'Hedge puts' },
  { id:'HEDG', name:'Citadel-X',    icon:'t-hedge',   fairValue:500,    div:0.002,   vol:0.018, float:2e7,  desc:'Hedge fund' },
  { id:'IPO',  name:'IPO Pipeline', icon:'t-ib',      fairValue:8000,   div:0.0015,  vol:0.025, float:5e5,  desc:'IPO desk' },
  { id:'MMKR', name:'MarketMaker',  icon:'t-mm',      fairValue:50000,  div:0.003,   vol:0.008, float:1e5,  desc:'MM equity' },
  { id:'FED',  name:'FedRate Bond', icon:'t-fed',     fairValue:1e6,    div:0.004,   vol:0.004, float:1e3,  desc:'Macro instrument' },
];

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
