import { describe, expect, it } from 'vitest';
import { evaluateConfluence, hasRecentCandleGap, MarketStructureEngine, sessionFilter } from './smcCore';
import { Candle } from '../types/smc';
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
  it('does not create a trade signal in a ranging market', () => {
    expect(evaluateConfluence(rangingCandles(100), rangingCandles(100))).toBeNull();
  });

  describe('market data integrity and session clock', () => {
    it('detects a recent missing broker bar', () => {
      const bars = rangingCandles(6);
      bars.forEach((bar, index) => { bar.time = index < 4 ? index * 60_000 : index * 60_000 + 3 * 60_000; });
      expect(hasRecentCandleGap(bars, 60_000)).toBe(true);
    });

    it('keeps London and New York kill zones aligned through daylight-saving changes', () => {
      expect(sessionFilter(Date.parse('2026-01-12T08:30:00Z')).activeSessionName).toBe('London Kill Zone');
      expect(sessionFilter(Date.parse('2026-07-13T07:30:00Z')).activeSessionName).toBe('London Kill Zone');
      expect(sessionFilter(Date.parse('2026-01-12T13:30:00Z')).new_york).toBe(true);
      expect(sessionFilter(Date.parse('2026-07-13T12:30:00Z')).new_york).toBe(true);
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
});
