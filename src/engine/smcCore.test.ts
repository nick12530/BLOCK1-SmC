import { describe, expect, it } from 'vitest';
import { evaluateConfluence } from './smcCore';
import { Candle } from '../types/smc';

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
});
