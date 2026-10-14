/**
 * PairsSignalDeck.tsx - Institutional Multi-Pair SMC Signal Deck
 * Elegantly displays all 4 currency pairs (XAUUSD, EURUSD, GBPUSD, USDJPY)
 * directly above the Multi-Strategy Signal Engine deck.
 *
 * Features:
 * - High-contrast institutional layout (no ribbons or overcoloured icons)
 * - Real-time confluence scoring, bias (BUY/SELL), spreads, and key SMC Order Blocks
 * - 1-Click symbol switching and trade alignment
 * - Responsive 4-column desktop / 2-column tablet / mobile-stacked deck
 */

import React, { useState } from 'react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  ArrowRight,
  Crosshair,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useEngine, useTicker } from '../hooks/useTradingStore';
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
  const ticker = useTicker();
  const autoSelectEnabled = engine.autoSelectBestScenario ?? true;
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!scannerAnalyses.length) return null;

  return (
    <div className="bg-white dark:bg-[#0c0e12] border border-slate-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 shadow-xs flex flex-col gap-2.5 font-sans transition-colors">
      {/* Top Header: Title, Active Status, Auto-Select Toggle & Collapse Toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2 sm:pb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-500">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Multi-Pair Signal Deck
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 whitespace-nowrap">
              4 Pairs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Auto-Select in Chart Toggle */}
          <button
            type="button"
            onClick={() => tradingEngine.setAutoSelectBestScenario(!autoSelectEnabled)}
            className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              autoSelectEnabled
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title="Automatically focus the highest-scoring currency pair on the chart"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Auto-Align: {autoSelectEnabled ? 'ON' : 'OFF'}</span>
            <span className="sm:hidden">{autoSelectEnabled ? 'Auto ON' : 'Auto OFF'}</span>
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Signal Deck Cards' : 'Collapse to Compact Deck Bar'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* When Collapsed: Sleek Single-Line Horizontal Deck for Maximum Space */}
      {isCollapsed ? (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 font-mono text-xs">
          {scannerAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-zinc-200 dark:text-zinc-950 border-slate-900 dark:border-zinc-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <span className="font-black">{item.symbol === 'XAUUSD' ? 'GOLD' : item.symbol}</span>
                <span className="tabular-nums font-bold text-[11px]">${item.price.toFixed(item.symbol === 'XAUUSD' || item.symbol === 'USDJPY' ? 2 : 4)}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    isBull
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : isBear
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  {item.bias} ({item.confluenceScore}%)
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Grid: 4 Elegantly Arranged Currency Pair Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {scannerAnalyses.map((item) => {
          const isActive = item.symbol === activeSymbol;
          const isBull = item.bias === 'BUY';
          const isBear = item.bias === 'SELL';
          const obZone = item.orderBlocks && item.orderBlocks.length > 0 ? item.orderBlocks[0] : null;
          const fvgZone = item.fvgs && item.fvgs.length > 0 ? item.fvgs[0] : null;
          const isDiscount = item.premiumDiscountPct < 50;

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className={`rounded-xl p-3 sm:p-3.5 border transition-all cursor-pointer flex flex-col justify-between gap-2.5 font-mono relative overflow-hidden min-w-0 ${
                isActive
                  ? 'bg-slate-100/90 dark:bg-zinc-900/90 border-slate-900 dark:border-zinc-500 shadow-xs'
                  : 'bg-slate-50/70 dark:bg-[#0f1217] border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-[#12161f]'
              }`}
            >
              {/* Row 1: Symbol Header, Live Price & Spread */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold shrink-0">
                      {item.symbol === 'XAUUSD' ? 'GOLD' : item.displayName.split('/')[0].trim()}
                    </span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" title="Active in workstation" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5 truncate">
                    Spread: {item.spreadPips}p ({item.spreadPoints} pts)
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                    ${item.price.toFixed(item.symbol === 'XAUUSD' || item.symbol === 'USDJPY' ? 2 : 4)}
                  </div>
                  <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 truncate">
                    {item.rank === 1 ? '★ TOP SETUP' : `Rank #${item.rank}`}
                  </div>
                </div>
              </div>

              {/* Row 2: Signal Bias, Status & Confluence Score */}
              <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0c0e12] border border-slate-200/80 dark:border-zinc-800 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 shrink-0 ${
                      isBull
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : isBear
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isBull ? <TrendingUp className="w-3 h-3" /> : isBear ? <TrendingDown className="w-3 h-3" /> : null}
                    <span>{item.bias}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                    {item.status}
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <strong className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                    {item.confluenceScore}%
                  </strong>
                </div>
              </div>

              {/* Row 3: Multi-Timeframe Alignment Ribbon */}
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-100/70 dark:bg-[#0a0d13] border border-slate-200/50 dark:border-zinc-800/60 text-[10px] font-mono min-w-0">
                <span className="text-slate-400 font-bold shrink-0">MTF:</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      item.m1Trend === 'bullish'
                        ? 'text-emerald-500 bg-emerald-500/10'
                        : item.m1Trend === 'bearish'
                        ? 'text-rose-500 bg-rose-500/10'
                        : 'text-slate-400 bg-slate-200 dark:bg-zinc-800'
                    }`}
                    title={`M1: ${item.m1Trend}`}
                  >
                    1m
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      item.m5Trend === 'bullish'
                        ? 'text-emerald-500 bg-emerald-500/10'
                        : item.m5Trend === 'bearish'
                        ? 'text-rose-500 bg-rose-500/10'
                        : 'text-slate-400 bg-slate-200 dark:bg-zinc-800'
                    }`}
                    title={`M5: ${item.m5Trend}`}
                  >
                    5m
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      item.m15Trend === 'bullish'
                        ? 'text-emerald-500 bg-emerald-500/10'
                        : item.m15Trend === 'bearish'
                        ? 'text-rose-500 bg-rose-500/10'
                        : 'text-slate-400 bg-slate-200 dark:bg-zinc-800'
                    }`}
                    title={`M15: ${item.m15Trend}`}
                  >
                    15m
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      item.h1Trend === 'bullish'
                        ? 'text-emerald-500 bg-emerald-500/10'
                        : item.h1Trend === 'bearish'
                        ? 'text-rose-500 bg-rose-500/10'
                        : 'text-slate-400 bg-slate-200 dark:bg-zinc-800'
                    }`}
                    title={`H1: ${item.h1Trend}`}
                  >
                    1h
                  </span>
                </div>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                    isDiscount
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                  }`}
                >
                  {item.premiumDiscountPct}% {isDiscount ? 'Discount' : 'Premium'}
                </span>
              </div>

              {/* Row 4: Key SMC Order Block, Structure & Target */}
              <div className="text-[11px] space-y-1 text-slate-600 dark:text-slate-300 bg-slate-100/60 dark:bg-[#0c0e12] p-2 rounded-xl border border-slate-200/60 dark:border-zinc-800/80 min-w-0">
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">Order Block:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-right">
                    {obZone ? `${obZone.bullish ? '+OB' : '-OB'} $${obZone.bottom.toFixed(item.symbol === 'XAUUSD' ? 1 : 3)}` : 'Scanning'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">Target RR / Lot:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate text-right">
                    1:{item.riskRewardRatio} {item.safeLotSize ? `(${item.safeLotSize}L)` : ''}
                  </span>
                </div>

                {/* Structure / Liquidity Status */}
                <div className="flex items-center justify-between gap-1 min-w-0 pt-0.5 border-t border-slate-200/40 dark:border-zinc-800/60 text-[10px]">
                  <span className="text-slate-400 shrink-0">Structure:</span>
                  <span className="font-semibold text-slate-700 dark:text-zinc-300 truncate text-right">
                    {item.liquidity?.recentSweep
                      ? `${item.liquidity.recentSweep === 'high' ? 'High' : 'Low'} Swept (SFP)`
                      : item.lastBOS
                      ? `BOS ${item.lastBOS.direction}`
                      : item.sessionName || 'Interbank'}
                  </span>
                </div>

                {item.signal && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-sky-600 dark:text-sky-300 min-w-0">
                    <span className="shrink-0 font-medium">Entry POI:</span>
                    <span className="font-bold tabular-nums truncate">${item.signal.entry.toFixed(item.symbol === 'XAUUSD' ? 2 : 4)}</span>
                  </div>
                )}
              </div>

              {/* Row 5: Action Button */}
              <div>
                {isActive ? (
                  <div className="w-full py-2 px-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-black text-center flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>Active in Terminal</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSymbol(item.symbol);
                      if (item.status === 'READY' && onExecuteTrade) {
                        onExecuteTrade(item);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{item.status === 'READY' ? `Trade ${item.symbol}` : `Focus ${item.symbol}`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
});
