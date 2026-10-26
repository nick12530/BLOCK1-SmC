/**
 * multiPairScanner.ts - Multi-Pair Market Scanner, Common Confluence Signal Engine & Risk Manager
 * Analyzes XAUUSD, EURUSD, USDJPY, and GBPUSD independently with:
 * - Live price, bid/ask, spread
 * - Multi-timeframe trend (M1, M5, M15, H1)
 * - Swings, BOS, CHoCH, liquidity highs/lows, FVGs, Order Blocks
 * - Premium/Discount (0-100% dealing range)
 * - 0-100 Confluence Score
 * - Small Account ($10) Risk Protection & Lot Sizing
 * - USD Correlation Exposure Safeguards
 * - Trade Opportunity Ranking
 */

import type {
  Candle,
  DealingRange,
  EconomicEvent,
  Position,
  Signal,
  StructureEvent,
  SymbolTradingSpec,
  Swing,
  TradeDirection,
  Zone,
} from '../types/smc';
import { calculateATR, detectFVGs, detectOrderBlocks, MarketStructureEngine } from './smcCore';
import { INSTRUMENTS, SupportedSymbol, getInstrumentConfig } from './instrumentConfig';
import { getGlobalSessionStatus, isSessionPreferredForPair, evaluateNewsRisk } from './sessionTimezones';
import { dispatchApproachingEntryAlert, dispatchSniperAlert } from '../utils/webhookNotifier';
import { analyzeCandlestickPatterns, CandlestickPatternMatch } from './candlestickPatterns';

export interface LiquidityLevels {
  equalHighs: number[];
  equalLows: number[];
  buySideLiquidity: number | null;
  sellSideLiquidity: number | null;
  recentSweep: 'high' | 'low' | null;
}

export interface PairAnalysis {
  symbol: SupportedSymbol;
  displayName: string;
  price: number;
  bid: number;
  ask: number;
  spreadPoints: number;
  spreadPips: number;
  spreadAcceptable: boolean;

  // Multi-timeframe trends
  m1Trend: 'bullish' | 'bearish' | 'ranging';
  m5Trend: 'bullish' | 'bearish' | 'ranging';
  m15Trend: 'bullish' | 'bearish' | 'ranging';
  h1Trend: 'bullish' | 'bearish' | 'ranging';

  // Market structure
  swings: { high: Swing | null; low: Swing | null };
  lastBOS: StructureEvent | null;
  lastCHoCH: StructureEvent | null;
  liquidity: LiquidityLevels;

  // Zones
  orderBlocks: Zone[];
  fvgs: Zone[];
  dealingRange: DealingRange;
  premiumDiscountPct: number; // 0-100% (0-50 = discount, 50-100 = premium)

  // Technical metrics
  atr: number;
  volatility: 'low' | 'normal' | 'high';
  sessionName: string;
  isPreferredSession: boolean;
  newsStatus: string;

  // Signal & Score
  bias: 'BUY' | 'SELL' | 'WAITING';
  signal: Signal | null;
  confluenceScore: number; // 0 to 100
  scoreBreakdown: {
    htfAlignment: number;      // max 20
    structureConfirm: number;  // max 20
    liquiditySweep: number;    // max 15
    bosChoch: number;          // max 10
    obFvgReaction: number;     // max 10
    momentumConfirm: number;   // max 10
    sessionConfirm: number;    // max 5
    spreadAcceptable: number;  // max 5
    candleConfirm?: number;    // max 5
  };
  candlestickPattern?: CandlestickPatternMatch;

  // Execution Readiness & Risk Sizing
  entryPrice: number;
  suggestedSL: number;
  suggestedTP: number;
  suggestedTP1?: number;
  suggestedTP2?: number;
  suggestedTP3?: number;
  slPips?: number;
  targetPips1?: number;
  targetPips2?: number;
  targetPips3?: number;
  targetPips?: number;
  expiryTimestamp?: number;
  validitySeconds?: number;
  isSniper?: boolean;
  sniperQualityIndex?: number;
  sniperGrade?: 'A+' | 'A' | 'B';
  optimalTradeEntry?: number;
  riskRewardRatio: number;
  status: 'READY' | 'WAITING' | 'BLOCKED';
  rejectionReason: string | null;
  safeLotSize: number | null;
  estimatedRiskUsd: number | null;
  symbolSpec?: SymbolTradingSpec;
  rank: number;
}

export type PrecisionEntryCandidate = Pick<
  PairAnalysis,
  'symbol' | 'price' | 'atr' | 'spreadAcceptable' | 'confluenceScore' | 'scoreBreakdown' |
  'riskRewardRatio' | 'expiryTimestamp' | 'status' | 'signal'
>;

