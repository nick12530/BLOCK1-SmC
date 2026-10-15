import type { Candle, InstrumentType, Signal, TradeDirection } from '../types/smc';
import { calculateATR, hasRecentCandleGap } from './smcCore';
import { getInstrumentConfig } from './instrumentConfig';

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
  timeframe: 'M1' | 'M5' | 'M15',
  score: number,
  candle: Candle,
  atr: number,
  reasons: string[],
  digits: number,
  tickSize?: number,
  symbol?: string
): Signal {
  const normalizePrice = (price: number) => Number(
    (tickSize && tickSize > 0
      ? Math.round(price / tickSize) * tickSize
      : price).toFixed(digits)
  );
  const entry = normalizePrice(candle.close);

  // Safe minimum stop loss distance: prevents 1-pip suicide stops eaten alive by broker spreads
  let minStopDistance = digits === 3 ? 0.08 : digits === 5 ? 0.00080 : 1.5;
  let pipSize = digits === 3 || digits === 2 ? 0.01 : 0.0001;
  if (symbol) {
    try {
      const cfg = getInstrumentConfig(symbol);
      minStopDistance = cfg.minPracticalStopPips * cfg.pipSize;
      pipSize = cfg.pipSize;
    } catch {
      // fallback
    }
  }

  // Use the larger of ATR or the instrument's minimum safe stop floor
  const effectiveStopDistance = Math.max(atr, minStopDistance);
  const stopPips = Number((effectiveStopDistance / pipSize).toFixed(1));

  const sl = normalizePrice(direction === 'BUY' ? entry - effectiveStopDistance : entry + effectiveStopDistance);
  const tp1 = normalizePrice(direction === 'BUY' ? entry + effectiveStopDistance * 1.8 : entry - effectiveStopDistance * 1.8);
  const tp2 = normalizePrice(direction === 'BUY' ? entry + effectiveStopDistance * 3.2 : entry - effectiveStopDistance * 3.2);
  const tp3 = normalizePrice(direction === 'BUY' ? entry + effectiveStopDistance * 5.5 : entry - effectiveStopDistance * 5.5);
  const tp = tp2; // Primary targets high-pip 3.2R expansion

  const targetPips1 = Number((Math.abs(tp1 - entry) / pipSize).toFixed(1));
  const targetPips2 = Number((Math.abs(tp2 - entry) / pipSize).toFixed(1));
  const targetPips3 = Number((Math.abs(tp3 - entry) / pipSize).toFixed(1));
  const targetPips = targetPips2;

  const validityDurationMs = timeframe === 'M15' ? 15 * 60_000 : timeframe === 'M5' ? 5 * 60_000 : 90_000;
  const candleTimeMs = candle.time < 1_000_000_000_000 ? candle.time * 1000 : candle.time;
  const expiryTimestamp = candleTimeMs + validityDurationMs;
  const validitySeconds = Math.max(0, Math.round((expiryTimestamp - Date.now()) / 1000));
  const isSniper = (timeframe === 'M15' || timeframe === 'M5') && score >= 4.2;

  return {
    strategy,
    direction,
    timeframe,
    score,
    entry,
    sl,
    tp,
    tp1,
    tp2,
    tp3,
    slPips: stopPips,
    targetPips1,
    targetPips2,
    targetPips3,
    targetPips,
    expiryTimestamp,
    validitySeconds,
    isSniper,
    reasons,
    atr: effectiveStopDistance,
    timestamp: new Date(Math.min(candleTimeMs, Date.now())).toISOString(),
    actionReason: `${strategy} ${direction} (${stopPips} pips safe stop beyond spread noise)`,
    perfectEntryReason: `Closed-candle setup with 1:3.2 high-yield risk/reward using ${stopPips} pips protective stop distance.`,
  };
}

export function evaluateTechnicalStrategies(
  executionCandles: Candle[],
  higherTimeframeCandles: Candle[],
  timeframe: 'M1' | 'M5' | 'M15',
  instrumentType: InstrumentType,
  digits: number = 2,
  tickSize?: number,
  symbol?: string
): Signal[] {
  if (executionCandles.length < EMA_SLOW + 2 || higherTimeframeCandles.length < EMA_SLOW + 2) return [];
  const intervalMs = timeframe === 'M1' ? 60_000 : timeframe === 'M5' ? 300_000 : 900_000;
  const htfIntervalMs = timeframe === 'M1' ? 300_000 : timeframe === 'M5' ? 900_000 : 3600_000;
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
      higherTrend === trendDirection ? 6.8 : 5.0,
      latest,
      atr,
      [
        `${EMA_FAST}-EMA pullback reclaimed in the direction of the ${EMA_SLOW}-EMA trend.`,
        higherTrend === trendDirection ? 'Higher-timeframe trend agrees with momentum.' : 'Synthetic instrument: higher-timeframe alignment is not required.',
      ],
      digits,
      tickSize,
      symbol
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
    // Require higher-timeframe confirmation: reject counter-trend noise that gets trapped by market makers
    if (breakoutDirection && (higherTrend === breakoutDirection || instrumentType === 'synthetic')) {
      signals.push(createSignal(
        'Volatility Breakout',
        breakoutDirection,
        timeframe,
        higherTrend === breakoutDirection ? 6.5 : 4.8,
        latest,
        atr,
        [
          `Closed candle broke the previous 20-bar ${breakoutDirection === 'BUY' ? 'high' : 'low'} with a body at least 0.8 ATR.`,
          higherTrend === breakoutDirection ? 'Higher-timeframe trend aligns and confirms breakout.' : 'Synthetic instrument: higher-timeframe alignment not required.',
        ],
        digits,
        tickSize,
        symbol
      ));
    }
  }

  return signals;
}
