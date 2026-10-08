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
  Swing,
  TradeDirection,
  Zone,
} from '../types/smc';
import { calculateATR, detectFVGs, detectOrderBlocks, MarketStructureEngine } from './smcCore';
import { INSTRUMENTS, SupportedSymbol, getInstrumentConfig } from './instrumentConfig';
import { getGlobalSessionStatus, isSessionPreferredForPair, evaluateNewsRisk } from './sessionTimezones';

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
    bosChoch: number;          // max 15
    obFvgReaction: number;     // max 10
    momentumConfirm: number;   // max 10
    sessionConfirm: number;    // max 5
    spreadAcceptable: number;  // max 5
  };

  // Execution Readiness & Risk Sizing
  entryPrice: number;
  suggestedSL: number;
  suggestedTP: number;
  riskRewardRatio: number;
  status: 'READY' | 'WAITING' | 'BLOCKED';
  rejectionReason: string | null;
  safeLotSize: number | null;
  estimatedRiskUsd: number | null;
  rank: number;
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
  maxAllowedUsdPositions: number = 2
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
    const side = getUsdSide(pos.symbol || pos.comment || '', pos.type);
    if (side === proposedUsdSide) {
      currentSameSideCount++;
    }
  }

  if (currentSameSideCount >= maxAllowedUsdPositions) {
    return {
      allowed: false,
      currentUsdExposure: currentSameSideCount,
      reason: `TRADE_REJECTED: CORRELATION_LIMIT_EXCEEDED (Already ${currentSameSideCount}x ${proposedUsdSide} positions open)`,
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
  lotStep: number = 0.01
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

  // Dollar value of 1 pip for 1 standard lot
  // For EURUSD / GBPUSD: 1 lot ($100,000) = $10 per pip ($1 per pip for 0.1 lot, $0.10 per pip for 0.01 lot)
  // For USDJPY: 1 lot = $100,000 / JPY rate ~ $6.50 per pip ($0.065 per pip for 0.01 lot)
  // For XAUUSD: 1 lot (100 oz) = $1 per 0.01 ($100 per pt) -> 0.01 lot = $1 per $1.00 move
  let pipValuePerLot = 10;
  if (symbol === 'USDJPY') pipValuePerLot = 6.67;
  else if (symbol === 'XAUUSD') pipValuePerLot = 10; // 0.1 pt = $10 on 1 lot

  const stopPips = stopDistancePrice / config.pipSize;
  const riskPerStandardLot = stopPips * pipValuePerLot;
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
  economicEvents: EconomicEvent[] | null = null
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

  // Determine tentative direction from HTF
  if (h1Trend === 'bullish' || m15Trend === 'bullish') {
    tentativeBias = 'BUY';
  } else if (h1Trend === 'bearish' || m15Trend === 'bearish') {
    tentativeBias = 'SELL';
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

  // +20 Market structure confirmation
  if (tentativeBias === 'BUY' && (m5Trend === 'bullish' || m1Trend === 'bullish')) {
    scoreStructure = 20;
  } else if (tentativeBias === 'SELL' && (m5Trend === 'bearish' || m1Trend === 'bearish')) {
    scoreStructure = 20;
  } else if (m5Trend !== 'ranging') {
    scoreStructure = 10;
  }

  // +15 Liquidity sweep
  if (tentativeBias === 'BUY' && (liquidity.recentSweep === 'low' || liquidity.equalLows.length > 0)) {
    scoreLiquidity = 15;
  } else if (tentativeBias === 'SELL' && (liquidity.recentSweep === 'high' || liquidity.equalHighs.length > 0)) {
    scoreLiquidity = 15;
  }

  // +15 BOS / CHoCH
  if (lastBOS || lastCHoCH) {
    const event = lastBOS || lastCHoCH;
    if (tentativeBias === 'BUY' && event?.direction === 'bullish') {
      scoreBosChoch = 15;
    } else if (tentativeBias === 'SELL' && event?.direction === 'bearish') {
      scoreBosChoch = 15;
    } else {
      scoreBosChoch = 5;
    }
  }

  // +10 Order Block / FVG reaction in discount/premium
  const hasMatchingOb = obs.some((ob) => (tentativeBias === 'BUY' ? ob.bullish : !ob.bullish));
  const hasMatchingFvg = fvgs.some((fvg) => (tentativeBias === 'BUY' ? fvg.bullish : !fvg.bullish));
  const isPricedRight = tentativeBias === 'BUY' ? premiumDiscountPct <= 55 : premiumDiscountPct >= 45;

  if ((hasMatchingOb || hasMatchingFvg) && isPricedRight) {
    scoreObFvg = 10;
  } else if (hasMatchingOb || hasMatchingFvg) {
    scoreObFvg = 5;
  }

  // +10 Momentum confirmation
  const latestM1 = candlesM1[candlesM1.length - 1];
  if (latestM1) {
    const isM1Bullish = latestM1.close > latestM1.open;
    if (tentativeBias === 'BUY' && isM1Bullish) scoreMomentum = 10;
    else if (tentativeBias === 'SELL' && !isM1Bullish) scoreMomentum = 10;
  }

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

  const confluenceScore = Math.min(
    100,
    scoreHtf + scoreStructure + scoreLiquidity + scoreBosChoch + scoreObFvg + scoreMomentum + scoreSession + scoreSpread
  );

  // 9. Stop Loss & Take Profit (Structure-based)
  const slBuffer = atr * 0.3;
  let suggestedSL = price;
  let suggestedTP = price;

  if (tentativeBias === 'BUY') {
    const swingLowPrice = msM5.lastSwingLow?.price || dr.low;
    suggestedSL = Number(Math.min(price - atr * config.atrSlMultiplier, swingLowPrice - slBuffer).toFixed(config.digits));
    const slDist = Math.max(config.pipSize * 5, price - suggestedSL);
    suggestedTP = Number((price + slDist * config.minRR).toFixed(config.digits));
  } else if (tentativeBias === 'SELL') {
    const swingHighPrice = msM5.lastSwingHigh?.price || dr.high;
    suggestedSL = Number(Math.max(price + atr * config.atrSlMultiplier, swingHighPrice + slBuffer).toFixed(config.digits));
    const slDist = Math.max(config.pipSize * 5, suggestedSL - price);
    suggestedTP = Number((price - slDist * config.minRR).toFixed(config.digits));
  }

  const stopDistance = Math.abs(price - suggestedSL);
  const targetDistance = Math.abs(suggestedTP - price);
  const riskRewardRatio = Number((targetDistance / Math.max(0.00001, stopDistance)).toFixed(2));

  // 10. Position sizing & Correlation checks
  const sizingResult = calculateSmallAccountPositionSize(equity, riskPct, stopDistance, symbol);
  const correlationResult = checkCorrelationExposure(symbol, tentativeBias === 'BUY' ? 'BUY' : 'SELL', openPositions);

  let status: 'READY' | 'WAITING' | 'BLOCKED' = 'WAITING';
  let rejectionReason: string | null = null;

  if (confluenceScore >= config.minScore && tentativeBias !== 'WAITING') {
    if (!spreadAcceptable) {
      status = 'BLOCKED';
      rejectionReason = `TRADE_REJECTED: SPREAD_TOO_WIDE (${spreadPoints} pts > ${config.maxSpreadPoints} max)`;
    } else if (newsRisk.hasNewsRisk) {
      status = 'BLOCKED';
      rejectionReason = `TRADE_REJECTED: ${newsRisk.reason}`;
    } else if (!correlationResult.allowed) {
      status = 'BLOCKED';
      rejectionReason = correlationResult.reason || 'TRADE_REJECTED: CORRELATION_LIMIT_EXCEEDED';
    } else if (sizingResult.rejectionReason) {
      status = 'BLOCKED';
      rejectionReason = sizingResult.rejectionReason;
    } else {
      status = 'READY';
    }
  }

  // 11. Create Signal object if ready
  let signalObj: Signal | null = null;
  if (tentativeBias !== 'WAITING' && confluenceScore >= 50) {
    const reasons: string[] = [];
    if (scoreHtf >= 15) reasons.push(`HTF ${h1Trend.toUpperCase()} Trend Alignment (+${scoreHtf})`);
    if (scoreStructure >= 15) reasons.push(`M5 Structure Confirmation (+${scoreStructure})`);
    if (scoreLiquidity >= 10) reasons.push(`Liquidity Pool Sweep (+${scoreLiquidity})`);
    if (scoreBosChoch >= 10) reasons.push(`BOS/CHoCH Imbalance (+${scoreBosChoch})`);
    if (scoreObFvg >= 5) reasons.push(`Discount/Premium POI Retest (+${scoreObFvg})`);
    if (scoreSession >= 5) reasons.push(`${sessions.activeSessionName} (+${scoreSession})`);

    signalObj = {
      direction: tentativeBias,
      timeframe: 'M5',
      score: Number((confluenceScore / 20).toFixed(1)), // normalized 5-point scale for legacy UI
      entry: Number(price.toFixed(config.digits)),
      sl: suggestedSL,
      tp: suggestedTP,
      reasons,
      atr,
      timestamp: new Date().toISOString(),
      actionReason: `${symbol} ${tentativeBias} (${confluenceScore}/100 Confluence) - 1:${riskRewardRatio} RR`,
      perfectEntryReason: `SMC ${tentativeBias} confluence with ${reasons.slice(0, 2).join(' + ')}`,
      strategy: 'SMC POI Retest',
    };
  }

  return {
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
    },
    entryPrice: Number(price.toFixed(config.digits)),
    suggestedSL,
    suggestedTP,
    riskRewardRatio,
    status,
    rejectionReason,
    safeLotSize: sizingResult.safeVolume,
    estimatedRiskUsd: sizingResult.riskAmount,
    rank: 4, // assigned below in rankOpportunities
  };
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
