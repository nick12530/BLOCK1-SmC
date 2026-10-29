import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, ShieldCheck, Zap } from 'lucide-react';
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
  if (ageMs === null) return '—';
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s`;
  return `${Math.floor(ageMs / 60_000)}m`;
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
  const [isExpanded, setIsExpanded] = useState(false);
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
  const riskUsedPct = portfolioRiskLimit > 0 ? (portfolioRisk.riskUsd / portfolioRiskLimit) * 100 : 0;
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
    <div className="neo-panel neo-card rounded-2xl border font-mono text-xs transition-colors overflow-hidden">
      {/* 1. Compact Telemetry Ribbon (Always Visible, Low Vertical Footprint) */}
      <div className="p-2.5 sm:px-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span className="font-sans font-bold text-slate-800 dark:text-zinc-200 text-xs">
            System Telemetry
          </span>
        </div>

        {/* Status Indicators Pill Strip */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Feed Health */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <span className={`w-2 h-2 rounded-full ${feedHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              {feedHealthy ? `Feed Live (${formatAge(quoteAge)})` : 'Feed Standby'}
            </span>
          </div>

          {/* Portfolio Risk Meter */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              Risk: <strong className="text-slate-900 dark:text-white">${portfolioRisk.riskUsd.toFixed(2)}</strong> / ${portfolioRiskLimit.toFixed(2)}
            </span>
            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  riskUsedPct > 80 ? 'bg-rose-500' : riskUsedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, riskUsedPct))}%` }}
              />
            </div>
          </div>

          {/* Validation Edge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              Edge: {validationMetrics.resolvedWinRate !== null ? `${validationMetrics.resolvedWinRate.toFixed(0)}% Win` : `${validationMetrics.sampleCount} Tracked`}
            </span>
          </div>

          {/* Expand / Collapse Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-[11px] font-bold cursor-pointer transition-colors"
          >
            <span>{isExpanded ? 'Hide Details' : 'Diagnostics'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Expandable Deep Diagnostics Drawer (Revealed only on demand) */}
      {isExpanded && (
        <div className="p-3 sm:p-4 border-t border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/30 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
              Closed Trade Results &amp; Forward Observations ({trackedSymbols.join(', ')})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Window:</span>
              <select
                value={windowDays ?? 'all'}
                onChange={(e) => setWindowDays(e.target.value === 'all' ? null : Number(e.target.value))}
                className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-zinc-200"
              >
                {rollingWindows.map((w) => (
                  <option key={w.label} value={w.days ?? 'all'}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Win Rate</span>
              <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
                {metrics.winRate !== null ? `${metrics.winRate.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-500 block">{metrics.count} closed trades</span>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Profit Factor</span>
              <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
                {metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : '—'}
              </span>
              <span className="text-[10px] text-slate-500 block">Gross wins / losses</span>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Realized PnL</span>
              <span className={`text-sm font-black tabular-nums block mt-0.5 ${
                metrics.netProfit > 0 ? 'text-emerald-500' : metrics.netProfit < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'
              }`}>
                ${metrics.netProfit.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block">Broker deal sync</span>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Signals Reaching TP</span>
              <span className="text-sm font-black text-emerald-500 tabular-nums block mt-0.5">
                {validationMetrics.targetHits} / {validationMetrics.targetHits + validationMetrics.stopHits}
              </span>
              <span className="text-[10px] text-slate-500 block">{validationMetrics.watching} currently watching</span>
            </div>
          </div>

          {/* Scanner Readiness Mini Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/50 dark:border-zinc-800/50">
            {trackedSymbols.map((sym) => {
              const analysis = analysisBySymbol.get(sym);
              const score = analysis?.confluenceScore ?? 0;
              const isReady = analysis?.status === 'READY';
              return (
                <div key={sym} className="p-2 rounded bg-white dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/40 text-[11px]">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900 dark:text-white">{sym}</strong>
                    <span className={`font-bold ${isReady ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {score}/100
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block truncate mt-0.5">
                    {analysis?.bias || 'Scanning'} · {analysis?.status || 'Active'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
