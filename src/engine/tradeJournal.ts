import type { ClosedTrade, Signal, TradeDirection, Zone } from '../types/smc';

const CLOSED_TRADES_STORAGE_KEY = 'smc.closed-trades.v1';
const TRADE_RATIONALES_STORAGE_KEY = 'smc.trade-rationales.v1';
const TRADE_ORDER_BLOCKS_STORAGE_KEY = 'smc.trade-order-blocks.v1';

export type TradeRationales = Record<string, string>;
export type TradeOrderBlocks = Record<string, Zone>;

function isZone(value: unknown): value is Zone {
  if (!value || typeof value !== 'object') return false;
  const zone = value as Partial<Zone>;
  return (
    zone.kind === 'OB' &&
    typeof zone.top === 'number' &&
    typeof zone.bottom === 'number' &&
    typeof zone.bullish === 'boolean' &&
    typeof zone.born === 'number' &&
    typeof zone.filled === 'boolean' &&
    typeof zone.tests === 'number'
  );
}

function isClosedTrade(value: unknown): value is ClosedTrade {
  if (!value || typeof value !== 'object') return false;
  const trade = value as Partial<ClosedTrade>;
  return (
    typeof trade.ticket === 'number' &&
    typeof trade.openTime === 'string' &&
    typeof trade.closeTime === 'string' &&
    (trade.type === 'BUY' || trade.type === 'SELL') &&
    typeof trade.volume === 'number' &&
    typeof trade.openPrice === 'number' &&
    typeof trade.closePrice === 'number' &&
    typeof trade.profit === 'number' &&
    typeof trade.pips === 'number' &&
    typeof trade.comment === 'string'
  );
}

export function readStoredClosedTrades(): ClosedTrade[] {
  try {
    const stored = localStorage.getItem(CLOSED_TRADES_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Stored closed trades are not an array.');
    return parsed.filter(isClosedTrade);
  } catch (error) {
    console.error('[Trade Journal] Could not load saved closed trades:', error);
    return [];
  }
}

export function persistClosedTrades(trades: ClosedTrade[]): void {
  try {
    localStorage.setItem(CLOSED_TRADES_STORAGE_KEY, JSON.stringify(trades));
  } catch (error) {
    console.error('[Trade Journal] Could not save closed trades:', error);
  }
}

export function readTradeRationales(): TradeRationales {
  try {
    const stored = localStorage.getItem(TRADE_RATIONALES_STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Stored trade rationales are not an object.');
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
  } catch (error) {
    console.error('[Trade Journal] Could not load saved trade rationales:', error);
    return {};
  }
}

export function persistTradeRationales(rationales: TradeRationales): void {
  try {
    localStorage.setItem(TRADE_RATIONALES_STORAGE_KEY, JSON.stringify(rationales));
  } catch (error) {
    console.error('[Trade Journal] Could not save trade rationales:', error);
  }
}

export function readTradeOrderBlocks(): TradeOrderBlocks {
  try {
    const stored = localStorage.getItem(TRADE_ORDER_BLOCKS_STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Stored trade order blocks are not an object.');
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, Zone] => isZone(entry[1])
      )
    );
  } catch (error) {
    console.error('[Trade Journal] Could not load saved trade order blocks:', error);
    return {};
  }
}

export function persistTradeOrderBlocks(orderBlocks: TradeOrderBlocks): void {
  try {
    localStorage.setItem(TRADE_ORDER_BLOCKS_STORAGE_KEY, JSON.stringify(orderBlocks));
  } catch (error) {
    console.error('[Trade Journal] Could not save trade order blocks:', error);
  }
}

export function findCorrespondingOrderBlock(
  direction: TradeDirection,
  entry: number,
  zones: Zone[]
): Zone | undefined {
  const matchingZones = zones.filter(
    (zone) => zone.kind === 'OB' && !zone.filled && zone.bullish === (direction === 'BUY')
  );
  return matchingZones
    .slice()
    .sort((left, right) => {
      const gap = (zone: Zone) =>
        entry < zone.bottom ? zone.bottom - entry : entry > zone.top ? entry - zone.top : 0;
      return gap(left) - gap(right);
    })[0];
}

export function buildSignalRationale(signal: Signal): string {
  const explanation = signal.humanExplanation?.tradeRationale || signal.actionReason;
  const reasons = signal.reasons.filter(Boolean);
  const details = explanation ? [explanation, ...reasons] : reasons;
  const uniqueDetails = [...new Set(details)];
  const rationale = `${signal.direction} ${signal.timeframe} signal (score ${signal.score}): ${
    uniqueDetails.join(' · ') || 'Qualified by the SMC confluence filters.'
  }`;
  return rationale.length > 950 ? `${rationale.slice(0, 947)}...` : rationale;
}

export function localDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function closedTradeDayKey(trade: ClosedTrade): string {
  return trade.closedAt ? localDayKey(trade.closedAt) : '';
}
