/**
 * SignalToastNotification.tsx - Sniper Entry Beacon & Floating High-Pip Cockpit
 * Remade specifically for Sniper Entries:
 * - Only activates for verified Sniper setups (M15/M5 high-confluence institutional POI)
 * - Automatically calculates safe lot size from balance, equity, and stop distance
 * - Real-time countdown timer towards entry time (auto-expires/passes once timer hits 0:00)
 * - Structured with Entry, TP 1, TP 2, TP 3, and Stop Loss (SL)
 * - Accommodates up to 5 simultaneous trades
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { signalAudioNotifier } from '../utils/audioNotification';
import { useMarket, useTicker, usePositions, useScannerAnalyses } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { getInstrumentConfig, SupportedSymbol } from '../engine/instrumentConfig';
import { Signal } from '../types/smc';
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  X,
  Zap,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
} from 'lucide-react';

interface SignalToastNotificationProps {
  onExecuteSignal?: (customVolume?: number, positionCount?: number, signal?: Signal) => void | Promise<void>;
}

export const SignalToastNotification: React.FC<SignalToastNotificationProps> = ({ onExecuteSignal }) => {
  const market = useMarket();
  const ticker = useTicker();
  const { positions } = usePositions();
  const scannerAnalyses = useScannerAnalyses();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedTpTarget, setSelectedTpTarget] = useState<'tp1' | 'tp2' | 'tp3'>('tp2');
  const [executing, setExecuting] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Surface ONLY sniper entries (M15/M5 institutional POI with high confluence score >= 4.0 or score >= 70)
  const targetSniperInfo = useMemo(() => {
    // 1. Check active chart signal first
    if (
      market.signal &&
      (market.signal.isSniper ||
        market.signal.score >= 4.0 ||
        market.signal.timeframe === 'M15' ||
        market.signal.strategy === 'SMC POI Retest')
    ) {
      return {
        signal: market.signal,
        symbol: (ticker.symbol || 'XAUUSD') as SupportedSymbol,
      };
    }

    // 2. Scan monitored pairs for best high-confluence sniper entry
    const candidatePairs = scannerAnalyses
      .filter((p) => p.signal && (p.signal.isSniper || p.confluenceScore >= 70 || p.signal.score >= 4.0))
      .sort((a, b) => b.confluenceScore - a.confluenceScore);

    if (candidatePairs.length > 0 && candidatePairs[0].signal) {
      return {
        signal: candidatePairs[0].signal,
        symbol: candidatePairs[0].symbol,
      };
    }

    return null;
  }, [market.signal, ticker.symbol, scannerAnalyses]);

  const signal = targetSniperInfo?.signal || null;
  const activeSymbol = (targetSniperInfo?.symbol || ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const cfg = getInstrumentConfig(activeSymbol);

  // Strict sniper qualification
  const isSniper = Boolean(
    signal && (
      signal.isSniper ||
      signal.score >= 4.0 ||
      signal.timeframe === 'M15' ||
      signal.strategy === 'SMC POI Retest'
    )
  );

  // Entry countdown timer: countdown towards the entry time window
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [hasPassed, setHasPassed] = useState<boolean>(false);

  useEffect(() => {
    if (!signal) {
      setHasPassed(false);
      setRemainingSec(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const signalTime = new Date(signal.timestamp).getTime();
      const validityMs = signal.timeframe === 'M15' ? 15 * 60_000 : 5 * 60_000;
      const expiry = signal.expiryTimestamp || (signalTime + validityMs);
      const left = Math.max(0, Math.floor((expiry - now) / 1000));
      setRemainingSec(left);

      // Once the entry window passes, the signal passes automatically
      if (left <= 0) {
        setHasPassed(true);
        setIsOpen(false);
      } else {
        setHasPassed(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [signal]);

  // Close when clicking outside popover
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

  // Auto-calculated optimal lot size based on balance and stop distance
  const autoLotSize = useMemo(() => {
    if (!signal) return 0.01;
    const calculated = tradingEngine.getRiskBasedVolume(signal.sl, undefined, signal.direction);
    return calculated || signal.recommendedLot || 0.01;
  }, [signal, ticker.balance, ticker.equity]);

  if (!signal || !isSniper || hasPassed) {
    return null;
  }

  const activeDirection = signal.direction;
  const isBuy = activeDirection === 'BUY';
  const activeEntry = signal.entry;
  const activeSL = signal.sl;

  // Multi-target TP 1, TP 2, TP 3 values
  const riskDist = Math.abs(activeEntry - activeSL);
  const activeTP1 = signal.tp1 ?? Number((isBuy ? activeEntry + riskDist * 1.8 : activeEntry - riskDist * 1.8).toFixed(cfg.digits));
  const activeTP2 = signal.tp2 ?? signal.tp ?? Number((isBuy ? activeEntry + riskDist * 3.2 : activeEntry - riskDist * 3.2).toFixed(cfg.digits));
  const activeTP3 = signal.tp3 ?? Number((isBuy ? activeEntry + riskDist * 5.5 : activeEntry - riskDist * 5.5).toFixed(cfg.digits));

  // Pip measurements
  const slPips = signal.slPips ?? Number((riskDist / cfg.pipSize).toFixed(1));
  const tp1Pips = signal.targetPips1 ?? Number((Math.abs(activeTP1 - activeEntry) / cfg.pipSize).toFixed(1));
  const tp2Pips = signal.targetPips2 ?? signal.targetPips ?? Number((Math.abs(activeTP2 - activeEntry) / cfg.pipSize).toFixed(1));
  const tp3Pips = signal.targetPips3 ?? Number((Math.abs(activeTP3 - activeEntry) / cfg.pipSize).toFixed(1));

  // Chosen TP for execution
  const chosenTp = selectedTpTarget === 'tp1' ? activeTP1 : selectedTpTarget === 'tp3' ? activeTP3 : activeTP2;
  const chosenPips = selectedTpTarget === 'tp1' ? tp1Pips : selectedTpTarget === 'tp3' ? tp3Pips : tp2Pips;

  // Dollars at risk and potential reward
  const pipVal = cfg.pipValuePerMicroLot * (autoLotSize / 0.01);
  const potentialRiskUsd = Number((slPips * pipVal).toFixed(2));
  const potentialRewardUsd = Number((chosenPips * pipVal).toFixed(2));

  // Simultaneous positions
  const maxSimultaneous = 5;
  const activePositionsCount = positions.length;
  const canOpenTrade = activePositionsCount < maxSimultaneous;

  // Formatted countdown timer string
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleExecuteSniper = async () => {
    if (!canOpenTrade) {
      setFeedback({
        msg: `Limit reached: Maximum 5 simultaneous trades active (${activePositionsCount}/5). Close a trade first.`,
        type: 'error',
      });
      return;
    }

    setExecuting(true);
    try {
      const orderSignal: Signal = {
        ...signal,
        tp: chosenTp,
      };

      if (activeSymbol && activeSymbol !== ticker.symbol) {
        tradingEngine.switchSymbol(activeSymbol);
      }

      if (onExecuteSignal) {
        await onExecuteSignal(autoLotSize, 1, orderSignal);
      } else {
        const res = tradingEngine.sendMarket(
          activeDirection,
          autoLotSize,
          activeSL,
          chosenTp,
          `sniper:${signal.timeframe}:${signal.score}`,
          activeSymbol
        );
        if (!res.ok) {
          throw new Error(res.error || 'Execution blocked by risk engine');
        }
      }

      signalAudioNotifier.playTradeExecutionAlert(activeDirection);
      setFeedback({
        msg: `🎯 SNIPER FILLED: ${activeDirection} ${autoLotSize}L ${activeSymbol} @ ${activeEntry} | TP: ${chosenTp} (+${chosenPips}p)`,
        type: 'success',
      });
      setTimeout(() => {
        setIsOpen(false);
        setFeedback(null);
      }, 2000);
    } catch (err) {
      setFeedback({
        msg: err instanceof Error ? err.message : 'Sniper order execution failed',
        type: 'error',
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <>
      {/* SNIPER ENTRY FLYOUT COCKPIT */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-6 z-[160] font-mono select-none flex items-end sm:items-center justify-center p-3 sm:p-0 bg-black/70 sm:bg-transparent backdrop-blur-xs sm:backdrop-blur-none animate-in fade-in duration-150">
          <div
            ref={popoverRef}
            className="w-full max-w-md sm:w-[420px] rounded-2xl bg-[#0b0e14] text-zinc-100 border border-amber-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-4 sm:p-5 space-y-3.5 max-h-[92dvh] overflow-y-auto ring-1 ring-amber-500/20"
          >
            {/* Header: Sniper Badge, Countdown Timer & Close */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                  <Target className="w-4 h-4 animate-spin-slow" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <span>🎯 SNIPER ENTRY</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                      {signal.timeframe} Setup
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Score {signal.score}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm text-white mt-0.5">
                    {activeDirection} {activeSymbol} · {signal.strategy}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Entry Countdown Badge */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                  <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>{formatTimer(remainingSec)}</span>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Feedback Message */}
            {feedback && (
              <div
                className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span className="font-bold">{feedback.msg}</span>
              </div>
            )}

            {/* Multi-Target Grid: Entry, SL, TP 1, TP 2, TP 3 */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>Targets & Stop Loss</span>
                <span className="text-zinc-500">Click a TP to select for order</span>
              </div>

              {/* Entry & SL Row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-bold">
                    Entry Spot
                  </span>
                  <span className="font-black text-white tabular-nums block text-sm mt-0.5">
                    ${activeEntry.toFixed(cfg.digits)}
                  </span>
                  <span className="text-[9px] text-zinc-500">Live Market Entry</span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30">
                  <span className="text-[9px] uppercase tracking-wider text-rose-400 block font-bold">
                    Stop Loss (SL)
                  </span>
                  <span className="font-black text-rose-400 tabular-nums block text-sm mt-0.5">
                    ${activeSL.toFixed(cfg.digits)}
                  </span>
                  <span className="text-[9px] text-rose-400/80 block">
                    -{slPips} pips (-${potentialRiskUsd})
                  </span>
                </div>
              </div>

              {/* Take Profit Target Cards (TP 1, TP 2, TP 3) */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* TP 1 */}
                <button
                  type="button"
                  onClick={() => setSelectedTpTarget('tp1')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTpTarget === 'tp1'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400">
                      TP 1
                    </span>
                    <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      1:1.8R
                    </span>
                  </div>
                  <span className="font-black tabular-nums block text-xs mt-1">
                    ${activeTP1.toFixed(cfg.digits)}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold block mt-0.5">
                    +{tp1Pips} pips
                  </span>
                </button>

                {/* TP 2 (High-Yield Standard) */}
                <button
                  type="button"
                  onClick={() => setSelectedTpTarget('tp2')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    selectedTpTarget === 'tp2'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="absolute -top-1.5 right-1.5 text-[7px] px-1 py-0.2 rounded bg-amber-500 text-black font-black uppercase">
                    Best RR
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400">
                      TP 2
                    </span>
                    <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      1:3.2R
                    </span>
                  </div>
                  <span className="font-black tabular-nums block text-xs mt-1">
                    ${activeTP2.toFixed(cfg.digits)}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold block mt-0.5">
                    +{tp2Pips} pips
                  </span>
                </button>

                {/* TP 3 (Max Pips Runner) */}
                <button
                  type="button"
                  onClick={() => setSelectedTpTarget('tp3')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTpTarget === 'tp3'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-sky-400">
                      TP 3
                    </span>
                    <span className="text-[8px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold">
                      1:5.5R
                    </span>
                  </div>
                  <span className="font-black tabular-nums block text-xs mt-1">
                    ${activeTP3.toFixed(cfg.digits)}
                  </span>
                  <span className="text-[9px] text-sky-400 font-bold block mt-0.5">
                    +{tp3Pips} pips
                  </span>
                </button>
              </div>
            </div>

            {/* Auto-Calculated Lot Size & Risk Engine Card */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Calculated Lot:</span>
                </span>
                <span className="text-xs font-black text-amber-300 font-mono">
                  {autoLotSize.toFixed(2)} Lots (Auto Risk Sized)
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-1.5">
                <span>Selected Target Potential:</span>
                <span className="font-bold text-emerald-400">
                  +${potentialRewardUsd} USD (+{chosenPips} pips)
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Simultaneous Trades:</span>
                <span className={`font-bold ${canOpenTrade ? 'text-zinc-300' : 'text-rose-400'}`}>
                  {activePositionsCount} of {maxSimultaneous} slots active
                </span>
              </div>
            </div>

            {/* Execution Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-3 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Dismiss
              </button>

              <button
                type="button"
                disabled={executing || !canOpenTrade}
                onClick={handleExecuteSniper}
                className={`flex-1 py-3 sm:py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98] ${
                  !canOpenTrade
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : isBuy
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black font-black'
                    : 'bg-rose-500 hover:bg-rose-400 text-white font-black'
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>
                  {executing
                    ? 'EXECUTING...'
                    : !canOpenTrade
                    ? 'MAX 5 TRADES REACHED'
                    : `EXECUTE SNIPER ${activeDirection} (${autoLotSize.toFixed(2)}L · ${selectedTpTarget.toUpperCase()})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SNIPER ENTRY TRIGGER BUTTON */}
      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[150] select-none font-mono">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          title={`Sniper ${activeDirection} Setup on ${activeSymbol} · ${formatTimer(remainingSec)} remaining`}
          className="relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-[#0a0d14] border border-amber-500/70 text-white shadow-[0_10px_30px_rgba(245,158,11,0.25)] hover:border-amber-400 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-1 ring-amber-500/30"
        >
          {/* Target Reticle Icon */}
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>

          {/* Sniper Label & Direction */}
          <span className="font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span>SNIPER {activeDirection}</span>
          </span>

          {/* Entry Countdown Timer Pill */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/40 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-300 animate-pulse" />
            <span>{formatTimer(remainingSec)}</span>
          </span>

          {/* Auto Lot Pill */}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hidden sm:inline-block">
            {autoLotSize.toFixed(2)}L
          </span>
        </button>
      </div>
    </>
  );
};
