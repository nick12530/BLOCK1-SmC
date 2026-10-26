import type { Candle } from '../types/smc';

export type SignalValidationOutcome =
  | 'WATCHING'
  | 'TARGET_HIT'
  | 'STOP_HIT'
  | 'AMBIGUOUS'
  | 'EXPIRED_UNTRIGGERED'
  | 'EXPIRED_OPEN';

export interface SignalValidationRecord {
  id: string;
  createdAt: string;
  sourceCandleTime: number;
  expiresAt: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  timeframe: 'M5' | 'M15';
  triggerPrice: number;
  stopLoss: number;
  takeProfit: number;
  confluenceScore: number;
  outcome: SignalValidationOutcome;
  triggeredAt?: number;
  resolvedAt?: number;
}

export interface SignalValidationSummary {
  sampleCount: number;
  targetHits: number;
  stopHits: number;
  ambiguous: number;
  expiredUntriggered: number;
  expiredOpen: number;
  watching: number;
  resolvedWinRate: number | null;
}

function candleTimeMs(candle: Candle): number {
  return candle.time < 1_000_000_000_000 ? candle.time * 1000 : candle.time;
}

function hitStop(record: SignalValidationRecord, candle: Candle): boolean {
  return record.direction === 'BUY' ? candle.low <= record.stopLoss : candle.high >= record.stopLoss;
}

function hitTarget(record: SignalValidationRecord, candle: Candle): boolean {
  return record.direction === 'BUY' ? candle.high >= record.takeProfit : candle.low <= record.takeProfit;
}

function finish(
  record: SignalValidationRecord,
  outcome: SignalValidationOutcome,
  timestamp: number
): SignalValidationRecord {
  return { ...record, outcome, resolvedAt: timestamp };
}

export function advanceSignalValidation(
  record: SignalValidationRecord,
  oneMinuteCandles: Candle[],
  now = Date.now()
): SignalValidationRecord {
  if (record.outcome !== 'WATCHING') return record;

  const closedCandles = oneMinuteCandles
    .filter((candle) => {
      const time = candleTimeMs(candle);
      return (
        Number.isFinite(time) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        candle.high >= candle.low &&
        time > record.sourceCandleTime &&
        time + 60_000 <= now &&
        time < record.expiresAt
      );
    })
    .sort((a, b) => candleTimeMs(a) - candleTimeMs(b));
  let updated = record;

  for (const candle of closedCandles) {
    const barTime = candleTimeMs(candle);
    if (!updated.triggeredAt) {
      const triggerTouched =
        candle.low <= updated.triggerPrice && candle.high >= updated.triggerPrice;
      if (!triggerTouched) continue;
      updated = { ...updated, triggeredAt: barTime };
      if (hitStop(updated, candle) || hitTarget(updated, candle)) {
        return finish(updated, 'AMBIGUOUS', barTime + 60_000);
      }
      continue;
    }

    if (barTime < updated.triggeredAt + 60_000) continue;
    const stopTouched = hitStop(updated, candle);
    const targetTouched = hitTarget(updated, candle);
    if (stopTouched && targetTouched) return finish(updated, 'AMBIGUOUS', barTime + 60_000);
    if (stopTouched) return finish(updated, 'STOP_HIT', barTime + 60_000);
    if (targetTouched) return finish(updated, 'TARGET_HIT', barTime + 60_000);
  }

  if (now < record.expiresAt) return updated;
  return finish(
    updated,
    updated.triggeredAt ? 'EXPIRED_OPEN' : 'EXPIRED_UNTRIGGERED',
    record.expiresAt
  );
}

export function summarizeSignalValidations(records: SignalValidationRecord[]): SignalValidationSummary {
  const targetHits = records.filter((record) => record.outcome === 'TARGET_HIT').length;
  const stopHits = records.filter((record) => record.outcome === 'STOP_HIT').length;
  const ambiguous = records.filter((record) => record.outcome === 'AMBIGUOUS').length;
  const expiredUntriggered = records.filter((record) => record.outcome === 'EXPIRED_UNTRIGGERED').length;
  const expiredOpen = records.filter((record) => record.outcome === 'EXPIRED_OPEN').length;
  const watching = records.filter((record) => record.outcome === 'WATCHING').length;
  const resolvedCount = targetHits + stopHits;

  return {
    sampleCount: records.length,
    targetHits,
    stopHits,
    ambiguous,
    expiredUntriggered,
    expiredOpen,
    watching,
    resolvedWinRate: resolvedCount ? (targetHits / resolvedCount) * 100 : null,
  };
}
