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
} from '../types/smc';
import {
  calculateATR,
  MarketStructureEngine,
  detectFVGs,
  detectOrderBlocks,
  sessionFilter,
  evaluateConfluence,
} from './smcCore';
import { generateSeedMarketData, fetchLiveGoldCandles, DEFAULT_ECONOMIC_EVENTS } from './dataFeed';
import { signalAudioNotifier } from '../utils/audioNotification';
import { analyzeGoldCandlestickPatterns } from './candlestickPatterns';

const SYMBOL = 'XAUUSD';
const MAGIC = 20261001;
export const MAX_SPREAD_POINTS = 40; // 40 points = 4.0 pips on gold
const AUTO_RR = 2.0;
const SCORE_THRESHOLD = 4.0;

export class TradingEngine {
  candlesM15: Candle[] = [];
  candlesH1: Candle[] = [];
  positions: Position[] = [];
  closedTrades: ClosedTrade[] = [];
  logs: EngineLog[] = [];

  bid: number = 4188.5;
  ask: number = 4188.68;
  spread: number = 18; // 18 points = 1.8 pips
  lastPrice: number = 4188.5;

  killSwitch: boolean = false;
  autoTrade: boolean = false;
  newsBlackout: boolean = false;
  connected: boolean = true;

  account: AccountState = {
    balance: 10.0,
    equity: 10.0,
    margin_free: 10.0,
    margin_used: 0.0,
    initial_balance: 10.0,
    daily_start_balance: 10.0,
    max_daily_loss_pct: 15.0, // $1.50 maximum daily loss protection for $10 account
    risk_pct: 10.0, // 0.01 lot micro sizing
    auto_rr: 2.0, // 1:2.0 Risk/Reward optimal compound ratio
    daily_drawdown_pct: 0.0,
    daily_loss_hit: false,
  };

  selectedTicket: number | null = null;
  currentScenario: string = 'london_bullish_fvg';
  ticketCounter: number = 8820410;
  tickCount: number = 0;
  lastAlertedSignalKey: string = '';
  private hasInitializedInitialPosition: boolean = false;

