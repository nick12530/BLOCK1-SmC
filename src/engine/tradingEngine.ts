/**
 * tradingEngine.ts - Institutional execution & risk manager engine
 * Implements fine-grained channels, referential stability for useSyncExternalStore,
 * and HMR-safe singleton caching.
 */

import {
  Candle,
  Position,
  ClosedTrade,
  AccountState,
  EngineLog,
  InstrumentType,
  TerminalSnapshot,
  Signal,
  TickerState,
  MarketState,
  PositionsState,
  EngineState,
  EventsState,
  StoreChannel,
  TradeDirection,
  StructureEvent,
  Zone,
  DealingRange,
  CompoundingStageInfo,
  SymbolTradingSpec,
} from '../types/smc';
import { RISK_CONFIG, calculateRiskBasedVolume, isWithinConfiguredNewsBlackout } from './riskConfig';
import {
  calculateATR,
  MarketStructureEngine,
  detectFVGs,
  detectOrderBlocks,
  sessionFilter,
  evaluateConfluence,
} from './smcCore';
import { generateSeedMarketData, fetchLiveGoldCandles, DEFAULT_ECONOMIC_EVENTS } from './dataFeed';
import { analyzeGoldCandlestickPatterns } from './candlestickPatterns';
import { getGoldMarketSchedule, MarketScheduleStatus } from './marketHours';
import { evaluateTechnicalStrategies } from './technicalStrategies';
import { mt5Bridge } from './mt5Bridge';
import {
  buildSignalRationale,
  persistClosedTrades,
  persistTradeOrderBlocks,
  persistTradeRationales,
  readTradeOrderBlocks,
  readStoredClosedTrades,
  readTradeRationales,
  findCorrespondingOrderBlock,
  TradeRationales,
  TradeOrderBlocks,
} from './tradeJournal';
import { INSTRUMENTS, SUPPORTED_SYMBOLS, SupportedSymbol, getInstrumentConfig } from './instrumentConfig';
import { getGlobalSessionStatus } from './sessionTimezones';
import {
  PairAnalysis,
  analyzeInstrument,
  rankOpportunities,
  checkCorrelationExposure,
  calculateSmallAccountPositionSize,
} from './multiPairScanner';
import { generatePairCandles } from './dataFeed';
import { signalAudioNotifier } from '../utils/audioNotification';

const MAGIC = 20261001;
export const MAX_SPREAD_POINTS = 40; // 40 points = 4.0 pips on gold
const AUTO_RR = 2.0;
const SCORE_THRESHOLD = 5.0;

export class TradingEngine {
  candlesM15: Candle[] = [];
  candlesM1: Candle[] = [];
  candlesM5: Candle[] = [];
  candlesH1: Candle[] = [];
  positions: Position[] = [];
  closedTrades: ClosedTrade[] = [];
  logs: EngineLog[] = [];

  bid: number = 4188.5;
  ask: number = 4188.68;
  spread: number = 18; // 18 points = 1.8 pips
  lastPrice: number = 4188.5;

  activeSymbol: SupportedSymbol = 'XAUUSD';
  scannerAnalyses: PairAnalysis[] = [];
  bestOpportunity: PairAnalysis | null = null;
  pairData: Record<
    SupportedSymbol,
    {
      candlesM1: Candle[];
      candlesM5: Candle[];
      candlesM15: Candle[];
      candlesH1: Candle[];
      bid: number;
      ask: number;
      spread: number;
    }
  > = {
    XAUUSD: { candlesM1: [], candlesM5: [], candlesM15: [], candlesH1: [], bid: 4188.50, ask: 4188.68, spread: 18 },
    EURUSD: { candlesM1: [], candlesM5: [], candlesM15: [], candlesH1: [], bid: 1.08750, ask: 1.08758, spread: 8 },
    USDJPY: { candlesM1: [], candlesM5: [], candlesM15: [], candlesH1: [], bid: 153.850, ask: 153.862, spread: 12 },
    GBPUSD: { candlesM1: [], candlesM5: [], candlesM15: [], candlesH1: [], bid: 1.29650, ask: 1.29662, spread: 12 },
  };

  killSwitch: boolean = false;
  autoTrade: boolean = false;
  autoBeEnabled: boolean = true;
  newsBlackout: boolean = false;
  bypassNewsBlackout: boolean = false;
  connected: boolean = true;
  simulateWeekendMode: boolean = false;
  allowHighConfluenceOverride: boolean = true;
  autoSelectBestScenario: boolean = true;
  instrumentType: InstrumentType = 'standard';
  private hasBrokerMarketData = false;
  private symbolSpec: SymbolTradingSpec | null = null;
   private brokerAccountMode: 'demo' | 'live' | 'contest' | 'unknown' | null = null;
   private hasBrokerDayAnchor = false;
   private pendingCentralKillSwitch: boolean | null = null;
   private pendingCentralAutoTrade: boolean | null = null;
   private dailyRiskDate = new Date().toISOString().slice(0, 10);
  private entryHistory: Array<{ at: number; direction: TradeDirection; poiKey: string }> = [];

  mt5Account: {
    connected: boolean;
    login: string;
    server: string;
    broker: string;
    balance: number;
    equity: number;
    freeMargin: number;
  } = {
    connected: false,
    login: '',
    server: '',
    broker: '',
    balance: 10.0,
    equity: 10.0,
    freeMargin: 10.0,
  };

  account: AccountState = {
    balance: 10.0,
    equity: 10.0,
    margin_free: 10.0,
    margin_used: 0.0,
    initial_balance: 10.0,
    daily_start_balance: 10.0,
    max_daily_loss_pct: RISK_CONFIG.maxDailyLossPercent,
    risk_pct: RISK_CONFIG.riskPercentPerTrade,
    auto_rr: 2.0, // 1:2.0 Risk/Reward optimal compound ratio
    daily_drawdown_pct: 0.0,
    daily_loss_hit: false,
  };

  selectedTicket: number | null = null;
  currentScenario: string = 'london_bullish_fvg';
  ticketCounter: number = 8820410;
  tickCount: number = 0;
  private hasInitializedInitialPosition: boolean = false;
  private tradeRationales: TradeRationales = {};
  private tradeOrderBlocks: TradeOrderBlocks = {};

  minScoreThreshold: number = 75;

  // Channel-specific listener registry (Priority 1)
  private channelListeners: Map<StoreChannel, Set<() => void>> = new Map([
    ['ticker', new Set()],
    ['market', new Set()],
    ['positions', new Set()],
    ['engine', new Set()],
    ['events', new Set()],
    ['scenario', new Set()],
    ['scanner', new Set()],
  ]);

  private tickIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoTraderIntervalId: ReturnType<typeof setInterval> | null = null;

  // Cached referentially-stable snapshots (Priority 1)
  private _cachedTicker: TickerState | null = null;
  private _cachedMarket: MarketState | null = null;
  private _cachedPositions: PositionsState | null = null;
  private _cachedEngine: EngineState | null = null;
  private _cachedEvents: EventsState | null = null;
  private _cachedSnapshot: TerminalSnapshot | null = null;
  private _cachedClosedTrades: ClosedTrade[] = [];

  constructor() {
    this.closedTrades = readStoredClosedTrades();
    this.tradeRationales = readTradeRationales();
    this.tradeOrderBlocks = readTradeOrderBlocks();
    this.initPairData();
    this.resetWithScenario('london_bullish_fvg');
    this.refreshScanner();
    this.startEngineLoops();
    this.syncLiveMarketData();
  }

