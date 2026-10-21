/**
 * SignalToastNotification.tsx - Precision Sniper Entry Flyout Cockpit
 * 100% Synchronized with Terminal Engine & Active Positions:
 * - Surfaces imminent A+ sniper setups (M15/M5 high-confluence institutional POI)
 * - Exact entry point "to the dot" with live distance in pips
 * - True real-time countdown timer to the exact second
 * - Automatically shuts down passed/invalidated signals with gentle audio blip
 * - Automatically closes if trade is already open or filled in the system
 * - Distinct VIP Telegram Pre-Execution indicator & audio chime
 * - 1-Click execution synchronized with MT5 execution engine
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { signalAudioNotifier } from '../utils/audioNotification';
import { useMarket, useTicker, usePositions, useScannerAnalyses } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { getInstrumentConfig, SupportedSymbol } from '../engine/instrumentConfig';
import { Signal } from '../types/smc';
import {
  TrendingUp,
  TrendingDown,
  X,
  Zap,
  Clock,
  Target,
  Minus,
  Plus,
  Send,
} from 'lucide-react';
import { dispatchSniperAlert } from '../utils/webhookNotifier';

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
  const lastAnnouncedSignalKey = useRef<string | null>(null);

  // Surface highest-probability imminent setup synchronized strictly with the system
  const targetSniperInfo = useMemo(() => {
    const currentActiveSym = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
    const isChartPosOpen = positions.some(
      (p) => p.symbol === currentActiveSym && p.type === market.signal?.direction
    );

    // 1. Prioritize active chart signal if imminent and not already open
    if (market.signal && !isChartPosOpen) {
      const sig = market.signal;
      const isCandidate = Boolean(sig.isSniper || sig.score >= 3.8 || sig.isImminent);
      if (isCandidate) {
        return {
          signal: sig,
          symbol: currentActiveSym,
        };
      }
    }

    // 2. Otherwise scan candidate pairs for highest-confluence ready setup with NO open position
    const candidatePairs = scannerAnalyses
      .filter((p) => {
        if (!p.signal || p.status !== 'READY') return false;
        const alreadyOpen = positions.some(
          (pos) => pos.symbol === p.symbol && pos.type === p.signal?.direction
        );
        return !alreadyOpen && (p.signal.isSniper || p.confluenceScore >= 70 || p.signal.isImminent);
      })
      .sort((a, b) => b.confluenceScore - a.confluenceScore);

    if (candidatePairs.length > 0 && candidatePairs[0].signal) {
      return {
        signal: candidatePairs[0].signal,
        symbol: candidatePairs[0].symbol,
      };
    }

    return null;
  }, [market.signal, ticker.symbol, scannerAnalyses, positions]);

  const signal = targetSniperInfo?.signal || null;
  const activeSymbol = (targetSniperInfo?.symbol || ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const cfg = getInstrumentConfig(activeSymbol);

  // Real-time live spot price for distance calculations
  const liveSpotPrice = useMemo(() => {
    if (ticker.symbol === activeSymbol && ticker.bid > 0) {
      return signal?.direction === 'BUY' ? ticker.ask : ticker.bid;
    }
    const pairAnalysis = scannerAnalyses.find((p) => p.symbol === activeSymbol);
    return pairAnalysis ? pairAnalysis.price : (signal?.entry ?? 0);
  }, [ticker, activeSymbol, scannerAnalyses, signal]);

  // Real-time countdown timer & auto-shutdown of passed signals
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [hasPassed, setHasPassed] = useState<boolean>(false);

  useEffect(() => {
    if (!signal) {
      setHasPassed(false);
      setRemainingSec(0);
      setIsOpen(false);
      return;
    }

    // Check if position was just opened for this setup -> immediately dismiss popup
    const isTradeNowOpen = positions.some(
      (p) => p.symbol === activeSymbol && p.type === signal.direction
    );
    if (isTradeNowOpen) {
      setIsOpen(false);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const signalTime = new Date(signal.timestamp).getTime();
      const validityMs = signal.timeframe === 'M15' ? 15 * 60_000 : 5 * 60_000;
      const expiry = signal.expiryTimestamp || (signalTime + validityMs);
      const left = Math.max(0, Math.floor((expiry - now) / 1000));
      setRemainingSec(left);

      // Audio tick during final 15 seconds
      if (left > 0 && left <= 15 && left % 3 === 0) {
        signalAudioNotifier.playCountdownUrgentTick();
      }

      // Check price invalidation
      const curPrice = liveSpotPrice > 0 ? liveSpotPrice : signal.entry;
      const isPricePastSl = signal.direction === 'BUY'
        ? curPrice <= signal.sl
        : curPrice >= signal.sl;

      // Price already ran past entry by > 1.2x ATR
      const isPriceRunaway = signal.direction === 'BUY'
        ? curPrice > signal.entry + 1.2 * signal.atr
        : curPrice < signal.entry - 1.2 * signal.atr;

      // Once the entry window passes, automatically shut down the signal
      if (left <= 0 || isPricePastSl || isPriceRunaway) {
        if (!hasPassed) {
          setHasPassed(true);
          setIsOpen(false);
          signalAudioNotifier.playSignalExpiredAlert();
        }
      } else {
        setHasPassed(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [signal, activeSymbol, liveSpotPrice, positions, hasPassed]);

  // Synchronized Auto-Popup & Audio Alert when fresh sniper signal is detected
  useEffect(() => {
    if (signal && !hasPassed) {
      const sigKey = `${activeSymbol}-${signal.direction}-${signal.entry}-${signal.timestamp}`;
      if (lastAnnouncedSignalKey.current !== sigKey) {
        lastAnnouncedSignalKey.current = sigKey;
        setIsOpen(true);

        // VIP Telegram setup gets prestigious shimmer alert; regular gets radar alert
        if (signal.isVipTelegram || signal.score >= 4.5) {
          signalAudioNotifier.playVipTelegramAlert(signal.direction);
        } else {
          signalAudioNotifier.playSniperImminentAlert(signal.direction, signal.entry);
        }
      }
    }
  }, [signal, hasPassed, activeSymbol]);

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

  // Auto-calculated optimal lot size
  const autoLotSize = useMemo(() => {
    if (!signal) return 0.01;
    const calculated = tradingEngine.getRiskBasedVolume(signal.sl, undefined, signal.direction);
    return calculated || signal.recommendedLot || 0.01;
  }, [signal]);

  const [customLot, setCustomLot] = useState<number>(0.01);
  const [isLotCustomized, setIsLotCustomized] = useState<boolean>(false);

  useEffect(() => {
    if (!isLotCustomized && autoLotSize > 0) {
      setCustomLot(autoLotSize);
    }
  }, [autoLotSize, isLotCustomized]);

  if (!signal || hasPassed) {
    return null;
  }

  const activeDirection = signal.direction;
  const isBuy = activeDirection === 'BUY';
  const activeEntry = signal.entry;
  const activeSL = signal.sl;
  const activeLot = Math.max(0.01, Math.min(100, Number(customLot) || autoLotSize || 0.01));

  // Multi-target values
  const riskDist = Math.abs(activeEntry - activeSL);
  const activeTP1 = signal.tp1 ?? Number((isBuy ? activeEntry + riskDist * 1.8 : activeEntry - riskDist * 1.8).toFixed(cfg.digits));
  const activeTP2 = signal.tp2 ?? signal.tp ?? Number((isBuy ? activeEntry + riskDist * 3.2 : activeEntry - riskDist * 3.2).toFixed(cfg.digits));
  const activeTP3 = signal.tp3 ?? Number((isBuy ? activeEntry + riskDist * 5.5 : activeEntry - riskDist * 5.5).toFixed(cfg.digits));

  const slPips = signal.slPips ?? Number((riskDist / cfg.pipSize).toFixed(1));
  const tp1Pips = signal.targetPips1 ?? Number((Math.abs(activeTP1 - activeEntry) / cfg.pipSize).toFixed(1));
  const tp2Pips = signal.targetPips2 ?? signal.targetPips ?? Number((Math.abs(activeTP2 - activeEntry) / cfg.pipSize).toFixed(1));
  const tp3Pips = signal.targetPips3 ?? Number((Math.abs(activeTP3 - activeEntry) / cfg.pipSize).toFixed(1));

  const chosenTp = selectedTpTarget === 'tp1' ? activeTP1 : selectedTpTarget === 'tp3' ? activeTP3 : activeTP2;
  const chosenPips = selectedTpTarget === 'tp1' ? tp1Pips : selectedTpTarget === 'tp3' ? tp3Pips : tp2Pips;

  const pipVal = cfg.pipValuePerMicroLot * (activeLot / 0.01);
  const potentialRiskUsd = Number((slPips * pipVal).toFixed(2));
  const potentialRewardUsd = Number((chosenPips * pipVal).toFixed(2));

  // Exact distance to dot in pips
  const distToDotPips = liveSpotPrice > 0
    ? Number((Math.abs(liveSpotPrice - activeEntry) / cfg.pipSize).toFixed(1))
    : 0;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleExecuteSniper = async () => {
    setExecuting(true);
    try {
      const orderSignal: Signal = {
        ...signal,
        tp: chosenTp,
      };

      if (activeSymbol && activeSymbol !== ticker.symbol) {
        tradingEngine.switchSymbol(activeSymbol);
      }

      signalAudioNotifier.unlock();
      signalAudioNotifier.playTradeExecutionAlert(activeDirection);

      if (onExecuteSignal) {
        await onExecuteSignal(activeLot, 1, orderSignal);
      } else {
        const res = tradingEngine.sendMarket(
          activeDirection,
          activeLot,
          activeSL,
          chosenTp,
          `sniper:${signal.timeframe}:${signal.score}`,
          activeSymbol
        );
        if (!res.ok) {
          throw new Error(res.error || 'Execution blocked by risk engine');
        }
      }

      setFeedback({
        msg: `🎯 FILLED: ${activeDirection} ${activeLot}L ${activeSymbol} @ $${activeEntry.toFixed(cfg.digits)}`,
        type: 'success',
      });
      setTimeout(() => {
        setIsOpen(false);
        setFeedback(null);
      }, 1500);
    } catch (err) {
      setFeedback({
        msg: err instanceof Error ? err.message : 'Sniper order execution failed',
        type: 'error',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleDispatchTelegram = async () => {
    const sent = await dispatchSniperAlert({
      symbol: activeSymbol,
      direction: activeDirection,
      timeframe: signal.timeframe,
      strategy: signal.strategy || 'POI Retest',
      entry: activeEntry,
      sl: activeSL,
      tp1: activeTP1,
      tp2: activeTP2,
      tp3: activeTP3,
      slPips,
      tp1Pips,
      tp2Pips,
      tp3Pips,
      confluenceScore: Math.round(signal.score * 20),
      recommendedLot: activeLot,
      sniperGrade: signal.sniperGrade || 'A+',
      isImminent: true,
      validitySeconds: remainingSec,
      distanceToEntryPips: distToDotPips,
    });
    setFeedback({
      msg: sent ? '✓ Telegram VIP Wire Dispatched' : 'Telegram webhook pending or unconfigured',
      type: sent ? 'success' : 'error',
    });
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <>
      {/* POPUP COCKPIT: Clean, Spacious & 100% System Synced */}
      {isOpen && (
        <div className="fixed top-16 right-4 z-[100] font-mono select-none flex items-start justify-end p-2 animate-in fade-in zoom-in-95 duration-150">
          <div
            ref={popoverRef}
            className="w-[410px] rounded-2xl bg-[#090d14] text-zinc-100 border border-sky-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-4 space-y-3.5 ring-1 ring-sky-500/20"
          >
            {/* Header: Imminent Execution Badge, Asset & Countdown */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                  isBuy ? 'bg-emerald-600 text-white shadow-xs' : 'bg-rose-600 text-white shadow-xs'
                }`}>
                  {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{activeDirection}</span>
                </span>
                <button
                  type="button"
                  onClick={() => tradingEngine.switchSymbol(activeSymbol)}
                  className="font-black text-sm text-white hover:text-sky-400 transition-colors cursor-pointer"
                  title="Click to focus this symbol on chart"
                >
                  {activeSymbol}
                </button>
                <span className="text-[10px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-800">
                  {signal.timeframe}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Live Countdown Timer */}
                <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                  remainingSec > 60
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse'
                }`}>
                  <Clock className="w-3 h-3" />
                  <span>{formatTimer(remainingSec)}</span>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Minimize flyout"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* VIP Pre-Execution Banner */}
            {(signal.isVipTelegram || signal.score >= 4.5) && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>100% CONVICTION VIP TELEGRAM SETUP</span>
                </span>
                <button
                  type="button"
                  onClick={handleDispatchTelegram}
                  className="hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                  title="Push instant alert to Telegram VIP channel"
                >
                  <Send className="w-3 h-3" />
                  <span>Push</span>
                </button>
              </div>
            )}

            {/* Exact Entry Level Banner ("To The Dot") */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-sky-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-sky-400 uppercase tracking-widest font-bold block">
                  EXACT ENTRY POINT (TO THE DOT)
                </span>
                <span className="text-xl font-black text-white tabular-nums tracking-tight">
                  ${activeEntry.toFixed(cfg.digits)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Current: ${liveSpotPrice.toFixed(cfg.digits)} ({distToDotPips}p to dot)
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Confluence</span>
                <span className="text-xs font-black text-emerald-400">
                  {signal.score.toFixed(1)} / 5.0 (A+ Grade)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[140px]">
                  {signal.mitigationType || 'POI 50% Mean Threshold'}
                </span>
              </div>
            </div>

            {/* Target Price Levels: Stop Loss & TP Selection */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              {/* Stop Loss */}
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-rose-400 uppercase font-bold block">Stop Loss</span>
                <span className="text-sm font-bold text-white tabular-nums block mt-0.5">
                  ${activeSL.toFixed(cfg.digits)}
                </span>
                <span className="text-[10px] text-rose-400 block mt-0.5">
                  -{slPips}p (-${potentialRiskUsd})
                </span>
              </div>

              {/* Take Profit Target Switcher */}
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">Target (TP)</span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {(['tp1', 'tp2', 'tp3'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTpTarget(t)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        selectedTpTarget === t
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-emerald-400 block mt-1 tabular-nums font-bold">
                  +${potentialRewardUsd} (+{chosenPips}p)
                </span>
              </div>
            </div>

            {/* Volume Adjustment */}
            <div className="flex items-center justify-between bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 text-xs">
              <span className="text-zinc-400 text-[11px] font-bold">Position Sizing:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLotCustomized(true);
                    setCustomLot((l) => Math.max(0.01, Math.round((l - 0.01) * 100) / 100));
                  }}
                  className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-200 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold text-white tabular-nums w-12 text-center text-xs">
                  {activeLot.toFixed(2)}L
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLotCustomized(true);
                    setCustomLot((l) => Math.min(10.0, Math.round((l + 0.01) * 100) / 100));
                  }}
                  className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Feedback Alert */}
            {feedback && (
              <div className={`p-2.5 rounded-lg text-xs font-bold text-center ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {feedback.msg}
              </div>
            )}

            {/* 1-Click Execution Button */}
            <button
              onClick={handleExecuteSniper}
              disabled={executing}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all active:scale-[0.99] ${
                isBuy
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                {executing ? 'EXECUTING ORDER...' : `EXECUTE ${activeDirection} NOW @ $${activeEntry.toFixed(cfg.digits)}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Beacon (When minimized) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 font-mono select-none">
          <button
            onClick={() => setIsOpen(true)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xl border cursor-pointer transition-all hover:scale-105 ${
              isBuy
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/50'
                : 'bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-950/50'
            }`}
          >
            <div className="relative">
              <Target className="w-4 h-4 text-white" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span>{activeSymbol} {activeDirection} SNIPER</span>
            <span className="text-[10px] tabular-nums font-mono px-1.5 py-0.5 rounded bg-black/50 text-white">
              {formatTimer(remainingSec)}
            </span>
          </button>
        </div>
      )}
    </>
  );
};
