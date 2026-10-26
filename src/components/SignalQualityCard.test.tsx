import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TradingEngine } from '../engine/tradingEngine';
import { SignalQualityCard } from './SignalQualityCard';

describe('SignalQualityCard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates broker-feed freshness as quote age increases without other engine updates', () => {
    const now = Date.parse('2026-10-22T09:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const engine = new TradingEngine();
    engine.stopEngineLoops();
    const ticker = {
      ...engine.getTickerSnapshot(),
      marketDataAvailable: true,
      quoteUpdatedAt: now - 44_000,
    };
    const market = {
      ...engine.getMarketSnapshot(),
      candlesM1: [{
        time: now - 10_000,
        timeStr: '',
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
      }],
    };

    render(
      <SignalQualityCard
        ticker={ticker}
        market={market}
        analyses={[]}
        closedTrades={[]}
        positions={[]}
        pendingOrders={[]}
        validations={[]}
      />
    );

    expect(screen.getByText('FRESH')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText('CHECK FEED')).toBeTruthy();
  });
});
