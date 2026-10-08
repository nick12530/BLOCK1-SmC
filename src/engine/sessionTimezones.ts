/**
 * sessionTimezones.ts - Global Trading Session & Broker/Kenya Time Engine
 * Displays both:
 * - Broker/Server Time (dynamic offset or UTC)
 * - Kenya / EAT Time (UTC+3, Nairobi)
 * Handles pair-specific session eligibility and currency news risk mapping.
 */

import type { EconomicEvent } from '../types/smc';
import type { SupportedSymbol } from './instrumentConfig';
import { INSTRUMENTS } from './instrumentConfig';

export interface GlobalSessionStatus {
  asian: boolean;
  london: boolean;
  new_york: boolean;
  sydney: boolean;
  activeSessionName: string;
  brokerTimeStr: string;
  kenyaTimeStr: string;
}

export function getGlobalSessionStatus(now: Date = new Date(), brokerOffsetHours: number = 0): GlobalSessionStatus {
  // UTC Hour and Minute
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcDec = utcHours + utcMinutes / 60;

  // Kenya / EAT is always UTC+3 (Nairobi)
  const kenyaHours = (utcHours + 3) % 24;
  const kenyaMinutes = utcMinutes;
  const kenyaTimeStr = `${String(kenyaHours).padStart(2, '0')}:${String(kenyaMinutes).padStart(2, '0')} EAT`;

  // Broker Time (UTC + brokerOffsetHours, default UTC)
  const brokerHours = (utcHours + brokerOffsetHours + 24) % 24;
  const brokerMinutes = utcMinutes;
  const brokerTimeStr = `${String(brokerHours).padStart(2, '0')}:${String(brokerMinutes).padStart(2, '0')} Server`;

  // Standard UTC market session windows
  // Sydney: 22:00 - 07:00 UTC
  const sydney = utcDec >= 22 || utcDec < 7;
  // Tokyo / Asian: 00:00 - 09:00 UTC
  const asian = utcDec >= 0 && utcDec < 9;
  // London: 07:00 - 16:00 UTC
  const london = utcDec >= 7 && utcDec < 16;
  // New York: 12:00 - 21:00 UTC
  const new_york = utcDec >= 12 && utcDec < 21;

  const activeNames: string[] = [];
  if (london && new_york) activeNames.push('London + New York Overlap');
  else if (london) activeNames.push('London Session');
  else if (new_york) activeNames.push('New York Session');
  else if (asian) activeNames.push('Tokyo/Asian Session');
  else if (sydney) activeNames.push('Sydney Session');
  else activeNames.push('Overnight Off-Hours');

  return {
    asian,
    london,
    new_york,
    sydney,
    activeSessionName: activeNames[0] || 'Interbank',
    brokerTimeStr,
    kenyaTimeStr,
  };
}

export function isSessionPreferredForPair(
  symbol: SupportedSymbol,
  sessions: GlobalSessionStatus
): boolean {
  const config = INSTRUMENTS[symbol];
  if (!config) return true;

  return config.preferredSessions.some((sessionKey) => {
    if (sessionKey === 'london') return sessions.london;
    if (sessionKey === 'new_york') return sessions.new_york;
    if (sessionKey === 'asian') return sessions.asian;
    if (sessionKey === 'sydney') return sessions.sydney;
    return false;
  });
}

/**
 * Maps symbols to their relevant news currencies.
 */
export function getCurrenciesForPair(symbol: SupportedSymbol): string[] {
  switch (symbol) {
    case 'EURUSD':
      return ['EUR', 'USD'];
    case 'GBPUSD':
      return ['GBP', 'USD'];
    case 'USDJPY':
      return ['USD', 'JPY'];
    case 'XAUUSD':
    default:
      return ['USD'];
  }
}

export interface NewsRiskResult {
  hasNewsRisk: boolean;
  reason?: string;
  nextEvent?: EconomicEvent;
  isDataUnavailable?: boolean;
}

/**
 * Checks economic calendar news risk for a specific pair.
 * Do not invent news if unavailable; displays NEWS FILTER: DATA UNAVAILABLE.
 */
export function evaluateNewsRisk(
  symbol: SupportedSymbol,
  events: EconomicEvent[] | null | undefined,
  leadMinutes: number = 30
): NewsRiskResult {
  if (!events || events.length === 0) {
    return {
      hasNewsRisk: false,
      isDataUnavailable: true,
      reason: 'NEWS FILTER: DATA UNAVAILABLE',
    };
  }

  const targetCurrencies = getCurrenciesForPair(symbol);
  const relevantHighImpact = events.filter(
    (ev) =>
      targetCurrencies.includes(ev.currency) &&
      ev.impact === 'high' &&
      ev.minutesRemaining >= 0 &&
      ev.minutesRemaining <= leadMinutes
  );

  if (relevantHighImpact.length > 0) {
    const next = relevantHighImpact[0];
    return {
      hasNewsRisk: true,
      nextEvent: next,
      reason: `HIGH IMPACT NEWS: ${next.currency} ${next.event} in ${next.minutesRemaining}m`,
    };
  }

  return { hasNewsRisk: false, isDataUnavailable: false };
}
