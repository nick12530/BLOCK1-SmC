import type { Candle, ClosedTrade, PendingOrder, Position, SymbolTradingSpec } from '../types/smc';

export interface ClosedTradeMetrics {
  count: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  averageOutcome: number | null;
}

export function summarizeClosedTrades(trades: ClosedTrade[]): ClosedTradeMetrics {
  const closed = trades.filter(
    (trade) =>
      (!trade.status || trade.status === 'CLOSED') &&
      Number.isFinite(trade.profit) &&
      Number.isFinite(Date.parse(trade.closeTime || trade.closedAt || ''))
  );
  const wins = closed.filter((trade) => trade.profit > 0);
  const losses = closed.filter((trade) => trade.profit < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.profit, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.profit, 0));
  const netProfit = closed.reduce((sum, trade) => sum + trade.profit, 0);

  return {
    count: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    averageOutcome: closed.length ? netProfit / closed.length : null,
  };
}

export function getCandleAgeMs(candles: Candle[], now = Date.now()): number | null {
  const rawTime = candles[candles.length - 1]?.time;
  if (!Number.isFinite(rawTime) || !rawTime) return null;
  const timestamp = rawTime < 1_000_000_000_000 ? rawTime * 1000 : rawTime;
  return timestamp <= now ? now - timestamp : null;
}

export function filterTradesByWindow(
  trades: ClosedTrade[],
  windowDays: number | null,
  now = Date.now()
): ClosedTrade[] {
  if (windowDays === null) return trades;
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  return trades.filter((trade) => {
    const closedAt = Date.parse(trade.closeTime || trade.closedAt || '');
    return Number.isFinite(closedAt) && closedAt >= cutoff;
  });
}

export interface PortfolioStopRisk {
  riskUsd: number;
  positionCount: number;
  pendingOrderCount: number;
  unknownCount: number;
}

export function estimatePortfolioStopRisk(
  positions: Array<Pick<Position, 'symbol' | 'type' | 'volume' | 'price_open' | 'sl'>>,
  pendingOrders: Array<Pick<PendingOrder, 'symbol' | 'direction' | 'volume' | 'entry' | 'sl' | 'status'>>,
  symbolSpecs: Partial<Record<string, SymbolTradingSpec>>,
  fallbackSymbol: string
): PortfolioStopRisk {
  let riskUsd = 0;
  let unknownCount = 0;
  let positionCount = 0;
  let pendingOrderCount = 0;

  const addExposure = (
    symbol: string,
    direction: 'BUY' | 'SELL',
    volume: number,
    entry: number,
    stopLoss: number
  ) => {
    const spec = symbolSpecs[symbol];
    if (
      !spec ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      !Number.isFinite(entry) ||
      !Number.isFinite(stopLoss) ||
      stopLoss <= 0 ||
      !Number.isFinite(spec.tickSize) ||
      spec.tickSize <= 0 ||
      !Number.isFinite(spec.tickValue) ||
      spec.tickValue <= 0
    ) {
      unknownCount += 1;
      return;
    }
    const adverseDistance = direction === 'BUY' ? entry - stopLoss : stopLoss - entry;
    riskUsd += (Math.max(0, adverseDistance) / spec.tickSize) * spec.tickValue * volume;
  };

  for (const position of positions) {
    positionCount += 1;
    addExposure(position.symbol || fallbackSymbol, position.type, position.volume, position.price_open, position.sl);
  }
  for (const order of pendingOrders) {
    if (order.status !== 'PENDING') continue;
    pendingOrderCount += 1;
    addExposure(order.symbol, order.direction, order.volume, order.entry, order.sl);
  }

  return { riskUsd, positionCount, pendingOrderCount, unknownCount };
}
