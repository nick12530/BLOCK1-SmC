/**
 * smcCore.ts - Institutional-grade SMC + TA engine for XAUUSD
 * Direct TypeScript implementation of smc_core.py
 * Design goals: lookahead-safe, high fidelity, confluence scoring.
 */

import {
  Candle,
  Swing,
  StructureEvent,
  Zone,
  DealingRange,
  SessionInfo,
  Signal,
  LiquiditySweepInfo,
} from '../types/smc';
import { analyzeGoldCandlestickPatterns } from './candlestickPatterns';

// ============================================================
// 1. INDICATORS: Wilder's ATR
// ============================================================
export function calculateATR(candles: Candle[], n: number = 14): number[] {
  const len = candles.length;
  const out = new Array<number>(len).fill(NaN);
  if (len < n || !Number.isInteger(n) || n < 1) return out;

  const tr: number[] = new Array(len);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < len; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }

  // Seed Wilder's smoothing with n true-range observations.
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += tr[i];
  }
  out[n - 1] = sum / n;

  // Wilder recursive smoothing
  for (let i = n; i < len; i++) {
    out[i] = (out[i - 1] * (n - 1) + tr[i]) / n;
  }

  return out;
}

// ============================================================
// 2. MARKET STRUCTURE: Swings -> BOS / CHoCH
// ============================================================
export class MarketStructureEngine {
  k: number;
  swings: Swing[] = [];
  events: StructureEvent[] = [];
  trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  lastSwingHigh: Swing | null = null;
  lastSwingLow: Swing | null = null;

  constructor(k: number = 3) {
    this.k = k;
  }

  update(candles: Candle[]): void {
    const n = candles.length;
    const k = this.k;
    const confirmed: Swing[] = [];

    // Fractal swings confirmed after k bars (NO lookahead)
    for (let i = k; i < n - k; i++) {
      let isHigh = true;
      let isLow = true;

      for (let j = i - k; j <= i + k; j++) {
        if (candles[j].high > candles[i].high) {
          isHigh = false;
        }
        if (candles[j].low < candles[i].low) {
          isLow = false;
        }
      }

      if (isHigh) {
        confirmed.push({ idx: i, price: candles[i].high, kind: 'H', time: candles[i].time });
      } else if (isLow) {
        confirmed.push({ idx: i, price: candles[i].low, kind: 'L', time: candles[i].time });
      }
    }

    this.swings = confirmed;

    let currentTrend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
    const newEvents: StructureEvent[] = [];
    let lastH: Swing | null = null;
    let lastL: Swing | null = null;

    for (const sw of confirmed) {
      const futureCandles = candles.slice(sw.idx + 1);
      if (futureCandles.length === 0) {
        if (sw.kind === 'H') lastH = sw;
        else lastL = sw;
        continue;
      }

      if (sw.kind === 'H') {
        const crossIdx = futureCandles.findIndex((c) => c.close > sw.price);
        if (crossIdx !== -1) {
          const bar = sw.idx + 1 + crossIdx;
          const kind: 'BOS' | 'CHoCH' = currentTrend === 'bearish' ? 'CHoCH' : 'BOS';
          newEvents.push({
            kind,
            direction: 'bullish',
            price: sw.price,
            bar,
            time: candles[bar]?.time,
          });
          currentTrend = 'bullish';
        }
        lastH = sw;
      } else {
        const crossIdx = futureCandles.findIndex((c) => c.close < sw.price);
        if (crossIdx !== -1) {
          const bar = sw.idx + 1 + crossIdx;
          const kind: 'BOS' | 'CHoCH' = currentTrend === 'bullish' ? 'CHoCH' : 'BOS';
          newEvents.push({
            kind,
            direction: 'bearish',
            price: sw.price,
            bar,
            time: candles[bar]?.time,
          });
          currentTrend = 'bearish';
        }
        lastL = sw;
      }
    }

    this.events = newEvents;
    this.trend = currentTrend;
    this.lastSwingHigh = lastH;
    this.lastSwingLow = lastL;
  }

  dealingRange(): DealingRange | null {
    if (this.lastSwingHigh && this.lastSwingLow) {
      const lo = this.lastSwingLow.price;
      const hi = this.lastSwingHigh.price;
      return {
        low: lo,
        high: hi,
        equilibrium: (hi + lo) / 2,
      };
    }
    return null;
  }
}