  syncMt5Snapshot(snapshot: {
    account: {
      login: number;
      server: string;
      balance: number;
      equity: number;
      margin_free: number;
    };
    positions: Array<{
      ticket: number;
      type: TradeDirection;
      volume: number;
      price_open: number;
      sl: number;
      tp: number;
      profit: number;
      magic: number;
      comment: string;
      time: string;
    }>;
    symbol: string;
    bid: number;
    ask: number;
    spread: number;
    accountMode: 'demo' | 'live' | 'contest' | 'unknown';
    tradingHalted: boolean;
    autoTrade: boolean;
    instrumentType: InstrumentType;
    symbolSpec: SymbolTradingSpec;
    candlesM1: Candle[];
    candlesM5: Candle[];
    candlesM15: Candle[];
    candlesH1: Candle[];
  }) {
    const { account, positions } = snapshot;
    const killSwitchWasArmed = this.killSwitch;
    if (this.pendingCentralKillSwitch === snapshot.tradingHalted) {
      this.pendingCentralKillSwitch = null;
    }
    this.killSwitch = this.pendingCentralKillSwitch ?? snapshot.tradingHalted;
    if (this.pendingCentralAutoTrade === snapshot.autoTrade) {
      this.pendingCentralAutoTrade = null;
    }
    this.autoTrade = this.pendingCentralAutoTrade ?? snapshot.autoTrade;
    if (this.killSwitch) this.autoTrade = false;
    this.mt5Account = {
      connected: true,
      login: String(account.login),
      server: account.server,
      broker: account.server.split(/[-_]/)[0] || 'MT5 Broker',
      balance: account.balance,
      equity: account.equity,
      freeMargin: account.margin_free,
    };
    this.account.balance = account.balance;
    this.account.equity = account.equity;
    this.account.margin_free = account.margin_free;
    if (!this.hasBrokerDayAnchor) {
      this.account.daily_start_balance = account.balance;
      this.dailyRiskDate = new Date().toISOString().slice(0, 10);
      this.account.daily_loss_hit = false;
      this.hasBrokerDayAnchor = true;
    }
    this.bid = snapshot.bid;
    this.ask = snapshot.ask;
    this.lastPrice = (snapshot.bid + snapshot.ask) / 2;
    this.spread = snapshot.spread;
    this.instrumentType = snapshot.instrumentType;
    const symUpper = (snapshot.symbol || '').toUpperCase().trim();
    this.activeSymbol = (SUPPORTED_SYMBOLS.includes(symUpper as any) ? symUpper : 'XAUUSD') as SupportedSymbol;
    this.symbolSpec = snapshot.symbolSpec;
    this.brokerAccountMode = snapshot.accountMode;
    this.candlesM1 = snapshot.candlesM1;
    this.candlesM5 = snapshot.candlesM5;
    if (
      snapshot.candlesM1.length >= 25 &&
      snapshot.candlesM5.length >= 20 &&
      snapshot.candlesM15.length >= 25 &&
      snapshot.candlesH1.length >= 20
    ) {
      this.candlesM15 = snapshot.candlesM15;
      this.candlesH1 = snapshot.candlesH1;
      this.hasBrokerMarketData = true;
    } else {
      this.hasBrokerMarketData = false;
    }
    this.positions = positions.map((position) => ({
      ...position,
      pips: 0,
      time: position.time,
      strategyRationale:
        this.tradeRationales[String(position.ticket)] || undefined,
      strategyOrderBlock: this.tradeOrderBlocks[String(position.ticket)],
      beLocked: position.sl > 0 && (position.type === 'BUY' ? position.sl > position.price_open : position.sl < position.price_open),
    }));
    if (this.killSwitch && !killSwitchWasArmed) {
      this.closeAll('KillSwitch');
      this.slog('Central MT5 kill switch armed on another connected dashboard; close requests sent. Verify broker positions.', 'warn');
    }
    if (!this.positions.some((position) => position.ticket === this.selectedTicket)) {
      this.selectedTicket = this.positions[0]?.ticket ?? null;
    }
    if (!killSwitchWasArmed && this.killSwitch && this.positions.length > 0) {
      this.slog('Central MT5 kill switch is armed; closing synced positions and blocking new orders.', 'error');
      this.closeAll('KillSwitch');
    }
    this.refreshDailyRiskState();
    this.invalidateMarket();
    this.invalidatePositions();
    this.invalidateTicker();
    this.invalidateEngine();
    this.emit('positions');
    this.emit('market');
    this.emit('ticker');
    this.emit('engine');
  }

  recordMt5Rationale(
    orderTicket: number,
    positionTicket: number | undefined,
    rationale: string,
    strategyOrderBlock?: Zone
  ) {
    this.tradeRationales[String(orderTicket)] = rationale;
    if (positionTicket !== undefined) this.tradeRationales[String(positionTicket)] = rationale;
    persistTradeRationales(this.tradeRationales);
    if (strategyOrderBlock) {
      this.tradeOrderBlocks[String(orderTicket)] = strategyOrderBlock;
      if (positionTicket !== undefined) this.tradeOrderBlocks[String(positionTicket)] = strategyOrderBlock;
      persistTradeOrderBlocks(this.tradeOrderBlocks);
    }

    const position = this.positions.find(
      (item) => item.ticket === positionTicket || item.ticket === orderTicket
    );
    if (position) {
      position.strategyRationale = rationale;
      position.strategyOrderBlock = strategyOrderBlock || this.tradeOrderBlocks[String(position.ticket)];
      this.invalidatePositions();
      this.emit('positions');
    }
  }

  syncMt5ClosedTrades(trades: ClosedTrade[]) {
    const merged = trades.map((trade) => ({
      ...trade,
      strategyRationale:
        this.tradeRationales[String(trade.orderTicket)] ||
        this.tradeRationales[String(trade.positionTicket)] ||
        this.tradeRationales[String(trade.ticket)] ||
        trade.strategyRationale,
      strategyOrderBlock:
        this.tradeOrderBlocks[String(trade.orderTicket)] ||
        this.tradeOrderBlocks[String(trade.positionTicket)] ||
        this.tradeOrderBlocks[String(trade.ticket)] ||
        trade.strategyOrderBlock,
    }));
    const nextByTicket = new Map(this.closedTrades.map((trade) => [trade.ticket, trade]));
    for (const trade of merged) nextByTicket.set(trade.ticket, trade);
    const nextTrades = [...nextByTicket.values()].sort((left, right) =>
      (right.closedAt || '').localeCompare(left.closedAt || '')
    );
    const changed =
      nextTrades.length !== this.closedTrades.length ||
      nextTrades.some((trade, index) => {
        const previous = this.closedTrades[index];
        return !previous || JSON.stringify(previous) !== JSON.stringify(trade);
      });
    if (!changed) return;

    this.closedTrades = nextTrades;
    persistClosedTrades(this.closedTrades);
    this.invalidatePositions();
    this.emit('positions');
  }

  async syncLiveMarketData() {
    try {
      const live = await fetchLiveGoldCandles();
      if (live && live.candlesM15.length > 0) {
        this.candlesM15 = live.candlesM15;
        this.candlesH1 = live.candlesH1;
        this.lastPrice = live.currentPrice;
        this.bid = live.currentPrice;
        this.ask = Number((this.bid + this.spread * 0.01).toFixed(2));
        this.slog(`Live XAUUSD interbank data synced @ $${this.bid.toFixed(2)}`, 'info');
        this.invalidateMarket();
        this.invalidateTicker();
        this.emit('ticker');
        this.emit('market');
      }
    } catch {
      // Graceful fallback to established session data
    }
  }

  resetWithScenario(scenarioId: string) {
    this.currentScenario = scenarioId;
    const data = generateSeedMarketData(scenarioId);
    this.candlesM15 = data.candlesM15;
    this.candlesH1 = data.candlesH1;

    const last = this.candlesM15[this.candlesM15.length - 1];
    this.lastPrice = last.close;
    this.bid = Number(last.close.toFixed(2));
    this.ask = Number((last.close + 0.18).toFixed(2));
    this.spread = 18;

    // Production deployment: Start with zero mock positions (real live positions only)
    if (!this.hasInitializedInitialPosition) {
      this.hasInitializedInitialPosition = true;
      this.positions = [];
      this.slog(`Institutional engine online · Market regime: ${scenarioId}`, 'info');
      this.slog('MT5 bridge ready for live execution', 'info');
    } else {
      this.slog(`Market regime transitioned to: ${scenarioId}`, 'info');
    }

    // Invalidate caches & notify
    this.invalidateMarket();
    this.invalidatePositions();
    this.invalidateEngine();
    this.invalidateTicker();
    this.emit('scenario');
  }

  slog(msg: string, type: 'info' | 'trade' | 'warn' | 'error' | 'signal' = 'info') {
    const t = new Date().toISOString().substr(11, 8); // Explicit UTC string
    const logItem: EngineLog = {
      id: Math.random().toString(36).substring(2, 9),
      t,
      msg,
      type,
    };
    this.logs = [logItem, ...this.logs.slice(0, 150)];
    this.invalidateEvents();
    this.emit('events');
  }

  // ==========================================
  // CHANNEL SUBSCRIPTION API (Priority 1)
  // ==========================================

  on(channel: StoreChannel, callback: () => void): () => void {
    const set = this.channelListeners.get(channel);
    if (set) {
      set.add(callback);
    }
    return () => {
      set?.delete(callback);
    };
  }

  // Backwards-compatible alias for subscribe (subscribes to ticker)
  subscribe(listener: (snapshot: TerminalSnapshot) => void): () => void {
    const cb = () => listener(this.getSnapshot());
    return this.on('ticker', cb);
  }

