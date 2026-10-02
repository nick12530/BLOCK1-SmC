/**
 * candlestickPatterns.ts - Institutional Gold (XAUUSD) Candlestick Pattern Engine
 * Masters all major candlestick reversal & continuation patterns specifically calibrated
 * for Gold volatility, liquidity sweeps, and Smart Money Concepts.
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
  reliability: number; // 0 to 100%
  description: string;
  goldInsight: string; // Specific gold volatility & SMC trading guidance
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
 * Masters and detects all major candlestick patterns on XAUUSD
 */
export function analyzeGoldCandlestickPatterns(candles: Candle[]): CandlestickAnalysis {
  if (candles.length < 4) {
    return {
      activePattern: {
        type: 'NEUTRAL_DOJI',
        name: 'Neutral Price Action',
        bias: 'NEUTRAL',
        reliability: 50,
        description: 'Insufficient candles for pattern confirmation.',
        goldInsight: 'Wait for M5/M15 candle close before committing volume.',
        wickRatio: '50% Body',
        displacementScore: 1,
      },
      recentPatterns: [],
      lastCandleMetrics: {
        range: 1,
        body: 0.5,
        upperWick: 0.25,
        lowerWick: 0.25,
        bodyPct: 50,
        upperWickPct: 25,
        lowerWickPct: 25,
        isBullish: true,
      },
    };
  }

  const c0 = candles[candles.length - 1]; // Latest candle
  const c1 = candles[candles.length - 2]; // Previous candle
  const c2 = candles[candles.length - 3]; // 2 candles ago
  const c3 = candles[candles.length - 4]; // 3 candles ago

  // Candle 0 metrics
  const range0 = Math.max(0.1, c0.high - c0.low);
  const body0 = Math.abs(c0.close - c0.open);
  const upperWick0 = c0.high - Math.max(c0.open, c0.close);
  const lowerWick0 = Math.min(c0.open, c0.close) - c0.low;
  const isBull0 = c0.close >= c0.open;

  const upperWickPct0 = Math.round((upperWick0 / range0) * 100);
  const lowerWickPct0 = Math.round((lowerWick0 / range0) * 100);
  const bodyPct0 = Math.round((body0 / range0) * 100);

  // Candle 1 metrics
  const range1 = Math.max(0.1, c1.high - c1.low);
  const body1 = Math.abs(c1.close - c1.open);
  const isBull1 = c1.close >= c1.open;
  const isBull2 = c2.close >= c2.open;

  const detected: CandlestickPatternMatch[] = [];

  // 1. LIQUIDITY SWEEP PINBAR (High Institutional Win-Rate on Gold)
  if (lowerWickPct0 >= 55 && bodyPct0 <= 35) {
    detected.push({
      type: 'SWEEP_PINBAR',
      name: 'Bullish Liquidity Sweep Pinbar (Hammer)',
      bias: 'BULLISH',
      reliability: 94,
      description: `Long lower rejection wick (${lowerWickPct0}%) purges sell-side liquidity before strong aggressive buyer recovery.`,
      goldInsight: 'XAUUSD sweeps Asian or session lows to trigger retail stops into institutional buy limits.',
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
      goldInsight: 'Gold tests psychological round figures (e.g. .00 / .50) before violent supply displacement.',
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
      goldInsight: 'Indicates interbank algorithmic buy program activation. Enter on 50% retest of the engulfing body.',
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
      goldInsight: 'Classic Gold distribution pattern following premium liquidity grab. Target opposing discount demand.',
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
      goldInsight: 'Signals completion of discount order block mitigation. Very reliable at London/NY open.',
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
      goldInsight: 'High probability signal when formed at the high of the day (HOD).',
      wickRatio: '3-Bar Cluster',
      displacementScore: 4,
    });
  }

  // 4. TWEEZER TOPS & BOTTOMS (Equal Highs / Equal Lows Retest)
  const equalLows = Math.abs(c0.low - c1.low) <= 0.35 && lowerWickPct0 > 30;
  const equalHighs = Math.abs(c0.high - c1.high) <= 0.35 && upperWickPct0 > 30;
  if (equalLows) {
    detected.push({
      type: 'TWEEZER_BOTTOM',
      name: 'Tweezer Bottoms (Double Key Level Defense)',
      bias: 'BULLISH',
      reliability: 87,
      description: 'Consecutive candles rejected at exact same low boundary, confirming institutional limit order defense.',
      goldInsight: 'Strong floor formed on Gold. Place Stop Loss 1.5 points below tweezer lows.',
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
      goldInsight: 'Sellers firmly defending resistance level. Look for breakdown below tweezer low.',
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
      goldInsight: 'Confirms runaway trend regime on Gold. Avoid shorting; buy pullbacks to M5 Order Blocks.',
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
      goldInsight: 'Violent liquidation phase on Gold. Target HTF discount equilibrium.',
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
      goldInsight: 'Gold consolidates tightly before NY open or high-impact US economic releases (CPI/NFP).',
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
        goldInsight: 'Sellers exhausted all supply during the bar; buyers completely reclaimed territory.',
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
        goldInsight: 'Buyers attempted push to highs but were crushed by institutional supply overhead.',
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
      goldInsight: 'Standard price delivery within the current dealing range. Await POI touch.',
      wickRatio: `${bodyPct0}% Body`,
      displacementScore: 2,
    });
  }

  return {
    activePattern: detected[0],
    recentPatterns: detected,
    lastCandleMetrics: {
      range: Number(range0.toFixed(2)),
      body: Number(body0.toFixed(2)),
      upperWick: Number(upperWick0.toFixed(2)),
      lowerWick: Number(lowerWick0.toFixed(2)),
      bodyPct: bodyPct0,
      upperWickPct: upperWickPct0,
      lowerWickPct: lowerWickPct0,
      isBullish: isBull0,
    },
  };
}
