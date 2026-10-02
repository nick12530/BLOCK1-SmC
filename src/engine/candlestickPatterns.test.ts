/**
 * candlestickPatterns.test.ts - Unit tests for Gold Candlestick Pattern Engine
 */

import { describe, it, expect } from 'vitest';
import { analyzeGoldCandlestickPatterns } from './candlestickPatterns';
import { Candle } from '../types/smc';

describe('Gold Candlestick Pattern Engine', () => {
  it('detects Bullish Liquidity Sweep Pinbar (Hammer) on Gold', () => {
    // A candle with a massive lower rejection wick sweeping liquidity
    const candles: Candle[] = [
      { time: 1000, timeStr: '10:00', open: 3840, high: 3845, low: 3838, close: 3842, volume: 150 },
      { time: 2000, timeStr: '10:15', open: 3842, high: 3844, low: 3835, close: 3836, volume: 180 },
      { time: 3000, timeStr: '10:30', open: 3836, high: 3838, low: 3830, close: 3832, volume: 210 },
      // c0: Open 3835, High 3836, Low 3820, Close 3834 -> Lower wick = 14 pts, range = 16 pts (>80% lower wick)
      { time: 4000, timeStr: '10:45', open: 3835, high: 3836, low: 3820, close: 3834, volume: 340 },
    ];

    const result = analyzeGoldCandlestickPatterns(candles);
    expect(result.activePattern).toBeDefined();
    expect(result.activePattern.type).toBe('SWEEP_PINBAR');
    expect(result.activePattern.bias).toBe('BULLISH');
    expect(result.activePattern.reliability).toBeGreaterThanOrEqual(90);
  });

  it('detects Bearish Institutional Engulfing displacement on Gold', () => {
    const candles: Candle[] = [
      { time: 1000, timeStr: '10:00', open: 3840, high: 3845, low: 3838, close: 3842, volume: 140 },
      { time: 2000, timeStr: '10:15', open: 3842, high: 3846, low: 3840, close: 3845, volume: 160 },
      // c1: Bullish candle 3845 to 3848
      { time: 3000, timeStr: '10:30', open: 3845, high: 3849, low: 3844, close: 3848, volume: 190 },
      // c0: Heavy bearish engulfing from 3850 down to 3838 (completely engulfs 3845-3848)
      { time: 4000, timeStr: '10:45', open: 3850, high: 3851, low: 3837, close: 3838, volume: 420 },
    ];

    const result = analyzeGoldCandlestickPatterns(candles);
    expect(result.activePattern).toBeDefined();
    expect(result.activePattern.type).toBe('BEARISH_ENGULFING');
    expect(result.activePattern.bias).toBe('BEARISH');
    expect(result.activePattern.reliability).toBeGreaterThanOrEqual(90);
  });
});
