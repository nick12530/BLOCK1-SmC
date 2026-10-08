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

  it('does not invent a signal from stale broker candles', () => {
    const stale = bars(80, 60_000);
    stale[stale.length - 1].time -= 10 * 60_000;

    expect(evaluateTechnicalStrategies(stale, bars(80, 5 * 60_000), 'M1', 'standard')).toEqual([]);
  });
});