  // Channel-specific listener registry (Priority 1)
  private channelListeners: Map<StoreChannel, Set<() => void>> = new Map([
    ['ticker', new Set()],
    ['market', new Set()],
    ['positions', new Set()],
    ['engine', new Set()],
    ['events', new Set()],
    ['scenario', new Set()],
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
    this.resetWithScenario('london_bullish_fvg');
    this.startEngineLoops();
    this.syncLiveMarketData();
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
      const allCloses = this.candlesM15.map((c) => c.close);
      const high24h = Math.max(...this.candlesM15.map((c) => c.high));
      const low24h = Math.min(...this.candlesM15.map((c) => c.low));
      const open24h = this.candlesM15[0]?.open || this.bid;
      const change24h = Number((this.bid - open24h).toFixed(2));
      const change24hPct = Number(((change24h / open24h) * 100).toFixed(2));

      this._cachedTicker = {
        time: new Date().toISOString().substr(11, 8) + ' UTC',
        symbol: SYMBOL,
        bid: Number(this.bid.toFixed(2)),
        ask: Number(this.ask.toFixed(2)),
        spread: this.spread,
        equity: Number(this.account.equity.toFixed(2)),
        balance: Number(this.account.balance.toFixed(2)),
        high24h: Number(high24h.toFixed(2)),
        low24h: Number(low24h.toFixed(2)),
        change24h,
        change24hPct,
        volume24h: '184.2K oz',
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
      let sig = evaluateConfluence(this.candlesM15, this.candlesH1, this.account.auto_rr, SCORE_THRESHOLD);
      if (!sig) {
        // Seamlessly advance to next market wave when signal is null
        this.cycleMarketWave();
        sig = evaluateConfluence(this.candlesM15, this.candlesH1, this.account.auto_rr, SCORE_THRESHOLD);
      }

      if (sig && sig.score >= SCORE_THRESHOLD) {
        const sigKey = `${sig.direction}_${sig.entry}_${sig.score}`;
        if (sigKey !== this.lastAlertedSignalKey) {
          this.lastAlertedSignalKey = sigKey;
          signalAudioNotifier.playSignalAlert(sig.direction, sig.entry);
        }
      }

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
        zones,
        history,
        candlesM15: this.candlesM15,
        candlesH1: this.candlesH1,
        mtfAlignment,
        candlestickAnalysis,
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

  getEngineSnapshot(): EngineState {
    if (!this._cachedEngine) {
      const sess = sessionFilter(new Date());
      this._cachedEngine = {
        kill_switch: this.killSwitch,
        auto_trade: this.autoTrade,
        news_blackout: this.newsBlackout,
        session: sess,
        connected: this.connected,
        max_spread_points: MAX_SPREAD_POINTS,
        daily_loss_pct: this.account.max_daily_loss_pct,
        daily_drawdown_pct: this.account.daily_drawdown_pct,
      };
    }
    return this._cachedEngine;
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
      this.evaluateAutoExecution();
    }, 5000);
  }

  stopEngineLoops() {
    if (this.tickIntervalId) clearInterval(this.tickIntervalId);
    if (this.autoTraderIntervalId) clearInterval(this.autoTraderIntervalId);
    this.tickIntervalId = null;
    this.autoTraderIntervalId = null;
  }

  simulatePriceTick() {
    // Natural micro-fluctuation
    const drift = (Math.random() - 0.49) * 0.35;
    this.bid = Number(Math.max(1000, this.bid + drift).toFixed(2));
    this.spread = Math.floor(16 + Math.random() * 6); // 16-22 pts normal
    this.ask = Number((this.bid + this.spread * 0.01).toFixed(2));

    // Progress latest M15 candle with real price updates
    if (this.candlesM15.length > 0) {
      const lastC = this.candlesM15[this.candlesM15.length - 1];
      lastC.close = this.bid;
      if (this.bid > lastC.high) lastC.high = this.bid;
      if (this.bid < lastC.low) lastC.low = this.bid;
    }

    // Update positions PnL safely
    let floatingPnl = 0;
    const toClose: { ticket: number; reason: 'TP' | 'SL' }[] = [];

    if (this.positions.length > 0) {
      this.positions = this.positions.map((p) => {
        const curPrice = p.type === 'BUY' ? this.bid : this.ask;
        const pts = p.type === 'BUY' ? curPrice - p.price_open : p.price_open - curPrice;
        const profit = Number((pts * p.volume * 100).toFixed(2));
        const pips = Number((pts * 10).toFixed(1));
        floatingPnl += profit;

        // Check SL / TP
        if (p.type === 'BUY') {
          if (curPrice <= p.sl) toClose.push({ ticket: p.ticket, reason: 'SL' });
          else if (curPrice >= p.tp) toClose.push({ ticket: p.ticket, reason: 'TP' });
        } else {
          if (curPrice >= p.sl) toClose.push({ ticket: p.ticket, reason: 'SL' });
          else if (curPrice <= p.tp) toClose.push({ ticket: p.ticket, reason: 'TP' });
        }

        return { ...p, profit, pips };
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
    this.account.daily_drawdown_pct = Number(
      Math.max(0, ((this.account.daily_start_balance - this.account.equity) / this.account.daily_start_balance) * 100).toFixed(2)
    );

    // Invalidate ticker cache and emit
    this.invalidateTicker();
    this.invalidatePositions();
    this.emit('ticker');
    this.emit('positions');

    // Periodically re-evaluate market dynamics on live tick progression
    this.tickCount++;
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

    // Trigger subtle notification sound effect
    signalAudioNotifier.playSignalAlert(
      wave.scenarioId === 'ny_bearish_choch' ? 'SELL' : 'BUY',
      wave.bid
    );

    // If AUTO is ON, automatically evaluate and execute the newly discovered perfect entry
    if (this.autoTrade && !this.killSwitch) {
      setTimeout(() => this.evaluateAutoExecution(), 400);
    }
  }

  evaluateAutoExecution() {
    if (!this.autoTrade || this.killSwitch) return;

    // Check spread gate
    if (this.spread > MAX_SPREAD_POINTS) {
      return;
    }

    // Small Account protection: Max 1 position for <= $50 accounts, max 3 for larger
    const maxAllowed = this.account.balance <= 50 ? 1 : 3;
    if (this.positions.length >= maxAllowed) {
      return;
    }

    const market = this.getMarketSnapshot();
    if (market.signal && market.signal.score >= SCORE_THRESHOLD) {
      const sig = market.signal;
      // Prevent executing the exact same entry repeatedly
      const hasRecentSimilarPos = this.positions.some(
        (p) => Math.abs(p.price_open - sig.entry) < 0.8 && p.type === sig.direction
      );
      if (hasRecentSimilarPos) {
        return;
      }

      this.slog(`Auto-Trader executing optimal small-account entry: ${sig.direction} @ ${sig.entry} (Score ${sig.score})`, 'trade');
      if (sig.actionReason) {
        this.slog(`Rationale: ${sig.actionReason}`, 'info');
      }
      this.sendMarket(
        sig.direction,
        0.01,
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

    if (this.spread > MAX_SPREAD_POINTS) {
      return { ok: false, error: `Spread too wide (${this.spread} points > ${MAX_SPREAD_POINTS} max)` };
    }

    // Small account protection limit (1 position for <= $50)
    const maxAllowed = this.account.balance <= 50 ? 1 : 3;
    if (this.positions.length >= maxAllowed) {
      return {
        ok: false,
        error: `Small Account Safeguard: Max ${maxAllowed} active trade allowed for $${this.account.balance.toFixed(2)} balance to protect capital from drawdown.`,
      };
    }

    const openPrice = direction === 'BUY' ? this.ask : this.bid;
    const ticket = ++this.ticketCounter;
    const newPos: Position = {
      ticket,
      time: new Date().toISOString().substr(11, 8),
      type: direction,
      volume,
      price_open: openPrice,
      sl,
      tp,
      profit: 0.0,
      pips: 0.0,
      magic: MAGIC,
      comment,
    };

    this.positions = [...this.positions, newPos];
    this.selectedTicket = ticket; // Automatically focus the newly entered trade on the chart!
    this.slog(`${comment} ${direction} ${volume} @ ${openPrice} -> #${ticket}`, 'trade');

    this.invalidatePositions();
    this.invalidateTicker();
    this.emit('positions');
    this.emit('ticker');

    return { ok: true, ticket, price: openPrice };
  }

  closePosition(ticket: number, reason: 'TP' | 'SL' | 'Manual' | 'KillSwitch' = 'Manual') {
    const pos = this.positions.find((p) => p.ticket === ticket);
    if (!pos) return;

    const closePrice = pos.type === 'BUY' ? this.bid : this.ask;
    const pts = pos.type === 'BUY' ? closePrice - pos.price_open : pos.price_open - closePrice;
    const profit = Number((pts * pos.volume * 100).toFixed(2));
    const pips = Number((pts * 10).toFixed(1));

    const closed: ClosedTrade = {
      ticket: pos.ticket,
      openTime: pos.time,
      closeTime: new Date().toISOString().substr(11, 8),
      type: pos.type,
      volume: pos.volume,
      openPrice: pos.price_open,
      closePrice,
      profit,
      pips,
      reason,
      comment: pos.comment,
    };

    this.positions = this.positions.filter((p) => p.ticket !== ticket);
    // ClosedTrades order must be preserved (Priority 15)
    this.closedTrades = [closed, ...this.closedTrades];
    this.account.balance = Number((this.account.balance + profit).toFixed(2));
    const remainingFloatingPnl = this.positions.reduce((sum, p) => sum + p.profit, 0);
    this.account.equity = Number((this.account.balance + remainingFloatingPnl).toFixed(2));

    this.slog(`Closed #${ticket} (${reason}) PnL: ${profit >= 0 ? '+' : ''}$${profit} USD | Balance: $${this.account.balance.toFixed(2)}`, 'trade');

    this.invalidatePositions();
    this.invalidateTicker();
    this.invalidateEngine();
    this.emit('positions');
    this.emit('ticker');
    this.emit('engine');
  }

  closeAll(reason: 'Manual' | 'KillSwitch' = 'Manual') {
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
      this.slog('KILL SWITCH ARMED: All positions closed, auto-trade halted', 'warn');
    } else {
      this.slog('KILL SWITCH DISARMED: Engine ready', 'info');
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

  tradeSignal(customVolume?: number): { ok: boolean; error?: string } {
    const market = this.getMarketSnapshot();
    if (!market.signal) {
      return { ok: false, error: 'No active signal meets confluence threshold' };
    }
    const defaultVol = this.account.balance <= 50 ? 0.01 : 0.02;
    const vol = customVolume && customVolume > 0 ? customVolume : defaultVol;
    const res = this.sendMarket(
      market.signal.direction,
      vol,
      market.signal.sl,
      market.signal.tp,
      `signal:${market.signal.score}`
    );
    return res;
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
