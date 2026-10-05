import { describe, expect, it } from 'vitest';
import {
  buildSignalRationale,
  closedTradeDayKey,
  findCorrespondingOrderBlock,
  localDayKey,
} from './tradeJournal';
import type { ClosedTrade, Signal, Zone } from '../types/smc';

const exampleSignal: Signal = {
  direction: 'BUY',
  timeframe: 'M15',
  score: 5,
  entry: 2300,
  sl: 2295,
  tp: 2310,
  reasons: ['Bullish structure break', 'Discount-zone retest'],
  atr: 2,
  timestamp: '2026-06-20T09:00:00.000Z',
  actionReason: 'Liquidity sweep and displacement confirmed.',
};

const exampleTrade: ClosedTrade = {
  ticket: 10,
  openTime: '09:00:00',
  closeTime: '09:30:00',
  closedAt: '2026-06-20T09:30:00.000Z',
  type: 'BUY',
  volume: 0.01,
  openPrice: 2300,
  closePrice: 2305,
  profit: 5,
  pips: 50,
  reason: 'TP',
  comment: 'SMC',
};

const zones: Zone[] = [
  { kind: 'OB', top: 102, bottom: 100, bullish: true, born: 1, filled: false, tests: 0 },
  { kind: 'OB', top: 95, bottom: 93, bullish: true, born: 2, filled: false, tests: 0 },
  { kind: 'OB', top: 101, bottom: 99, bullish: false, born: 3, filled: false, tests: 0 },
  { kind: 'OB', top: 100, bottom: 98, bullish: true, born: 4, filled: true, tests: 0 },
];

describe('trade journal helpers', () => {
  it('keeps signal confluence details in the recorded rationale', () => {
    expect(buildSignalRationale(exampleSignal)).toContain('Liquidity sweep and displacement confirmed.');
    expect(buildSignalRationale(exampleSignal)).toContain('Bullish structure break');
    expect(buildSignalRationale(exampleSignal)).toContain('BUY M15 signal (score 5)');
  });

  it('uses the device-local calendar date for closes', () => {
    const date = new Date(2026, 5, 20, 12);
    expect(localDayKey(date)).toBe('2026-06-20');
    expect(closedTradeDayKey(exampleTrade)).toBe(localDayKey(exampleTrade.closedAt!));
  });

  it('leaves historical trades without a close timestamp unassigned to a calendar day', () => {
    expect(closedTradeDayKey({ ...exampleTrade, closedAt: undefined })).toBe('');
  });

  it('links a trade to the nearest active order block on its side', () => {
    expect(findCorrespondingOrderBlock('BUY', 99.5, zones)?.born).toBe(1);
    expect(findCorrespondingOrderBlock('SELL', 99.5, zones)?.born).toBe(3);
    expect(findCorrespondingOrderBlock('BUY', 150, [])).toBeUndefined();
  });
});