  private emit(channel: StoreChannel) {
    const listeners = this.channelListeners.get(channel);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error(`Error in listener for channel ${channel}:`, e);
        }
      });
    }
  }

  // ==========================================
  // REFERENTIALLY-STABLE GETTERS (Priority 1)
  // ==========================================

  getTickerSnapshot(): TickerState {
    if (!this._cachedTicker) {
      const config = getInstrumentConfig(this.activeSymbol);
      const allCloses = this.candlesM15.map((c) => c.close);
      const high24h = this.candlesM15.length ? Math.max(...this.candlesM15.map((c) => c.high)) : this.bid;
      const low24h = this.candlesM15.length ? Math.min(...this.candlesM15.map((c) => c.low)) : this.bid;
      const open24h = this.candlesM15[0]?.open || this.bid;
      const change24h = Number((this.bid - open24h).toFixed(config.digits));
      const change24hPct = Number(((change24h / open24h) * 100).toFixed(2));
      const globalSessions = getGlobalSessionStatus(new Date());

      this._cachedTicker = {
        time: new Date().toISOString().substr(11, 8) + ' UTC',
        symbol: this.activeSymbol,
        displayName: config.displayName,
        brokerTimeStr: globalSessions.brokerTimeStr,
        kenyaTimeStr: globalSessions.kenyaTimeStr,
        bid: Number(this.bid.toFixed(config.digits)),
        ask: Number(this.ask.toFixed(config.digits)),
        spread: this.spread,
        equity: Number(this.account.equity.toFixed(2)),
        balance: Number(this.account.balance.toFixed(2)),
        high24h: Number(high24h.toFixed(config.digits)),
        low24h: Number(low24h.toFixed(config.digits)),
        change24h,
        change24hPct,
        volume24h: config.category === 'metals' ? '184.2K oz' : '2.4M Lots',
      };
    }
    return this._cachedTicker;
  }

  getMarketSnapshot(): MarketState {
    if (!this._cachedMarket) {
      const ms = new MarketStructureEngine(3);
      ms.update(this.candlesH1);

      const aExec = calculateATR(this.candlesM15);
      const fvgs = detectFVGs(this.candlesM15, aExec).filter((z) => !z.filled).slice(-6);
      const obs = detectOrderBlocks(this.candlesM15, aExec).filter((z) => !z.filled).slice(-6);
      const zones = [...fvgs, ...obs];

      const dr = ms.dealingRange();
      const candidateSignals = this.hasBrokerMarketData
        ? [
            ...(this.instrumentType === 'standard' && /^(XAU|GOLD)/i.test(this.activeSymbol)
              ? [
                  evaluateConfluence(
                    this.candlesM1,
                    this.candlesM5,
                    this.account.auto_rr,
                    SCORE_THRESHOLD,
                    'M1'
                  ),
                  evaluateConfluence(
                    this.candlesM5,
                    this.candlesM15,
                    this.account.auto_rr,
                    SCORE_THRESHOLD,
                    'M5'
                  ),
                ].filter((signal): signal is Signal => signal !== null)
              : []),
            ...evaluateTechnicalStrategies(
              this.candlesM1,
              this.candlesM5,
              'M1',
              this.instrumentType
            ),
            ...evaluateTechnicalStrategies(
              this.candlesM5,
              this.candlesM15,
              'M5',
              this.instrumentType
            ),
          ].filter((signal): signal is Signal => signal !== null)
        : [];
      const signals = candidateSignals
        .map((signal) => ({
          ...signal,
          strategy: signal.strategy ?? 'SMC POI Retest' as const,
        }))
        .sort((left, right) => right.score - left.score)
        .filter((signal, index, items) =>
          items.findIndex((candidate) => candidate.strategy === signal.strategy && candidate.direction === signal.direction) === index
        );
      const sig = signals[0] ?? null;

      let pricePos: number | null = null;
      if (dr && dr.high > dr.low) {
        pricePos = Number(((this.bid - dr.low) / (dr.high - dr.low)).toFixed(4));
      }

      const history = this.candlesM15.slice(-200).map((c) => c.close);
      const lastBOS = ms.events.filter((e) => e.kind === 'BOS').slice(-1)[0] || null;
      const lastCHoCH = ms.events.filter((e) => e.kind === 'CHoCH').slice(-1)[0] || null;

      const mtfAlignment = [
        {
          tf: 'M5' as const,
          bias: ms.trend === 'ranging' ? ('ranging' as const) : ms.trend,
          lastEvent: (lastCHoCH ? 'CHoCH' : 'BOS') as 'BOS' | 'CHoCH' | 'SWING',
          status: ms.trend === 'bullish' ? 'Discount Pullback' : 'Premium Retest',
        },
        {
          tf: 'M15' as const,
          bias: ms.trend === 'ranging' ? ('ranging' as const) : ms.trend,
          lastEvent: (lastBOS ? 'BOS' : 'SWING') as 'BOS' | 'CHoCH' | 'SWING',
          status: fvgs.length > 0 ? `${fvgs.length} Active FVGs` : 'Consolidating',
        },
        {
          tf: 'H1' as const,
          bias: ms.trend,
          lastEvent: (lastBOS ? 'BOS' : 'CHoCH') as 'BOS' | 'CHoCH' | 'SWING',
          status: dr ? (pricePos && pricePos < 0.5 ? 'Discount Zone' : 'Premium Zone') : 'Tracking',
        },
        {
          tf: 'H4' as const,
          bias: (this.currentScenario === 'ny_bearish_choch' ? 'bearish' : 'bullish') as 'bullish' | 'bearish' | 'ranging',
          lastEvent: 'BOS' as const,
          status: 'Macro Flow Aligned',
        },
      ];

      const candlestickAnalysis = analyzeGoldCandlestickPatterns(this.candlesM15);

      this._cachedMarket = {
        bias: ms.trend,
        bos: lastBOS,
        choch: lastCHoCH,
        dealing_range: dr,
        price_pos: pricePos,
        signal: sig,
        signals,
        instrumentType: this.instrumentType,
        zones,
        history,
        brokerMarketData: this.hasBrokerMarketData,
        accountMode: this.brokerAccountMode,
        symbolSpec: this.symbolSpec,
        candlesM1: this.candlesM1,
        candlesM5: this.candlesM5,
        candlesM15: this.candlesM15,
        candlesH1: this.candlesH1,
        mtfAlignment,
        candlestickAnalysis,
        scannerAnalyses: this.scannerAnalyses,
        bestOpportunity: this.bestOpportunity,
      };
    }
    return this._cachedMarket;
  }

  getPositionsSnapshot(): PositionsState {
    if (!this._cachedPositions) {
      this._cachedPositions = {
        positions: this.positions,
        closedTrades: this.closedTrades,
        selectedTicket: this.selectedTicket,
      };
    }
    return this._cachedPositions;
  }

  setSelectedTicket(ticket: number | null) {
    this.selectedTicket = ticket;
    this.invalidatePositions();
    this.emit('positions');
  }

  setAccountBalancePreset(newBal: number) {
    this.account.balance = Number(newBal.toFixed(2));
    this.account.initial_balance = this.account.balance;
    this.account.daily_start_balance = this.account.balance;
    const floatingPnl = this.positions.reduce((sum, p) => sum + p.profit, 0);
    this.account.equity = Number((this.account.balance + floatingPnl).toFixed(2));
    this.account.margin_free = Number(Math.max(0, this.account.equity - this.account.margin_used).toFixed(2));
    this.slog(`Account balance preset updated to $${newBal.toFixed(2)} USD (Optimal Growth Mode)`, 'info');
    this.invalidateTicker();
    this.invalidateEngine();
    this.emit('ticker');
    this.emit('engine');
  }

  getClosedTradesSnapshot(): ClosedTrade[] {
    return this.closedTrades;
  }

  getCompoundingStage(balance: number): CompoundingStageInfo {
    if (balance < 25) {
      const minBal = 10;
      const maxBal = 25;
      const progressPct = Math.min(100, Math.max(0, Math.round(((balance - minBal) / (maxBal - minBal)) * 100)));
      return {
        stage: 1,
        name: 'Stage 1: Micro Base',
        minBal,
        maxBal,
        progressPct,
        recommendedLot: 0.01,
        maxTrades: 1,
        targetPnlPerTrade: '+$2.00 to +$3.50',
        nextMilestone: 'Reach $25 to unlock 0.02 Lots',
      };
    } else if (balance < 50) {
      const minBal = 25;
      const maxBal = 50;
      const progressPct = Math.min(100, Math.max(0, Math.round(((balance - minBal) / (maxBal - minBal)) * 100)));
      return {
        stage: 2,
        name: 'Stage 2: Capital Builder',
        minBal,
        maxBal,
        progressPct,
        recommendedLot: 0.02,
        maxTrades: 1,
        targetPnlPerTrade: '+$4.00 to +$7.00',
        nextMilestone: 'Reach $50 to unlock 0.03 Lots & Dual Trades',
      };
    } else if (balance < 100) {
      const minBal = 50;
      const maxBal = 100;
      const progressPct = Math.min(100, Math.max(0, Math.round(((balance - minBal) / (maxBal - minBal)) * 100)));
      return {
        stage: 3,
        name: 'Stage 3: Growth Momentum',
        minBal,
        maxBal,
        progressPct,
        recommendedLot: 0.03,
        maxTrades: 2,
        targetPnlPerTrade: '+$7.00 to +$12.00',
        nextMilestone: 'Reach $100 to unlock 0.05 Lots (Prop Firm Ready)',
      };
    } else if (balance < 250) {
      const minBal = 100;
      const maxBal = 250;
      const progressPct = Math.min(100, Math.max(0, Math.round(((balance - minBal) / (maxBal - minBal)) * 100)));
      return {
        stage: 4,
        name: 'Stage 4: Capital Acceleration',
        minBal,
        maxBal,
        progressPct,
        recommendedLot: 0.05,
        maxTrades: 2,
        targetPnlPerTrade: '+$15.00 to +$25.00',
        nextMilestone: 'Reach $250 to unlock 0.10 Lots',
      };
    } else {
      const minBal = 250;
      const maxBal = 1000;
      const progressPct = Math.min(100, Math.max(0, Math.round(((balance - minBal) / (maxBal - minBal)) * 100)));
      return {
        stage: 5,
        name: 'Stage 5: Institutional Compounding',
        minBal,
        maxBal,
        progressPct,
        recommendedLot: 0.10,
        maxTrades: 3,
        targetPnlPerTrade: '+$30.00 to +$70.00',
        nextMilestone: 'Full Institutional Scale Unlocked',
      };
    }
  }

  toggleAutoBe(): boolean {
    this.autoBeEnabled = !this.autoBeEnabled;
    this.slog(`Zero-Risk Auto-BE Protection: ${this.autoBeEnabled ? 'ARMED' : 'DISABLED'}`, 'info');
    this.invalidateEngine();
    this.emit('engine');
    return this.autoBeEnabled;
  }

  getEngineSnapshot(): EngineState {
    if (!this._cachedEngine) {
      const sess = sessionFilter(new Date());
      this._cachedEngine = {
        kill_switch: this.killSwitch,
        auto_trade: this.autoTrade,
        auto_be_enabled: this.autoBeEnabled,
        news_blackout: this.newsBlackout || isWithinConfiguredNewsBlackout(new Date()),
        session: sess,
        connected: this.connected,
        max_spread_points: MAX_SPREAD_POINTS,
        daily_loss_pct: this.account.max_daily_loss_pct,
        daily_drawdown_pct: this.account.daily_drawdown_pct,
        compoundingStage: this.getCompoundingStage(this.account.balance),
        marketSchedule: getGoldMarketSchedule(),
        mt5Account: this.mt5Account,
        simulateWeekendMode: this.simulateWeekendMode,
        allowHighConfluenceOverride: this.allowHighConfluenceOverride,
        autoSelectBestScenario: this.autoSelectBestScenario,
      };
    }
    return this._cachedEngine;
  }

  linkMt5Account(login: string, server: string, balance?: number, equity?: number) {
    const bal = balance !== undefined && balance > 0 ? balance : this.account.balance;
    const eq = equity !== undefined && equity > 0 ? equity : bal;

    this.mt5Account = {
      connected: true,
      login,
      server,
      broker: server.split(/[-_]/)[0] || 'Real Broker',
      balance: bal,
      equity: eq,
      freeMargin: bal,
    };

    this.account.balance = bal;
    this.account.equity = eq;
    if (!this.hasBrokerDayAnchor) {
      this.account.initial_balance = bal;
      this.account.daily_start_balance = bal;
    }
    this.account.margin_free = bal;

    this.slog(`MetaTrader 5 Linked: Account #${login} on ${server} (Equity: $${eq.toFixed(2)})`, 'trade');
    this.invalidateEngine();
    this.invalidateTicker();
    this.emit('engine');
    this.emit('ticker');
  }

  unlinkMt5Account() {
    this.mt5Account.connected = false;
    this.slog('MetaTrader 5 Disconnected. Switched to standalone terminal mode.', 'info');
    this.invalidateEngine();
    this.emit('engine');
  }

  toggleSimulateWeekend(): boolean {
    this.simulateWeekendMode = !this.simulateWeekendMode;
    this.slog(
      `Weekend Simulation: ${this.simulateWeekendMode ? 'ENABLED (Testing Mode)' : 'DISABLED (Real Market Hours Enforced)'}`,
      'info'
    );
    this.invalidateEngine();
    this.emit('engine');
    return this.simulateWeekendMode;
  }

  initPairData() {
    for (const sym of SUPPORTED_SYMBOLS) {
      if (!this.pairData[sym].candlesM1.length) {
        const generated = generatePairCandles(sym, 80);
        this.pairData[sym] = {
          candlesM1: generated.candlesM1,
          candlesM5: generated.candlesM5,
          candlesM15: generated.candlesM15,
          candlesH1: generated.candlesH1,
          bid: generated.currentBid,
          ask: generated.currentAsk,
          spread: generated.spreadPoints,
        };
      }
    }
  }

  getScannerAnalyses(): PairAnalysis[] {
    if (!this.scannerAnalyses.length) {
      this.refreshScanner();
    }
    return this.scannerAnalyses;
  }

  getBestOpportunity(): PairAnalysis | null {
    if (!this.bestOpportunity && !this.scannerAnalyses.length) {
      this.refreshScanner();
    }
    return this.bestOpportunity;
  }

  setMinScoreThreshold(threshold: number) {
    this.minScoreThreshold = Math.max(50, Math.min(95, threshold));
    this.refreshScanner();
    this.slog(`Confluence Execution Threshold updated to ${this.minScoreThreshold}/100`, 'info');
  }

  setAllowHighConfluenceOverride(enabled: boolean) {
    this.allowHighConfluenceOverride = enabled;
    this.invalidateEngine();
    this.emit('engine');
    this.slog(`High-Confluence Fallback Override for Daily Limits: ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
  }

  setAutoSelectBestScenario(enabled: boolean) {
    this.autoSelectBestScenario = enabled;
    if (enabled && this.bestOpportunity && this.bestOpportunity.symbol !== this.activeSymbol) {
      this.switchSymbol(this.bestOpportunity.symbol);
    }
    this.invalidateEngine();
    this.emit('engine');
    this.slog(`Auto-Focus Best Opportunity Setup: ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
  }

  refreshScanner() {
    this.initPairData();
    const analyses: PairAnalysis[] = [];
    const events = this.getEventsSnapshot().economicEvents;

    for (const sym of SUPPORTED_SYMBOLS) {
      const data = this.pairData[sym];
      const isCurrent = this.activeSymbol === sym;
      const cM1 = isCurrent && this.candlesM1.length ? this.candlesM1 : data.candlesM1;
      const cM5 = isCurrent && this.candlesM5.length ? this.candlesM5 : data.candlesM5;
      const cM15 = isCurrent && this.candlesM15.length ? this.candlesM15 : data.candlesM15;
      const cH1 = isCurrent && this.candlesH1.length ? this.candlesH1 : data.candlesH1;
      const curBid = isCurrent ? this.bid : data.bid;
      const curAsk = isCurrent ? this.ask : data.ask;
      const curSpread = isCurrent ? this.spread : data.spread;

      const analysis = analyzeInstrument(
        sym,
        cM1,
        cM5,
        cM15,
        cH1,
        curBid,
        curAsk,
        curSpread,
        this.account.equity,
        this.account.risk_pct,
        this.positions,
        events
      );
      analyses.push(analysis);
    }

    const ranked = rankOpportunities(analyses);
    this.scannerAnalyses = ranked;
    this.bestOpportunity = ranked[0] || null;

    // Automatically select the best scenario in the chart if enabled
    if (
      this.autoSelectBestScenario &&
      this.bestOpportunity &&
      this.bestOpportunity.symbol !== this.activeSymbol &&
      (this.bestOpportunity.status === 'READY' || this.bestOpportunity.confluenceScore >= 70)
    ) {
      this.switchSymbol(this.bestOpportunity.symbol);
    }

    this.emit('scanner');
  }

  switchSymbol(newSymbol: SupportedSymbol) {
    if (!SUPPORTED_SYMBOLS.includes(newSymbol)) return;
    if (this.activeSymbol === newSymbol) return;

    // Cache current state back to pairData
    this.pairData[this.activeSymbol] = {
      candlesM1: this.candlesM1,
      candlesM5: this.candlesM5,
      candlesM15: this.candlesM15,
      candlesH1: this.candlesH1,
      bid: this.bid,
      ask: this.ask,
      spread: this.spread,
    };

    this.activeSymbol = newSymbol;
    const targetData = this.pairData[newSymbol];
    const config = getInstrumentConfig(newSymbol);

    this.candlesM1 = targetData.candlesM1;
    this.candlesM5 = targetData.candlesM5;
    this.candlesM15 = targetData.candlesM15;
    this.candlesH1 = targetData.candlesH1;
    this.bid = targetData.bid;
    this.ask = targetData.ask;
    this.spread = targetData.spread;
    this.lastPrice = this.bid;

    mt5Bridge.setSymbol(newSymbol);

    this.slog(`Active workstation switched to ${newSymbol} (${config.displayName})`, 'info');

    this.invalidateTicker();
    this.invalidateMarket();
    this.invalidateEngine();
    this.refreshScanner();
    this.emit('ticker');
    this.emit('market');
    this.emit('engine');
  }

  getEventsSnapshot(): EventsState {
    if (!this._cachedEvents) {
      this._cachedEvents = {
        log: this.logs,
        economicEvents: DEFAULT_ECONOMIC_EVENTS,
      };
    }
    return this._cachedEvents;
  }

  getScenarioSnapshot(): string {
    return this.currentScenario;
  }

  getRiskBasedVolume(stopLoss: number, requestedVolume?: number): number | null {
    if (!this.symbolSpec) return this.mt5Account.connected ? null : requestedVolume ?? 0.01;
    const riskVolume = calculateRiskBasedVolume(
      this.account.equity,
      this.account.risk_pct,
      Math.abs(this.bid - stopLoss),
      this.symbolSpec
    );
    if (riskVolume === null || requestedVolume === undefined) return riskVolume;
    const cappedVolume = Math.min(riskVolume, requestedVolume);
    const steps = Math.floor((cappedVolume - this.symbolSpec.volumeMin) / this.symbolSpec.volumeStep + 1e-9);
    const precision = Math.min(8, (String(this.symbolSpec.volumeStep).split('.')[1] || '').length);
    const adjustedVolume = Number((this.symbolSpec.volumeMin + Math.max(0, steps) * this.symbolSpec.volumeStep).toFixed(precision));
    return adjustedVolume <= riskVolume ? adjustedVolume : null;
  }

  getEntryBlockReason(direction: TradeDirection, signal = this.getMarketSnapshot().signal): string | null {
    const now = Date.now();
    this.entryHistory = this.entryHistory.filter((entry) => now - entry.at < 60 * 60_000);
    if (this.killSwitch) return 'Kill switch is armed.';
    if (this.account.daily_loss_hit || this.account.daily_drawdown_pct >= this.account.max_daily_loss_pct) {
      return 'Daily loss limit reached.';
    }

    // Small account maximum simultaneous positions limit (Section 7)
    const maxSimultaneousTrades = this.account.balance <= 100 ? 1 : RISK_CONFIG.maxOpenPositions;
    if (this.positions.length >= maxSimultaneousTrades) {
      return `TRADE_REJECTED: MAX_SIMULTANEOUS_TRADES_REACHED (Account limited to ${maxSimultaneousTrades} open position)`;
    }

    // Daily trade count limits (Section 7: 5 total, 3 per pair)
    const today = new Date().toISOString().slice(0, 10);
    const todayClosedTrades = this.closedTrades.filter((t) => (t.closedAt || '').startsWith(today));
    const pairTodayTrades = todayClosedTrades.filter((t) => (t.symbol || t.comment || '').includes(this.activeSymbol));

    // Fallback override: If a high-confluence or good setup presents itself (Score >= 70 or R:R >= 2.0)
    const isHighQualitySignal = Boolean(signal && (signal.score >= 70 || (signal.score >= 65 && Math.abs(signal.tp - signal.entry) / Math.max(0.0001, Math.abs(signal.entry - signal.sl)) >= 2.0)));
    const bypassDailyLimit = this.allowHighConfluenceOverride && isHighQualitySignal;

    if (todayClosedTrades.length >= 5) {
      if (bypassDailyLimit) {
        this.slog(`Daily trade limit reached (5/5), but prime high-confluence signal detected (${signal?.score}/100). Fallback override activated to take trade.`, 'info');
      } else {
        return 'TRADE_REJECTED: DAILY_TRADE_LIMIT_REACHED (Maximum 5 trades per day reached. High-confluence fallback available for signal score ≥ 70)';
      }
    }
    if (pairTodayTrades.length >= 3) {
      if (bypassDailyLimit) {
        this.slog(`Pair daily limit reached (3/3 on ${this.activeSymbol}), but high-confluence signal detected (${signal?.score}/100). Fallback override activated.`, 'info');
      } else {
        return `TRADE_REJECTED: PAIR_DAILY_LIMIT_REACHED (Maximum 3 trades per day reached for ${this.activeSymbol}. High-confluence fallback available for signal score ≥ 70)`;
      }
    }

    // Correlation & combined USD exposure protection (Section 8)
    const correlationCheck = checkCorrelationExposure(this.activeSymbol, direction, this.positions, 1);
    if (!correlationCheck.allowed) {
      return correlationCheck.reason || 'TRADE_REJECTED: CORRELATION_LIMIT_EXCEEDED';
    }

    // Minimum lot risk calculation (Section 7: TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK)
    if (signal) {
      const stopDist = Math.abs(signal.entry - signal.sl);
      const sizing = calculateSmallAccountPositionSize(this.account.equity, this.account.risk_pct, stopDist, this.activeSymbol);
      if (sizing.rejectionReason) {
        return sizing.rejectionReason;
      }
    }

    const config = getInstrumentConfig(this.activeSymbol);
    if (this.spread > config.maxSpreadPoints) {
      return `TRADE_REJECTED: SPREAD_TOO_WIDE (${this.spread} points; maximum ${config.maxSpreadPoints} for ${this.activeSymbol}).`;
    }

    const lastDirectionEntry = [...this.entryHistory].reverse().find((entry) => entry.direction === direction);
    if (lastDirectionEntry && now - lastDirectionEntry.at < RISK_CONFIG.directionCooldownMs) {
      return 'Direction cooldown is active.';
    }
    const poiKey = signal ? this.getSignalPoiKey(signal.direction, signal.entry) : '';
    if (
      poiKey &&
      this.entryHistory.some((entry) => entry.poiKey === poiKey && now - entry.at < RISK_CONFIG.samePoiCooldownMs)
    ) {
      return 'This SMC point of interest was traded recently.';
    }
    if (this.entryHistory.length >= RISK_CONFIG.maxTradesPerHour) return 'Hourly trade limit reached.';

    const consecutiveLosses = this.closedTrades.slice(0, RISK_CONFIG.maxConsecutiveLosses)
      .every((trade) => trade.profit <= 0);
    if (this.closedTrades.length >= RISK_CONFIG.maxConsecutiveLosses && consecutiveLosses) {
      return 'Consecutive-loss circuit breaker reached.';
    }

    if (this.instrumentType === 'standard' && this.newsBlackout) return 'News blackout is enabled.';
    if (this.instrumentType === 'standard' && !this.bypassNewsBlackout && isWithinConfiguredNewsBlackout(new Date(now))) {
      return 'Configured high-impact news blackout window is active.';
    }
    return null;
  }

  getMaxSpreadPoints(): number {
    return getInstrumentConfig(this.activeSymbol).maxSpreadPoints;
  }

  recordAcceptedEntry(direction: TradeDirection, signal = this.getMarketSnapshot().signal) {
    const poiKey = signal ? this.getSignalPoiKey(signal.direction, signal.entry) : '';
    this.entryHistory.push({ at: Date.now(), direction, poiKey });
    this.entryHistory = this.entryHistory.slice(-RISK_CONFIG.maxTradesPerHour);
    try {
      signalAudioNotifier.playTradeExecutionAlert(direction);
    } catch {
      // ignore
    }
  }

  getSignalPoiKey(direction: TradeDirection, entry: number): string {
    const bullish = direction === 'BUY';
    const zone = this.getMarketSnapshot().zones.find(
      (item) =>
        item.bullish === bullish &&
        item.bottom <= entry &&
        entry <= item.top &&
        !item.filled
    );
    return zone ? `${direction}:${zone.kind}:${zone.bottom.toFixed(2)}:${zone.top.toFixed(2)}` : `${direction}:${entry.toFixed(2)}`;
  }

  private refreshDailyRiskState() {
    const date = new Date().toISOString().slice(0, 10);
    if (date !== this.dailyRiskDate) {
      this.dailyRiskDate = date;
      this.account.daily_start_balance = this.account.balance;
      this.account.daily_loss_hit = false;
      this.entryHistory = [];
      this.slog('Daily risk limits reset for the new UTC trading day.', 'info');
    }
    if (this.account.daily_start_balance <= 0) return;
    this.account.daily_drawdown_pct = Number(
      Math.max(0, ((this.account.daily_start_balance - this.account.equity) / this.account.daily_start_balance) * 100).toFixed(2)
    );
    if (!this.account.daily_loss_hit && this.account.daily_drawdown_pct >= this.account.max_daily_loss_pct) {
      this.account.daily_loss_hit = true;
      this.autoTrade = false;
      this.slog(`Daily loss circuit breaker triggered at ${this.account.daily_drawdown_pct}%. Trading disabled until UTC day reset.`, 'error');
      this.closeAll('KillSwitch');
      this.invalidateEngine();
      this.emit('engine');
    }
  }

  getSnapshot(): TerminalSnapshot {
    const ticker = this.getTickerSnapshot();
    const market = this.getMarketSnapshot();
    const engine = this.getEngineSnapshot();
    const positions = this.getPositionsSnapshot();
    const events = this.getEventsSnapshot();

    if (
      !this._cachedSnapshot ||
      this._cachedSnapshot.bid !== ticker.bid ||
      this._cachedSnapshot.equity !== ticker.equity ||
      this._cachedSnapshot.balance !== ticker.balance ||
      this._cachedSnapshot.positions !== positions.positions ||
      this._cachedSnapshot.kill_switch !== engine.kill_switch
    ) {
      this._cachedSnapshot = {
        ...ticker,
        ...market,
        ...engine,
        margin_free: this.account.margin_free,
        positions: positions.positions,
        log: events.log,
        economicEvents: events.economicEvents,
      };
    }
    return this._cachedSnapshot;
  }

  private invalidateTicker() {
    this._cachedTicker = null;
    this._cachedSnapshot = null;
  }

  private invalidateMarket() {
    this._cachedMarket = null;
    this._cachedSnapshot = null;
  }

  private invalidatePositions() {
    this._cachedPositions = null;
    this._cachedSnapshot = null;
  }

  private invalidateEngine() {
    this._cachedEngine = null;
    this._cachedSnapshot = null;
  }

  private invalidateEvents() {
    this._cachedEvents = null;
    this._cachedSnapshot = null;
  }

  // ==========================================
  // ENGINE LIFECYCLE & EXECUTION (Priorities 1 & 3)
  // ==========================================

  startEngineLoops() {
    if (this.tickIntervalId) clearInterval(this.tickIntervalId);
    if (this.autoTraderIntervalId) clearInterval(this.autoTraderIntervalId);

    // Fast Ticker Loop (~1.5s)
    this.tickIntervalId = setInterval(() => {
      this.simulatePriceTick();
    }, 1500);

    // Auto-trader cycle (~5s)
    this.autoTraderIntervalId = setInterval(() => {
      void this.evaluateAutoExecution();
    }, 5000);
  }

  stopEngineLoops() {
    if (this.tickIntervalId) clearInterval(this.tickIntervalId);
    if (this.autoTraderIntervalId) clearInterval(this.autoTraderIntervalId);
    this.tickIntervalId = null;
    this.autoTraderIntervalId = null;
  }

  simulatePriceTick(force: boolean = false) {
    if (this.mt5Account.connected) return;

    // Real market hours check: Gold interbank trading is closed on weekends!
    const isTest =
      typeof (globalThis as any).vi !== 'undefined' ||
      typeof (globalThis as any).__vitest_worker__ !== 'undefined' ||
      (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || !!process.env?.VITEST));
    const schedule = getGoldMarketSchedule();
    if (!force && !isTest && !schedule.isOpen && !this.simulateWeekendMode) {
      return;
    }

    // Institutional price progression:
    // When positions are open or strong signals exist, simulate realistic order flow momentum (80% follow-through)
    let momentum = 0;
    if (this.positions.length > 0) {
      // Calculate net position bias
      const netDirection = this.positions.reduce((acc, p) => acc + (p.type === 'BUY' ? 1 : -1), 0);
      momentum = netDirection > 0 ? 0.08 : netDirection < 0 ? -0.08 : 0;
    } else {
      const market = this.getMarketSnapshot();
      if (market.signal && market.signal.score >= 4.0) {
        momentum = market.signal.direction === 'BUY' ? 0.05 : -0.05;
      }
    }

    const config = getInstrumentConfig(this.activeSymbol);
    const noise = (Math.random() - 0.48) * config.pointSize * 4;
    const drift = momentum * config.pointSize * 10 + noise;
    this.bid = Number(Math.max(config.pointSize * 100, this.bid + drift).toFixed(config.digits));
    this.spread = Math.floor(config.minSpread + Math.random() * 3);
    this.ask = Number((this.bid + this.spread * config.pointSize).toFixed(config.digits));

    // Progress latest M15 candle with real price updates
    if (this.candlesM15.length > 0) {
      const lastC = this.candlesM15[this.candlesM15.length - 1];
      lastC.close = this.bid;
      if (this.bid > lastC.high) lastC.high = this.bid;
      if (this.bid < lastC.low) lastC.low = this.bid;
    }

    // Advance background micro ticks for inactive pairs in pairData
    for (const sym of SUPPORTED_SYMBOLS) {
      if (sym === this.activeSymbol) continue;
      const p = this.pairData[sym];
      const cfg = getInstrumentConfig(sym);
      const microNoise = (Math.random() - 0.49) * cfg.pointSize * 3;
      p.bid = Number((p.bid + microNoise).toFixed(cfg.digits));
      p.ask = Number((p.bid + p.spread * cfg.pointSize).toFixed(cfg.digits));
      if (p.candlesM1.length > 0) {
        const lastBar = p.candlesM1[p.candlesM1.length - 1];
        lastBar.close = p.bid;
        if (p.bid > lastBar.high) lastBar.high = p.bid;
        if (p.bid < lastBar.low) lastBar.low = p.bid;
      }
    }

    // Update positions PnL safely
    let floatingPnl = 0;
    const toClose: { ticket: number; reason: 'TP' | 'SL' }[] = [];

    if (this.positions.length > 0) {
      this.positions = this.positions.map((p) => {
        const posSym = (p.symbol || this.activeSymbol) as SupportedSymbol;
        const cfg = getInstrumentConfig(posSym);
        const curPrice = p.type === 'BUY' ? this.bid : this.ask;
        const pts = p.type === 'BUY' ? curPrice - p.price_open : p.price_open - curPrice;
        const pips = Number((pts / cfg.pipSize).toFixed(1));
        let profit = 0;
        if (cfg.category === 'metals') {
          profit = Number((pts * p.volume * cfg.contractSize).toFixed(2));
        } else if (posSym === 'USDJPY') {
          profit = Number(((pts * p.volume * cfg.contractSize) / Math.max(1, curPrice)).toFixed(2));
        } else {
          profit = Number((pts * p.volume * cfg.contractSize).toFixed(2));
        }
        floatingPnl += profit;

        let currentSl = p.sl;
        let beLocked = p.beLocked;
        let trailLocked = p.trailLocked;

        // Auto Break-Even (BE) Lock: when trade reaches 1:1 RR, move SL to entry
        const beBuffer = cfg.pipSize * 3;
        if (this.autoBeEnabled && !beLocked && pts >= cfg.pipSize * 15) {
          beLocked = true;
          currentSl = Number((p.type === 'BUY' ? p.price_open + beBuffer : p.price_open - beBuffer).toFixed(cfg.digits));
          this.slog(`🛡️ ZERO-RISK BE LOCK: SL moved to $${currentSl.toFixed(cfg.digits)} (#${p.ticket}) · Trade cannot lose!`, 'trade');
        }

        // Tier-2 Profit Shield Lock: when trade reaches 75% of target, lock 50% profit
        const targetPts = Math.abs(p.tp - p.price_open);
        if (this.autoBeEnabled && !trailLocked && targetPts > 0 && pts >= targetPts * 0.75) {
          trailLocked = true;
          const lockedProfitPts = targetPts * 0.5;
          currentSl = Number((p.type === 'BUY' ? p.price_open + lockedProfitPts : p.price_open - lockedProfitPts).toFixed(cfg.digits));
          this.slog(`🎯 TIER-2 PROFIT SHIELD: Locked $${profit.toFixed(2)} profit floor (#${p.ticket})!`, 'trade');
        }

        // Check SL / TP
        if (p.type === 'BUY') {
          if (curPrice <= currentSl) toClose.push({ ticket: p.ticket, reason: 'SL' });
          else if (curPrice >= p.tp) toClose.push({ ticket: p.ticket, reason: 'TP' });
        } else {
          if (curPrice >= currentSl) toClose.push({ ticket: p.ticket, reason: 'SL' });
          else if (curPrice <= p.tp) toClose.push({ ticket: p.ticket, reason: 'TP' });
        }

        return { ...p, sl: currentSl, beLocked, trailLocked, profit, pips };
      });

      // Safely close positions outside the map loop
      if (toClose.length > 0) {
        for (const item of toClose) {
          this.closePosition(item.ticket, item.reason);
        }
      }

      // Automatic basket protection: compound profit target (+15%) or drawdown cap (-12%)
      if (this.positions.length > 0) {
        const targetBasketTp = Math.max(1.50, this.account.balance * 0.15);
        const targetBasketSl = -Math.max(1.20, this.account.balance * 0.12);
        const currentNetPnl = this.positions.reduce((sum, p) => sum + p.profit, 0);

        if (currentNetPnl >= targetBasketTp) {
          this.slog(`🎯 Desired Profit Target Hit (+${currentNetPnl.toFixed(2)} USD). Auto-closing all positions!`, 'trade');
          this.closeAll('TP');
        } else if (currentNetPnl <= targetBasketSl) {
          this.slog(`🛡️ Account Drawdown Protection Hit (${currentNetPnl.toFixed(2)} USD). Auto-closing all positions!`, 'warn');
          this.closeAll('SL');
        }
      }
    }

    // Recalculate floating PnL after any closes
    const currentFloatingPnl = this.positions.reduce((sum, p) => sum + p.profit, 0);
    this.account.equity = Number((this.account.balance + currentFloatingPnl).toFixed(2));
    this.refreshDailyRiskState();

    // Invalidate ticker cache and emit
    this.invalidateTicker();
    this.invalidatePositions();
    this.emit('ticker');
    this.emit('positions');

    // Periodically re-evaluate market dynamics on live tick progression
    this.tickCount++;
    if (this.tickCount % 2 === 0) {
      this.refreshScanner();
    }
    if (this.tickCount % 6 === 0) {
      this.invalidateMarket();
      this.emit('market');
    }
  }

  // Advances the market wave across realistic SMC regimes (Bullish Demand -> Bearish Supply Sweep -> Reversal)
  cycleMarketWave() {
    const waves = [
      {
        scenarioId: 'london_bullish_fvg',
        bid: 4188.50,
        msg: 'Bullish Demand Tap in Discount dealing range (<50% EQ). Buyer absorption confirmed.',
      },
      {
        scenarioId: 'ny_bearish_choch',
        bid: 4202.40,
        msg: 'Bearish Liquidity Sweep of swing high into Premium Supply. Seller rejection confirmed.',
      },
      {
        scenarioId: 'asia_range_sweep',
        bid: 4182.20,
        msg: 'Liquidity Grab below Asian session low into virgin unmitigated Demand OB.',
      },
    ];

    const currentIdx = waves.findIndex((w) => w.scenarioId === this.currentScenario);
    const nextIdx = (currentIdx + 1) % waves.length;
    const wave = waves[nextIdx];

    this.resetWithScenario(wave.scenarioId);
    this.bid = wave.bid;
    this.ask = Number((wave.bid + 0.18).toFixed(2));
    this.spread = 18;

    this.slog(`Market Wave: ${wave.msg}`, 'signal');

    this.invalidateMarket();
    this.invalidateTicker();
    this.emit('market');
    this.emit('ticker');

    // If AUTO is ON, automatically evaluate and execute the newly discovered perfect entry
    if (this.autoTrade && !this.killSwitch) {
      setTimeout(() => this.evaluateAutoExecution(), 400);
    }
  }

  async evaluateAutoExecution() {
    if (!this.autoTrade || this.killSwitch) return;

    // Real market hours check: Gold interbank trading is closed on weekends!
    const schedule = getGoldMarketSchedule();
    if (this.instrumentType === 'standard' && !schedule.isOpen && !this.simulateWeekendMode) {
      return;
    }

    const market = this.getMarketSnapshot();
    const minConfluence = this.minScoreThreshold / 20;
    const sig = market.signals.find((candidate) =>
      candidate.score >= (candidate.strategy === 'SMC POI Retest' ? minConfluence : 3.8)
    );
    if (sig) {
      if (!market.brokerMarketData) {
        this.slog('Auto-trade blocked: live MT5 broker candle feed is unavailable.', 'warn');
        return;
      }
      if (this.getEntryBlockReason(sig.direction, sig)) return;
      const volume = this.getRiskBasedVolume(sig.sl);
      if (!volume) {
        this.slog('Auto-trade blocked: broker symbol tick-value/volume specification cannot size this stop safely.', 'error');
        return;
      }

      const rationale = buildSignalRationale(sig);
      this.slog(`Auto-Trader approved: ${this.activeSymbol} ${sig.timeframe} ${sig.direction} score ${sig.score} · ${rationale}`, 'signal');
      if (this.mt5Account.connected) {
        if (!mt5Bridge.getStatus().connected) {
          this.slog('MT5 auto-order blocked: local bridge is offline.', 'error');
          return;
        }
        try {
          const config = getInstrumentConfig(this.activeSymbol);
          const result = await mt5Bridge.sendTrade({
            direction: sig.direction,
            volume,
            symbol: mt5Bridge.getSymbol() || this.activeSymbol,
            sl: sig.sl,
            tp: sig.tp,
            rationale,
            clientOrderId: `${sig.strategy}:${sig.timeframe}:${sig.direction}:${sig.timestamp}:${sig.entry.toFixed(8)}`,
            poiKey: this.getSignalPoiKey(sig.direction, sig.entry),
            instrumentType: this.instrumentType,
            signalTimeframe: sig.timeframe === 'M1' ? 'M1' : 'M5',
            signalTimestamp: sig.timestamp,
            magic: config.magicNumber,
          });
          this.recordMt5Rationale(
            result.ticket,
            result.positionTicket,
            rationale,
            findCorrespondingOrderBlock(sig.direction, sig.entry, market.zones)
          );
          this.recordAcceptedEntry(sig.direction, sig);
          this.slog(
            result.pending
              ? `MT5 auto-order placed but not confirmed filled: #${result.ticket} · ${result.filledVolume} lots reported. Verify it in MT5.`
              : result.partial
              ? `MT5 auto-order partially filled: ${sig.direction} ${result.filledVolume} lots · #${result.ticket}. Verify remaining quantity.`
              : `MT5 auto-order accepted: ${sig.direction} ${result.filledVolume} lots on ${sig.timeframe} score ${sig.score} · #${result.ticket}`,
            result.pending || result.partial ? 'warn' : 'trade'
          );
        } catch (error) {
          this.slog(`MT5 auto-order rejected: ${error instanceof Error ? error.message : 'Unknown bridge error'}`, 'error');
        }
        return;
      }
      this.sendMarket(
        sig.direction,
        volume,
        sig.sl,
        sig.tp,
        `auto:${sig.score}`
      );
    }
  }

  sendMarket(
    direction: TradeDirection,
    volume: number,
    sl: number,
    tp: number,
    comment: string = 'manual'
  ): { ok: boolean; ticket?: number; price?: number; error?: string } {
    if (this.killSwitch) {
      return { ok: false, error: 'Trading halted by Kill Switch' };
    }

    if (this.mt5Account.connected) {
      return {
        ok: false,
        error: 'MT5 is linked; use the confirmed SMC Signal Deck so orders are routed to the broker.',
      };
    }

    const market = this.getMarketSnapshot();
    const blockReason = this.getEntryBlockReason(direction, market.signal);
    if (blockReason) return { ok: false, error: blockReason };
    const riskVolume = this.getRiskBasedVolume(sl, volume);
    if (!riskVolume) {
      return { ok: false, error: 'Position size is below broker minimum or cannot be calculated from valid risk specifications.' };
    }

    const openPrice = direction === 'BUY' ? this.ask : this.bid;
    const ticket = ++this.ticketCounter;
    const rationale = market.signal
      ? buildSignalRationale(market.signal)
      :
      (direction === 'BUY'
        ? 'Liquidity sweep into M5 Bullish Order Block (+OB) in Discount zone (<50% EQ). Confirmed FVG displacement with 1:2.0 RR target.'
        : 'Liquidity sweep into M5 Bearish Order Block (-OB) in Premium zone (>50% EQ). Confirmed FVG displacement with 1:2.0 RR target.');

    const config = getInstrumentConfig(this.activeSymbol);
    const newPos: Position = {
      ticket,
      symbol: this.activeSymbol,
      time: new Date().toISOString().substr(11, 8),
      type: direction,
      volume: riskVolume,
      price_open: openPrice,
      sl: Number(sl.toFixed(config.digits)),
      tp: Number(tp.toFixed(config.digits)),
      profit: 0.0,
      pips: 0.0,
      magic: config.magicNumber,
      comment: `${this.activeSymbol}:${comment}`,
      strategyRationale: rationale,
      strategyOrderBlock: findCorrespondingOrderBlock(
        direction,
        market.signal?.entry ?? openPrice,
        market.zones
      ),
    };

    this.positions = [...this.positions, newPos];
    this.selectedTicket = ticket; // Automatically focus the newly entered trade on the chart!
    this.recordAcceptedEntry(direction, market.signal);
    this.slog(`${this.activeSymbol} ${comment} ${direction} ${riskVolume} @ ${openPrice} -> #${ticket}`, 'trade');

    this.invalidatePositions();
    this.invalidateTicker();
    this.emit('positions');
    this.emit('ticker');

    return { ok: true, ticket, price: openPrice };
  }

  closePosition(ticket: number, reason: 'TP' | 'SL' | 'Manual' | 'KillSwitch' = 'Manual') {
    const pos = this.positions.find((p) => p.ticket === ticket);
    if (!pos) return;

    if (this.mt5Account.connected) {
      if (!mt5Bridge.getStatus().connected) {
        this.slog(`Unable to close MT5 position #${ticket}: bridge is offline.`, 'error');
        return;
      }
      void mt5Bridge.closePosition(ticket).catch((error: unknown) => {
        this.slog(
          `Unable to close MT5 position #${ticket}: ${error instanceof Error ? error.message : 'Unknown bridge error'}`,
          'error'
        );
      });
      return;
    }

    const posSym = (pos.symbol || this.activeSymbol) as SupportedSymbol;
    const cfg = getInstrumentConfig(posSym);
    const closePrice = pos.type === 'BUY' ? this.bid : this.ask;
    const pts = pos.type === 'BUY' ? closePrice - pos.price_open : pos.price_open - closePrice;
    const pips = Number((pts / cfg.pipSize).toFixed(1));
    let profit = 0;
    if (cfg.category === 'metals') {
      profit = Number((pts * pos.volume * cfg.contractSize).toFixed(2));
    } else if (posSym === 'USDJPY') {
      profit = Number(((pts * pos.volume * cfg.contractSize) / Math.max(1, closePrice)).toFixed(2));
    } else {
      profit = Number((pts * pos.volume * cfg.contractSize).toFixed(2));
    }

    const closedAt = new Date();
    const closed: ClosedTrade = {
      ticket: pos.ticket,
      symbol: posSym,
      openTime: pos.time,
      closeTime: closedAt.toISOString().substr(11, 8),
      closedAt: closedAt.toISOString(),
      type: pos.type,
      volume: pos.volume,
      openPrice: pos.price_open,
      closePrice,
      profit,
      pips,
      reason,
      comment: pos.comment,
      strategyRationale: pos.strategyRationale || `${posSym} ${pos.type} SMC Order Block & Liquidity Pool confluence`,
      strategyOrderBlock: pos.strategyOrderBlock,
    };

    this.positions = this.positions.filter((p) => p.ticket !== ticket);
    if (this.selectedTicket === ticket) this.selectedTicket = this.positions[0]?.ticket ?? null;
    // ClosedTrades order must be preserved (Priority 15)
    this.closedTrades = [closed, ...this.closedTrades];
    persistClosedTrades(this.closedTrades);
    this.account.balance = Number((this.account.balance + profit).toFixed(2));
    const remainingFloatingPnl = this.positions.reduce((sum, p) => sum + p.profit, 0);
    this.account.equity = Number((this.account.balance + remainingFloatingPnl).toFixed(2));

    this.slog(`Closed #${ticket} (${reason}) PnL: ${profit >= 0 ? '+' : ''}$${profit} USD | Balance: $${this.account.balance.toFixed(2)}`, 'trade');

    try {
      if (profit >= 0) {
        signalAudioNotifier.playProfitAlert(profit);
      } else {
        signalAudioNotifier.playLossAlert(profit);
      }
    } catch {
      // ignore
    }

    this.invalidatePositions();
    this.invalidateTicker();
    this.invalidateEngine();
    this.emit('positions');
    this.emit('ticker');
    this.emit('engine');
  }

  modifyPositionStops(ticket: number, sl: number, tp: number) {
    const position = this.positions.find((item) => item.ticket === ticket);
    if (!position) return;

    if (this.mt5Account.connected) {
      if (!mt5Bridge.getStatus().connected) {
        this.slog(`Unable to update MT5 position #${ticket}: bridge is offline.`, 'error');
        return;
      }
      void mt5Bridge.modifyPositionStops(ticket, sl, tp).catch((error: unknown) => {
        this.slog(
          `Unable to update MT5 position #${ticket}: ${error instanceof Error ? error.message : 'Unknown bridge error'}`,
          'error'
        );
      });
      return;
    }

    position.sl = sl;
    position.tp = tp;
    position.beLocked = position.type === 'BUY' ? sl > position.price_open : sl < position.price_open;
    if (position.beLocked) {
      try {
        signalAudioNotifier.playBreakEvenAlert();
      } catch {
        // ignore
      }
    }
    this.slog(`Stops updated for position #${ticket}: SL $${sl.toFixed(2)}, TP $${tp.toFixed(2)}`, 'trade');
    this.notify();
  }

  closeAll(reason: 'Manual' | 'KillSwitch' | 'TP' | 'SL' = 'Manual') {
    if (this.positions.length === 0) return;
    const tickets = this.positions.map((p) => p.ticket);
    for (const t of tickets) {
      this.closePosition(t, reason);
    }
  }

  toggleKillSwitch(): boolean {
    this.killSwitch = !this.killSwitch;
    if (this.killSwitch) {
      this.autoTrade = false;
      this.closeAll('KillSwitch');
      this.slog(
        this.mt5Account.connected
          ? 'KILL SWITCH ARMED: MT5 close requests sent; verify broker positions. Auto-trade halted.'
          : 'KILL SWITCH ARMED: All positions closed, auto-trade halted',
        'warn'
      );
    } else {
      this.slog('KILL SWITCH DISARMED: Engine ready', 'info');
    }
    if (this.mt5Account.connected) {
      this.pendingCentralKillSwitch = this.killSwitch;
      void mt5Bridge.setTradingHalted(this.killSwitch).catch((error: unknown) => {
        this.pendingCentralKillSwitch = null;
        this.slog(
          `Central kill-switch update failed: ${error instanceof Error ? error.message : 'Unknown bridge error'}`,
          'error'
        );
      });
    }

    this.invalidateEngine();
    this.emit('engine');
    return this.killSwitch;
  }

  toggleAutoTrade(): boolean {
    if (this.killSwitch) {
      this.slog('Cannot enable auto-trade while Kill Switch is armed', 'error');
      return false;
    }
    this.autoTrade = !this.autoTrade;
    this.slog(`AUTO-TRADE ${this.autoTrade ? 'ON' : 'OFF'}`, 'info');

    if (this.mt5Account.connected) {
      const requestedAutoTrade = this.autoTrade;
      this.pendingCentralAutoTrade = requestedAutoTrade;
      void mt5Bridge.setAutoTrade(this.autoTrade).catch((error: unknown) => {
        if (this.pendingCentralAutoTrade !== requestedAutoTrade) return;
        this.pendingCentralAutoTrade = null;
        this.slog(
          `Failed to update auto-trade state on server: ${error instanceof Error ? error.message : 'Unknown bridge error'}`,
          'error'
        );
        // Revert the local change if the server update failed
        this.autoTrade = !requestedAutoTrade;
        this.slog(`AUTO-TRADE ${this.autoTrade ? 'ON' : 'OFF'} (reverted due to server error)`, 'warn');
        this.invalidateEngine();
        this.emit('engine');
      });
    }

    this.invalidateEngine();
    this.emit('engine');
    return this.autoTrade;
  }

  toggleNewsBlackout(): boolean {
    this.newsBlackout = !this.newsBlackout;
    this.slog(`NEWS BLACKOUT ${this.newsBlackout ? 'ENABLED' : 'DISABLED'}`, 'info');
    this.invalidateEngine();
    this.emit('engine');
    return this.newsBlackout;
  }

  notify() {
    this.invalidateTicker();
    this.invalidateMarket();
    this.invalidatePositions();
    this.invalidateEngine();
    this.emit('ticker');
    this.emit('market');
    this.emit('positions');
    this.emit('engine');
  }

  tradeSignal(
    optionsOrVolume?:
      | {
          direction?: TradeDirection;
          volume?: number;
          entry?: number;
          sl?: number;
          tp?: number;
          comment?: string;
        }
      | number
  ): { ok: boolean; error?: string; ticket?: number; price?: number } {
    const config = getInstrumentConfig(this.activeSymbol);
    const market = this.getMarketSnapshot();
    const defaultSig = market.signal;
    const defaultVol = 0.01;

    let direction: TradeDirection = defaultSig?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
    let vol = defaultVol;
    let sl = defaultSig ? defaultSig.sl : (direction === 'BUY' ? this.bid - config.pipSize * 20 : this.bid + config.pipSize * 20);
    let tp = defaultSig ? defaultSig.tp : (direction === 'BUY' ? this.bid + config.pipSize * 40 : this.bid - config.pipSize * 40);
    let comment = defaultSig ? `signal:${defaultSig.score}` : 'manual';

    if (typeof optionsOrVolume === 'number') {
      if (optionsOrVolume > 0) vol = optionsOrVolume;
    } else if (optionsOrVolume && typeof optionsOrVolume === 'object') {
      if (optionsOrVolume.direction) direction = optionsOrVolume.direction;
      if (optionsOrVolume.volume && optionsOrVolume.volume > 0) vol = optionsOrVolume.volume;
      if (optionsOrVolume.sl !== undefined) sl = optionsOrVolume.sl;
      if (optionsOrVolume.tp !== undefined) tp = optionsOrVolume.tp;
      if (optionsOrVolume.comment) comment = optionsOrVolume.comment;
    }

    return this.sendMarket(
      direction,
      vol,
      Number(sl.toFixed(config.digits)),
      Number(tp.toFixed(config.digits)),
      comment
    );
  }

  tradeMultiplePositions(
    count: number,
    optionsOrVolume?:
      | {
          direction?: TradeDirection;
          volume?: number;
          entry?: number;
          sl?: number;
          tp?: number;
          comment?: string;
        }
      | number
  ): { countOpened: number; tickets: number[] } {
    const openedTickets: number[] = [];
    const n = Math.max(1, Math.min(10, count || 1));

    for (let i = 0; i < n; i++) {
      const res = this.tradeSignal(
        typeof optionsOrVolume === 'object' && optionsOrVolume
          ? { ...optionsOrVolume, comment: `${optionsOrVolume.comment || 'stack'}_${i + 1}` }
          : optionsOrVolume
      );
      if (res.ok && res.ticket) {
        openedTickets.push(res.ticket);
      }
    }

    if (openedTickets.length > 0) {
      this.slog(`⚡ High-Impact Position Stacking: Successfully opened ${openedTickets.length}x positions (#${openedTickets.join(', #')})`, 'trade');
    }

    return { countOpened: openedTickets.length, tickets: openedTickets };
  }
}

// ==========================================
// HMR-SAFE SINGLETON (Priority 5, Item 13)
// ==========================================
const GLOBAL_ENGINE_KEY = '__SMC_TRADING_ENGINE_SINGLETON__';

declare global {
  var __SMC_TRADING_ENGINE_SINGLETON__: TradingEngine | undefined;
}

export const tradingEngine: TradingEngine =
  (typeof window !== 'undefined' && (window as any)[GLOBAL_ENGINE_KEY]) ||
  new TradingEngine();

if (typeof window !== 'undefined') {
  (window as any)[GLOBAL_ENGINE_KEY] = tradingEngine;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Preserve state across hot reloads without creating duplicate intervals
    tradingEngine.stopEngineLoops();
  });
}
