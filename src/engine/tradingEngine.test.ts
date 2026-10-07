/**
 * tradingEngine.test.ts - Unit tests for TradingEngine store (Priority 5, Item 15)
 * Verifies:
 * (a) same-data snapshot returns identical reference
 * (b) channel subscribers fire only for their channel
 * (c) closedTrades appends preserve order
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TradingEngine } from './tradingEngine';
import { Candle } from '../types/smc';
import { calculateRiskBasedVolume } from './riskConfig';

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

describe('TradingEngine Store Architecture', () => {
  let engine: TradingEngine;

  beforeEach(() => {
    engine = new TradingEngine();
    engine.stopEngineLoops(); // stop background loops during unit tests
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
      symbolSpec: {
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
  });

  it('blocks entries at the exact daily loss threshold and during direction cooldown', () => {
    engine.account.daily_drawdown_pct = engine.account.max_daily_loss_pct;
    expect(engine.getEntryBlockReason('BUY', null)).toBe('Daily loss limit reached.');

    engine.account.daily_drawdown_pct = 0;
    engine.recordAcceptedEntry('BUY', null);
    expect(engine.getEntryBlockReason('BUY', null)).toBe('Direction cooldown is active.');
  });
});
