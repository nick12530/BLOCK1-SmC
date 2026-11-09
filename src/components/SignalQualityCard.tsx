import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { ClosedTrade, MarketState, PendingOrder, Position, TickerState } from '../types/smc';
import {
  estimatePortfolioStopRisk,
  getCandleAgeMs,
  summarizeClosedTrades,
} from '../engine/tradingDiagnostics';
import { RISK_CONFIG } from '../engine/riskConfig';
import type { SignalValidationRecord } from '../engine/signalValidation';

interface SignalQualityCardProps {
  ticker: TickerState;
  market: MarketState;
  analyses: PairAnalysis[];
  closedTrades: ClosedTrade[];
  positions: Position[];
  pendingOrders: PendingOrder[];
  validations: SignalValidationRecord[];
}

export const SignalQualityCard: React.FC<SignalQualityCardProps> = ({
  ticker,
  market,
  analyses,
  closedTrades,
  positions,
  pendingOrders,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(intervalId);
  }, []);

  const metrics = useMemo(() => summarizeClosedTrades(closedTrades), [closedTrades]);

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
    candleAge <= 120_000;

  return (
    <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl px-4 py-3 bg-white dark:bg-[#121917] font-mono text-xs transition-colors space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Engine &amp; Risk Health Deck
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            · {feedHealthy ? 'Data Feed Verified' : 'Checking Feed'} · Risk: ${portfolioRisk.riskUsd.toFixed(2)} / ${portfolioRiskLimit.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors cursor-pointer"
          title={isExpanded ? 'Collapse Deck' : 'Expand Diagnostics'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Diagnostics Deck */}
      {isExpanded && (
        <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-t border-slate-100 dark:border-[#222d29]">
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Win Rate</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              {metrics.winRate !== null ? `${metrics.winRate.toFixed(1)}%` : 'No Closed Trades'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Profit Factor</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              {metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : '—'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Portfolio Stop Risk</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              ${portfolioRisk.riskUsd.toFixed(2)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Feed Latency</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              {quoteAge !== null ? `${(quoteAge / 1000).toFixed(1)}s` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