// ============================================================
// 3. ZONES: Fair Value Gaps & Order Blocks with Mitigation
// ============================================================
function markMitigation(zones: Zone[], candles: Candle[]): void {
  for (const z of zones) {
    let tests = 0;
    let filled = false;

    for (let i = z.born + 1; i < candles.length; i++) {
      const c = candles[i];
      if (z.bullish) {
        if (c.low <= z.top) tests++;
        if (c.low <= z.bottom) {
          filled = true;
        }
      } else {
        if (c.high >= z.bottom) tests++;
        if (c.high >= z.top) {
          filled = true;
        }
      }
    }

    z.tests = tests;
    z.filled = filled;
  }
}

export function detectFVGs(candles: Candle[], atrArr: number[], minMult: number = 0.15): Zone[] {
  const zones: Zone[] = [];
  const n = candles.length;

  for (let i = 2; i < n; i++) {
    const atrNow = atrArr[i];
    if (isNaN(atrNow) || atrNow <= 0) continue;

    const gapUp = candles[i].low - candles[i - 2].high; // Bullish FVG
    const gapDn = candles[i - 2].low - candles[i].high; // Bearish FVG

    if (gapUp > minMult * atrNow) {
      zones.push({
        kind: 'FVG',
        top: candles[i].low,
        bottom: candles[i - 2].high,
        bullish: true,
        born: i,
        bornTime: candles[i].time,
        filled: false,
        tests: 0,
      });
    }

    if (gapDn > minMult * atrNow) {
      zones.push({
        kind: 'FVG',
        top: candles[i - 2].low,
        bottom: candles[i].high,
        bullish: false,
        born: i,
        bornTime: candles[i].time,
        filled: false,
        tests: 0,
      });
    }
  }

  markMitigation(zones, candles);
  return zones;
}

export function detectOrderBlocks(
  candles: Candle[],
  _atrArr: number[],
  impulseMult: number = 1.5,
  minBodyFrac: number = 0.4
): Zone[] {
  const n = candles.length;
  const zones: Zone[] = [];
  const used = new Set<number>();

  // Calculate 20-period rolling average body
  const bodySizes: number[] = new Array(n);
  const avgBodies: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    bodySizes[i] = Math.abs(candles[i].close - candles[i].open);
    if (i >= 19) {
      let sum = 0;
      for (let k = i - 19; k <= i; k++) {
        sum += bodySizes[k];
      }
      avgBodies[i] = sum / 20;
    }
  }

  for (let i = 21; i < n; i++) {
    const avgBody = avgBodies[i];
    if (isNaN(avgBody) || used.has(i)) continue;

    const body = bodySizes[i];
    const range = candles[i].high - candles[i].low + 1e-12;
    const isImpulse = body > impulseMult * avgBody && body / range > minBodyFrac;

    if (!isImpulse) continue;

    const j = i - 1;
    const curr = candles[i];
    const prev = candles[j];

    if (curr.close > curr.open && prev.close < prev.open) {
      // Bullish impulse -> Demand OB (previous bearish candle)
      zones.push({
        kind: 'OB',
        top: prev.high,
        bottom: prev.low,
        bullish: true,
        born: j,
        bornTime: prev.time,
        filled: false,
        tests: 0,
      });
      used.add(j);
    } else if (curr.close < curr.open && prev.close > prev.open) {
      // Bearish impulse -> Supply OB (previous bullish candle)
      zones.push({
        kind: 'OB',
        top: prev.high,
        bottom: prev.low,
        bullish: false,
        born: j,
        bornTime: prev.time,
        filled: false,
        tests: 0,
      });
      used.add(j);
    }
  }

  markMitigation(zones, candles);
  return zones;
}

