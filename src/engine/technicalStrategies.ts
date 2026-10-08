import type { Candle, InstrumentType, Signal, TradeDirection } from '../types/smc';
import { calculateATR, hasRecentCandleGap } from './smcCore';

const EMA_FAST = 20;
const EMA_SLOW = 50;
const ATR_PERIOD = 14;

function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * multiplier + result[index - 1] * (1 - multiplier));
  }
  return result;
}

function createSignal(
  strategy: Signal['strategy'],
  direction: TradeDirection,
  timeframe: 'M1' | 'M5',
  score: number,
  candle: Candle,
  atr: number,
  reasons: string[],
  digits: number,
  tickSize?: number
): Signal {
  const normalizePrice = (price: number) => Number(
    (tickSize && tickSize > 0
      ? Math.round(price / tickSize) * tickSize
      : price).toFixed(digits)
  );
  const entry = normalizePrice(candle.close);
  const sl = normalizePrice(direction === 'BUY' ? entry - atr : entry + atr);
  const tp = normalizePrice(direction === 'BUY' ? entry + atr * 2 : entry - atr * 2);
  return {
    strategy,
    direction,
    timeframe,
    score,
    entry,
    sl,
    tp,
    reasons,
    atr,
    timestamp: new Date(candle.time < 1_000_000_000_000 ? candle.time * 1000 : candle.time).toISOString(),
    actionReason: `${strategy} ${direction} confirmation`,
    perfectEntryReason: `Closed-candle setup with 1:2 risk/reward using ATR-based protection.`,
  };
}

export function evaluateTechnicalStrategies(
  executionCandles: Candle[],
  higherTimeframeCandles: Candle[],
  timeframe: 'M1' | 'M5',
  instrumentType: InstrumentType,
  digits: number = 2,
  tickSize?: number
): Signal[] {
  if (executionCandles.length < EMA_SLOW + 2 || higherTimeframeCandles.length < EMA_SLOW + 2) return [];
  const intervalMs = timeframe === 'M1' ? 60_000 : 300_000;
  const htfIntervalMs = timeframe === 'M1' ? 300_000 : 900_000;
  const now = Date.now();
  const latest = executionCandles[executionCandles.length - 1];
  const higherLatest = higherTimeframeCandles[higherTimeframeCandles.length - 1];
  const toMs = (time: number) => time < 1_000_000_000_000 ? time * 1000 : time;
  if (
    now - toMs(latest.time) > intervalMs * 3 ||
    now - toMs(higherLatest.time) > htfIntervalMs * 3 ||
    hasRecentCandleGap(executionCandles, intervalMs) ||
    hasRecentCandleGap(higherTimeframeCandles, htfIntervalMs)
  ) return [];

  const atrValues = calculateATR(executionCandles, ATR_PERIOD);
  const atr = atrValues[atrValues.length - 1];
  if (!Number.isFinite(atr) || atr <= 0) return [];

  const executionCloses = executionCandles.map((candle) => candle.close);
  const higherCloses = higherTimeframeCandles.map((candle) => candle.close);
  const fast = ema(executionCloses, EMA_FAST);
  const slow = ema(executionCloses, EMA_SLOW);
  const higherFast = ema(higherCloses, EMA_FAST);
  const higherSlow = ema(higherCloses, EMA_SLOW);
  const previous = executionCandles[executionCandles.length - 2];
  const lastFast = fast[fast.length - 1];
  const previousFast = fast[fast.length - 2];
  const higherTrend: TradeDirection | null = higherFast.at(-1)! > higherSlow.at(-1)!
    ? 'BUY'
    : higherFast.at(-1)! < higherSlow.at(-1)!
      ? 'SELL'
      : null;
  const signals: Signal[] = [];

  const trendDirection: TradeDirection | null = lastFast > slow.at(-1)!
    ? 'BUY'
    : lastFast < slow.at(-1)!
      ? 'SELL'
      : null;
  const trendRetest = trendDirection === 'BUY'
    ? previous.low <= previousFast + atr * 0.15 && latest.close > lastFast && latest.close > latest.open
    : trendDirection === 'SELL'
      ? previous.high >= previousFast - atr * 0.15 && latest.close < lastFast && latest.close < latest.open
      : false;
  if (trendDirection && trendRetest && (higherTrend === trendDirection || instrumentType === 'synthetic')) {
    signals.push(createSignal(
      'Trend Pullback',
      trendDirection,
      timeframe,
      higherTrend === trendDirection ? 4.5 : 3.8,
      latest,
      atr,
      [
        `${EMA_FAST}-EMA pullback reclaimed in the direction of the ${EMA_SLOW}-EMA trend.`,
        higherTrend === trendDirection ? 'Higher-timeframe trend agrees.' : 'Synthetic instrument: higher-timeframe alignment is not required.',
      ],
      digits,
      tickSize
    ));
  }

  const lookback = executionCandles.slice(-21, -1);
  if (lookback.length === 20) {
    const resistance = Math.max(...lookback.map((candle) => candle.high));
    const support = Math.min(...lookback.map((candle) => candle.low));
    const body = Math.abs(latest.close - latest.open);
    const bullishBreakout = latest.close > resistance && latest.close > latest.open && body >= atr * 0.8;
    const bearishBreakout = latest.close < support && latest.close < latest.open && body >= atr * 0.8;
    const breakoutDirection: TradeDirection | null = bullishBreakout ? 'BUY' : bearishBreakout ? 'SELL' : null;
    if (breakoutDirection) {
      signals.push(createSignal(
        'Volatility Breakout',
        breakoutDirection,
        timeframe,
        higherTrend === breakoutDirection ? 4.7 : 4.0,
        latest,
        atr,
        [
          `Closed candle broke the previous 20-bar ${breakoutDirection === 'BUY' ? 'high' : 'low'} with a body at least 0.8 ATR.`,
          higherTrend === breakoutDirection ? 'Higher-timeframe trend agrees.' : 'Breakout is counter to or not confirmed by higher-timeframe trend.',
        ],
        digits,
        tickSize
      ));
    }
  }

  return signals;
}
