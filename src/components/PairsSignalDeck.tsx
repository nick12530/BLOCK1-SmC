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

import React from 'react';
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

  if (!scannerAnalyses.length) return null;

  return (
    <div className="bg-white dark:bg-[#0c141d] border border-slate-200/90 dark:border-[#1a2d3e] rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-xs flex flex-col gap-2.5 sm:gap-3.5 font-sans transition-colors">
      {/* Top Header: Title, Active Status & Auto-Select Toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#162736] pb-2 sm:pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-500">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Multi-Pair Signal Deck
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 whitespace-nowrap">
              4 Pairs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-Select in Chart Toggle */}
          <button
            type="button"
            onClick={() => tradingEngine.setAutoSelectBestScenario(!autoSelectEnabled)}
            className={`text-[11px] font-mono font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              autoSelectEnabled
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title="Automatically focus the highest-scoring currency pair on the chart"
          >
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>Auto-Align: {autoSelectEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Grid: 4 Elegantly Arranged Currency Pair Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {scannerAnalyses.map((item) => {
          const isActive = item.symbol === activeSymbol;
          const isBull = item.bias === 'BUY';
          const isBear = item.bias === 'SELL';
          const obZone = item.orderBlocks && item.orderBlocks.length > 0 ? item.orderBlocks[0] : null;

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className={`rounded-xl p-3 sm:p-3.5 border transition-all cursor-pointer flex flex-col justify-between gap-2.5 font-mono relative ${
                isActive
                  ? 'bg-sky-500/[0.04] dark:bg-[#0e1f30] border-sky-500 dark:border-sky-500 shadow-md ring-1 ring-sky-500/40'
                  : 'bg-slate-50/70 dark:bg-[#09121c] border-slate-200 dark:border-[#172736] hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-[#0c1622]'
              }`}
            >
              {/* Row 1: Symbol Header, Live Price & Spread */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      {item.symbol === 'XAUUSD' ? 'GOLD' : item.displayName.split('/')[0].trim()}
                    </span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" title="Active in workstation" />
                    )}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                    Spread: {item.spreadPips} pips ({item.spreadPoints} pts)
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                    ${item.price.toFixed(item.symbol === 'XAUUSD' || item.symbol === 'USDJPY' ? 2 : 4)}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-bold text-sky-600 dark:text-sky-400">
                    {item.rank === 1 ? '★ TOP CONFLUENCE' : `Rank #${item.rank}`}
                  </div>
                </div>
              </div>

              {/* Row 2: Signal Bias & Confluence Score */}
              <div className="flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-lg bg-white dark:bg-[#060c14] border border-slate-200/80 dark:border-[#142232]">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
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
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {item.status}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Score: </span>
                  <strong className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                    {item.confluenceScore}/100
                  </strong>
                </div>
              </div>

              {/* Row 3: Key Order Block & Risk:Reward Details */}
              <div className="text-[10px] sm:text-[11px] space-y-1 sm:space-y-1.5 text-slate-600 dark:text-slate-300 bg-slate-100/60 dark:bg-[#071018] p-2 sm:p-2.5 rounded-lg border border-slate-200/60 dark:border-[#142232]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Order Block:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                    {obZone ? `${obZone.bullish ? '+OB' : '-OB'} $${obZone.bottom.toFixed(item.symbol === 'XAUUSD' ? 1 : 3)}` : 'Scanning Order Block'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target RR:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    1:{item.riskRewardRatio} RR
                  </span>
                </div>

                {item.signal && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-sky-600 dark:text-sky-300">
                    <span>Entry POI:</span>
                    <span className="font-bold tabular-nums">${item.signal.entry.toFixed(item.symbol === 'XAUUSD' ? 2 : 4)}</span>
                  </div>
                )}
              </div>

              {/* Row 4: Action Button */}
              <div>
                {isActive ? (
                  <div className="w-full py-1.5 sm:py-2 px-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Active Workstation</span>
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
                    className="w-full py-1.5 sm:py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
    </div>
  );
});