// ============================================================
// 4. SESSION FILTER (London and New York sessions for XAUUSD)
// ============================================================
export function sessionFilter(dateOrTimestamp: Date | number): SessionInfo {
  const d = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
  const utcHours = d.getUTCHours();
  const utcMinutes = d.getUTCMinutes();
  const localMinutes = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    return hour * 60 + minute;
  };
  const londonTime = localMinutes('Europe/London');
  const newYorkTime = localMinutes('America/New_York');
  const tokyoTime = localMinutes('Asia/Tokyo');
  const sydneyTime = localMinutes('Australia/Sydney');

  const london = londonTime >= 480 && londonTime <= 1020;
  const londonKillZone = londonTime >= 480 && londonTime <= 660;
  const newYork = newYorkTime >= 480 && newYorkTime <= 1020;
  const newYorkKillZone = newYorkTime >= 480 && newYorkTime <= 720;
  const asian = tokyoTime >= 0 && tokyoTime <= 540;
  const sydney = sydneyTime >= 420 && sydneyTime <= 960;

  const tradable = london || newYork;

  let activeSessionName = 'Asian Session';
  if (london && newYork) activeSessionName = 'London / NY Overlap';
  else if (londonKillZone) activeSessionName = 'London Kill Zone';
  else if (newYorkKillZone) activeSessionName = 'New York Kill Zone';
  else if (london) activeSessionName = 'London Session';
  else if (newYork) activeSessionName = 'New York Session';
  else if (asian) activeSessionName = 'Tokyo / Asian Session';
  else if (sydney) activeSessionName = 'Sydney Session';

  const pad = (n: number) => n.toString().padStart(2, '0');
  const currentUtcTime = `${pad(utcHours)}:${pad(utcMinutes)}:${pad(d.getUTCSeconds())} UTC`;
  // East Africa Time (EAT = UTC + 3)
  const eatHours = (utcHours + 3) % 24;
  const currentEatTime = `${pad(eatHours)}:${pad(utcMinutes)}:${pad(d.getUTCSeconds())} EAT`;

  // High-Institutional-Volume Windows
  // London Open: 07:00 – 10:00 UTC (10:00 – 13:00 EAT)
  const londonOpenWindow = utcHours >= 7 && utcHours < 10;
  // New York AM / Silver Bullet: 13:00 – 16:00 UTC (16:00 – 19:00 EAT)
  const newYorkSilverBullet = utcHours >= 13 && utcHours < 16;
  // Low-liquidity Asian Consolidation: 21:00 – 05:00 UTC (00:00 – 08:00 EAT)
  const asianConsolidation = utcHours >= 21 || utcHours < 5;
  const isHighVolumeWindow = londonOpenWindow || newYorkSilverBullet;

  const sessions = [
    { id: 'london' as const, name: 'London', active: london, hours: '08:00–17:00 London local (11:00–20:00 EAT)' },
    { id: 'new_york' as const, name: 'New York', active: newYork, hours: '08:00–17:00 New York local (16:00–01:00 EAT)' },
    { id: 'asian' as const, name: 'Asian / Tokyo', active: asian, hours: '00:00–09:00 Tokyo local (00:00–09:00 EAT)' },
    { id: 'sydney' as const, name: 'Sydney', active: sydney, hours: '07:00–16:00 Sydney local (00:00–09:00 EAT)' },
  ];

  return {
    london,
    new_york: newYork,
    asian,
    sydney,
    tradable,
    currentUtcTime,
    currentEatTime,
    activeSessionName,
    londonOpenWindow,
    newYorkSilverBullet,
    asianConsolidation,
    isHighVolumeWindow,
    sessions,
  };
}

/**
 * Liquidity Sweep / Swing Failure Pattern (SFP) Gate Engine
 * Checks whether the current/recent candle wicked past previous swing highs/lows
 * or Asian session extremes to collect liquidity, then rejected back inside the range.
 */
export function detectLiquiditySweep(
  candles: Candle[],
  swings: Swing[],
  direction: 'BUY' | 'SELL'
): LiquiditySweepInfo {
  if (candles.length < 5) return { hasSweep: false };
  const lastCandle = candles[candles.length - 1];
  const prevCandles = candles.slice(-12, -1);

  if (direction === 'SELL') {
    // Bearish SFP: Wick pierced ABOVE prior swing high / Asian high, but close rejected back BELOW it
    const recentHighs = swings.filter((s) => s.kind === 'H').slice(-6);
    const targetHigh = recentHighs.length > 0
      ? Math.max(...recentHighs.map((h) => h.price))
      : Math.max(...prevCandles.map((c) => c.high));

    const swept = lastCandle.high > targetHigh && lastCandle.close < targetHigh;
    if (swept) {
      return {
        hasSweep: true,
        type: 'SWING_HIGH_SFP',
        sweptPrice: targetHigh,
        rejectionConfirmed: true,
        description: `Bearish Liquidity Sweep / SFP: Wick pierced above $${targetHigh.toFixed(2)} taking buy-side liquidity, rejected back into range (Close: $${lastCandle.close.toFixed(2)}).`,
      };
    }
  } else {
    // Bullish SFP: Wick pierced BELOW prior swing low / Asian low, but close rejected back ABOVE it
    const recentLows = swings.filter((s) => s.kind === 'L').slice(-6);
    const targetLow = recentLows.length > 0
      ? Math.min(...recentLows.map((l) => l.price))
      : Math.min(...prevCandles.map((c) => c.low));

    const swept = lastCandle.low < targetLow && lastCandle.close > targetLow;
    if (swept) {
      return {
        hasSweep: true,
        type: 'SWING_LOW_SFP',
        sweptPrice: targetLow,
        rejectionConfirmed: true,
        description: `Bullish Liquidity Sweep / SFP: Wick pierced below $${targetLow.toFixed(2)} taking sell-side liquidity, rejected back into range (Close: $${lastCandle.close.toFixed(2)}).`,
      };
    }
  }

  return { hasSweep: false };
}

