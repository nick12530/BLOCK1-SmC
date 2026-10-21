/**
 * PairsSignalDeck.tsx - NIFTY Minimalist Multi-Pair Sniper Signal Deck
 * Precision PC-Focused Layout:
 * - Spacious, high-contrast, uncluttered cards for all 4 currency pairs
 * - Exact entry points "to the dot" with live countdown timers
 * - Distinguishes 100% Conviction VIP Telegram pre-execution setups
 * - Automatically shuts down expired/invalidated setups
 * - Instant 1-click symbol focus & execution
 */

import React, { useState, useEffect } from 'react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { signalAudioNotifier } from '../utils/audioNotification';

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
  const autoSelectEnabled = engine.autoSelectBestScenario ?? false;
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Live seconds countdown ticker
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!scannerAnalyses.length) return null;

  return (
    <div className="w-full bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
      {/* Header: Spacious, Minimalist Bar */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-zinc-800/80 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-sans">
              SNIPER SIGNAL DECK
            </h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
            4 Core Instruments · Real-Time Order Flow &amp; Technical Analysis
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Auto-Focus toggle */}
          <button
            type="button"
            onClick={() => tradingEngine.setAutoSelectBestScenario(!autoSelectEnabled)}
            className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              autoSelectEnabled
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
            title="Automatically focus the highest-scoring currency pair"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Auto-Focus: {autoSelectEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Deck' : 'Collapse to Ticker'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* When Collapsed: Clean Compact Single-Line Ticker */}
      {isCollapsed ? (
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 font-mono text-xs">
          {scannerAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-slate-900 dark:border-white shadow-xs font-bold'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <span className="font-bold">{item.symbol}</span>
                <span className="tabular-nums font-black">
                  ${item.price.toFixed(item.symbol === 'XAUUSD' || item.symbol === 'USDJPY' ? 2 : 4)}
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    isBull ? 'text-emerald-500' : isBear ? 'text-rose-500' : 'text-slate-400'
                  }`}
                >
                  {item.bias} ({item.confluenceScore}%)
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Spacious, Minimalist 4-Column Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {scannerAnalyses.map((item) => {
            const isActive = item.symbol === activeSymbol;
            const isBull = item.bias === 'BUY';
            const isBear = item.bias === 'SELL';
            const hasSignal = item.status === 'READY' && item.signal;

            // Live countdown calculation
            let remainingSec = 0;
            let isPassed = false;
            if (item.expiryTimestamp) {
              remainingSec = Math.max(0, Math.floor((item.expiryTimestamp - nowMs) / 1000));
              isPassed = remainingSec <= 0;
            }

            // Exact entry to the dot
            const exactEntry = item.signal?.entry ?? item.entryPrice;
            const decimals = item.symbol === 'XAUUSD' || item.symbol === 'USDJPY' ? 2 : 4;
            const isVip = Boolean(item.signal?.isVipTelegram || (item.confluenceScore >= 80 && hasSignal));

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol(item.symbol)}
                className={`rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between gap-4 font-mono relative ${
                  isActive
                    ? 'bg-sky-500/5 dark:bg-zinc-900/90 border-sky-500/50 dark:border-sky-500/40 shadow-md ring-1 ring-sky-500/20'
                    : 'bg-slate-50/70 dark:bg-[#0e1017] border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* 1. Header: Symbol, Asset Name & Live Price */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                        {item.symbol}
                      </span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-sky-500 shadow-sm shadow-sky-500/50 shrink-0" />
                      )}
                      {isVip && !isPassed && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>VIP</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 dark:text-zinc-500 block mt-0.5 font-sans">
                      {item.symbol === 'XAUUSD' ? 'Gold Spot / USD' : item.displayName.split('/')[0].trim()}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 dark:text-white tabular-nums block">
                      ${item.price.toFixed(decimals)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                      Spread: {item.spreadPips}p
                    </span>
                  </div>
                </div>

                {/* 2. Middle Row: Exact Entry Point To The Dot & Direction */}
                <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                  hasSignal && !isPassed
                    ? isBull
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-white dark:bg-black/30 border-slate-200/70 dark:border-zinc-800/60'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {isBull ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      ) : isBear ? (
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                      ) : null}
                      <span
                        className={`text-xs font-black uppercase ${
                          hasSignal && !isPassed
                            ? isBull
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {isPassed ? 'SIGNAL PASSED' : hasSignal ? `${item.bias} SIGNAL` : 'MONITORING'}
                      </span>
                    </div>

                    {/* Entry Window Countdown */}
                    {hasSignal && !isPassed && remainingSec > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        remainingSec > 60
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        <span>{Math.floor(remainingSec / 60)}:{(remainingSec % 60).toString().padStart(2, '0')}</span>
                      </span>
                    )}
                  </div>

                  {/* Exact Entry Point (To The Dot) */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-zinc-800/40">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold">
                      Exact Entry
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                      ${exactEntry.toFixed(decimals)}
                    </span>
                  </div>
                </div>

                {/* 3. Confluence Score & Execution Button */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 dark:text-zinc-500 text-[11px]">
                      Confluence
                    </span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-slate-900 dark:text-white font-black">
                        {item.confluenceScore}%
                      </span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {item.sniperGrade || (item.confluenceScore >= 80 ? 'A+' : item.confluenceScore >= 65 ? 'A' : 'B')}
                      </span>
                    </div>
                  </div>

                  {/* 1-Click Action Button */}
                  <div>
                    {isActive ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active on Chart</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSymbol(item.symbol);
                          if (item.status === 'READY' && onExecuteTrade) {
                            signalAudioNotifier.unlock();
                            onExecuteTrade(item);
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>{item.status === 'READY' ? `Trade ${item.symbol}` : `View ${item.symbol}`}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
