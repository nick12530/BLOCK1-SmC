/**
 * SignalToastNotification.tsx - Ultra-Compact Translucent Beacon & Mobile-Optimized Popover
 * Fixes:
 * - Beacon circle is small, sleek, and translucent with a well-proportioned micro icon (no oversized badges)
 * - Popover is fully responsive and auto-fits mobile screens without overflowing (inset-x-3 with safe margins)
 * - Backdrop click to close on mobile
 * - 1-Click trade execution with volume adjustment
 */

import React, { useState, useEffect, useRef } from 'react';
import { signalAudioNotifier } from '../utils/audioNotification';
import { useMarket, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TrendingUp,
  TrendingDown,
  X,
  Zap,
  Minus,
  Plus,
} from 'lucide-react';

export const SignalToastNotification: React.FC = () => {
  const market = useMarket();
  const ticker = useTicker();

  const [isOpen, setIsOpen] = useState(false);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [lotSize, setLotSize] = useState(0.02);
  const popoverRef = useRef<HTMLDivElement>(null);

  const signal = market.signal;
  const activeDirection = signal?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const activeEntry = signal?.entry || ticker.bid;
  const isBuy = activeDirection === 'BUY';

  const risk = 4.0;
  const reward = 8.0;
  const activeSL = isBuy ? activeEntry - risk : activeEntry + risk;
  const activeTP = isBuy ? activeEntry + reward : activeEntry - reward;
  const strengthPct = Math.min(99, Math.max(82, Math.round(((signal?.score || 4.8) / 5.0) * 100)));

  // Listen to engine signal chime alerts
  useEffect(() => {
    const unsubscribe = signalAudioNotifier.onSignalAlert(() => {
      setHasNewAlert(true);
      const timer = setTimeout(() => {
        setHasNewAlert(false);
      }, 8000);
      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Close when tapping outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleExecute = () => {
    tradingEngine.tradeSignal(lotSize);
    signalAudioNotifier.playSignalAlert(activeDirection, activeEntry);
    setIsOpen(false);
    setHasNewAlert(false);
  };

  const handleAdjustLot = (delta: number) => {
    setLotSize((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(50.0, Math.max(0.01, next));
    });
  };

  return (
    <>
      {/* MOBILE POPUP MODAL / DESKTOP FLYOUT POPOVER */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-18 sm:inset-x-auto sm:bottom-20 sm:right-6 z-[160] font-mono select-none flex justify-center sm:justify-end animate-in fade-in zoom-in-95 duration-150">
          <div
            ref={popoverRef}
            className="w-full max-w-[340px] sm:w-80 rounded-2xl bg-zinc-950/95 dark:bg-black/95 text-white border border-zinc-700/80 shadow-2xl backdrop-blur-xl p-3.5 space-y-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-white ${
                    isBuy ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">
                      {activeDirection} XAUUSD
                    </h3>
                    <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-zinc-800 text-emerald-400">
                      {strengthPct}%
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-sans">
                    SMC Confluence Setup
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Price Levels Grid */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-semibold">
                  Entry
                </span>
                <span className="font-bold text-white tabular-nums block text-[11px]">
                  ${activeEntry.toFixed(2)}
                </span>
              </div>

              <div className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[8.5px] uppercase tracking-wider text-rose-400 block font-semibold">
                  Stop Loss
                </span>
                <span className="font-bold text-rose-300 tabular-nums block text-[11px]">
                  ${activeSL.toFixed(2)}
                </span>
              </div>

              <div className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[8.5px] uppercase tracking-wider text-emerald-400 block font-semibold">
                  Target TP
                </span>
                <span className="font-bold text-emerald-300 tabular-nums block text-[11px]">
                  ${activeTP.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Volume Lots Selector */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Volume:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAdjustLot(-0.01)}
                  className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="font-bold text-xs text-white tabular-nums w-12 text-center">
                  {lotSize.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustLot(0.01)}
                  className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* 1-Click Execution Button */}
            <button
              onClick={handleExecute}
              className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-[0.99] text-white ${
                isBuy
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>EXECUTE {activeDirection} ({lotSize.toFixed(2)} LOTS)</span>
            </button>
          </div>
        </div>
      )}

      {/* ROUND SMALL TRANSLUCENT CIRCLE BEACON */}
      {/* Sized proportionally (w-10 h-10), translucent glass, no oversized badges */}
      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[150] select-none font-mono">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          title={`Tap to view and execute ${activeDirection} trade`}
          className={`relative w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center shadow-lg transition-all cursor-pointer ${
            isBuy
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-400'
              : 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/60 text-rose-400'
          } hover:scale-105 active:scale-95`}
        >
          {/* Subtle breathing radar ring when new signal alerted */}
          {hasNewAlert && (
            <span
              className={`absolute -inset-1 rounded-full animate-ping opacity-60 pointer-events-none ${
                isBuy ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
          )}

          {/* Clean, well-proportioned icon inside the circle */}
          {isBuy ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}

          {/* Micro Status Dot (Clean & Proportional, no huge text pill) */}
          <span
            className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ring-2 ring-black/80 ${
              isBuy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'
            }`}
          />
        </button>
      </div>
    </>
  );
};