export function hasRecentCandleGap(candles: Candle[], intervalMs: number, lookback: number = 4): boolean {
  const recent = candles.slice(-lookback);
  return recent.some(
    (candle, index) => index > 0 && candle.time - recent[index - 1].time > intervalMs * 2
  );
}

// ============================================================
// 5. SIGNAL FUSION - Weighted Confluence Scoring
// ============================================================
export function evaluateConfluence(
  dfExec: Candle[],
  dfHtf: Candle[],
  rr: number = 2.0,
  minScoreThreshold: number = 5.0,
  timeframe: 'M1' | 'M5' | 'M15' = 'M5'
): Signal | null {
  if (dfExec.length < 25 || dfHtf.length < 20) return null;

  const aExec = calculateATR(dfExec);
  const lastCandle = dfExec[dfExec.length - 1];
  const price = lastCandle.close;
  const atrNow = aExec[aExec.length - 1];

  if (isNaN(atrNow) || atrNow <= 0) return null;
  const now = Date.now();
  const toMilliseconds = (time: number) => (time < 1_000_000_000_000 ? time * 1000 : time);
  const timeframeMs = { M1: 60_000, M5: 5 * 60_000, M15: 15 * 60_000 }[timeframe];
  const htfTimeframeMs = timeframe === 'M1' ? 5 * 60_000 : timeframe === 'M5' ? 15 * 60_000 : 60 * 60_000;
  if (
    now - toMilliseconds(lastCandle.time) > timeframeMs * 3 ||
    now - toMilliseconds(dfHtf[dfHtf.length - 1].time) > htfTimeframeMs * 3 ||
    hasRecentCandleGap(dfExec, timeframeMs) ||
    hasRecentCandleGap(dfHtf, htfTimeframeMs)
  ) {
    return null;
  }

  const ms = new MarketStructureEngine(3);
  ms.update(dfHtf);

  // Unmitigated recent zones from execution timeframe
  const fvgs = detectFVGs(dfExec, aExec).filter((z) => !z.filled).slice(-8);
  const obs = detectOrderBlocks(dfExec, aExec).filter((z) => !z.filled).slice(-8);
  const zones = [...fvgs, ...obs];

  const sess = sessionFilter(lastCandle.time);

  let score = 0.0;
  const reasons: string[] = [];

  if (ms.trend === 'ranging') return null;

  score += 2.0;
  reasons.push(`HTF ${ms.trend.toUpperCase()} structure aligned (+2.0)`);

  const dr = ms.dealingRange();
  let inDiscount = false;
  let inPremium = false;

  if (dr) {
    inDiscount = price < dr.equilibrium;
    inPremium = price > dr.equilibrium;
  }

  let direction: 'BUY' | 'SELL' | null = null;
  let zone: Zone | null = null;

  if (ms.trend === 'bullish' && inDiscount) {
    score += 1.0;
    reasons.push('Price in DISCOUNT of HTF dealing range (< Equilibrium) (+1.0)');
    for (const z of zones) {
      // Prioritize fresh zones (tests <= 1) for highest win rate
      if (z.bullish && z.tests <= 2 && z.bottom - 0.25 * atrNow <= price && price <= z.top + 0.25 * atrNow) {
        zone = z;
        break;
      }
    }
  } else if (ms.trend === 'bearish' && inPremium) {
    score += 1.0;
    reasons.push('Price in PREMIUM of HTF dealing range (> Equilibrium) (+1.0)');
    for (const z of zones) {
      if (!z.bullish && z.tests <= 2 && z.bottom - 0.25 * atrNow <= price && price <= z.top + 0.25 * atrNow) {
        zone = z;
        break;
      }
    }
  }

  let sl = 0;
  let tp = 0;

  if (zone) {
    direction = zone.bullish ? 'BUY' : 'SELL';
    score += 1.5;
    reasons.push(
      `${zone.kind} retest (${zone.bullish ? 'Demand' : 'Supply'}, ${zone.tests} prior test${zone.tests === 1 ? '' : 's'}) (+1.5)`
    );

    // High Win-Rate Rule: Fresh POI bonus
    if (zone.tests === 0) {
      score += 0.5;
      reasons.push('Virgin unmitigated POI - Maximum institutional order flow (+0.5)');
    }

    const base = zone.bullish ? zone.bottom : zone.top;
    const buf = 0.5 * atrNow;
    sl = direction === 'BUY' ? base - buf : base + buf;

    let risk = Math.abs(price - sl);
    if (risk < 0.5 * atrNow) {
      // SL sanity: must be beyond noise
      sl = direction === 'BUY' ? price - atrNow : price + atrNow;
      risk = atrNow;
      reasons.push('SL buffered to 1.0x ATR beyond market noise');
    }
    tp = direction === 'BUY' ? price + rr * risk : price - rr * risk;
  } else {
    return null;
  }

  if (ms.events.length > 0) {
    const lastEvent = ms.events[ms.events.length - 1];
    if (lastEvent.direction === (direction === 'BUY' ? 'bullish' : 'bearish')) {
      score += 1.0;
      reasons.push(`Last structure event ${lastEvent.kind} (${lastEvent.direction}) aligned (+1.0)`);
    }
  }

  // Liquidity Sweep / Swing Failure Pattern (SFP) Gate Engine
  const sweep = detectLiquiditySweep(dfExec, ms.swings, direction);
  if (sweep.hasSweep) {
    score += 1.5;
    reasons.push(`${sweep.description} (+1.5)`);
  }

  if (!sess.tradable) return null;
  score += 0.5;
  reasons.push(`Inside active ${sess.activeSessionName} (+0.5)`);

  // Asian session consolidation suppression (21:00 - 05:00 UTC / 00:00 - 08:00 EAT)
  // Suppress low-liquidity false breakouts, unless an exceptional high-profit signal exception applies
  const inAsianConsolidation = Boolean(sess.asianConsolidation);
  const isHighProfitException = score >= 6.5;
  if (inAsianConsolidation && !isHighProfitException) {
    return null;
  }
  if (inAsianConsolidation && isHighProfitException) {
    reasons.push('⭐ High-Profit Exception: Out-of-session institutional setup approved during Asian consolidation');
  }

  // Mastered Gold Candlestick Pattern Engine
  const csAnalysis = analyzeGoldCandlestickPatterns(dfExec);
  const activePattern = csAnalysis.activePattern;
  const targetBias = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
  if (activePattern.bias !== targetBias || activePattern.reliability < 80) return null;
  score += (activePattern.reliability / 100) * 0.75;
  reasons.push(`${activePattern.name} (${activePattern.wickRatio}, ${activePattern.reliability}% reliability) (+${((activePattern.reliability / 100) * 0.75).toFixed(2)})`);

  // Determine the triggering candle pattern and mechanics
  const isBear = direction === 'SELL';
  const range = Math.max(0.1, lastCandle.high - lastCandle.low);
  const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const rejectionConfirmed = direction === 'BUY'
    ? lastCandle.close > lastCandle.open && lowerWick > body
    : lastCandle.close < lastCandle.open && upperWick > body;
  if (!rejectionConfirmed || score < minScoreThreshold) return null;
  const wickRatio = isBear
    ? `${((upperWick / range) * 100).toFixed(0)}% Upper Wick`
    : `${((lowerWick / range) * 100).toFixed(0)}% Lower Wick`;

  const patternName = activePattern.name;

  const tf = timeframe;
  const explanation = isBear
    ? `${tf} candle at ${lastCandle.timeStr} swept into premium supply at $${lastCandle.high.toFixed(2)}, meeting heavy institutional sell volume and closing down at $${lastCandle.close.toFixed(2)}. ${zone ? `Rejection confirmed off ${zone.kind} Supply (${zone.bottom}-${zone.top}).` : ''}`
    : `${tf} candle at ${lastCandle.timeStr} tapped discount demand at $${lastCandle.low.toFixed(2)}, soaking up sell-side liquidity with buyers pushing price up to close at $${lastCandle.close.toFixed(2)}. ${zone ? `Rejection confirmed off ${zone.kind} Demand (${zone.bottom}-${zone.top}).` : ''}`;

  const actionReason = isBear
    ? `SELL triggered: ${activePattern.name} swept into premium supply (${zone ? `${zone.bottom.toFixed(1)}-${zone.top.toFixed(1)}` : 'POI'}) with strong sell displacement, rejecting ${wickRatio}. ${activePattern.goldInsight}`
    : `BUY triggered: ${activePattern.name} absorbed into discount demand (${zone ? `${zone.bottom.toFixed(1)}-${zone.top.toFixed(1)}` : 'POI'}) with aggressive buyer response, rejecting ${wickRatio}. ${activePattern.goldInsight}`;

  const perfectEntryReason = isBear
    ? `Perfect Entry identified @ $${price.toFixed(2)} on ${tf} confirmation: Tight SL at $${sl.toFixed(2)} (${Math.abs(price - sl).toFixed(1)} pts risk) targeting 1:${rr} RR @ $${tp.toFixed(2)}.`
    : `Perfect Entry identified @ $${price.toFixed(2)} on ${tf} confirmation: Tight SL at $${sl.toFixed(2)} (${Math.abs(price - sl).toFixed(1)} pts risk) targeting 1:${rr} RR @ $${tp.toFixed(2)}.`;

  const riskPts = Math.abs(price - sl);
  const rewardPts = Math.abs(tp - price);
  if (riskPts <= 0 || rewardPts / riskPts < 2) return null;
  const rrRatio = (rewardPts / Math.max(0.1, riskPts)).toFixed(1);

  const humanExplanation = {
    headline: isBear
      ? `Institutional SELL Setup: High-Probability Short on Gold`
      : `Institutional BUY Setup: High-Probability Long on Gold`,
    simpleSummary: isBear
      ? `Gold reached an expensive resistance ceiling where institutional sellers dumped inventory. Smart money rejected higher prices, setting up a high-probability drop.`
      : `Gold dipped into a discounted wholesale demand zone. Institutional buyers stepped in with strong volume, absorbing sell orders and preparing for a rally.`,
    marketCondition: isBear
      ? `Market tried pushing higher but encountered heavy institutional selling pressure, leaving a supply imbalance.`
      : `Higher-timeframe market structure is bullish. Sellers failed to break lower support, confirming buyers remain in control.`,
    tradeRationale: isBear
      ? `Formed a ${patternName} (${wickRatio}) rejecting supply at $${price.toFixed(1)}. Risk is capped just above the swing high.`
      : `Formed a ${patternName} (${wickRatio}) defending demand at $${price.toFixed(1)}. Risk is capped just below the swing low.`,
    howToTrade: isBear
      ? `Enter SELL now at market ($${price.toFixed(1)}). Keep your Stop Loss strictly at $${sl.toFixed(1)} (capping risk at $${riskPts.toFixed(1)}/oz). Target profit at $${tp.toFixed(1)} (+${rewardPts.toFixed(1)}/oz).`
      : `Enter BUY now at market ($${price.toFixed(1)}). Keep your Stop Loss strictly at $${sl.toFixed(1)} (capping risk at $${riskPts.toFixed(1)}/oz). Target profit at $${tp.toFixed(1)} (+${rewardPts.toFixed(1)}/oz).`,
    riskRewardSummary: `Risking $${riskPts.toFixed(1)} to make $${rewardPts.toFixed(1)} per oz (1 : ${rrRatio} Reward-to-Risk).`,
  };

  return {
    direction,
    timeframe,
    score: Number(score.toFixed(2)),
    entry: Number(price.toFixed(2)),
    sl: Number(sl.toFixed(2)),
    tp: Number(tp.toFixed(2)),
    reasons,
    atr: Number(atrNow.toFixed(2)),
    timestamp: new Date(toMilliseconds(lastCandle.time)).toISOString(),
    actionReason,
    perfectEntryReason,
    candlestickPattern: activePattern,
    humanExplanation,
    liquiditySweep: sweep,
    isOutOfSessionException: inAsianConsolidation && isHighProfitException,
    triggerPattern: {
      name: patternName,
      bias: isBear ? 'bearish' : 'bullish',
      timeframe,
      timeStr: lastCandle.timeStr,
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
      wickRatio,
      explanation,
    },
  };
}
