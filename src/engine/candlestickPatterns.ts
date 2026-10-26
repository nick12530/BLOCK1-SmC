/**
 * Instrument-neutral candle patterns using pip-scaled price tolerances.
 */

import { Candle } from '../types/smc';

export type CandlestickPatternType =
  | 'SWEEP_PINBAR'
  | 'BULLISH_ENGULFING'
  | 'BEARISH_ENGULFING'
  | 'MORNING_STAR'
  | 'EVENING_STAR'
  | 'TWEEZER_BOTTOM'
  | 'TWEEZER_TOP'
  | 'THREE_WHITE_SOLDIERS'
  | 'THREE_BLACK_CROWS'
  | 'DRAGONFLY_DOJI'
  | 'GRAVESTONE_DOJI'
  | 'INSIDE_BAR'
  | 'INVERTED_HAMMER'
  | 'NEUTRAL_DOJI';

export interface CandlestickPatternMatch {
  type: CandlestickPatternType;
  name: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  reliability: number; // Heuristic pattern score, not a probability of profit.
  description: string;
  marketInsight: string;
  wickRatio: string;
  displacementScore: number; // 1 to 5
}

export interface CandlestickAnalysis {
  activePattern: CandlestickPatternMatch;
  recentPatterns: CandlestickPatternMatch[];
  lastCandleMetrics: {
    range: number;
    body: number;
    upperWick: number;
    lowerWick: number;
    bodyPct: number;
    upperWickPct: number;
    lowerWickPct: number;
    isBullish: boolean;
  };
}

/**
 * Detects common candle patterns with tolerances scaled to the instrument.
 */
