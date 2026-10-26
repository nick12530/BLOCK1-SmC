import { describe, expect, it } from 'vitest';
import type { Candle, ClosedTrade, SymbolTradingSpec } from '../types/smc';
import {
  estimatePortfolioStopRisk,
  filterTradesByWindow,
  getCandleAgeMs,
  summarizeClosedTrades,
} from './tradingDiagnostics';

const makeTrade = (ticket: number, profit: number, closeTime: string): ClosedTrade => ({
  ticket,
  openTime: closeTime,
  closeTime,
  type: profit >= 0 ? 'BUY' : 'SELL',
  volume: 0.01,
  openPrice: 1,
  closePrice: 1,
  profit,
  pips: profit,
  reason: 'Manual',
});

describe('trading diagnostics', () => {
  it('summarizes only valid closed trade outcomes and avoids invented zero-sample rates', () => {
    const metrics = summarizeClosedTrades([
      makeTrade(1, 12, '2026-10-20T12:00:00Z'),
      makeTrade(2, -4, '2026-10-20T13:00:00Z'),
      { ...makeTrade(3, 99, '2026-10-20T14:00:00Z'), status: 'RUNNING' },
    ]);

    expect(metrics).toMatchObject({
      count: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      netProfit: 8,
      grossProfit: 12,
      grossLoss: 4,
      profitFactor: 3,
      averageOutcome: 4,
    });
    expect(summarizeClosedTrades([]).winRate).toBeNull();
  });

  it('filters closed trades by a selected rolling window', () => {
    const now = Date.parse('2026-10-21T00:00:00Z');
    const trades = [
      makeTrade(1, 1, '2026-10-20T12:00:00Z'),
      makeTrade(2, 1, '2026-09-01T12:00:00Z'),
    ];

    expect(filterTradesByWindow(trades, 7, now)).toHaveLength(1);
    expect(filterTradesByWindow(trades, null, now)).toHaveLength(2);
  });

  it('handles candle timestamps in seconds and milliseconds without accepting future bars', () => {
    const now = Date.parse('2026-10-21T00:00:00Z');
    const candleAt = (time: number): Candle => ({
      time,
      timeStr: '',
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
    });
    expect(getCandleAgeMs([candleAt(now / 1000 - 60)], now)).toBe(60_000);
    expect(getCandleAgeMs([candleAt(now - 30_000)], now)).toBe(30_000);
    expect(getCandleAgeMs([candleAt(now + 1_000)], now)).toBeNull();
  });

  it('estimates risk from live stops and pending entry stops, counting unavailable risk explicitly', () => {
    const spec: SymbolTradingSpec = {
      point: 0.01,
      tickSize: 0.01,
      tickValue: 1,
      contractSize: 1,
      volumeMin: 0.01,
      volumeMax: 10,
      volumeStep: 0.01,
      tradeStopsLevel: 0,
      tradeFreezeLevel: 0,
    };
    const position = {
      ticket: 1,
      symbol: 'XAUUSD',
      type: 'BUY' as const,
      volume: 0.1,
      price_open: 2000,
      sl: 1990,
    };
    const pending = {
      ticket: 2,
      symbol: 'XAUUSD',
      direction: 'SELL' as const,
      type: 'SELL_LIMIT' as const,
      volume: 0.1,
      entry: 2010,
      sl: 2020,
      status: 'PENDING' as const,
    };

    expect(
      estimatePortfolioStopRisk([position], [pending], { XAUUSD: spec }, 'XAUUSD')
    ).toEqual({
      riskUsd: 200,
      positionCount: 1,
      pendingOrderCount: 1,
      unknownCount: 0,
    });
    expect(estimatePortfolioStopRisk([position], [], {}, 'XAUUSD').unknownCount).toBe(1);
  });
});
