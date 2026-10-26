import { describe, expect, it } from 'vitest';
import type { Candle } from '../types/smc';
import { evaluateTechnicalStrategies } from './technicalStrategies';

const bars = (count: number, intervalMs: number, breakout = false): Candle[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const close = breakout && index === count - 1 ? 103 : 100 + (index % 2 ? 0.02 : -0.02);
    const open = breakout && index === count - 1 ? 100 : close - (index % 2 ? 0.01 : -0.01);
    return {
      time: now - (count - index) * intervalMs,
      timeStr: '12:00',
      open,
      high: breakout && index === count - 1 ? 103.2 : 100.2,
      low: breakout && index === count - 1 ? 99.9 : 99.8,
      close,
      volume: 100,
    };
  });
};

const flatBars = (count: number, intervalMs: number): Candle[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    time: now - (count - index) * intervalMs,
    timeStr: '12:00',
    open: 100,
    high: 100.1,
    low: 99.9,
    close: 100,
    volume: 100,
  }));
};

describe('multi-strategy technical signals', () => {
  it('finds a closed-candle volatility breakout outside the gold kill zones', () => {
    const signals = evaluateTechnicalStrategies(
      bars(80, 60_000, true),
      bars(80, 5 * 60_000),
      'M1',
      'synthetic'
    );

    expect(signals.some((signal) => signal.strategy === 'Volatility Breakout' && signal.direction === 'BUY')).toBe(true);
  });

  it('surfaces a confirmed trend pullback when the higher timeframe is neutral', () => {
    const intervalMs = 60_000;
    const execution = Array.from({ length: 80 }, (_, index) => {
      const trendClose = 100 + index * 0.03;
      const close = index === 78 ? trendClose - 0.7 : index === 79 ? trendClose - 0.05 : trendClose;
      return {
        time: Date.now() - (80 - index) * intervalMs,
        timeStr: '12:00',
        open: index === 79 ? close - 0.08 : close - 0.01,
        high: close + 0.1,
        low: close - 0.1,
        close,
        volume: 100,
      };
    });

    const signals = evaluateTechnicalStrategies(
      execution,
      flatBars(80, 5 * intervalMs),
      'M1',
      'standard'
    );
    const pullback = signals.find((signal) => signal.strategy === 'Trend Pullback');

    expect(pullback).toEqual(expect.objectContaining({
      direction: 'BUY',
      score: 6.2,
    }));
    expect(pullback?.reasons).toContain(
      'Higher-timeframe trend is neutral; execution-timeframe confirmation supports this candidate.'
    );
  });

  it('does not emit a trend-pullback signal for a negligible confirmation candle', () => {
    const intervalMs = 60_000;
    const execution = Array.from({ length: 80 }, (_, index) => {
      const trendClose = 100 + index * 0.03;
      const close = index === 78 ? trendClose - 0.7 : index === 79 ? trendClose - 0.05 : trendClose;
      return {
        time: Date.now() - (80 - index) * intervalMs,
        timeStr: '12:00',
        open: index === 79 ? close - 0.001 : close - 0.01,
        high: close + 0.1,
        low: close - 0.1,
        close,
        volume: 100,
      };
    });

    const signals = evaluateTechnicalStrategies(
      execution,
      flatBars(80, 5 * intervalMs),
      'M1',
      'standard'
    );

    expect(signals.some((signal) => signal.strategy === 'Trend Pullback')).toBe(false);
  });

  it('surfaces a moderately sized breakout when the higher timeframe is neutral', () => {
    const intervalMs = 60_000;
    const execution = bars(80, intervalMs);
    const last = execution.length - 1;
    execution[last] = {
      ...execution[last],
      open: 100.2,
      high: 100.5,
      low: 100.1,
      close: 100.48,
    };

    const signals = evaluateTechnicalStrategies(
      execution,
      flatBars(80, 5 * intervalMs).map((candle, index) => ({
        ...candle,
        open: 100 + index * 0.0002,
        close: 100 + index * 0.0002,
        high: 100 + index * 0.0002 + 0.1,
        low: 100 + index * 0.0002 - 0.1,
      })),
      'M1',
      'standard'
    );

    expect(signals).toContainEqual(expect.objectContaining({
      strategy: 'Volatility Breakout',
      direction: 'BUY',
      score: 6.2,
    }));
  });

  it('marks counter-trend candidates below the automatic-execution threshold', () => {
    const intervalMs = 60_000;
    const execution = bars(80, intervalMs);
    const last = execution.length - 1;
    execution[last] = {
      ...execution[last],
      open: 100.2,
      high: 100.5,
      low: 100.1,
      close: 100.48,
    };
    const bearishHigherTimeframe = flatBars(80, 5 * intervalMs).map((candle, index) => ({
      ...candle,
      open: 110 - index * 0.1,
      close: 110 - index * 0.1,
      high: 110 - index * 0.1 + 0.1,
      low: 110 - index * 0.1 - 0.1,
    }));

    const signals = evaluateTechnicalStrategies(
      execution,
      bearishHigherTimeframe,
      'M1',
      'standard'
    );
    const breakout = signals.find((signal) => signal.strategy === 'Volatility Breakout');

    expect(breakout).toEqual(expect.objectContaining({ direction: 'BUY', score: 5.8 }));
    expect(breakout?.reasons).toContain(
      'Higher-timeframe trend disagrees; watch-only candidate below the automatic-execution score threshold.'
    );
  });

  it('keeps closed-candle signals actionable for a full window after their source bar closes', () => {
    const timeframes = [
      { name: 'M1' as const, intervalMs: 60_000, higherIntervalMs: 5 * 60_000, validityMs: 90_000 },
      { name: 'M5' as const, intervalMs: 5 * 60_000, higherIntervalMs: 15 * 60_000, validityMs: 5 * 60_000 },
      { name: 'M15' as const, intervalMs: 15 * 60_000, higherIntervalMs: 60 * 60_000, validityMs: 15 * 60_000 },
    ];

    for (const timeframe of timeframes) {
      const signal = evaluateTechnicalStrategies(
        bars(80, timeframe.intervalMs, true),
        flatBars(80, timeframe.higherIntervalMs),
        timeframe.name,
        'standard'
      ).find((candidate) => candidate.strategy === 'Volatility Breakout');

      expect(signal).toBeDefined();
      expect(signal!.expiryTimestamp).toBe(
        Date.parse(signal!.timestamp) + timeframe.intervalMs + timeframe.validityMs
      );
    }
  });

  it('does not invent a signal from stale broker candles', () => {
    const stale = bars(80, 60_000);
    stale[stale.length - 1].time -= 10 * 60_000;

    expect(evaluateTechnicalStrategies(stale, bars(80, 5 * 60_000), 'M1', 'standard')).toEqual([]);
  });
});