export function analyzeCandlestickPatterns(
  candles: Candle[],
  pipSize: number,
  instrumentName = 'Market'
): CandlestickAnalysis {
  const safePipSize = Number.isFinite(pipSize) && pipSize > 0 ? pipSize : 0.0001;
  const metricDigits = Math.min(8, Math.max(2, Math.ceil(-Math.log10(safePipSize)) + 1));
  if (candles.length < 4) {
    return {
      activePattern: {
        type: 'NEUTRAL_DOJI',
        name: 'Unavailable',
        bias: 'NEUTRAL',
        reliability: 0,
        description: 'Insufficient candles for pattern confirmation.',
        marketInsight: 'Waiting for verified broker candles.',
        wickRatio: 'Unavailable',
        displacementScore: 0,
      },
      recentPatterns: [],
      lastCandleMetrics: {
        range: 0,
        body: 0,
        upperWick: 0,
        lowerWick: 0,
        bodyPct: 0,
        upperWickPct: 0,
        lowerWickPct: 0,
        isBullish: true,
      },
    };
  }

  const c0 = candles[candles.length - 1]; // Latest candle
  const c1 = candles[candles.length - 2]; // Previous candle
  const c2 = candles[candles.length - 3]; // 2 candles ago
  const c3 = candles[candles.length - 4]; // 3 candles ago

  // Candle 0 metrics
  const range0 = Math.max(safePipSize * 0.1, c0.high - c0.low);
  const body0 = Math.abs(c0.close - c0.open);
  const upperWick0 = c0.high - Math.max(c0.open, c0.close);
  const lowerWick0 = Math.min(c0.open, c0.close) - c0.low;
  const isBull0 = c0.close >= c0.open;

  const upperWickPct0 = Math.round((upperWick0 / range0) * 100);
  const lowerWickPct0 = Math.round((lowerWick0 / range0) * 100);
  const bodyPct0 = Math.round((body0 / range0) * 100);

  // Candle 1 metrics
  const range1 = Math.max(safePipSize * 0.1, c1.high - c1.low);
  const body1 = Math.abs(c1.close - c1.open);
  const isBull1 = c1.close >= c1.open;
  const isBull2 = c2.close >= c2.open;

  const detected: CandlestickPatternMatch[] = [];

  // 1. Long-wick rejection bars
  if (lowerWickPct0 >= 55 && bodyPct0 <= 35) {
    detected.push({
      type: 'SWEEP_PINBAR',
      name: 'Bullish Liquidity Sweep Pinbar (Hammer)',
      bias: 'BULLISH',
      reliability: 94,
      description: `Long lower rejection wick (${lowerWickPct0}%) purges sell-side liquidity before strong aggressive buyer recovery.`,
      marketInsight: `Check whether the rejection coincides with a confirmed ${instrumentName} liquidity level.`,
      wickRatio: `${lowerWickPct0}% Lower Wick`,
      displacementScore: 5,
    });
  } else if (upperWickPct0 >= 55 && bodyPct0 <= 35) {
    detected.push({
      type: 'SWEEP_PINBAR',
      name: 'Bearish Liquidity Sweep Pinbar (Shooting Star)',
      bias: 'BEARISH',
      reliability: 94,
      description: `Long upper rejection wick (${upperWickPct0}%) sweeps buy-side liquidity into premium institutional supply.`,
      marketInsight: `Check for nearby resistance or swept highs on ${instrumentName}.`,
      wickRatio: `${upperWickPct0}% Upper Wick`,
      displacementScore: 5,
    });
  }

  // 2. BULLISH & BEARISH ENGULFING (Displacement / FVG Origin)
  if (!isBull1 && isBull0 && c0.close > c1.open && c0.open <= c1.close && body0 > body1 * 1.25) {
    detected.push({
      type: 'BULLISH_ENGULFING',
      name: 'Bullish Institutional Engulfing (Displacement)',
      bias: 'BULLISH',
      reliability: 91,
      description: 'Massive bullish displacement candle completely engulfs prior bearish range, creating fresh Fair Value Gaps.',
      marketInsight: 'Use higher-timeframe direction and location to distinguish displacement from a late breakout.',
      wickRatio: `${bodyPct0}% Expansion Body`,
      displacementScore: 5,
    });
  } else if (isBull1 && !isBull0 && c0.close < c1.open && c0.open >= c1.close && body0 > body1 * 1.25) {
    detected.push({
      type: 'BEARISH_ENGULFING',
      name: 'Bearish Institutional Engulfing (Displacement)',
      bias: 'BEARISH',
      reliability: 91,
      description: 'Aggressive institutional sell candle completely engulfs prior bullish candle, fracturing lower-timeframe market structure.',
      marketInsight: 'Check whether the displacement breaks structure and leaves room to the next support.',
      wickRatio: `${bodyPct0}% Expansion Body`,
      displacementScore: 5,
    });
  }

  // 3. MORNING STAR & EVENING STAR (3-Candle Trend Shift)
  const isSmallBody1 = body1 / range1 <= 0.35;
  if (!isBull2 && isSmallBody1 && isBull0 && c0.close > c2.open - (c2.open - c2.close) * 0.5) {
    detected.push({
      type: 'MORNING_STAR',
      name: 'Bullish Morning Star Reversal Cluster',
      bias: 'BULLISH',
      reliability: 89,
      description: '3-candle reversal cluster: Bearish impulse followed by absorption doji, followed by aggressive bullish expansion.',
      marketInsight: 'Confirmation is stronger when the reversal forms at a pre-identified support zone.',
      wickRatio: '3-Bar Cluster',
      displacementScore: 4,
    });
  } else if (isBull2 && isSmallBody1 && !isBull0 && c0.close < c2.open + (c2.close - c2.open) * 0.5) {
    detected.push({
      type: 'EVENING_STAR',
      name: 'Bearish Evening Star Reversal Cluster',
      bias: 'BEARISH',
      reliability: 89,
      description: '3-candle reversal cluster: Bullish push met by supply exhaustion doji and confirmed by heavy sell displacement.',
      marketInsight: 'Confirmation is stronger when the reversal forms at a pre-identified resistance zone.',
      wickRatio: '3-Bar Cluster',
      displacementScore: 4,
    });
  }

  // 4. TWEEZER TOPS & BOTTOMS (Equal Highs / Equal Lows Retest)
  const equalLevelTolerance = safePipSize * 3.5;
  const equalLows = Math.abs(c0.low - c1.low) <= equalLevelTolerance && lowerWickPct0 > 30;
  const equalHighs = Math.abs(c0.high - c1.high) <= equalLevelTolerance && upperWickPct0 > 30;
  if (equalLows) {
    detected.push({
      type: 'TWEEZER_BOTTOM',
      name: 'Tweezer Bottoms (Double Key Level Defense)',
      bias: 'BULLISH',
      reliability: 87,
      description: 'Consecutive candles rejected at exact same low boundary, confirming institutional limit order defense.',
      marketInsight: 'Treat the repeated low as a level to monitor; it is not a confirmed reversal on its own.',
      wickRatio: `${lowerWickPct0}% Defense Wick`,
      displacementScore: 4,
    });
  } else if (equalHighs) {
    detected.push({
      type: 'TWEEZER_TOP',
      name: 'Tweezer Tops (Double Supply Wall)',
      bias: 'BEARISH',
      reliability: 87,
      description: 'Consecutive candles testing exact same resistance ceiling, showing repeated rejection of higher prices.',
      marketInsight: 'Treat the repeated high as a level to monitor; it is not a confirmed reversal on its own.',
      wickRatio: `${upperWickPct0}% Supply Rejection`,
      displacementScore: 4,
    });
  }

  // 5. THREE WHITE SOLDIERS & THREE BLACK CROWS (Momentum Trend Confirmation)
  if (isBull0 && isBull1 && c2.close >= c2.open && c0.close > c1.close && c1.close > c2.close && bodyPct0 > 55) {
    detected.push({
      type: 'THREE_WHITE_SOLDIERS',
      name: 'Three White Soldiers (Sustained Institutional Inflow)',
      bias: 'BULLISH',
      reliability: 86,
      description: 'Three consecutive strong bullish candles with progressive higher closes and minimal upper wicks.',
      marketInsight: 'Momentum may be extended; check trend context and avoid chasing after a large move.',
      wickRatio: `${bodyPct0}% Momentum`,
      displacementScore: 5,
    });
  } else if (!isBull0 && !isBull1 && c2.close < c2.open && c0.close < c1.close && c1.close < c2.close && bodyPct0 > 55) {
    detected.push({
      type: 'THREE_BLACK_CROWS',
      name: 'Three Black Crows (Aggressive Sell-Off Expansion)',
      bias: 'BEARISH',
      reliability: 86,
      description: 'Three consecutive strong bearish candles with progressive lower closes, confirming institutional distribution.',
      marketInsight: 'Momentum may be extended; check trend context and avoid chasing after a large move.',
      wickRatio: `${bodyPct0}% Momentum`,
      displacementScore: 5,
    });
  }

  // 6. INSIDE BAR (Institutional Volatility Compression)
  if (c0.high < c1.high && c0.low > c1.low) {
    detected.push({
      type: 'INSIDE_BAR',
      name: 'Inside Bar (Volatility Compression Coil)',
      bias: 'NEUTRAL',
      reliability: 82,
      description: 'Current candle range completely inside mother bar, signaling institutional order accumulation before breakout.',
      marketInsight: 'Compression can precede expansion, but the breakout direction is not known until confirmed.',
      wickRatio: 'Coiled Range',
      displacementScore: 3,
    });
  }

  // 7. DRAGONFLY / GRAVESTONE DOJI
  if (bodyPct0 <= 15) {
    if (lowerWickPct0 >= 70) {
      detected.push({
        type: 'DRAGONFLY_DOJI',
        name: 'Dragonfly Doji (Exhaustion & Absorption)',
        bias: 'BULLISH',
        reliability: 85,
        description: 'Open, close, and high are virtually identical at top with extreme lower wick.',
        marketInsight: 'A long lower wick indicates rejection; confirm direction with surrounding structure.',
        wickRatio: `${lowerWickPct0}% Reclaim Wick`,
        displacementScore: 4,
      });
    } else if (upperWickPct0 >= 70) {
      detected.push({
        type: 'GRAVESTONE_DOJI',
        name: 'Gravestone Doji (Supply Dominance)',
        bias: 'BEARISH',
        reliability: 85,
        description: 'Open, close, and low are virtually identical at bottom with extreme upper wick.',
        marketInsight: 'A long upper wick indicates rejection; confirm direction with surrounding structure.',
        wickRatio: `${upperWickPct0}% Rejection Wick`,
        displacementScore: 4,
      });
    }
  }

  // Fallback if no specific pattern matched
  if (detected.length === 0) {
    detected.push({
      type: 'NEUTRAL_DOJI',
      name: isBull0 ? 'Bullish Drift Bar' : 'Bearish Drift Bar',
      bias: isBull0 ? 'BULLISH' : 'BEARISH',
      reliability: 68,
      description: `Normal order flow progression (${bodyPct0}% body, ${isBull0 ? lowerWickPct0 : upperWickPct0}% wick).`,
      marketInsight: 'A directional candle alone is not a setup; wait for location and trigger confirmation.',
      wickRatio: `${bodyPct0}% Body`,
      displacementScore: 2,
    });
  }

  return {
    activePattern: detected[0],
    recentPatterns: detected,
    lastCandleMetrics: {
      range: Number(range0.toFixed(metricDigits)),
      body: Number(body0.toFixed(metricDigits)),
      upperWick: Number(upperWick0.toFixed(metricDigits)),
      lowerWick: Number(lowerWick0.toFixed(metricDigits)),
      bodyPct: bodyPct0,
      upperWickPct: upperWickPct0,
      lowerWickPct: lowerWickPct0,
      isBullish: isBull0,
    },
  };
}

export function analyzeGoldCandlestickPatterns(candles: Candle[]): CandlestickAnalysis {
  return analyzeCandlestickPatterns(candles, 0.1, 'Gold');
}
