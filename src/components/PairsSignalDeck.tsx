/**
 * PairsSignalDeck.tsx - Minimalist Multi-Pair Signal Deck
 * Elegantly displays all 4 currency pairs (XAUUSD, EURUSD, USDJPY, GBPUSD)
 * with zero unnecessary visual clutter:
 * - High-contrast, clean typography (no nested cards or garish badges)
 * - Clear direction (BUY/SELL), confluence %, and key SMC target level
 * - 1-Click symbol switching
 * - 1-Click collapsible into a sleek single-line ticker
 */

import React, { useState } from 'react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';

interface PairsSignalDeckProps {
  scannerAnalyses: PairAnalysis[];
  activeSymbol: string;
  onSelectSymbol: (symbol: SupportedSymbol) => void;
  onExecuteTrade?: (analysis: PairAnalysis) => void;
}

export const PairsSignalDeck: React.FC<PairsSignalDeckProps> = React.memo(({
  scannerAnalyses,
  activeSymbol,
  onSelectSymbol,
  onExecuteTrade,
}) => {
  const engine = useEngine();
  const autoSelectEnabled = engine.autoSelectBestScenario ?? true;
  const [isCollapsed, setIsCollapsed] = useState(true);

  const readyCount = scannerAnalyses.filter((analysis) =>
    analysis.status === 'READY' &&
    typeof analysis.safeLotSize === 'number' &&
    analysis.safeLotSize > 0
  ).length;

  const analyzedSymbols = new Set(scannerAnalyses.map((analysis) => analysis.symbol));
  const missingSymbols = SUPPORTED_SYMBOLS.filter((symbol) => !analyzedSymbols.has(symbol));
  
  const orderedAnalyses = [...scannerAnalyses].sort((left, right) => {
    const leftTradeable = left.status === 'READY' && typeof left.safeLotSize === 'number' && left.safeLotSize > 0 ? 1 : 0;
    const rightTradeable = right.status === 'READY' && typeof right.safeLotSize === 'number' && right.safeLotSize > 0 ? 1 : 0;
    const leftReady = left.status === 'READY' ? 1 : 0;
    const rightReady = right.status === 'READY' ? 1 : 0;
    return rightTradeable - leftTradeable ||
      rightReady - leftReady ||
      right.confluenceScore - left.confluenceScore;
  });

  return (
    <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl px-4 py-3 bg-white dark:bg-[#121917] transition-colors font-mono text-xs">
      {/* Deck Header: Title & Minimal Actions */}
      <div className="flex items-center justify-between pb-1 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Scanner Deck
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            · {readyCount} of {SUPPORTED_SYMBOLS.length} ready
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => tradingEngine.setAutoSelectBestScenario(!autoSelectEnabled)}
            className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer ${
              autoSelectEnabled
                ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                : 'bg-slate-50 dark:bg-[#0f1513] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#222d29]'
            }`}
            title="Automatically switch chart to top scoring setup"
          >
            Auto-Focus: {autoSelectEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Deck' : 'Collapse to Strip'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!scannerAnalyses.length ? (
        <div className="pt-2 text-[11px] text-slate-400 dark:text-slate-500">
          Waiting for live quotes and broker candles...
        </div>
      ) : isCollapsed ? (
        /* Minimalist Single-Line Ticker Deck */
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 font-mono text-xs">
          {orderedAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            const hasSafeLot = typeof item.safeLotSize === 'number' && item.safeLotSize > 0;
            const statusLabel = item.status === 'READY'
              ? hasSafeLot ? `${item.bias} READY` : 'RISK BLOCKED'
              : item.status === 'BLOCKED'
                ? 'BLOCKED'
                : item.bias === 'WAITING'
                  ? 'NO SETUP'
                  : `${item.bias} BIAS`;

            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-xs ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-transparent font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-[#0f1513] border-slate-200 dark:border-[#222d29] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <span>{item.symbol === 'XAUUSD' ? 'GOLD' : item.symbol}</span>
                <span className="tabular-nums font-bold">
                  {item.price.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    isBull
                      ? isActive ? 'text-emerald-300 dark:text-emerald-700' : 'text-emerald-600 dark:text-emerald-400'
                      : isBear
                      ? isActive ? 'text-rose-300 dark:text-rose-700' : 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {statusLabel} · {item.confluenceScore}
                </span>
              </button>
            );
          })}
          {missingSymbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => onSelectSymbol(symbol)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-400 dark:border-[#222d29] dark:text-slate-500 text-xs"
            >
              <span>{symbol}</span>
              <span className="text-[10px]">WAITING</span>
            </button>
          ))}
        </div>
      ) : (
        /* Modest, Airy 4-Column Card Grid with zero squeezing */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
          {orderedAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            const hasSafeLot = typeof item.safeLotSize === 'number' && item.safeLotSize > 0;
            const canTrade = item.status === 'READY' && hasSafeLot;

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol(item.symbol)}
                className={`rounded-xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between gap-2.5 font-mono ${
                  isActive
                    ? 'bg-slate-50 dark:bg-[#161f1c] border-slate-900 dark:border-white shadow-xs'
                    : 'bg-slate-50/50 dark:bg-[#0f1513] border-slate-200 dark:border-[#222d29] hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.symbol === 'XAUUSD' ? 'GOLD' : item.symbol}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <span className="tabular-nums font-bold text-slate-900 dark:text-white">
                    {item.price.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}
                  </span>
                </div>

                {/* Status Row */}
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    {isBull ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isBear ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    ) : null}
                    <span className="font-bold">
                      {item.signal ? item.signal.direction : item.bias}
                    </span>
                  </div>
                  <span>Score: <strong className="text-slate-900 dark:text-white">{item.confluenceScore}</strong></span>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSymbol(item.symbol);
                    if (canTrade && onExecuteTrade) {
                      onExecuteTrade(item);
                    }
                  }}
                  className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-200 dark:bg-[#222d29] text-slate-800 dark:text-slate-200'
                      : 'bg-white dark:bg-[#1a2320] border border-slate-200 dark:border-[#222d29] text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{isActive ? 'Current Chart' : canTrade ? `Execute ${item.symbol}` : `View ${item.symbol}`}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
