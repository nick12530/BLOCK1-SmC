/**
 * tradingEngine.test.ts - Unit tests for TradingEngine store (Priority 5, Item 15)
 * Verifies:
 * (a) same-data snapshot returns identical reference
 * (b) channel subscribers fire only for their channel
 * (c) closedTrades appends preserve order
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TradingEngine } from './tradingEngine';

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

    // Close position 1
    engine.closePosition(pos1.ticket, 'Manual');
    expect(engine.closedTrades.length).toBeGreaterThanOrEqual(1);
    const firstClosed = engine.closedTrades[0];
    expect(firstClosed.ticket).toBe(pos1.ticket);

    // Open position 2
    engine.sendMarket('SELL', 0.1, 3850, 3830, 'test2');
    const pos2 = engine.positions[engine.positions.length - 1];

    // Close position 2
    engine.closePosition(pos2.ticket, 'TP');
    // Newest closed trade must be at index 0
    expect(engine.closedTrades[0].ticket).toBe(pos2.ticket);
    expect(engine.closedTrades[1].ticket).toBe(pos1.ticket);
  });
});
