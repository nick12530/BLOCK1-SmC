import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, ShieldCheck } from 'lucide-react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import type { ClosedTrade, MarketState, PendingOrder, Position, TickerState } from '../types/smc';
import {
  estimatePortfolioStopRisk,
  filterTradesByWindow,
  getCandleAgeMs,
  summarizeClosedTrades,
} from '../engine/tradingDiagnostics';
import { RISK_CONFIG } from '../engine/riskConfig';
import type { SignalValidationRecord } from '../engine/signalValidation';
import { summarizeSignalValidations } from '../engine/signalValidation';

interface SignalQualityCardProps {
  ticker: TickerState;
  market: MarketState;
  analyses: PairAnalysis[];
  closedTrades: ClosedTrade[];
  positions: Position[];
  pendingOrders: PendingOrder[];
  validations: SignalValidationRecord[];
}

const trackedSymbols: SupportedSymbol[] = ['XAUUSD', 'EURUSD', 'USDJPY', 'GBPUSD'];
const rollingWindows = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'All history', days: null },
] as const;

function formatAge(ageMs: number | null): string {
  if (ageMs === null) return 'Unavailable';
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)} sec`;
  return `${Math.floor(ageMs / 60_000)} min`;
}

export const SignalQualityCard: React.FC<SignalQualityCardProps> = ({
  ticker,
  market,
  analyses,
  closedTrades,
  positions,
  pendingOrders,
  validations,
}) => {
  const [windowDays, setWindowDays] = useState<number | null>(30);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const filteredTrades = useMemo(
    () => filterTradesByWindow(closedTrades, windowDays),
    [closedTrades, windowDays]
  );
  const metrics = useMemo(() => summarizeClosedTrades(filteredTrades), [filteredTrades]);
  const validationWindow = useMemo(() => {
    if (windowDays === null) return validations;
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    return validations.filter((record) => Date.parse(record.createdAt) >= cutoff);
  }, [validations, windowDays]);
  const validationMetrics = useMemo(
    () => summarizeSignalValidations(validationWindow),
    [validationWindow]
  );
  const symbolSpecs = useMemo(() => {
    const specs: Record<string, NonNullable<PairAnalysis['symbolSpec']>> = {};
    for (const analysis of analyses) {
      if (analysis.symbolSpec) specs[analysis.symbol] = analysis.symbolSpec;
    }
    if (market.symbolSpec) specs[ticker.symbol] = market.symbolSpec;
    return specs;
  }, [analyses, market.symbolSpec, ticker.symbol]);
  const portfolioRisk = useMemo(
    () => estimatePortfolioStopRisk(positions, pendingOrders, symbolSpecs, ticker.symbol),
    [positions, pendingOrders, symbolSpecs, ticker.symbol]
  );
  const portfolioRiskLimit = ticker.equity * (RISK_CONFIG.maxPortfolioRiskPercent / 100);
  const candleAge = getCandleAgeMs(market.candlesM1, now);
  const quoteAge =
    ticker.quoteUpdatedAt && ticker.quoteUpdatedAt > 0
      ? Math.max(0, now - ticker.quoteUpdatedAt)
      : null;
  const feedHealthy =
    Boolean(ticker.marketDataAvailable) &&
    quoteAge !== null &&
    quoteAge <= 45_000 &&
    candleAge !== null &&
    candleAge <= 3 * 60_000;
  const analysisBySymbol = new Map(analyses.map((analysis) => [analysis.symbol, analysis]));

  return (
    <section
      aria-labelledby="signal-quality-heading"
      className="neo-panel neo-card isolate min-w-0 rounded-2xl border p-4 sm:p-5 text-slate-800 dark:text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/12 p-2.5 text-blue-700 dark:text-blue-300">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 id="signal-quality-heading" className="text-base font-extrabold tracking-tight">
              Signal Quality &amp; System Health
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Broker observations and closed-trade results; confluence is not a win probability.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold">
          <span>Results window</span>
          <select
            value={windowDays ?? 'all'}
            onChange={(event) =>
              setWindowDays(event.target.value === 'all' ? null : Number(event.target.value))
            }
            className="rounded-lg border border-slate-300 bg-white/80 px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {rollingWindows.map((window) => (
              <option key={window.label} value={window.days ?? 'all'}>
                {window.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl bg-slate-100/80 p-3.5 dark:bg-slate-900/55">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold">
              {feedHealthy ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              Broker feed
            </h3>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                feedHealthy
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
              }`}
            >
              {feedHealthy ? 'FRESH' : ticker.marketDataAvailable ? 'CHECK FEED' : 'WAITING'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <p className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-800/70">
              <span className="block font-semibold text-slate-500 dark:text-slate-400">Quote age</span>
              <strong className="mt-0.5 block font-extrabold">{formatAge(quoteAge)}</strong>
            </p>
            <p className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-800/70">
              <span className="block font-semibold text-slate-500 dark:text-slate-400">M1 candle age</span>
              <strong className="mt-0.5 block font-extrabold">{formatAge(candleAge)}</strong>
            </p>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {ticker.symbol} · spread {ticker.spread.toFixed(1)} points · calendar/data readiness remains a separate trade gate.
          </p>
        </div>

        <div className="rounded-xl bg-slate-100/80 p-3.5 dark:bg-slate-900/55">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              Closed-trade results
            </h3>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {metrics.count} broker-synced
            </span>
          </div>
          {metrics.count > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Metric label="Win rate" value={`${metrics.winRate?.toFixed(1)}%`} />
              <Metric label="Net P&L" value={`$${metrics.netProfit.toFixed(2)}`} />
              <Metric
                label="Profit factor"
                value={metrics.profitFactor === null ? 'No losses yet' : metrics.profitFactor.toFixed(2)}
              />
              <Metric label="Avg outcome" value={`$${metrics.averageOutcome?.toFixed(2)}`} />
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              No closed broker trades in this window. Performance metrics are withheld until there is an observed sample.
            </p>
          )}
          <p className="mt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            Realized MT5 deal outcomes include broker-reported deal costs. Past results do not predict future returns.
          </p>
        </div>
      </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100/80 px-3.5 py-3 dark:bg-slate-900/55">
          <div>
            <p className="text-xs font-extrabold">Open and pending stop exposure</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              Current stop-distance estimate · risk cap {RISK_CONFIG.maxPortfolioRiskPercent}% of equity
            </p>
          </div>
          <div className="text-right">
            {ticker.marketDataAvailable && ticker.equity > 0 ? (
              <p className="font-mono text-sm font-extrabold tabular-nums">
                ${portfolioRisk.riskUsd.toFixed(2)} / ${portfolioRiskLimit.toFixed(2)}
              </p>
            ) : (
              <p className="text-xs font-extrabold">Connect MT5 to calculate</p>
            )}
            <p
              className={`text-[10px] font-extrabold ${
                portfolioRisk.unknownCount
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {portfolioRisk.positionCount} positions · {portfolioRisk.pendingOrderCount} pending
              {portfolioRisk.unknownCount ? ` · ${portfolioRisk.unknownCount} risk unknown` : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-slate-100/80 p-3.5 dark:bg-slate-900/55">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold">Prospective signal validation</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                Forward-observes READY triggers on closed broker M1 candles; not a historical backtest or execution record.
              </p>
            </div>
            <span className="rounded-full bg-blue-500/12 px-2.5 py-1 text-[11px] font-extrabold text-blue-700 dark:text-blue-300">
              {validationMetrics.sampleCount} observed
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="TP before SL"
              value={
                validationMetrics.resolvedWinRate === null
                  ? 'Collecting sample'
                  : `${validationMetrics.resolvedWinRate.toFixed(1)}% · ${validationMetrics.targetHits + validationMetrics.stopHits} resolved`
              }
            />
            <Metric label="Still watching" value={String(validationMetrics.watching)} />
            <Metric label="Expired before trigger" value={String(validationMetrics.expiredUntriggered)} />
            <Metric label="Ambiguous / open at expiry" value={`${validationMetrics.ambiguous} / ${validationMetrics.expiredOpen}`} />
          </div>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            Ties where the same candle reaches trigger and a target/stop are excluded as ambiguous. Spread, commission, slippage, and executable fills are not modeled in this signal-only observation.
          </p>
        </div>

      <details className="group mt-3 rounded-xl bg-slate-100/80 p-3.5 dark:bg-slate-900/55">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold">
          <span className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            Scanner readiness and rejection reasons
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {trackedSymbols.map((symbol) => {
            const analysis = analysisBySymbol.get(symbol);
            return (
              <div key={symbol} className="rounded-lg bg-white/75 p-3 dark:bg-slate-800/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-extrabold">{symbol}</span>
                  <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                    {analysis ? `${analysis.confluenceScore}/100` : 'NO FRESH SCAN'}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] font-bold">
                  {analysis ? `${analysis.status} · ${analysis.bias}` : 'Waiting for fresh broker data'}
                </p>
                <p className="mt-1 break-words text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {analysis?.rejectionReason ||
                    (analysis
                      ? 'No active rejection. Re-check live price, spread, and trigger before execution.'
                      : 'A stale or incomplete symbol is excluded rather than filled with sample values.')}
                </p>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 rounded-lg bg-white/70 px-2.5 py-2 dark:bg-slate-800/70">
    <span className="block truncate font-semibold text-slate-500 dark:text-slate-400">{label}</span>
    <strong className="mt-0.5 block truncate font-extrabold tabular-nums">{value}</strong>
  </div>
);
