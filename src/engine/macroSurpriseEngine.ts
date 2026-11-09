/**
 * macroSurpriseEngine.ts - Macroeconomic Surprise & Economic Delta Engine
 *
 * Quantifies economic releases (CPI, NFP, GDP, Central Bank Rate Decisions):
 * - Computes Surprise Delta: (Actual - Forecast)
 * - Identifies Post-News Institutional Drift windows (5m - 60m post-print)
 * - Maps macroeconomic surprises to instrument bias (XAUUSD, EURUSD, GBPUSD, USDJPY)
 * - Scores macro confluence bonus (+1.5) or warns against macro headwinds (-2.0)
 */

import { EconomicEvent } from '../types/smc';
import { SupportedSymbol } from './instrumentConfig';
import { getCurrenciesForPair } from './sessionTimezones';

export interface MacroConfluenceResult {
  scoreBonus: number; // e.g. +1.5 for alignment, -2.0 for macro headwind
  macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  activeSurpriseEvent?: EconomicEvent;
  postNewsDriftActive: boolean;
  reasons: string[];
}

function parseNumber(str?: string): number | null {
  if (!str || str === '—' || str.trim() === '') return null;
  const cleaned = str.replace(/[%,K,k,M,m,B,b]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Determines whether a currency surprise is bullish or bearish for that currency.
 */
export function getCurrencySurpriseBias(event: EconomicEvent): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (event.surpriseDirection && event.surpriseDirection !== 'PENDING') {
    return event.surpriseDirection === 'BULLISH'
      ? 'BULLISH'
      : event.surpriseDirection === 'BEARISH'
      ? 'BEARISH'
      : 'NEUTRAL';
  }

  const act = parseNumber(event.actual);
  const est = parseNumber(event.forecast);
  if (act === null || est === null) return 'NEUTRAL';

  const delta = act - est;
  if (Math.abs(delta) < 1e-5) return 'NEUTRAL';

  const name = event.event.toLowerCase();
  const isInverse = name.includes('unemployment') || name.includes('jobless');

  if (delta > 0) {
    return isInverse ? 'BEARISH' : 'BULLISH';
  } else {
    return isInverse ? 'BULLISH' : 'BEARISH';
  }
}

/**
 * Maps a currency bias to the expected direction for a given trading pair.
 * E.g., USD BULLISH -> EURUSD SELL, GBPUSD SELL, USDJPY BUY, XAUUSD SELL.
 */
export function mapCurrencyBiasToPair(
  symbol: SupportedSymbol,
  currency: string,
  currencyBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (currencyBias === 'NEUTRAL') return 'NEUTRAL';

  if (currency === 'USD') {
    if (symbol === 'EURUSD' || symbol === 'GBPUSD' || symbol === 'XAUUSD') {
      return currencyBias === 'BULLISH' ? 'SELL' : 'BUY';
    } else if (symbol === 'USDJPY') {
      return currencyBias === 'BULLISH' ? 'BUY' : 'SELL';
    }
  } else if (currency === 'EUR' && symbol === 'EURUSD') {
    return currencyBias === 'BULLISH' ? 'BUY' : 'SELL';
  } else if (currency === 'GBP' && symbol === 'GBPUSD') {
    return currencyBias === 'BULLISH' ? 'BUY' : 'SELL';
  } else if (currency === 'JPY' && symbol === 'USDJPY') {
    return currencyBias === 'BULLISH' ? 'SELL' : 'BUY'; // JPY strong -> USDJPY drops
  }

  return 'NEUTRAL';
}

/**
 * Evaluates whether current macroeconomic surprises reinforce or contradict a proposed trade.
 */
export function evaluateMacroSurpriseConfluence(
  symbol: SupportedSymbol,
  direction: 'BUY' | 'SELL',
  events: EconomicEvent[] | null | undefined
): MacroConfluenceResult {
  if (!events || events.length === 0) {
    return {
      scoreBonus: 0,
      macroBias: 'NEUTRAL',
      postNewsDriftActive: false,
      reasons: [],
    };
  }

  const currencies = getCurrenciesForPair(symbol);
  const relevantEvents = events.filter(
    (e) => currencies.includes(e.currency) && e.impact === 'high'
  );

  let scoreBonus = 0;
  const reasons: string[] = [];
  let macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let postNewsDriftActive = false;
  let activeSurpriseEvent: EconomicEvent | undefined = undefined;

  // Look for releases with actual prints or recent prints (minutesRemaining between -60 and 0)
  for (const ev of relevantEvents) {
    const act = parseNumber(ev.actual);
    const est = parseNumber(ev.forecast);
    const isRecent = ev.minutesRemaining <= 0 && ev.minutesRemaining >= -60;

    if ((act !== null && est !== null) || isRecent) {
      const currBias = getCurrencySurpriseBias(ev);
      const expectedPairDir = mapCurrencyBiasToPair(symbol, ev.currency, currBias);

      if (expectedPairDir !== 'NEUTRAL') {
        activeSurpriseEvent = ev;
        postNewsDriftActive = true;
        macroBias = expectedPairDir === 'BUY' ? 'BULLISH' : 'BEARISH';

        if (expectedPairDir === direction) {
          scoreBonus += 1.5;
          reasons.push(
            `🏛️ Macroeconomic Surprise Aligned: ${ev.currency} ${ev.event} (Act: ${ev.actual || 'Beat'}, Est: ${ev.forecast}) confirms institutional ${direction} drift (+1.5)`
          );
        } else {
          scoreBonus -= 2.0;
          reasons.push(
            `⚠️ Macro Headwind Warning: Trade opposes major ${ev.currency} ${ev.event} surprise (${currBias} ${ev.currency}) (-2.0)`
          );
        }
        break; // prioritize the most impactful release
      }
    }
  }

  return {
    scoreBonus,
    macroBias,
    activeSurpriseEvent,
    postNewsDriftActive,
    reasons,
  };
}
