/**
 * tradingEngine.test.ts - Unit tests for TradingEngine store (Priority 5, Item 15)
 * Verifies:
 * (a) same-data snapshot returns identical reference
 * (b) channel subscribers fire only for their channel
 * (c) closedTrades appends preserve order
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradingEngine, getDefaultSymbolSpec } from './tradingEngine';
import { Candle } from '../types/smc';
import { calculateRiskBasedVolume } from './riskConfig';
import { mt5Bridge } from './mt5Bridge';

describe('risk-based position sizing', () => {
  it('sizes a known XAU-style contract from equity, stop, tick value, and broker lot step', () => {
    const size = calculateRiskBasedVolume(10_000, 0.5, 1, {
      tickSize: 0.01,
      tickValue: 1,
      contractSize: 100,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
    });

    expect(size).toBe(0.5);
  });

  it('rejects invalid specs and risk amounts below the broker minimum volume', () => {
    const spec = {
      tickSize: 0.01,
      tickValue: 1,
      contractSize: 100,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
    };

    expect(calculateRiskBasedVolume(1, 0.5, 100, spec)).toBeNull();
    expect(calculateRiskBasedVolume(10_000, 0.5, 0, spec)).toBeNull();
  });

  it('sizes a buy from the live ask and reports broker-minimum risk against the budget', () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.activeSymbol = 'XAUUSD';
    engine.account.equity = 1_000;
    engine.account.risk_pct = 0.5;
    engine.bid = 100;
    engine.ask = 101;
    (engine as any).symbolSpec = {
      tickSize: 0.01,
      tickValue: 1,
      contractSize: 100,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
    };

    const info = engine.getRiskSizingInfo(100, 'BUY');
    const volume = engine.getRiskBasedVolume(100, 0.05, 'BUY');

    expect(info).toEqual({
      riskPercent: 0.5,
      riskBudget: 5,
      minimumLot: 0.01,
      minimumLotRisk: 1,
      safeVolume: 0.05,
    });
    expect(volume).toBe(0.05);
  });

  it('reports when broker minimum lot risk exceeds the account budget', () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.activeSymbol = 'XAUUSD';
    engine.account.equity = 50;
    engine.account.risk_pct = 0.5;
    engine.bid = 100;
    engine.ask = 101;
    (engine as any).symbolSpec = {
      tickSize: 0.01,
      tickValue: 1,
      contractSize: 100,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
    };

    expect(engine.getRiskSizingInfo(100, 'BUY')).toEqual({
      riskPercent: 0.5,
      riskBudget: 0.25,
      minimumLot: 0.01,
      minimumLotRisk: 1,
      safeVolume: null,
    });
    expect(engine.getRiskBasedVolume(100, 0.01, 'BUY')).toBeNull();
  });
});

describe('broker-only signal availability', () => {
  it('does not scan cached candles while the verified bridge is disconnected', () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.connected = false;
    engine.mt5Account.connected = false;
    engine.pairData.XAUUSD = {
      candlesM1: candles(80, 60_000),
      candlesM5: candles(80, 5 * 60_000),
      candlesM15: candles(80, 15 * 60_000),
      candlesH1: candles(80, 60 * 60_000),
      bid: 2000,
      ask: 2000.1,
      spread: 10,
      marketDataAt: Date.now(),
      symbolSpec: getDefaultSymbolSpec('XAUUSD'),
    };

    engine.refreshScanner();

    expect(engine.getScannerAnalyses()).toEqual([]);
    expect(engine.getBestOpportunity()).toBeNull();
  });

  it('refreshes the scanner after failed pair-data requests so stale analyses are rechecked', async () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.connected = true;
    engine.mt5Account.connected = true;
    const refreshScanner = vi.spyOn(engine, 'refreshScanner');
    vi.spyOn(mt5Bridge, 'getStatus').mockReturnValue({
      ...mt5Bridge.getStatus(),
      connected: true,
    });
    vi.spyOn(mt5Bridge, 'fetchSymbolSnapshot').mockRejectedValue(new Error('broker unavailable'));

    await (engine as any).refreshBrokerPairData();

    expect(refreshScanner).toHaveBeenCalledOnce();
    engine.stopEngineLoops();
    vi.restoreAllMocks();
  });
});

describe('scanner signals in the active signal engine', () => {
  it('surfaces the active pair scanner candidate and preserves its 0-10 score scale', () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.activeSymbol = 'EURUSD';
    engine.candlesM1 = candles(80, 60_000);
    engine.candlesM5 = candles(80, 5 * 60_000);
    const signal = {
      strategy: 'SMC POI Retest' as const,
      direction: 'BUY' as const,
      timeframe: 'M5' as const,
      score: 6.5,
      entry: 1.1,
      sl: 1.099,
      tp: 1.103,
      timestamp: new Date().toISOString(),
      expiryTimestamp: Date.now() + 60_000,
      reasons: ['Scanner confluence 65/100'],
      atr: 0.001,
    };
    engine.scannerAnalyses = [{
      symbol: 'EURUSD',
      status: 'READY',
      signal,
      expiryTimestamp: signal.expiryTimestamp,
      confluenceScore: 65,
      rejectionReason: null,
    } as any];

    const market = engine.getMarketSnapshot();

    expect(market.signals).toContainEqual(expect.objectContaining({
      direction: 'BUY',
      score: 6.5,
      timestamp: signal.timestamp,
    }));
  });

  it('keeps a visible non-ready scanner candidate from being executed', () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.activeSymbol = 'EURUSD';
    engine.candlesM1 = candles(80, 60_000);
    engine.candlesM5 = candles(80, 5 * 60_000);
    const signal = {
      strategy: 'SMC POI Retest' as const,
      direction: 'BUY' as const,
      timeframe: 'M5' as const,
      score: 5.5,
      entry: 1.1,
      sl: 1.099,
      tp: 1.103,
      timestamp: new Date().toISOString(),
      reasons: [],
      atr: 0.001,
    };
    engine.scannerAnalyses = [{
      symbol: 'EURUSD',
      status: 'BLOCKED',
      signal,
      confluenceScore: 55,
      rejectionReason: 'TRADE_REJECTED: NEWS_DATA_UNAVAILABLE',
    } as any];

    expect(engine.getMarketSnapshot().signals).toContainEqual(
      expect.objectContaining({ timestamp: signal.timestamp, score: 5.5 })
    );
    expect(engine.getEntryBlockReason('BUY', signal, Date.now(), true, 'EURUSD')).toBe(
      'TRADE_REJECTED: NEWS_DATA_UNAVAILABLE'
    );
  });

  it('keeps technical-signal execution behind live economic-calendar availability', () => {
    const engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.mt5Account.connected = true;
    const signal = {
      strategy: 'Trend Pullback' as const,
      direction: 'BUY' as const,
      timeframe: 'M5' as const,
      score: 6.8,
      entry: 1.1,
      sl: 1.099,
      tp: 1.103,
      timestamp: new Date().toISOString(),
      reasons: [],
      atr: 0.001,
    };

    expect(engine.getEntryBlockReason('BUY', signal, Date.now(), true, 'EURUSD')).toBe(
      'TRADE_REJECTED: NEWS_DATA_UNAVAILABLE'
    );
  });
});

const candles = (count: number, intervalMs: number): Candle[] =>
  Array.from({ length: count }, (_, index) => ({
    time: Date.now() - (count - index) * intervalMs,
    timeStr: '12:00',
    open: 2000,
    high: 2000.5,
    low: 1999.5,
    close: 2000.1,
    volume: 100,
  }));

const flatCandles = (count: number, intervalMs: number, breakout = false): Candle[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const isBreakout = breakout && index === count - 1;
    const close = isBreakout ? 103 : 100 + (index % 2 ? 0.02 : -0.02);
    return {
      time: now - (count - index) * intervalMs,
      timeStr: '12:00',
      open: isBreakout ? 100 : close - (index % 2 ? 0.01 : -0.01),
      high: isBreakout ? 103.2 : 100.2,
      low: isBreakout ? 99.9 : 99.8,
      close,
      volume: 100,
    };
  });
};

describe('final execution-boundary risk validation', () => {
  let engine: TradingEngine;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    engine = new TradingEngine();
    engine.stopEngineLoops();
    engine.bypassNewsBlackout = true;
    engine.mt5Account.connected = true;
    vi.spyOn(mt5Bridge, 'getStatus').mockReturnValue({
      connected: true, serverUrl: 'test', lastPing: null, lastError: null, mode: 'demo',
    });
    vi.spyOn(engine, 'getEntryBlockReason').mockReturnValue(null);
  });

  it('rejects 0.01 EURUSD when the requested stop risks $1.50 against a $0.46 budget', () => {
    engine.account.equity = 92;
    engine.account.risk_pct = 0.5;
    engine.activeSymbol = 'EURUSD';
    (engine as any).symbolSpec = getDefaultSymbolSpec('EURUSD');
    engine.bid = 1.10000;
    engine.ask = 1.10002;

    const result = engine.sendMarket('BUY', 0.01, 1.09852, 1.10302, 'manual');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK');
    expect(result.error).toContain('0.01L risks $1.50, budget: $0.46');
    expect(engine.positions).toHaveLength(0);
  });

  it('does not send an auto MT5 order when the selected signal stop exceeds the minimum-lot risk budget', async () => {
    engine.account.equity = 92;
    engine.account.risk_pct = 0.5;
    engine.activeSymbol = 'EURUSD';
    (engine as any).symbolSpec = getDefaultSymbolSpec('EURUSD');
    engine.bid = 1.10000;
    engine.ask = 1.10002;
    engine.instrumentType = 'synthetic';
    engine.autoTrade = true;
    vi.spyOn(mt5Bridge, 'getSymbol').mockReturnValue('EURUSD');
    const rejectedSignal = vi.spyOn(engine, 'recordRejectedSignal');
    const sendTrade = vi.spyOn(mt5Bridge, 'sendTrade').mockResolvedValue({
      ticket: 123, positionTicket: 123, price: 1.10002, filledVolume: 0.01,
    } as any);
    vi.spyOn(engine, 'getMarketSnapshot').mockReturnValue({
      brokerMarketData: true,
      zones: [],
      signals: [{
        direction: 'BUY', entry: 1.1, sl: 1.09852, tp: 1.10302,
        score: 80, strategy: 'SMC POI Retest', timeframe: 'M5', timestamp: new Date().toISOString(),
      }],
    } as any);

    await engine.evaluateAutoExecution();

    expect(sendTrade).not.toHaveBeenCalled();
    expect(rejectedSignal).toHaveBeenCalledWith(
      expect.objectContaining({ sl: 1.09852 }),
      expect.stringContaining('TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK'),
      'EURUSD'
    );
  });

  it('allows a qualifying 0-10 technical signal at the documented 6/10 threshold', async () => {
    engine.account.equity = 10_000;
    engine.account.risk_pct = 0.5;
    engine.activeSymbol = 'XAUUSD';
    engine.instrumentType = 'synthetic';
    engine.bid = 2000;
    engine.ask = 2000.1;
    (engine as any).symbolSpec = getDefaultSymbolSpec('XAUUSD');
    engine.autoTrade = true;
    vi.spyOn(mt5Bridge, 'getSymbol').mockReturnValue('XAUUSD');
    const sendTrade = vi.spyOn(mt5Bridge, 'sendTrade').mockResolvedValue({
      ok: true,
      ticket: 123,
      positionTicket: 123,
      price: 2000.1,
      filledVolume: 0.01,
      partial: false,
      pending: false,
    });
    const signal = {
      direction: 'BUY' as const,
      entry: 2000,
      sl: 1990,
      tp: 2032,
      score: 6.8,
      strategy: 'Trend Pullback' as const,
      timeframe: 'M5' as const,
      timestamp: new Date().toISOString(),
      expiryTimestamp: Date.now() + 60_000,
    };
    vi.spyOn(engine, 'getMarketSnapshot').mockReturnValue({
      brokerMarketData: true,
      zones: [],
      signals: [signal],
      signal,
    } as any);

    await engine.evaluateAutoExecution();

    expect(sendTrade).toHaveBeenCalledTimes(1);
  });

  it('uses the target symbol quote and requested stop rather than the active symbol spec', () => {
    engine.account.equity = 92;
    engine.account.risk_pct = 0.5;
    engine.activeSymbol = 'XAUUSD';
    engine.pairData.EURUSD.bid = 1.10000;
    engine.pairData.EURUSD.ask = 1.10002;

    const result = engine.sendMarket('BUY', 0.01, 1.09852, 1.10302, 'manual', 'EURUSD');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('TRADE_REJECTED: BROKER_SYMBOL_SPEC_UNAVAILABLE');
    expect(engine.positions).toHaveLength(0);
    expect(engine.activeSymbol).toBe('XAUUSD');
  });
});

describe('TradingEngine Store Architecture', () => {
  let engine: TradingEngine;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    engine = new TradingEngine();
    engine.mt5Account.connected = false;
    engine.stopEngineLoops(); // stop background loops during unit tests
    engine.bypassNewsBlackout = true;
  });

  it('(a) same-data snapshot returns identical referential reference', () => {
    const snap1 = engine.getTickerSnapshot();
    const snap2 = engine.getTickerSnapshot();

    // Must be identical object reference for useSyncExternalStore
    expect(snap1).toBe(snap2);

    const market1 = engine.getMarketSnapshot();
    const market2 = engine.getMarketSnapshot();
    expect(market1).toBe(market2);
  });

  it('(b) channel subscribers fire only for their channel', () => {
    let tickerFired = 0;
    let positionsFired = 0;
    let engineFired = 0;

    engine.on('ticker', () => {
      tickerFired++;
    });

    engine.on('positions', () => {
      positionsFired++;
    });

    engine.on('engine', () => {
      engineFired++;
    });

    // Fire a ticker price simulation
    engine.simulatePriceTick();
    expect(tickerFired).toBeGreaterThanOrEqual(1);
    expect(engineFired).toBe(0);

    // Toggle kill switch (engine channel)
    const prevPosFired = positionsFired;
    engine.toggleKillSwitch();
    expect(engineFired).toBe(1);
  });

  it('(c) closedTrades appends preserve order (newest first)', () => {
    // Open position 1
    engine.sendMarket('BUY', 0.05, 3830, 3850, 'test1');
    const pos1 = engine.positions[engine.positions.length - 1];
    const orderBlock = {
      kind: 'OB' as const,
      top: 3832,
      bottom: 3828,
      bullish: true,
      born: 12,
      filled: false,
      tests: 0,
    };
    engine.recordMt5Rationale(pos1.ticket, pos1.ticket, 'Confirmed bullish order-block retest.', orderBlock);
    engine.setSelectedTicket(pos1.ticket);
    expect(engine.getPositionsSnapshot().selectedTicket).toBe(pos1.ticket);
    expect(engine.positions.find((position) => position.ticket === pos1.ticket)?.strategyOrderBlock).toEqual(orderBlock);

    // Close position 1
    engine.closePosition(pos1.ticket, 'Manual');
    expect(engine.closedTrades.length).toBeGreaterThanOrEqual(1);
    const firstClosed = engine.closedTrades[0];
    expect(firstClosed.ticket).toBe(pos1.ticket);
    expect(firstClosed.strategyRationale).toBe('Confirmed bullish order-block retest.');
    expect(firstClosed.strategyOrderBlock).toEqual(orderBlock);

    // Open position 2
    engine.sendMarket('SELL', 0.1, 3850, 3830, 'test2');
    const pos2 = engine.positions[engine.positions.length - 1];

    // Close position 2
    engine.closePosition(pos2.ticket, 'TP');
    // Newest closed trade must be at index 0
    expect(engine.closedTrades[0].ticket).toBe(pos2.ticket);
    expect(engine.closedTrades[1].ticket).toBe(pos1.ticket);
  });

  it('publishes broker M1/M5 candles for the scalping chart and signal engine', () => {
    const candlesM1 = candles(100, 60_000);
    const candlesM5 = candles(100, 5 * 60_000);
    const candlesM15 = candles(100, 15 * 60_000);
    const candlesH1 = candles(100, 60 * 60_000);

    engine.syncMt5Snapshot({
      account: { login: 1, server: 'Demo', balance: 100, equity: 100, margin_free: 100 },
      positions: [],
      symbol: 'XAUUSD',
      bid: 2000,
      ask: 2000.2,
      spread: 20,
      accountMode: 'demo',
      tradingHalted: false,
      autoTrade: true,
      instrumentType: 'standard',
      symbolSpec: {
        point: 0.01,
        tickSize: 0.01,
        tickValue: 1,
        contractSize: 100,
        volumeMin: 0.01,
        volumeMax: 100,
        volumeStep: 0.01,
        tradeStopsLevel: 0,
        tradeFreezeLevel: 0,
      },
      candlesM1,
      candlesM5,
      candlesM15,
      candlesH1,
    });

    const market = engine.getMarketSnapshot();
    expect(market.brokerMarketData).toBe(true);
    expect(market.candlesM1).toBe(candlesM1);
    expect(market.candlesM5).toBe(candlesM5);
    expect(market.accountMode).toBe('demo');
    expect(engine.autoTrade).toBe(true);
  });

  it('generates ranked technical signals for a broker-named synthetic symbol', () => {
    engine.syncMt5Snapshot({
      account: { login: 1, server: 'Demo', balance: 10, equity: 10, margin_free: 10 },
      positions: [],
      symbol: 'Volatility 75 Index',
      bid: 100,
      ask: 100.1,
      spread: 1,
      accountMode: 'demo',
      tradingHalted: false,
      autoTrade: false,
      instrumentType: 'synthetic',
      symbolSpec: {
        point: 0.01,
        tickSize: 0.01,
        tickValue: 0.01,
        contractSize: 1,
        volumeMin: 0.01,
        volumeMax: 100,
        volumeStep: 0.01,
        tradeStopsLevel: 0,
        tradeFreezeLevel: 0,
      },
      candlesM1: flatCandles(80, 60_000, true),
      candlesM5: flatCandles(80, 5 * 60_000, true),
      candlesM15: flatCandles(80, 15 * 60_000),
      candlesH1: flatCandles(80, 60 * 60_000),
    });

    const market = engine.getMarketSnapshot();
    expect(market.instrumentType).toBe('synthetic');
    expect(market.signals.some((signal) => signal.strategy === 'Volatility Breakout')).toBe(true);
    expect(market.signal).toBe(market.signals[0]);
  });

  it('blocks entries at the exact daily loss threshold and during direction cooldown', () => {
    engine.account.daily_drawdown_pct = engine.account.max_daily_loss_pct;
    expect(engine.getEntryBlockReason('BUY', null)).toBe('Daily loss limit reached.');

    engine.account.daily_drawdown_pct = 0;
    engine.directionCooldownEnabled = true;
    engine.directionCooldownSeconds = 15;
    engine.recordAcceptedEntry('BUY', null);
    expect(engine.getEntryBlockReason('BUY', null)).toBe('Direction cooldown is active.');
  });

  it('allows high-confluence signal fallback override when daily limit is reached', () => {
    engine.account.balance = 1000;
    engine.account.equity = 1000;
    const today = new Date().toISOString();
    // Simulate 5 closed trades today
    engine.closedTrades = [
      { ticket: 1, type: 'BUY', volume: 0.01, openPrice: 2000, closePrice: 2005, sl: 1995, tp: 2010, profit: 5, pips: 50, closedAt: today, reason: 'TP' },
      { ticket: 2, type: 'BUY', volume: 0.01, openPrice: 2000, closePrice: 2005, sl: 1995, tp: 2010, profit: 5, pips: 50, closedAt: today, reason: 'TP' },
      { ticket: 3, type: 'BUY', volume: 0.01, openPrice: 2000, closePrice: 2005, sl: 1995, tp: 2010, profit: 5, pips: 50, closedAt: today, reason: 'TP' },
      { ticket: 4, type: 'BUY', volume: 0.01, openPrice: 2000, closePrice: 2005, sl: 1995, tp: 2010, profit: 5, pips: 50, closedAt: today, reason: 'TP' },
      { ticket: 5, type: 'BUY', volume: 0.01, openPrice: 2000, closePrice: 2005, sl: 1995, tp: 2010, profit: 5, pips: 50, closedAt: today, reason: 'TP' },
    ];

    const lowScoreSignal = {
      direction: 'BUY' as const,
      timeframe: 'M5' as const,
      score: 55,
      entry: 2000,
      sl: 1995,
      tp: 2005,
      reasons: ['Consolidation'],
      atr: 2.0,
      timestamp: new Date().toISOString(),
    };

    const highScoreSignal = {
      direction: 'BUY' as const,
      timeframe: 'M5' as const,
      score: 82,
      entry: 2000,
      sl: 1995,
      tp: 2015,
      reasons: ['HTF Order Block', 'Liquidity Sweep'],
      atr: 2.0,
      timestamp: new Date().toISOString(),
    };

    // Low score should be blocked by daily limit
    expect(engine.getEntryBlockReason('BUY', lowScoreSignal)).toContain('DAILY_TRADE_LIMIT_REACHED');

    // High score with allowHighConfluenceOverride should bypass daily limit
    engine.allowHighConfluenceOverride = true;
    expect(engine.getEntryBlockReason('BUY', highScoreSignal)).toBeNull();
  });

  it('auto-selects the best scenario when enabled', () => {
    engine.setAutoSelectBestScenario(true);
    expect(engine.autoSelectBestScenario).toBe(true);

    engine.setAutoSelectBestScenario(false);
    expect(engine.autoSelectBestScenario).toBe(false);
  });

  it('scales out 50% of paper volume and moves SL to breakeven + 2 points', async () => {
    engine.positions = [{
      ticket: 99,
      symbol: 'XAUUSD',
      time: '12:00',
      type: 'BUY',
      volume: 0.10,
      initialVolume: 0.10,
      price_open: 2000.0,
      sl: 1995.0,
      initialSl: 1995.0,
      tp: 2015.0,
      initialTp: 2015.0,
      profit: 0,
      pips: 0,
      magic: 10001,
      comment: 'test',
    }];
    engine.bid = 2007.5; // +7.5 pts = 1.5R on 5 pt risk
    engine.ask = 2007.7;

    const scaled = await engine.scaleOutPosition(99, 0.5);
    expect(scaled).toBe(true);

    const pos = engine.positions.find((p) => p.ticket === 99);
    expect(pos?.volume).toBe(0.05);
    expect(pos?.partialTaken).toBe(true);
    expect(pos?.beLocked).toBe(true);
    expect(pos?.sl).toBeGreaterThan(2000.0);
    expect(engine.closedTrades[0].reason).toBe('PARTIAL_TP');
    expect(engine.closedTrades[0].volume).toBe(0.05);
  });

  it('sends live scale-out volume to MT5 without optimistic local accounting', async () => {
    engine.activeSymbol = 'XAUUSD';
    engine.mt5Account.connected = true;
    (engine as any).symbolSpec = getDefaultSymbolSpec('XAUUSD');
    engine.bid = 2007.5;
    engine.ask = 2007.7;
    engine.positions = [{
      ticket: 99,
      brokerTicket: 99,
      symbol: 'XAUUSD',
      time: '12:00',
      type: 'BUY',
      volume: 0.10,
      price_open: 2000,
      sl: 1995,
      tp: 2015,
      profit: 0,
      pips: 0,
      magic: 10001,
      comment: 'test',
    }];
    vi.spyOn(mt5Bridge, 'getStatus').mockReturnValue({
      ...mt5Bridge.getStatus(),
      connected: true,
    });
    const closePosition = vi.spyOn(mt5Bridge, 'closePosition').mockResolvedValue();
    vi.spyOn(mt5Bridge, 'modifyPositionStops').mockResolvedValue();

    const scaled = await engine.scaleOutPosition(99, 0.5);

    expect(scaled).toBe(true);
    expect(closePosition).toHaveBeenCalledWith(99, 0.05);
    expect(engine.positions[0].volume).toBe(0.10);
    expect(engine.closedTrades).toHaveLength(0);
  });

  it('leaves live position state unchanged when the broker rejects a scale-out', async () => {
    engine.activeSymbol = 'XAUUSD';
    engine.mt5Account.connected = true;
    (engine as any).symbolSpec = getDefaultSymbolSpec('XAUUSD');
    engine.bid = 2007.5;
    engine.ask = 2007.7;
    engine.positions = [{
      ticket: 99,
      brokerTicket: 99,
      symbol: 'XAUUSD',
      time: '12:00',
      type: 'BUY',
      volume: 0.10,
      price_open: 2000,
      sl: 1995,
      tp: 2015,
      profit: 0,
      pips: 0,
      magic: 10001,
      comment: 'test',
    }];
    vi.spyOn(mt5Bridge, 'getStatus').mockReturnValue({
      ...mt5Bridge.getStatus(),
      connected: true,
    });
    vi.spyOn(mt5Bridge, 'closePosition').mockRejectedValue(new Error('broker rejected close'));

    const scaled = await engine.scaleOutPosition(99, 0.5);

    expect(scaled).toBe(false);
    expect(engine.positions[0].volume).toBe(0.10);
    expect(engine.closedTrades).toHaveLength(0);
    expect(engine.logs[0].msg).toContain('broker rejected close');
  });

  it('does not paper-close a live position when the MT5 bridge is offline', () => {
    engine.mt5Account.connected = true;
    engine.positions = [{
      ticket: 99,
      symbol: 'XAUUSD',
      time: '12:00',
      type: 'BUY',
      volume: 0.10,
      price_open: 2000,
      sl: 1995,
      tp: 2015,
      profit: 0,
      pips: 0,
      magic: 10001,
      comment: 'test',
    }];
    vi.spyOn(mt5Bridge, 'getStatus').mockReturnValue({
      ...mt5Bridge.getStatus(),
      connected: false,
    });

    engine.closePosition(99, 'Manual');

    expect(engine.positions).toHaveLength(1);
    expect(engine.closedTrades).toHaveLength(0);
    expect(engine.logs[0].msg).toContain('bridge is offline');
  });

  it('automatically triggers multi-tier 1.5R scale-out and trails stop during price ticks', () => {
    engine.autoBeEnabled = true;
    engine.account.balance = 10_000;
    engine.positions = [{
      ticket: 101,
      symbol: 'XAUUSD',
      time: '12:00',
      type: 'BUY',
      volume: 0.10,
      initialVolume: 0.10,
      price_open: 2000.0,
      sl: 1996.0, // Risk = 4 pts. 1.5R = +6.0 pts -> Price 2006.0
      initialSl: 1996.0,
      tp: 2012.0,
      initialTp: 2012.0,
      profit: 0,
      pips: 0,
      magic: 10001,
      comment: 'auto-scale-test',
    }];
    engine.bid = 2006.5; // Reaches 1.5R+
    engine.ask = 2006.7;

    // Simulate tick update
    engine.simulatePriceTick();

    const pos = engine.positions.find((p) => p.ticket === 101);
    expect(pos?.partialTaken).toBe(true);
    expect(pos?.volume).toBe(0.05);
    // Stop loss automatically moved to entry + 2 buffer points
    expect(pos?.sl).toBeGreaterThanOrEqual(2000.02);
    expect(pos?.beLocked).toBe(true);
    expect(engine.closedTrades.some((t) => t.reason === 'PARTIAL_TP' && t.positionTicket === 101)).toBe(true);
  });

  it('trails stop loss to base of newly confirmed Order Block swings', () => {
    engine.autoBeEnabled = true;
    engine.account.balance = 10_000;
    engine.positions = [{
      ticket: 102,
      symbol: 'XAUUSD',
      time: '12:00',
      type: 'BUY',
      volume: 0.05,
      initialVolume: 0.05,
      price_open: 2000.0,
      sl: 2000.2, // Already at BE
      initialSl: 1996.0,
      tp: 2025.0,
      profit: 10,
      pips: 10,
      magic: 10001,
      comment: 'ob-trail-test',
      beLocked: true,
    }];
    engine.bid = 2015.0;
    engine.ask = 2015.2;

    // Supply market snapshot with confirmed Bullish Order Block at 2008.0-2010.0
    (engine as any)._cachedMarket = {
      ...engine.getMarketSnapshot(),
      zones: [{
        kind: 'OB',
        bullish: true,
        bottom: 2008.0,
        top: 2010.0,
        born: Date.now() - 60000,
        filled: false,
        tests: 0,
      }],
      signal: {
        atr: 2.0,
        reasons: ['OB Bullish Retest'],
      } as any,
    };

    engine.simulatePriceTick();

    const pos = engine.positions.find((p) => p.ticket === 102);
    // Trailed SL should be base of OB (2008.0 - 0.25*2.0 = 2007.5)
    expect(pos?.sl).toBe(2007.5);
    expect(pos?.trailLocked).toBe(true);
  });

  it('validates Asian consolidation suppression and high-profit out-of-session exceptions', () => {
    // Reset closed trades so daily trade limit is clear
    engine.account.balance = 1000;
    engine.account.equity = 1000;
    engine.closedTrades = [];
    (engine as any).entryHistory = [];
    // 23:00 UTC is inside Asian consolidation (21:00 - 05:00 UTC / 00:00 - 08:00 EAT)
    const asianDate = new Date('2026-10-10T23:00:00Z');

    // Standard low-score signal in Asian session should be suppressed
    const lowSignal: any = {
      direction: 'BUY',
      timeframe: 'M5',
      score: 4.5,
      entry: 2000,
      sl: 1995,
      tp: 2005,
      atr: 2.0,
      reasons: ['Consolidation'],
      timestamp: asianDate.toISOString(),
    };

    // Simulate entry block check during Asian session
    const reason = engine.getEntryBlockReason('BUY', lowSignal, asianDate.getTime());
    expect(reason).toContain('ASIAN_CONSOLIDATION_SUPPRESSED');

    // High-profit exceptional signal (Score >= 6.5 or isOutOfSessionException) authorized
    const highProfitSignal: any = {
      direction: 'BUY',
      timeframe: 'M5',
      score: 7.2,
      entry: 2000,
      sl: 1995,
      tp: 2018, // 18 pts reward / 5 pts risk = 3.6 RR
      atr: 2.0,
      reasons: ['HTF Order Block', 'SFP Wick Sweep'],
      isOutOfSessionException: true,
      timestamp: asianDate.toISOString(),
    };

    const allowedReason = engine.getEntryBlockReason('BUY', highProfitSignal, asianDate.getTime());
    expect(allowedReason).toBeNull();
  });

  it('decouples execution gates and allows profitable trades during direction cooldown', () => {
    engine.account.balance = 5000;
    engine.account.equity = 5000;
    engine.closedTrades = [];
    (engine as any).entryHistory = [];
    const now = Date.now();

    // Record an entry to activate direction cooldown
    engine.directionCooldownEnabled = true;
    engine.directionCooldownSeconds = 15;
    engine.recordAcceptedEntry('BUY');

    // Without a valid profitable signal, direction cooldown blocks duplicate entries
    const emptyCheck = engine.getEntryBlockReason('BUY', null, now);
    expect(emptyCheck).toBe('Direction cooldown is active.');

    // With a valid profitable signal (RR >= 1.5 with SMC confluence), smart gate decouples and allows entry
    const profitableSignal: any = {
      direction: 'BUY',
      timeframe: 'M5',
      score: 68,
      entry: 2000,
      sl: 1996, // 4 pts risk
      tp: 2008, // 8 pts reward = 2.0 RR
      atr: 2.0,
      reasons: ['Order Block Retest', 'Bullish FVG Confirmation'],
      timestamp: new Date(now).toISOString(),
    };

    const smartResult = engine.getEntryBlockReason('BUY', profitableSignal, now);
    expect(smartResult).toBeNull();
  });
});
