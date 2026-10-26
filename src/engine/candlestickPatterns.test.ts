/**
 * candlestickPatterns.test.ts - Unit tests for Gold Candlestick Pattern Engine
 */

import { describe, it, expect } from 'vitest';
import { analyzeCandlestickPatterns, analyzeGoldCandlestickPatterns } from './candlestickPatterns';
import { Candle } from '../types/smc';

describe('Gold Candlestick Pattern Engine', () => {
  it('reports unavailable rather than fabricating a pattern when broker candles are absent', () => {
    const result = analyzeGoldCandlestickPatterns([]);
    expect(result.activePattern.name).toBe('Unavailable');
    expect(result.activePattern.reliability).toBe(0);
    expect(result.activePattern.displacementScore).toBe(0);
    expect(result.lastCandleMetrics.range).toBe(0);
  });

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

  it('scales equal-level pattern tolerance to FX pips and keeps price metrics precise', () => {
    const candles: Candle[] = [
      { time: 1000, timeStr: '10:00', open: 1.1002, high: 1.1005, low: 1.1000, close: 1.1003, volume: 100 },
      { time: 2000, timeStr: '10:05', open: 1.1002, high: 1.1006, low: 1.1000, close: 1.1004, volume: 100 },
      { time: 3000, timeStr: '10:10', open: 1.1004, high: 1.1005, low: 1.1000, close: 1.1001, volume: 100 },
      { time: 4000, timeStr: '10:15', open: 1.1001, high: 1.1004, low: 1.0998, close: 1.1003, volume: 100 },
    ];

    const result = analyzeCandlestickPatterns(candles, 0.0001, 'EURUSD');

    expect(result.activePattern.type).toBe('TWEEZER_BOTTOM');
    expect(result.activePattern.marketInsight).toContain('repeated low');
    expect(result.lastCandleMetrics.range).toBe(0.0006);
  });
});
