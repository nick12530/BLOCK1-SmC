/**
 * MultiPairScannerPanel.tsx - Unified Multi-Instrument SMC Market Scanner
 * Displays all 4 instruments simultaneously (XAUUSD, EURUSD, USDJPY, GBPUSD)
 * with real-time MT5 metrics, confluence scoring (0-100), trends, setup quality,
 * and small account risk sizing.
 */

import React from 'react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface MultiPairScannerPanelProps {
  scannerAnalyses: PairAnalysis[];
  activeSymbol: string;
  onSelectSymbol: (symbol: SupportedSymbol) => void;
  onExecuteTrade?: (analysis: PairAnalysis) => void;
}

export const MultiPairScannerPanel: React.FC<MultiPairScannerPanelProps> = ({
  scannerAnalyses,
  activeSymbol,
  onSelectSymbol,
  onExecuteTrade,
}) => {
  return (
    <div className="bg-white dark:bg-[#0c131c] border border-slate-200 dark:border-[#1a3040] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col gap-4 font-sans transition-colors">
      {/* Header with Scanner Title & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#1a3040]/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Multi-Pair Market Scanner</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                4 Pairs Live
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Continuous SMC confluence evaluation, liquidity tracking, and small account risk protection
            </p>
          </div>
        </div>

        {/* Quick Opportunity Filter Status */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            Active: <strong className="text-sky-600 dark:text-sky-400 font-bold">{activeSymbol}</strong>
          </span>
        </div>
      </div>

      {/* Grid of 4 Instrument Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {scannerAnalyses.map((item) => {
          const isSelected = item.symbol === activeSymbol;
          const isReady = item.status === 'READY';
          const isBlocked = item.status === 'BLOCKED';
          const isBuy = item.bias === 'BUY';
          const isSell = item.bias === 'SELL';

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                isSelected
                  ? 'bg-sky-500/[0.04] dark:bg-[#102336] border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                  : 'bg-slate-50/70 dark:bg-[#0e1925] border-slate-200 dark:border-[#1a3040] hover:border-slate-300 dark:hover:border-[#244258]'
              }`}
            >
              {/* Rank Banner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    {item.symbol}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium">
                    {item.displayName.split('/')[0].trim()}
                  </span>
                </div>

                {/* Podium Rank */}
                <span
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                    item.rank === 1
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-slate-200/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {item.rank === 1 ? '★ Best Setup' : `#${item.rank}`}
                </span>
              </div>

              {/* Price & Spread Matrix */}
              <div className="flex items-baseline justify-between border-b border-slate-200/60 dark:border-zinc-800/60 pb-2.5 font-mono">
                <div>
                  <span className="text-[11px] text-zinc-400 block">Bid / Ask</span>
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {item.bid.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block">Spread</span>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      item.spreadAcceptable
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {item.spreadPips} pips ({item.spreadPoints} pts)
                  </span>
                </div>
              </div>

              {/* Direction Bias & Confluence Score */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                    {isBuy ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isSell ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    <strong
                      className={`font-bold ${
                        isBuy
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isSell
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {item.bias === 'WAITING' ? 'Ranging Bias' : `${item.bias} Bias`}
                    </strong>
                  </span>

                  <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                    {item.confluenceScore}/100 Score
                  </span>
                </div>

                {/* Score Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.confluenceScore >= 75
                        ? 'bg-emerald-500'
                        : item.confluenceScore >= 60
                        ? 'bg-sky-500'
                        : 'bg-zinc-400'
                    }`}
                    style={{ width: `${Math.max(8, item.confluenceScore)}%` }}
                  />
                </div>
              </div>

              {/* Multi-Timeframe Trend Badges */}
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                {[
                  { label: 'M1', trend: item.m1Trend },
                  { label: 'M5', trend: item.m5Trend },
                  { label: 'M15', trend: item.m15Trend },
                  { label: 'H1', trend: item.h1Trend },
                ].map(({ label, trend }) => (
                  <div
                    key={label}
                    className={`py-1 rounded border font-bold ${
                      trend === 'bullish'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : trend === 'bearish'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : 'bg-slate-200/50 dark:bg-zinc-800/50 text-zinc-500 border-transparent'
                    }`}
                  >
                    <span>{label}: </span>
                    <span className="uppercase">{trend[0]}</span>
                  </div>
                ))}
              </div>

              {/* Trade Execution Matrix (Entry, SL, TP, RR) */}
              <div className="bg-white/80 dark:bg-[#0a141f] p-2.5 rounded-xl border border-slate-200/70 dark:border-zinc-800/80 font-mono text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>Entry: ${item.entryPrice}</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    1:{item.riskRewardRatio} RR
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>SL: ${item.suggestedSL}</span>
                  <span>TP: ${item.suggestedTP}</span>
                </div>
              </div>

              {/* Status / Rejection Banner */}
              {isBlocked && item.rejectionReason ? (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] flex items-start gap-1.5 leading-tight">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="truncate" title={item.rejectionReason}>
                    {item.rejectionReason}
                  </span>
                </div>
              ) : isReady ? (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Confluence Ready</span>
                  </span>
                  {item.safeLotSize && <span>{item.safeLotSize} Lots</span>}
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-zinc-500 text-[11px] text-center">
                  Awaiting Structure Confirmation
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSymbol(item.symbol);
                  if (isReady && onExecuteTrade) {
                    onExecuteTrade(item);
                  }
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200'
                }`}
              >
                <span>{isSelected ? (isReady ? `Execute ${item.bias}` : 'Active Terminal') : `Inspect ${item.symbol}`}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