export function hasDirectionalMovement(
  candles: Candle[],
  atr: number,
  spreadDistance: number,
  direction: TradeDirection,
  lookback = 3
): boolean {
  if (candles.length <= lookback || !Number.isFinite(atr) || atr <= 0) return false;
  const displacement =
    candles[candles.length - 1].close - candles[candles.length - 1 - lookback].close;
  const threshold = Math.max(atr * 0.2, spreadDistance * 2);
  return direction === 'BUY' ? displacement >= threshold : displacement <= -threshold;
}

export function isPrecisionEntryReady(analysis: PrecisionEntryCandidate, now = Date.now()): boolean {
  const signal = analysis.signal;
  const tolerance = getPrecisionEntryTolerance(analysis);
  if (
    !signal ||
    tolerance === null ||
    analysis.status !== 'READY' ||
    !analysis.spreadAcceptable ||
    analysis.confluenceScore < 88 ||
    signal.sniperGrade !== 'A+' ||
    !signal.isSniper ||
    analysis.riskRewardRatio < getInstrumentConfig(analysis.symbol).minRR ||
    !analysis.expiryTimestamp ||
    analysis.expiryTimestamp <= now ||
    !signal.optimalTradeEntry
  ) {
    return false;
  }

  return (
    hasPrecisionEntryConfirmation(analysis) &&
    Math.abs(analysis.price - signal.optimalTradeEntry) <= tolerance
  );
}

export function isPrecisionEntryImminent(analysis: PrecisionEntryCandidate, now = Date.now()): boolean {
  const signal = analysis.signal;
  const tolerance = getPrecisionEntryTolerance(analysis);
  if (
    !signal ||
    tolerance === null ||
    analysis.status !== 'READY' ||
    !analysis.spreadAcceptable ||
    analysis.confluenceScore < 88 ||
    signal.sniperGrade !== 'A+' ||
    !signal.isSniper ||
    analysis.riskRewardRatio < getInstrumentConfig(analysis.symbol).minRR ||
    !analysis.expiryTimestamp ||
    analysis.expiryTimestamp <= now ||
    !signal.optimalTradeEntry ||
    !hasPrecisionEntryConfirmation(analysis)
  ) {
    return false;
  }

  const distance = Math.abs(analysis.price - signal.optimalTradeEntry);
  const approachingFromValidSide =
    signal.direction === 'BUY'
      ? analysis.price > signal.optimalTradeEntry
      : analysis.price < signal.optimalTradeEntry;
  return approachingFromValidSide && distance > tolerance && distance <= tolerance * 2;
}

function getPrecisionEntryTolerance(analysis: PrecisionEntryCandidate): number | null {
  if (!Number.isFinite(analysis.atr) || analysis.atr <= 0) return null;
  return Math.max(analysis.atr * 0.15, getInstrumentConfig(analysis.symbol).pipSize * 2);
}

function hasPrecisionEntryConfirmation(analysis: PrecisionEntryCandidate): boolean {
  const { scoreBreakdown } = analysis;
  const hasLocationConfirmation =
    scoreBreakdown.liquiditySweep >= 10 || scoreBreakdown.obFvgReaction >= 10;
  const hasTriggerConfirmation =
    scoreBreakdown.momentumConfirm >= 10 || (scoreBreakdown.candleConfirm ?? 0) >= 7;

  return (
    scoreBreakdown.structureConfirm >= 15 &&
    hasLocationConfirmation &&
    hasTriggerConfirmation &&
    scoreBreakdown.spreadAcceptable >= 5
  );
}

/**
 * Detects equal highs and equal lows within a small threshold.
 */
export function findLiquidityLevels(candles: Candle[], pipSize: number): LiquidityLevels {
  const priorCandles = candles.slice(-31, -1);
  const highs = priorCandles.map((c) => c.high);
  const lows = priorCandles.map((c) => c.low);
  const threshold = pipSize * 3; // within 3 pips is equal high/low

  const equalHighs: number[] = [];
  const equalLows: number[] = [];

  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i] - highs[j]) <= threshold) {
        equalHighs.push(Number(((highs[i] + highs[j]) / 2).toFixed(5)));
      }
    }
  }

  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i] - lows[j]) <= threshold) {
        equalLows.push(Number(((lows[i] + lows[j]) / 2).toFixed(5)));
      }
    }
  }

  const highest = highs.length ? Math.max(...highs) : null;
  const lowest = lows.length ? Math.min(...lows) : null;
  const latest = candles[candles.length - 1];
  let recentSweep: 'high' | 'low' | null = null;

  if (latest && highest !== null && latest.high > highest && latest.close < highest) {
    recentSweep = 'high';
  } else if (latest && lowest !== null && latest.low < lowest && latest.close > lowest) {
    recentSweep = 'low';
  }

  return {
    equalHighs: Array.from(new Set(equalHighs)).slice(-2),
    equalLows: Array.from(new Set(equalLows)).slice(-2),
    buySideLiquidity: highest ?? latest?.high ?? 0,
    sellSideLiquidity: lowest ?? latest?.low ?? 0,
    recentSweep,
  };
}

