import type { CandlestickAnalysis, CandlestickPatternMatch } from '../engine/candlestickPatterns';
import type { PairAnalysis } from '../engine/multiPairScanner';

export interface Candle {
  time: number; // Unix timestamp in seconds or ms
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Swing {
  idx: number;
  price: number;
  kind: 'H' | 'L';
  time?: number;
}

export interface StructureEvent {
  kind: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  price: number;
  bar: number;
  time?: number;
}

export interface Zone {
  kind: 'FVG' | 'OB';
  top: number;
  bottom: number;
  bullish: boolean;
  born: number; // bar index where formed
  bornTime?: number;
  filled: boolean;
  tests: number;
}

export interface DealingRange {
  low: number;
  high: number;
  equilibrium: number;
}

export interface SessionItem {
  id: 'london' | 'new_york' | 'asian' | 'sydney';
  name: string;
  active: boolean;
  hours: string;
}

export interface SessionInfo {
  london: boolean;
  new_york: boolean;
  asian: boolean;
  sydney: boolean;
  tradable: boolean;
  currentUtcTime: string;
  currentEatTime?: string; // East Africa Time (UTC+3)
  activeSessionName: string;
  londonOpenWindow?: boolean; // 07:00 – 10:00 UTC / 10:00 – 13:00 EAT
  newYorkSilverBullet?: boolean; // 13:00 – 16:00 UTC / 16:00 – 19:00 EAT
  asianConsolidation?: boolean; // 21:00 – 05:00 UTC / 00:00 – 08:00 EAT (suppressed)
  isHighVolumeWindow?: boolean; // true during London Open or NY Silver Bullet
  sessions: SessionItem[];
}

export interface LiquiditySweepInfo {
  hasSweep: boolean;
  type?: 'ASIAN_HIGH_SWEEP' | 'ASIAN_LOW_SWEEP' | 'SWING_HIGH_SFP' | 'SWING_LOW_SFP';
  sweptPrice?: number;
  rejectionConfirmed?: boolean;
  description?: string;
}

export interface TriggerPattern {
  name: string;
  bias: 'bullish' | 'bearish';
  timeframe: string;
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  wickRatio: string;
  explanation: string;
}

export type TradeDirection = 'BUY' | 'SELL';
export type InstrumentType = 'standard' | 'synthetic';

export interface HumanSignalExplanation {
  headline: string;
  simpleSummary: string;
  marketCondition: string;
  tradeRationale: string;
  howToTrade: string;
  riskRewardSummary: string;
}

export interface Signal {
  strategy?: 'SMC POI Retest' | 'Trend Pullback' | 'Volatility Breakout';
  direction: TradeDirection;
  timeframe: 'M1' | 'M5' | 'M15';
  score: number;
  entry: number;
  sl: number;
  tp: number;
  reasons: string[];
  atr: number;
  timestamp: string;
  actionReason?: string;
  perfectEntryReason?: string;
  triggerPattern?: TriggerPattern;
  candlestickPattern?: CandlestickPatternMatch;
  humanExplanation?: HumanSignalExplanation;
  liquiditySweep?: LiquiditySweepInfo;
  isOutOfSessionException?: boolean;
}

export interface Position {
  ticket: number;
  symbol?: string;
  time: string;
  type: TradeDirection;
  volume: number; // lots
  initialVolume?: number;
  price_open: number;
  sl: number;
  initialSl?: number;
  tp: number;
  initialTp?: number;
  profit: number;
  pips: number;
  magic: number;
  comment: string;
  beLocked?: boolean;
  trailLocked?: boolean;
  partialTaken?: boolean; // 50% scale-out executed at 1.5R
  partialProfitLocked?: number;
  trailedOrderBlockId?: string; // ID of OB currently anchoring trailed SL
  strategyRationale?: string;
  strategyOrderBlock?: Zone;
}

export interface PendingOrder {
  ticket: number;
  symbol: string;
  type: 'BUY_LIMIT' | 'SELL_LIMIT';
  direction: TradeDirection;
  volume: number;
  entry: number;
  sl: number;
  tp: number;
  score: number;
  strategy: string;
  timeframe?: string;
  createdTime: number; // timestamp ms
  ttlSeconds: number; // total hold duration in seconds
  expiresAt: number; // timestamp ms
  remainingSeconds: number;
  maxDriftPips: number;
  currentDriftPips: number;
  status: 'PENDING' | 'TRIGGERED' | 'CANCELLED';
  strategyRationale?: string;
  strategyOrderBlock?: Zone;
}

export interface ClosedTrade {
  ticket: number;
  symbol?: string;
  orderTicket?: number;
  positionTicket?: number;
  openTime?: string;
  closeTime?: string;
  closedAt?: string;
  type: TradeDirection;
  volume: number;
  openPrice: number;
  closePrice: number;
  sl?: number;
  tp?: number;
  profit: number;
  pips: number;
  reason: 'TP' | 'SL' | 'Manual' | 'KillSwitch' | 'PARTIAL_TP';
  comment?: string;
  strategyRationale?: string;
  strategyOrderBlock?: Zone;
}

export interface EngineLog {
  id: string;
  t: string;
  msg: string;
  type?: 'info' | 'trade' | 'warn' | 'error' | 'signal';
}

export interface EconomicEvent {
  id: string;
  time: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY';
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
  minutesRemaining: number;
}

export interface MultiTimeframeAlignment {
  tf: 'M1' | 'M5' | 'M15' | 'H1' | 'H4';
  bias: 'bullish' | 'bearish' | 'ranging';
  lastEvent: 'BOS' | 'CHoCH' | 'SWING';
  status: string;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  expectedOutcome: string;
  expectedSignal: TradeDirection;
  expectedWinRate: string;
}

// ==========================================
// DECOUPLED SLICE INTERFACES (Priority 1 & 4)
// ==========================================

export interface TickerState {
  time: string;
  symbol: string;
  displayName?: string;
  brokerTimeStr?: string;
  kenyaTimeStr?: string;
  bid: number;
  ask: number;
  spread: number;
  equity: number;
  balance: number;
  high24h: number;
  low24h: number;
  change24h: number;
  change24hPct: number;
  volume24h: string;
}

export type ChartTimeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4';

export interface TimeframeIndicatorData {
  timeframe: ChartTimeframe;
  zones: Zone[];
  dealing_range: DealingRange | null;
  bias: 'bullish' | 'bearish' | 'ranging';
  bos: StructureEvent | null;
  choch: StructureEvent | null;
  price_pos: number | null;
  atr: number;
}

export interface MarketState {
  activeSymbol?: string;
  bias: 'bullish' | 'bearish' | 'ranging';
  bos: StructureEvent | null;
  choch: StructureEvent | null;
  dealing_range: DealingRange | null;
  price_pos: number | null; // 0 to 1
  signal: Signal | null;
  signals: Signal[];
  instrumentType: InstrumentType;
  zones: Zone[];
  history: number[];
  brokerMarketData: boolean;
  accountMode: 'demo' | 'live' | 'contest' | 'unknown' | null;
  symbolSpec: SymbolTradingSpec | null;
  currentTimeframe: ChartTimeframe;
  candlesM1: Candle[];
  candlesM5: Candle[];
  candlesM15: Candle[];
  candlesH1: Candle[];
  candlesH4?: Candle[];
  timeframeData?: Record<ChartTimeframe, TimeframeIndicatorData>;
  mtfAlignment: MultiTimeframeAlignment[];
  candlestickAnalysis?: CandlestickAnalysis;
  scannerAnalyses?: PairAnalysis[];
  bestOpportunity?: PairAnalysis | null;
}

export interface SymbolTradingSpec {
  point: number;
  tickSize: number;
  tickValue: number;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  tradeStopsLevel: number;
  tradeFreezeLevel: number;
}

export interface PositionsState {
  positions: Position[];
  closedTrades: ClosedTrade[];
  pendingOrders?: PendingOrder[];
  selectedTicket?: number | null;
}

export interface CompoundingStageInfo {
  stage: number;
  name: string;
  minBal: number;
  maxBal: number;
  progressPct: number;
  recommendedLot: number;
  maxTrades: number;
  targetPnlPerTrade: string;
  nextMilestone: string;
}

import { MarketScheduleStatus } from '../engine/marketHours';

export interface EngineState {
  kill_switch: boolean;
  auto_trade: boolean;
  auto_be_enabled: boolean;
  news_blackout: boolean;
  session: SessionInfo;
  connected: boolean;
  max_spread_points: number;
  daily_loss_pct: number;
  daily_drawdown_pct: number;
  compoundingStage: CompoundingStageInfo;
  marketSchedule?: MarketScheduleStatus;
  mt5Account?: {
    connected: boolean;
    login: string;
    server: string;
    broker: string;
    balance: number;
    equity: number;
    freeMargin: number;
  };
  allowHighConfluenceOverride?: boolean;
  autoSelectBestScenario?: boolean;
  tradingViewSynced?: boolean;
  tradingViewLastSync?: number;
}

export interface EventsState {
  log: EngineLog[];
  economicEvents: EconomicEvent[];
}

export interface AccountRiskConfig {
  balance: number;
  equity: number;
  margin_free: number;
  margin_used: number;
  initial_balance: number;
  daily_start_balance: number;
  max_daily_loss_pct: number;
  risk_pct: number;
  auto_rr: number;
  daily_drawdown_pct: number;
  daily_loss_hit: boolean;
  allowHighConfluenceOverride?: boolean;
  autoSelectBestScenario?: boolean;
}

export type AccountState = AccountRiskConfig;

// Composition of all slices for backwards compatibility
export interface TerminalSnapshot extends TickerState, MarketState, EngineState {
  margin_free: number;
  positions: Position[];
  log: EngineLog[];
  economicEvents: EconomicEvent[];
}

export type StoreChannel = 'ticker' | 'market' | 'positions' | 'engine' | 'events' | 'scanner';
