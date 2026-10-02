import type { CandlestickAnalysis, CandlestickPatternMatch } from '../engine/candlestickPatterns';

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
  activeSessionName: string;
  sessions: SessionItem[];
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

export interface HumanSignalExplanation {
  headline: string;
  simpleSummary: string;
  marketCondition: string;
  tradeRationale: string;
  howToTrade: string;
  riskRewardSummary: string;
}

export interface Signal {
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
}

export interface Position {
  ticket: number;
  time: string;
  type: TradeDirection;
  volume: number; // lots
  price_open: number;
  sl: number;
  tp: number;
  profit: number;
  pips: number;
  magic: number;
  comment: string;
}

export interface ClosedTrade {
  ticket: number;
  openTime: string;
  closeTime: string;
  type: TradeDirection;
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  pips: number;
  reason: 'TP' | 'SL' | 'Manual' | 'KillSwitch';
  comment: string;
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
  currency: 'USD' | 'EUR' | 'GBP';
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
  minutesRemaining: number;
}

export interface MultiTimeframeAlignment {
  tf: 'M5' | 'M15' | 'H1' | 'H4';
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

export interface MarketState {
  bias: 'bullish' | 'bearish' | 'ranging';
  bos: StructureEvent | null;
  choch: StructureEvent | null;
  dealing_range: DealingRange | null;
  price_pos: number | null; // 0 to 1
  signal: Signal | null;
  zones: Zone[];
  history: number[];
  candlesM15: Candle[];
  candlesH1: Candle[];
  mtfAlignment: MultiTimeframeAlignment[];
  candlestickAnalysis?: CandlestickAnalysis;
}

export interface PositionsState {
  positions: Position[];
  closedTrades: ClosedTrade[];
  selectedTicket?: number | null;
}

export interface EngineState {
  kill_switch: boolean;
  auto_trade: boolean;
  news_blackout: boolean;
  session: SessionInfo;
  connected: boolean;
  max_spread_points: number;
  daily_loss_pct: number;
  daily_drawdown_pct: number;
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
}

export type AccountState = AccountRiskConfig;

// Composition of all slices for backwards compatibility
export interface TerminalSnapshot extends TickerState, MarketState, EngineState {
  margin_free: number;
  positions: Position[];
  log: EngineLog[];
  economicEvents: EconomicEvent[];
}

export type StoreChannel = 'ticker' | 'market' | 'positions' | 'engine' | 'events' | 'scenario';
