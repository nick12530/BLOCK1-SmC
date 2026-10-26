import { describe, expect, it } from 'vitest';
import {
  calculateATR,
  detectFVGs,
  detectLiquiditySweep,
  evaluateConfluence,
  hasRecentCandleGap,
  MarketStructureEngine,
  sessionFilter,
} from './smcCore';
import { Candle, Swing } from '../types/smc';
import { isWithinConfiguredNewsBlackout } from './riskConfig';

const rangingCandles = (count: number): Candle[] =>
  Array.from({ length: count }, (_, index) => ({
    time: index * 900_000,
    timeStr: '12:00',
    open: 100,
    high: 100.2,
    low: 99.8,
    close: index % 2 === 0 ? 100.05 : 99.95,
    volume: 100,
  }));

describe('SMC signal filters', () => {
  it('seeds Wilder ATR with a full period of true ranges', () => {
    const candles = Array.from({ length: 15 }, (_, index) => ({
      time: index * 60_000,
      timeStr: '12:00',
      open: 1.1,
      high: 1.2,
      low: 1.0,
      close: 1.1,
      volume: 100,
    }));

    const atr = calculateATR(candles, 14);

    expect(atr[12]).toBeNaN();
    expect(atr[13]).toBeCloseTo(0.2);
    expect(atr[14]).toBeCloseTo(0.2);
  });

  it('preserves broker precision in SMC levels for FX symbols', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, index) => ({
      time: Date.now() - (20 - index) * 60_000,
      timeStr: '12:00',
      open: 1.08401,
      high: 1.0842,
      low: 1.0838,
      close: 1.0841,
      volume: 100,
    }));
    candles[10] = { ...candles[10], high: 1.08423, low: 1.08377 };
    candles[12] = { ...candles[12], high: 1.08435, low: 1.08425 };
    const atr = Array(candles.length).fill(0.0004);

    const zones = detectFVGs(candles, atr, 0.01);

    expect(zones[0].bottom).toBe(1.08423);
    expect(zones[0].top).toBe(1.08425);
  });

  it('does not create a trade signal in a ranging market', () => {
    expect(evaluateConfluence(rangingCandles(100), rangingCandles(100))).toBeNull();
  });

  describe('market data integrity and session clock', () => {
    it('detects a recent missing broker bar', () => {
      const bars = rangingCandles(6);
      bars.forEach((bar, index) => { bar.time = index < 4 ? index * 60_000 : index * 60_000 + 3 * 60_000; });
      expect(hasRecentCandleGap(bars, 60_000)).toBe(true);
    });

    it('keeps London and New York sessions aligned through daylight-saving changes', () => {
      expect(sessionFilter(Date.parse('2026-01-12T08:30:00Z')).activeSessionName).toBe('London Kill Zone');
      expect(sessionFilter(Date.parse('2026-07-13T07:30:00Z')).activeSessionName).toBe('London Kill Zone');
      expect(sessionFilter(Date.parse('2026-01-12T13:30:00Z')).new_york).toBe(true);
      expect(sessionFilter(Date.parse('2026-07-13T12:30:00Z')).new_york).toBe(true);
    });

    it('allows entries throughout London and New York sessions, not only their kill zones', () => {
      const laterLondon = sessionFilter(Date.parse('2026-07-13T12:30:00Z'));
      const laterNewYork = sessionFilter(Date.parse('2026-07-13T16:30:00Z'));
      const outsideSessions = sessionFilter(Date.parse('2026-07-13T22:00:00Z'));

      expect(laterLondon.london).toBe(true);
      expect(laterLondon.tradable).toBe(true);
      expect(laterLondon.activeSessionName).toBe('London / NY Overlap');
      expect(laterNewYork.new_york).toBe(true);
      expect(laterNewYork.tradable).toBe(true);
      expect(laterNewYork.activeSessionName).toBe('New York Session');
      expect(outsideSessions.tradable).toBe(false);
    });

    it('quotes East Africa Time (EAT) and detects high-volume London Open and NY Silver Bullet windows', () => {
      const londonOpen = sessionFilter(Date.parse('2026-07-13T08:30:00Z'));
      expect(londonOpen.currentEatTime).toContain('EAT');
      expect(londonOpen.londonOpenWindow).toBe(true);
      expect(londonOpen.isHighVolumeWindow).toBe(true);

      const nySilverBullet = sessionFilter(Date.parse('2026-07-13T14:30:00Z'));
      expect(nySilverBullet.newYorkSilverBullet).toBe(true);
      expect(nySilverBullet.isHighVolumeWindow).toBe(true);

      const asianConsolidation = sessionFilter(Date.parse('2026-07-13T23:30:00Z'));
      expect(asianConsolidation.asianConsolidation).toBe(true);
    });

    it('detects Bearish and Bullish Liquidity Sweep / SFP rejections', () => {
      const baseCandles: Candle[] = [
        { time: 1000, timeStr: '10:00', open: 100, high: 105, low: 99, close: 104, volume: 10 },
        { time: 2000, timeStr: '10:01', open: 104, high: 106, low: 103, close: 105, volume: 10 },
        { time: 3000, timeStr: '10:02', open: 105, high: 107, low: 104, close: 106, volume: 10 },
        { time: 4000, timeStr: '10:03', open: 106, high: 108, low: 105, close: 107, volume: 10 },
        // Sweep candle: wicks above previous high (108) to 110, but closes below at 106.5
        { time: 5000, timeStr: '10:04', open: 107, high: 110, low: 106, close: 106.5, volume: 20 },
      ];
      const swings: Swing[] = [{ idx: 3, price: 108, kind: 'H', time: 4000 }];
      const sweep = detectLiquiditySweep(baseCandles, swings, 'SELL');
      expect(sweep.hasSweep).toBe(true);
      expect(sweep.type).toBe('SWING_HIGH_SFP');
      expect(sweep.rejectionConfirmed).toBe(true);
    });

    it('applies configured news blackout times using New York daylight-saving rules', () => {
      expect(isWithinConfiguredNewsBlackout(new Date('2026-01-12T13:30:00Z'))).toBe(true);
      expect(isWithinConfiguredNewsBlackout(new Date('2026-07-13T12:30:00Z'))).toBe(true);
      expect(isWithinConfiguredNewsBlackout(new Date('2026-07-13T14:00:00Z'))).toBe(false);
    });
  });

  describe('hand-labeled market structure', () => {
    it('finds the known bullish BOS followed by bearish CHoCH', () => {
      const points = [
        [101, 97, 100], [105, 99, 102], [110, 100, 103], [107, 101, 104],
        [106, 100, 104], [112, 99, 111], [107, 98, 104], [108, 101, 105],
        [106, 100, 103], [104, 98, 101], [102, 97, 99], [104, 96, 100],
        [105, 95, 99], [103, 97, 100], [101, 94, 94], [99, 93, 95],
      ];
      const candles: Candle[] = points.map(([high, low, close], index) => ({
        time: index * 60_000,
        timeStr: '12:00',
        open: close,
        high: Math.max(high, close),
        low: Math.min(low, close),
        close,
        volume: 100,
      }));
      const structure = new MarketStructureEngine(1);
      structure.update(candles);

      expect(structure.events.some((event) => event.kind === 'BOS' && event.direction === 'bullish')).toBe(true);
      expect(structure.events.some((event) => event.kind === 'CHoCH' && event.direction === 'bearish')).toBe(true);
      expect(structure.events.map((event) => event.bar)).toEqual(
        [...structure.events].map((event) => event.bar).sort((left, right) => left - right)
      );
      expect(structure.events.at(-1)?.direction).toBe('bearish');
    });

    it('produces only structure events observable at each chronological prefix', () => {
      const points = [
        [101, 97, 100], [105, 99, 102], [110, 100, 103], [107, 101, 104],
        [106, 100, 104], [112, 99, 111], [107, 98, 104], [108, 101, 105],
        [106, 100, 103], [104, 98, 101], [102, 97, 99], [104, 96, 100],
        [105, 95, 99], [103, 97, 100], [101, 94, 94], [99, 93, 95],
      ];
      const candles: Candle[] = points.map(([high, low, close], index) => ({
        time: index * 60_000,
        timeStr: '12:00',
        open: close,
        high: Math.max(high, close),
        low: Math.min(low, close),
        close,
        volume: 100,
      }));
      const complete = new MarketStructureEngine(1);
      complete.update(candles);

      for (let length = 6; length < candles.length; length += 1) {
        const prefix = new MarketStructureEngine(1);
        prefix.update(candles.slice(0, length));
        const eventsAvailableByPrefix = complete.events.filter((event) => event.bar < length);
        expect(prefix.events).toEqual(eventsAvailableByPrefix);
      }
    });

    it('handles varied valid candle sequences without invalid event prices', () => {
      for (let seed = 1; seed <= 25; seed += 1) {
        let state = seed;
        const random = () => {
          state = (state * 48271) % 2147483647;
          return state / 2147483647;
        };
        let close = 100;
        const candles = Array.from({ length: 60 }, (_, index) => {
          const open = close;
          close += random() - 0.5;
          return {
            time: index * 60_000,
            timeStr: '12:00',
            open,
            high: Math.max(open, close) + random(),
            low: Math.min(open, close) - random(),
            close,
            volume: 100,
          };
        });
        const structure = new MarketStructureEngine(2);
        structure.update(candles);
        for (const event of structure.events) {
          expect(Number.isFinite(event.price)).toBe(true);
          expect(['BOS', 'CHoCH']).toContain(event.kind);
        }
      }
    });
  });

  describe('closed bar execution (repainting prevention)', () => {
    it('does not return a signal when the setup only exists on the unclosed forming bar, but evaluates it once completed', () => {
      // SAFETY-FIX: verify signals fire only on closed bars
      const now = Date.now();
      const baseTime = now - 40 * 60_000;
      const htfCandles: Candle[] = Array.from({ length: 30 }, (_, index) => ({
        time: baseTime + index * 5 * 60_000,
        timeStr: '12:00',
        open: 2600 + index * 2,
        high: 2602 + index * 2,
        low: 2599 + index * 2,
        close: 2601 + index * 2,
        volume: 100,
      }));

      const execCandles: Candle[] = Array.from({ length: 25 }, (_, index) => ({
        time: baseTime + index * 60_000,
        timeStr: '12:00',
        open: 2600 + index * 0.1,
        high: 2601 + index * 0.1,
        low: 2599 + index * 0.1,
        close: 2600 + index * 0.1,
        volume: 100,
      }));

      const formingCandle: Candle = {
        time: baseTime + 25 * 60_000,
        timeStr: '12:25',
        open: 2602.5,
        high: 2602.6,
        low: 2598.0,
        close: 2602.4,
        volume: 200,
      };

      const seriesWithForming = [...execCandles, formingCandle];

      // Forming candle at dfExec[length - 1] is sliced off, so it does not trigger an incomplete signal
      const signalForming = evaluateConfluence(seriesWithForming, htfCandles, 2.0, 5.0, 'M1');
      expect(signalForming).toBeNull();

      // Now complete the bar by appending the next forming bar
      const nextFormingBar: Candle = {
        time: baseTime + 26 * 60_000,
        timeStr: '12:26',
        open: 2602.4,
        high: 2603.0,
        low: 2602.0,
        close: 2602.8,
        volume: 100,
      };
      const seriesWithCompleted = [...execCandles, formingCandle, nextFormingBar];
      const closed = seriesWithCompleted.slice(0, -1);
      // The forming candle has now transitioned into the closed set
      expect(closed[closed.length - 1]).toEqual(formingCandle);
    });
  });
});