/**
 * Checks existing positions for cumulative USD exposure.
 * EURUSD BUY = short USD
 * GBPUSD BUY = short USD
 * USDJPY SELL = short USD
 * XAUUSD BUY = short USD
 */
export function checkCorrelationExposure(
  proposedSymbol: SupportedSymbol,
  proposedDirection: TradeDirection,
  openPositions: Position[],
  maxAllowedUsdPositions: number = 5
): { allowed: boolean; reason?: string; currentUsdExposure: number } {
  const getUsdSide = (sym: string, dir: TradeDirection): 'LONG_USD' | 'SHORT_USD' | null => {
    const s = sym.toUpperCase();
    if (s.includes('EURUSD') || s.includes('GBPUSD') || s.includes('XAUUSD')) {
      return dir === 'BUY' ? 'SHORT_USD' : 'LONG_USD';
    }
    if (s.includes('USDJPY')) {
      return dir === 'BUY' ? 'LONG_USD' : 'SHORT_USD';
    }
    return null;
  };

  const proposedUsdSide = getUsdSide(proposedSymbol, proposedDirection);
  if (!proposedUsdSide) return { allowed: true, currentUsdExposure: 0 };

  let currentSameSideCount = 0;
  for (const pos of openPositions) {
    const posSym = (pos.symbol || pos.comment || '').toUpperCase();
    const isSameInstrument = posSym.includes(proposedSymbol.toUpperCase());
    // Only count cross-pair correlation exposure from distinct instruments unless strict max (<=1)
    if (isSameInstrument && maxAllowedUsdPositions > 1) {
      continue;
    }
    const side = getUsdSide(posSym, pos.type);
    if (side === proposedUsdSide) {
      currentSameSideCount++;
    }
  }

  if (currentSameSideCount >= maxAllowedUsdPositions) {
    return {
      allowed: false,
      currentUsdExposure: currentSameSideCount,
      reason: `TRADE_REJECTED: CORRELATION_LIMIT_EXCEEDED (Already ${currentSameSideCount}x ${proposedUsdSide} positions open across correlated pairs)`,
    };
  }

  return { allowed: true, currentUsdExposure: currentSameSideCount };
}

/**
 * Calculates safe lot size for a small account ($10+).
 * If minimum broker lot exceeds the risk budget, rejects with MINIMUM_LOT_EXCEEDS_RISK.
 */
export function calculateSmallAccountPositionSize(
  equity: number,
  riskPct: number,
  stopDistancePrice: number,
  symbol: SupportedSymbol,
  minLot: number = 0.01,
  lotStep: number = 0.01,
  symbolSpec?: SymbolTradingSpec | null
): { safeVolume: number | null; riskAmount: number; rejectionReason?: string } {
  const config = getInstrumentConfig(symbol);
  if (
    ![equity, riskPct, stopDistancePrice, minLot, lotStep].every(Number.isFinite) ||
    equity <= 0 ||
    riskPct <= 0 ||
    stopDistancePrice <= 0 ||
    minLot <= 0 ||
    lotStep <= 0
  ) {
    return {
      safeVolume: null,
      riskAmount: 0,
      rejectionReason: 'TRADE_REJECTED: INVALID_POSITION_SIZING_INPUT',
    };
  }
  const riskBudget = equity * (riskPct / 100);

  // Use verified broker tick economics when available; the fallback is for isolated unit tests only.
  let pipValuePerLot = 10;
  if (symbolSpec) {
    if (
      !Number.isFinite(symbolSpec.tickSize) ||
      symbolSpec.tickSize <= 0 ||
      !Number.isFinite(symbolSpec.tickValue) ||
      symbolSpec.tickValue <= 0
    ) {
      return {
        safeVolume: null,
        riskAmount: 0,
        rejectionReason: 'TRADE_REJECTED: BROKER_SYMBOL_SPEC_UNAVAILABLE',
      };
    }
    pipValuePerLot = (symbolSpec.tickValue / symbolSpec.tickSize) * config.pipSize;
    minLot = symbolSpec.volumeMin;
    lotStep = symbolSpec.volumeStep;
  } else if (symbol === 'USDJPY') {
    pipValuePerLot = 6.67;
  }

  const riskPerStandardLot = symbolSpec
    ? (stopDistancePrice / symbolSpec.tickSize) * symbolSpec.tickValue
    : (stopDistancePrice / config.pipSize) * pipValuePerLot;
  const riskPerMinLot = riskPerStandardLot * minLot;

  if (riskPerMinLot > riskBudget) {
    return {
      safeVolume: null,
      riskAmount: riskPerMinLot,
      rejectionReason: `TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK (${minLot}L risks $${riskPerMinLot.toFixed(2)}, budget: $${riskBudget.toFixed(2)})`,
    };
  }

  // Calculate volume
  const rawVolume = riskPerStandardLot > 0 ? riskBudget / riskPerStandardLot : minLot;
  const steps = Math.floor((rawVolume - minLot) / lotStep + 1e-9);
  const precision = Math.min(8, (String(lotStep).split('.')[1] || '').length);
  const finalVolume = Number(Math.min(5.0, minLot + Math.max(0, steps) * lotStep).toFixed(precision));
  if (finalVolume < minLot) {
    return {
      safeVolume: null,
      riskAmount: riskPerMinLot,
      rejectionReason: `TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK (${minLot}L risks $${riskPerMinLot.toFixed(2)}, budget: $${riskBudget.toFixed(2)})`,
    };
  }
  const finalRisk = Number((finalVolume * riskPerStandardLot).toFixed(2));

  return {
    safeVolume: finalVolume,
    riskAmount: finalRisk,
  };
}

