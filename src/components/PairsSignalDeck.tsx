/**
 * PairsSignalDeck.tsx - NIFTY Minimalist Multi-Pair Signal Deck
 * Elegantly displays all 4 currency pairs (XAUUSD, EURUSD, USDJPY, GBPUSD)
 * with zero unnecessary visual clutter:
 * - High-contrast, clean typography (no nested cards or garish badges)
 * - Clear direction (BUY/SELL), confluence %, and key SMC target level
 * - 1-Click symbol switching and execution
 * - Responsive 4-column desktop / 2-column tablet / mobile-stacked deck
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
  Sparkles,
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
    <div className="neo-panel neo-card w-full border rounded-2xl p-4 sm:p-5 transition-colors">
      {/* Deck Header: Title, Auto-Align & Collapse Toggle */}
      <div className="flex items-center justify-between pb-1 mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider font-sans">
            Live Setup Scan
          </h2>
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300 font-mono">
            {readyCount} READY / {SUPPORTED_SYMBOLS.length} PAIRS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-Align toggle */}
          <button
            type="button"
            onClick={() => tradingEngine.setAutoSelectBestScenario(!autoSelectEnabled)}
            className={`text-xs font-mono font-medium px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
              autoSelectEnabled
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800'
            }`}
            title="Automatically focus the highest-scoring currency pair"
          >
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>Auto-Focus: {autoSelectEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Cards' : 'Collapse to Ticker'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!scannerAnalyses.length ? (
        <div>
          <p className="py-2 text-xs font-mono text-slate-500 dark:text-zinc-400">
            {engine.connected
              ? 'Waiting for fresh MT5 broker quotes, candles, and symbol specifications. No synthetic signals are shown.'
              : 'Connect the local MT5 bridge to load verified market data. No synthetic signals are shown.'}
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-[10px] font-bold text-slate-500 dark:text-zinc-400">
            {SUPPORTED_SYMBOLS.map((symbol) => (
              <span key={symbol} className="rounded-md border border-slate-200 px-2 py-1 dark:border-zinc-800">
                {symbol} · NO FRESH SCAN
              </span>
            ))}
          </div>
        </div>
      ) : isCollapsed ? (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 font-mono text-xs">
          {orderedAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            const hasSafeLot = typeof item.safeLotSize === 'number' && item.safeLotSize > 0;
            const statusLabel = item.status === 'READY'
              ? hasSafeLot ? `READY ${item.bias}` : 'RISK BLOCKED'
              : item.status === 'BLOCKED'
                ? 'BLOCKED'
                : item.rejectionReason?.includes('INSUFFICIENT_DIRECTIONAL_MOVEMENT')
                  ? `NO MOVEMENT${item.bias === 'WAITING' ? '' : ` · ${item.bias} BIAS`}`
                  : item.bias === 'WAITING'
                    ? 'NO SETUP'
                    : `WAITING · ${item.bias} BIAS`;
            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'neo-vivid-blue border-transparent text-white shadow-xs font-bold'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <span>{item.symbol === 'XAUUSD' ? 'GOLD' : item.symbol}</span>
                <span className="tabular-nums font-black">
                  {item.price.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    isBull
                      ? 'text-emerald-500'
                      : isBear
                      ? 'text-rose-500'
                      : 'text-slate-400'
                  }`}
                >
                  {statusLabel} · {item.confluenceScore}/100
                </span>
                {item.signal?.optimalTradeEntry && (
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-300">
                    OTE {item.signal.optimalTradeEntry.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}
                  </span>
                )}
              </button>
            );
          })}
          {missingSymbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => onSelectSymbol(symbol)}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-1.5 text-slate-600 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200"
              title="No fresh broker-backed scan is available for this pair."
            >
              <span>{symbol}</span>
              <span className="text-[10px] font-bold">NO FRESH SCAN</span>
            </button>
          ))}
        </div>
      ) : (
        /* Grid: 4 Clean, Minimalist Cards with Generous Spacing */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {orderedAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            const obZone = item.orderBlocks && item.orderBlocks.length > 0 ? item.orderBlocks[0] : null;
            const hasSafeLot = typeof item.safeLotSize === 'number' && item.safeLotSize > 0;
            const canTrade = item.status === 'READY' && hasSafeLot;
            const hasNoMovement = item.rejectionReason?.includes('INSUFFICIENT_DIRECTIONAL_MOVEMENT');

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol(item.symbol)}
                className={`neo-panel neo-card rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between gap-3 font-mono relative ${
                  isActive
                    ? 'bg-sky-50 dark:bg-sky-950/25 border-sky-500 shadow-xs'
                    : 'bg-white dark:bg-[#0f1117] border-slate-200 dark:border-zinc-800/90 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* 1. Header: Symbol, Subtitle & Live Price */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                        {item.symbol}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {item.symbol === 'XAUUSD' ? 'Gold' : item.displayName.split('/')[0].trim()}
                      </span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                      Spread: {item.spreadPips}p
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 dark:text-white tabular-nums block">
                      {item.price.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                      1:{item.riskRewardRatio} RR
                    </span>
                  </div>
                </div>

                {/* 2. Middle Row: Confluence & Direction */}
                <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-slate-100/70 dark:bg-black/40 border border-slate-200/50 dark:border-zinc-800/60">
                  <div className="flex items-center gap-1.5">
                    {isBull ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isBear ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    ) : null}
                    <span
                      className={`font-black ${
                        isBull
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isBear
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.signal ? item.signal.direction : item.bias === 'WAITING' ? 'NO SETUP' : `${item.bias} BIAS`}
                    </span>
                    <span className="text-slate-400 dark:text-zinc-600">·</span>
                    <span className="text-slate-600 dark:text-zinc-300 font-bold">
                      {item.confluenceScore}/100
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate max-w-[100px]">
                  {item.status === 'READY' && !(typeof item.safeLotSize === 'number' && item.safeLotSize > 0)
                    ? 'RISK BLOCKED'
                    : item.status === 'READY' && item.signal?.optimalTradeEntry
                    ? `OTE ${item.signal.optimalTradeEntry.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}`
                    : hasNoMovement
                      ? 'NO MOVEMENT'
                    : obZone
                      ? `${obZone.bullish ? '+OB' : '-OB'} ${obZone.bottom.toFixed(item.symbol === 'XAUUSD' ? 2 : item.symbol === 'USDJPY' ? 3 : 5)}`
                      : item.status}
                  </span>
                </div>

                {/* 3. Action Button */}
                <div>
                  {isActive ? (
                    <div className="w-full py-1.5 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active on Chart</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSymbol(item.symbol);
                        if (canTrade && onExecuteTrade) {
                          onExecuteTrade(item);
                        }
                      }}
                      title={item.status === 'READY' && !hasSafeLot
                        ? 'Blocked by the current risk limit: the minimum valid lot would exceed the risk budget.'
                        : undefined}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{canTrade ? `Trade ${item.symbol}` : item.status === 'READY' && !hasSafeLot ? 'Risk limit — no safe lot' : `View ${item.symbol}`}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {missingSymbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => onSelectSymbol(symbol)}
              className="neo-panel neo-card flex min-h-36 flex-col justify-center gap-2 rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/40 p-4 text-left font-mono dark:border-amber-700/50 dark:bg-amber-950/10"
              title="No fresh broker-backed scan is available for this pair."
            >
              <span className="text-sm font-black text-slate-800 dark:text-slate-100">{symbol}</span>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">NO FRESH SCAN</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Waiting for fresh broker quotes, candles, and symbol specifications.
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