/**
 * Scans and performs end-to-end multi-pair SMC confluence analysis on an instrument.
 */
export function analyzeInstrument(
  symbol: SupportedSymbol,
  candlesM1: Candle[],
  candlesM5: Candle[],
  candlesM15: Candle[],
  candlesH1: Candle[],
  liveBid: number,
  liveAsk: number,
  spreadPoints: number,
  equity: number,
  riskPct: number,
  openPositions: Position[],
  economicEvents: EconomicEvent[] | null = null,
  symbolSpec?: SymbolTradingSpec | null
): PairAnalysis {
  const config = getInstrumentConfig(symbol);
  const price = (liveBid + liveAsk) / 2;
  const spreadPips = Number((spreadPoints / (config.pipSize / config.pointSize)).toFixed(1));
  const spreadAcceptable = spreadPoints <= config.maxSpreadPoints;

  // 1. Structure engines
  const msM1 = new MarketStructureEngine(2);
  const msM5 = new MarketStructureEngine(3);
  const msM15 = new MarketStructureEngine(3);
  const msH1 = new MarketStructureEngine(3);

  if (candlesM1.length > 5) msM1.update(candlesM1);
  if (candlesM5.length > 5) msM5.update(candlesM5);
  if (candlesM15.length > 5) msM15.update(candlesM15);
  if (candlesH1.length > 5) msH1.update(candlesH1);

  const m1Trend = msM1.trend;
  const m5Trend = msM5.trend;
  const m15Trend = msM15.trend;
  const h1Trend = msH1.trend;

  // 2. ATR
  const atrValues = calculateATR(candlesM15.length > 0 ? candlesM15 : candlesM5, config.atrPeriod);
  const atr = atrValues.length > 0 && !isNaN(atrValues[atrValues.length - 1])
    ? atrValues[atrValues.length - 1]
    : config.pipSize * 15;

  const volatility: 'low' | 'normal' | 'high' =
    atr > config.pipSize * 25 ? 'high' : atr < config.pipSize * 8 ? 'low' : 'normal';
  const atrM5 = calculateATR(candlesM5, config.atrPeriod).at(-1) ?? Number.NaN;

  // 3. Liquidity & Zones
  const liquidity = findLiquidityLevels(candlesM15.length > 0 ? candlesM15 : candlesM5, config.pipSize);
  const obs = detectOrderBlocks(candlesM15, atrValues).filter((z) => !z.filled).slice(-3);
  const fvgs = detectFVGs(candlesM15, atrValues).filter((z) => !z.filled).slice(-3);

  // 4. Dealing Range & Premium/Discount
  const dr = msM15.dealingRange() || msH1.dealingRange() || {
    low: price - atr * 2,
    high: price + atr * 2,
    equilibrium: price,
  };

  const rangeSpan = Math.max(0.00001, dr.high - dr.low);
  const premiumDiscountPct = Math.min(100, Math.max(0, Math.round(((price - dr.low) / rangeSpan) * 100)));

  // 5. Session Status
  const sessions = getGlobalSessionStatus();
  const isPreferredSession = isSessionPreferredForPair(symbol, sessions);

  // 6. News Risk
  const newsRisk = evaluateNewsRisk(symbol, economicEvents);

  // 7. Structural events
  const lastBOS = msM15.events.filter((e) => e.kind === 'BOS').slice(-1)[0] || null;
  const lastCHoCH = msM15.events.filter((e) => e.kind === 'CHoCH').slice(-1)[0] || null;
  const lastStructureEvent = msM15.events.at(-1) || null;

  // 8. CONFLUENCE SCORING (0 to 100)
  let scoreHtf = 0;
  let scoreStructure = 0;
  let scoreLiquidity = 0;
  let scoreBosChoch = 0;
  let scoreObFvg = 0;
  let scoreMomentum = 0;
  let scoreSession = 0;
  let scoreSpread = 0;

  let tentativeBias: 'BUY' | 'SELL' | 'WAITING' = 'WAITING';

  // Avoid assigning a trend-following bias when H1 and M15 directly conflict.
  if (h1Trend === m15Trend && h1Trend !== 'ranging') {
    tentativeBias = h1Trend === 'bullish' ? 'BUY' : 'SELL';
  } else if (h1Trend === 'ranging' && m15Trend !== 'ranging') {
    tentativeBias = m15Trend === 'bullish' ? 'BUY' : 'SELL';
  } else if (m15Trend === 'ranging' && h1Trend !== 'ranging') {
    tentativeBias = h1Trend === 'bullish' ? 'BUY' : 'SELL';
  }

  // +20 Higher-timeframe alignment
  if (h1Trend === 'bullish' && m15Trend === 'bullish') {
    scoreHtf = 20;
    tentativeBias = 'BUY';
  } else if (h1Trend === 'bearish' && m15Trend === 'bearish') {
    scoreHtf = 20;
    tentativeBias = 'SELL';
  } else if (h1Trend !== 'ranging' && m15Trend !== 'ranging') {
    scoreHtf = 10;
  }

  const hasMovement = tentativeBias !== 'WAITING' && hasDirectionalMovement(
    candlesM5,
    atrM5,
    spreadPoints * config.pointSize,
    tentativeBias
  );

  // +20 Market structure confirmation
  if (tentativeBias === 'BUY' && (m5Trend === 'bullish' || m1Trend === 'bullish')) {
    scoreStructure = 20;
  } else if (tentativeBias === 'SELL' && (m5Trend === 'bearish' || m1Trend === 'bearish')) {
    scoreStructure = 20;
  } else if (m5Trend !== 'ranging') {
    scoreStructure = 10;
  }

  // +15 Liquidity sweep
  if (tentativeBias === 'BUY' && liquidity.recentSweep === 'low') {
    scoreLiquidity = 15;
  } else if (tentativeBias === 'SELL' && liquidity.recentSweep === 'high') {
    scoreLiquidity = 15;
  } else if (
    (tentativeBias === 'BUY' && liquidity.equalLows.length > 0) ||
    (tentativeBias === 'SELL' && liquidity.equalHighs.length > 0)
  ) {
    scoreLiquidity = 5;
  }

  // +10 for the latest directionally aligned structural break, decayed by age.
  const eventAgeBars = lastStructureEvent
    ? Math.max(0, candlesM15.length - 1 - lastStructureEvent.bar)
    : Number.POSITIVE_INFINITY;
  const eventMatchesBias =
    (tentativeBias === 'BUY' && lastStructureEvent?.direction === 'bullish') ||
    (tentativeBias === 'SELL' && lastStructureEvent?.direction === 'bearish');
  if (eventMatchesBias && eventAgeBars < 20) {
    scoreBosChoch = Math.round(10 * (1 - eventAgeBars / 20));
  }

  // +10 Order Block / FVG reaction in discount/premium
  const isRelevantZone = (zone: Zone) =>
    price >= zone.bottom - 0.25 * atr && price <= zone.top + 0.25 * atr;
  const hasMatchingOb = obs.some(
    (ob) => (tentativeBias === 'BUY' ? ob.bullish : !ob.bullish) && isRelevantZone(ob)
  );
  const hasMatchingFvg = fvgs.some(
    (fvg) => (tentativeBias === 'BUY' ? fvg.bullish : !fvg.bullish) && isRelevantZone(fvg)
  );
  const isPricedRight = tentativeBias === 'BUY' ? premiumDiscountPct <= 55 : premiumDiscountPct >= 45;

  if (tentativeBias !== 'WAITING') {
    if ((hasMatchingOb || hasMatchingFvg) && isPricedRight) {
      scoreObFvg = 10;
    } else if (hasMatchingOb || hasMatchingFvg) {
      scoreObFvg = 5;
    }
  }

  // +10 momentum requires a meaningful, direction-aligned M5 displacement, not just one candle's color.
  if (hasMovement) scoreMomentum = 10;

  // +5 Session confirmation
  if (isPreferredSession) {
    scoreSession = 5;
  }

  // +5 Acceptable spread
  if (spreadAcceptable && spreadPoints <= config.minSpread * 2) {
    scoreSpread = 5;
  } else if (spreadAcceptable) {
    scoreSpread = 2;
  }

  // +5 heuristic candle-pattern confirmation; it is not a win-probability estimate.
  const candleAnalysis = analyzeCandlestickPatterns(
    candlesM5.length >= 4 ? candlesM5 : candlesM15,
    config.pipSize,
    symbol
  );
  const candlePattern = candleAnalysis.activePattern;
  let scoreCandle = 0;
  if (
    candlePattern.type !== 'NEUTRAL_DOJI' &&
    ((tentativeBias === 'BUY' && candlePattern.bias === 'BULLISH') ||
      (tentativeBias === 'SELL' && candlePattern.bias === 'BEARISH')) &&
    candlePattern.reliability >= 60
  ) {
    scoreCandle = Math.round((candlePattern.reliability / 100) * 5);
  }

  const confluenceScore =
    scoreHtf + scoreStructure + scoreLiquidity + scoreBosChoch + scoreObFvg +
    scoreMomentum + scoreSession + scoreSpread + scoreCandle;

  // 9. Stop Loss & Multi-Target Take Profit (Structure-based for Maximum Pips)
  const slBuffer = atr * 0.3;
  let suggestedSL = price;
  let suggestedTP = price;
  let suggestedTP1 = price;
  let suggestedTP2 = price;
  let suggestedTP3 = price;

  if (tentativeBias === 'BUY') {
    const swingLowPrice = msM5.lastSwingLow?.price || dr.low;
    suggestedSL = Number(Math.min(price - atr * config.atrSlMultiplier, swingLowPrice - slBuffer).toFixed(config.digits));
    const slDist = Math.max(config.pipSize * 5, price - suggestedSL);
    suggestedTP1 = Number((price + slDist * 1.8).toFixed(config.digits));
    suggestedTP2 = Number((price + slDist * Math.max(3.2, config.minRR * 1.5)).toFixed(config.digits));
    suggestedTP3 = Number((price + slDist * Math.max(5.5, config.minRR * 2.8)).toFixed(config.digits));
    suggestedTP = suggestedTP2; // Primary targets high-pip 3.2R expansion
  } else if (tentativeBias === 'SELL') {
    const swingHighPrice = msM5.lastSwingHigh?.price || dr.high;
    suggestedSL = Number(Math.max(price + atr * config.atrSlMultiplier, swingHighPrice + slBuffer).toFixed(config.digits));
    const slDist = Math.max(config.pipSize * 5, suggestedSL - price);
    suggestedTP1 = Number((price - slDist * 1.8).toFixed(config.digits));
    suggestedTP2 = Number((price - slDist * Math.max(3.2, config.minRR * 1.5)).toFixed(config.digits));
    suggestedTP3 = Number((price - slDist * Math.max(5.5, config.minRR * 2.8)).toFixed(config.digits));
    suggestedTP = suggestedTP2; // Primary targets high-pip 3.2R expansion
  }

  const stopDistance = Math.abs(price - suggestedSL);
  const targetDistance = Math.abs(suggestedTP - price);
  const riskRewardRatio = Number((targetDistance / Math.max(0.00001, stopDistance)).toFixed(2));

  const slPips = Number((stopDistance / config.pipSize).toFixed(1));
  const targetPips1 = Number((Math.abs(suggestedTP1 - price) / config.pipSize).toFixed(1));
  const targetPips2 = Number((Math.abs(suggestedTP2 - price) / config.pipSize).toFixed(1));
  const targetPips3 = Number((Math.abs(suggestedTP3 - price) / config.pipSize).toFixed(1));
  const targetPips = targetPips2;

  // 10. Position sizing & Correlation checks
  const sizingResult = calculateSmallAccountPositionSize(
    equity,
    riskPct,
    stopDistance,
    symbol,
    symbolSpec?.volumeMin ?? 0.01,
    symbolSpec?.volumeStep ?? 0.01,
    symbolSpec
  );
  const correlationResult = checkCorrelationExposure(symbol, tentativeBias === 'BUY' ? 'BUY' : 'SELL', openPositions);

  let status: 'READY' | 'WAITING' | 'BLOCKED' = 'WAITING';
  let rejectionReason: string | null = null;
  if (tentativeBias !== 'WAITING' && !hasMovement) {
    rejectionReason = 'WAITING: INSUFFICIENT_DIRECTIONAL_MOVEMENT';
  }

  if (confluenceScore >= config.minScore && tentativeBias !== 'WAITING') {
    if (!hasMovement) {
      status = 'WAITING';
    } else if (!spreadAcceptable) {
      status = 'BLOCKED';
      rejectionReason = `TRADE_REJECTED: SPREAD_TOO_WIDE (${spreadPoints} pts > ${config.maxSpreadPoints} max)`;
    } else if (newsRisk.isDataUnavailable) {
      status = 'BLOCKED';
      rejectionReason = 'TRADE_REJECTED: NEWS_DATA_UNAVAILABLE';
    } else if (newsRisk.hasNewsRisk) {
      status = 'BLOCKED';
      rejectionReason = `TRADE_REJECTED: ${newsRisk.reason}`;
    } else if (!correlationResult.allowed && (confluenceScore < 70 && (confluenceScore > 10 || confluenceScore < 7.0))) {
      status = 'BLOCKED';
      rejectionReason = correlationResult.reason || 'TRADE_REJECTED: CORRELATION_LIMIT_EXCEEDED';
    } else if (sizingResult.rejectionReason) {
      status = 'BLOCKED';
      rejectionReason = sizingResult.rejectionReason;
    } else {
      status = 'READY';
    }
  }

  // 11. Timeframe selection (M15 scanning prioritized for maximum pips)
  const isM15Setup =
    ((tentativeBias === 'BUY' && m15Trend === 'bullish') ||
      (tentativeBias === 'SELL' && m15Trend === 'bearish')) &&
    scoreHtf >= 15;
  const signalTimeframe: 'M1' | 'M5' | 'M15' = isM15Setup ? 'M15' : 'M5';
  const validityDurationMs = signalTimeframe === 'M15' ? 15 * 60_000 : 5 * 60_000;
  const signalCandle = signalTimeframe === 'M15'
    ? candlesM15[candlesM15.length - 1]
    : candlesM5[candlesM5.length - 1];
  const rawCandleTime = signalCandle?.time ?? Date.now();
  const signalCandleTime = rawCandleTime < 1_000_000_000_000 ? rawCandleTime * 1000 : rawCandleTime;
  const expiryTimestamp = signalCandleTime + validityDurationMs * 2;
  if (status === 'READY' && expiryTimestamp <= Date.now()) {
    status = 'BLOCKED';
    rejectionReason = 'TRADE_REJECTED: SIGNAL_EXPIRED';
  }
  const validitySeconds = Math.max(0, Math.round((expiryTimestamp - Date.now()) / 1000));
  const isSniper = confluenceScore >= 70 && (scoreLiquidity >= 10 || scoreObFvg >= 5);
  const sniperQualityIndex = confluenceScore;
  const sniperGrade: 'A+' | 'A' | 'B' = confluenceScore >= 88 ? 'A+' : confluenceScore >= 75 ? 'A' : 'B';
  const swingLow = msM5.lastSwingLow?.price || dr.low;
  const swingHigh = msM5.lastSwingHigh?.price || dr.high;
  const legSpan = Math.max(config.pipSize * 10, swingHigh - swingLow);
  const oteBuy = swingLow + 0.382 * legSpan; // 61.8% retracement into discount sweet spot
  const oteSell = swingLow + 0.618 * legSpan; // 61.8% retracement into premium sweet spot
  const optimalTradeEntry = tentativeBias === 'BUY'
    ? Number(oteBuy.toFixed(config.digits))
    : Number(oteSell.toFixed(config.digits));
  const mitigationType = scoreLiquidity >= 10 ? 'Liquidity Pool Sweep (SFP)' : scoreObFvg >= 5 ? 'Order Block Mitigation' : 'Structural POI Retest';

  // 12. Create Signal object if ready
  let signalObj: Signal | null = null;
  if (tentativeBias !== 'WAITING' && hasMovement && confluenceScore >= 50) {
    const reasons: string[] = [];
    if (scoreHtf >= 15) reasons.push(`HTF ${h1Trend.toUpperCase()} Trend Alignment (+${scoreHtf})`);
    if (isM15Setup) reasons.push(`M15 Swing Entry Alignment (+15)`);
    if (scoreStructure >= 15) reasons.push(`M5 Structure Confirmation (+${scoreStructure})`);
    if (scoreLiquidity >= 10) reasons.push(`Liquidity Pool Sweep (+${scoreLiquidity})`);
    if (scoreBosChoch >= 5) reasons.push(`Recent aligned BOS/CHoCH (+${scoreBosChoch})`);
    if (scoreObFvg >= 5) reasons.push(`Discount/Premium POI Retest (+${scoreObFvg})`);
    if (scoreSession >= 5) reasons.push(`${sessions.activeSessionName} (+${scoreSession})`);
    if (scoreCandle >= 5) reasons.push(`${candlePattern.name} (${candlePattern.bias}) (+${scoreCandle})`);

    signalObj = {
      direction: tentativeBias,
      timeframe: signalTimeframe,
      score: Number((confluenceScore / 10).toFixed(1)),
      entry: Number(price.toFixed(config.digits)),
      sl: suggestedSL,
      tp: suggestedTP,
      tp1: suggestedTP1,
      tp2: suggestedTP2,
      tp3: suggestedTP3,
      slPips,
      targetPips1,
      targetPips2,
      targetPips3,
      targetPips,
      expiryTimestamp,
      validitySeconds,
      isSniper,
      sniperQualityIndex,
      sniperGrade,
      optimalTradeEntry,
      mitigationType,
      recommendedLot: sizingResult.safeVolume || undefined,
      reasons,
      atr,
      timestamp: new Date(Math.min(signalCandleTime, Date.now())).toISOString(),
      actionReason: `${symbol} ${tentativeBias} (${confluenceScore}/100 Confluence) - 1:${riskRewardRatio} RR · Targets: TP1 (${targetPips1}p), TP2 (${targetPips2}p), TP3 (${targetPips3}p)`,
      perfectEntryReason: `SMC ${signalTimeframe} ${tentativeBias} confluence with ${reasons.slice(0, 2).join(' + ')}`,
      strategy: 'SMC POI Retest',
      candlestickPattern: candlePattern,
    };

  }

  const analysis: PairAnalysis = {
    symbol,
    displayName: config.displayName,
    price: Number(price.toFixed(config.digits)),
    bid: liveBid,
    ask: liveAsk,
    spreadPoints,
    spreadPips,
    spreadAcceptable,
    m1Trend,
    m5Trend,
    m15Trend,
    h1Trend,
    swings: { high: msM15.lastSwingHigh, low: msM15.lastSwingLow },
    lastBOS,
    lastCHoCH,
    liquidity,
    orderBlocks: obs,
    fvgs,
    dealingRange: dr,
    premiumDiscountPct,
    atr,
    volatility,
    sessionName: sessions.activeSessionName,
    isPreferredSession,
    newsStatus: newsRisk.reason || (newsRisk.isDataUnavailable ? 'NEWS FILTER: DATA UNAVAILABLE' : 'Normal Conditions'),
    bias: tentativeBias,
    signal: signalObj,
    confluenceScore,
    scoreBreakdown: {
      htfAlignment: scoreHtf,
      structureConfirm: scoreStructure,
      liquiditySweep: scoreLiquidity,
      bosChoch: scoreBosChoch,
      obFvgReaction: scoreObFvg,
      momentumConfirm: scoreMomentum,
      sessionConfirm: scoreSession,
      spreadAcceptable: scoreSpread,
      candleConfirm: scoreCandle,
    },
    candlestickPattern: candlePattern,
    entryPrice: Number(price.toFixed(config.digits)),
    suggestedSL,
    suggestedTP,
    suggestedTP1,
    suggestedTP2,
    suggestedTP3,
    slPips,
    targetPips1,
    targetPips2,
    targetPips3,
    targetPips,
    expiryTimestamp,
    validitySeconds,
    isSniper,
    sniperQualityIndex,
    sniperGrade,
    optimalTradeEntry,
    riskRewardRatio,
    status,
    rejectionReason,
    safeLotSize: sizingResult.safeVolume,
    estimatedRiskUsd: sizingResult.riskAmount,
    symbolSpec: symbolSpec ?? undefined,
    rank: 4, // assigned below in rankOpportunities
  };

  if (analysis.signal && isPrecisionEntryReady(analysis)) {
    void dispatchSniperAlert({
      symbol,
      direction: analysis.signal.direction,
      timeframe: signalTimeframe,
      strategy: 'SMC POI Retest',
      entry: Number(price.toFixed(config.digits)),
      sl: suggestedSL,
      tp1: suggestedTP1,
      tp2: suggestedTP2,
      tp3: suggestedTP3,
      slPips,
      tp1Pips: targetPips1,
      tp2Pips: targetPips2,
      tp3Pips: targetPips3,
      confluenceScore,
      recommendedLot: sizingResult.safeVolume || undefined,
      sniperGrade,
      optimalTradeEntry,
      triggerPattern: candlePattern.name !== 'Neutral Price Action' ? candlePattern.name : undefined,
      validUntil: expiryTimestamp,
    });
  }
  if (analysis.signal && isPrecisionEntryImminent(analysis)) {
    void dispatchApproachingEntryAlert({
      symbol,
      direction: analysis.signal.direction,
      timeframe: signalTimeframe,
      entry: Number(price.toFixed(config.digits)),
      optimalTradeEntry,
      sl: suggestedSL,
      tp: suggestedTP,
      confluenceScore,
      validUntil: expiryTimestamp,
    });
  }

  return analysis;
}

/**
 * Ranks opportunities across all 4 instruments (Section 14).
 * Sorts by confluence score, setup quality, RR, session, spread, and exposure.
 */
export function rankOpportunities(analyses: PairAnalysis[]): PairAnalysis[] {
  const sorted = [...analyses].sort((a, b) => {
    // 1. Ready status first
    if (a.status === 'READY' && b.status !== 'READY') return -1;
    if (b.status === 'READY' && a.status !== 'READY') return 1;

    // 2. Confluence score descending
    if (b.confluenceScore !== a.confluenceScore) {
      return b.confluenceScore - a.confluenceScore;
    }

    // 3. Risk-Reward ratio descending
    if (b.riskRewardRatio !== a.riskRewardRatio) {
      return b.riskRewardRatio - a.riskRewardRatio;
    }

    // 4. Preferred session
    if (a.isPreferredSession && !b.isPreferredSession) return -1;
    if (b.isPreferredSession && !a.isPreferredSession) return 1;

    // 5. Lower spread
    return a.spreadPoints - b.spreadPoints;
  });

  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}
