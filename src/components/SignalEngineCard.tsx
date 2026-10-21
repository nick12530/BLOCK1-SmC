/**
 * SignalEngineCard.tsx - Uncluttered, Spacious Sniper Execution Deck
 * Redesigned for maximum clarity and zero visual fatigue:
 * - Clean spacious layout with generous breathing room
 * - Exact entry level "to the dot" with live countdown timer
 * - Prominent Direction, Confluence Score & Risk/Reward metrics
 * - Straightforward lot size controls (Presets & Stepper)
 * - Decisive 1-Click Execution bar with tactile audio feedback
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useMarket, useTicker, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  ArrowRight,
  Zap,
  Check,
  Minus,
  Plus,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Signal, TradeDirection } from '../types/smc';
import { getInstrumentConfig } from '../engine/instrumentConfig';
import { signalAudioNotifier } from '../utils/audioNotification';

interface SignalEngineCardProps {
  onExecuteSignal?: (customVolume?: number, positionCount?: number, signal?: Signal) => void | Promise<void>;
}

const LOT_PRESETS = [0.01, 0.02, 0.05, 0.10];

export const SignalEngineCard: React.FC<SignalEngineCardProps> = React.memo(({ onExecuteSignal }) => {
  const market = useMarket();
  const ticker = useTicker();
  const engine = useEngine();

  const [lotSize, setLotSize] = useState<number>(0.01);
  const [executedFeedback, setExecutedFeedback] = useState<string | null>(null);

  const rawSig = market.signal;
  const cfg = getInstrumentConfig(ticker.symbol);
  const maxSpreadPoints = tradingEngine.getMaxSpreadPoints();
  const isWideSpread = ticker.spread > maxSpreadPoints;

  const activeDirection: TradeDirection = rawSig?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const isBuy = activeDirection === 'BUY';

  // Precision exact entry point
  const currentSpot = isBuy ? ticker.ask : ticker.bid;
  const exactEntry = rawSig?.entry ?? currentSpot;
  const slPrice = rawSig?.sl ?? null;
  const tpPrice = rawSig?.tp ?? null;
  const riskPts = rawSig ? Math.abs(rawSig.entry - rawSig.sl) : 0;
  const rewardPts = rawSig ? Math.abs(rawSig.tp - rawSig.entry) : 0;

  const riskLimitedLot = rawSig ? tradingEngine.getRiskBasedVolume(rawSig.sl, lotSize, rawSig.direction) : null;
  const safeLot = riskLimitedLot ?? lotSize;

  // Real-time Countdown timer towards entry window
  const [remainingSec, setRemainingSec] = useState<number>(0);
  useEffect(() => {
    if (!rawSig) {
      setRemainingSec(0);
      return;
    }
    const updateCountdown = () => {
      const now = Date.now();
      const sigTime = new Date(rawSig.timestamp).getTime();
      const durationMs = rawSig.timeframe === 'M15' ? 15 * 60_000 : 5 * 60_000;
      const expiry = rawSig.expiryTimestamp || (sigTime + durationMs);
      const left = Math.max(0, Math.floor((expiry - now) / 1000));
      setRemainingSec(left);

      if (left > 0 && left <= 15 && left % 3 === 0) {
        signalAudioNotifier.playCountdownUrgentTick();
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [rawSig]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const distToDotPips = Number((Math.abs(currentSpot - exactEntry) / cfg.pipSize).toFixed(1));
  const isVip = Boolean(rawSig?.isVipTelegram || (rawSig && rawSig.score >= 4.5));

  const tradeMetrics = useMemo(() => {
    const totalLots = Number(safeLot.toFixed(2));
    let riskDollar = 0;
    let rewardDollar = 0;

    if (cfg.category === 'metals') {
      riskDollar = Number((riskPts * totalLots * cfg.contractSize).toFixed(2));
      rewardDollar = Number((rewardPts * totalLots * cfg.contractSize).toFixed(2));
    } else {
      riskDollar = Number((riskPts * totalLots * cfg.contractSize).toFixed(2));
      rewardDollar = Number((rewardPts * totalLots * cfg.contractSize).toFixed(2));
    }

    const rrRatio = riskPts > 0 ? (rewardPts / riskPts).toFixed(1) : '3.2';

    return {
      totalLots,
      riskDollar,
      rewardDollar,
      rrRatio,
    };
  }, [riskPts, rewardPts, safeLot, cfg]);

  const handleAdjustLot = (delta: number) => {
    setLotSize((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(10.0, Math.max(0.01, next));
    });
  };

  const handleExecute = async () => {
    if (isWideSpread || !rawSig) return;
    signalAudioNotifier.unlock();
    signalAudioNotifier.playTradeExecutionAlert(rawSig.direction);

    if (onExecuteSignal) {
      await onExecuteSignal(safeLot, 1, rawSig);
    } else {
      const res = tradingEngine.sendMarket(
        rawSig.direction,
        safeLot,
        rawSig.sl,
        rawSig.tp,
        `sniper:${rawSig.timeframe}:${rawSig.score}`,
        ticker.symbol
      );
      setExecutedFeedback(res.ok ? `Order sent: ${rawSig.direction} ${safeLot.toFixed(2)}L` : res.error || 'Rejected');
      setTimeout(() => setExecutedFeedback(null), 3500);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-4 font-mono text-xs transition-colors min-w-0">
      {/* 1. Header: Clean Title, Symbol & Auto-Trader Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider font-sans">
                Sniper Execution Deck
              </h2>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {ticker.symbol}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
              Interbank Spread: {ticker.spread} PTS
            </span>
          </div>
        </div>

        {/* Live Entry Countdown Timer (When signal is active) */}
        {rawSig && remainingSec > 0 && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
            remainingSec > 60
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            <span className="tabular-nums">Entry: {formatTimer(remainingSec)}</span>
          </div>
        )}
      </div>

      {/* VIP Telegram Pre-Execution Indicator */}
      {rawSig && isVip && (
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>100% CONVICTION VIP TELEGRAM PRE-EXECUTION</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-amber-500/20">
            A+ Sniper
          </span>
        </div>
      )}

      {/* 2. Hero Action Banner: Direction, Confluence & Timing */}
      <div className={`rounded-xl p-3.5 border transition-all ${
        rawSig
          ? isBuy
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
            : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
          : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
              rawSig
                ? isBuy
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}>
              {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{rawSig ? `${rawSig.direction} SNIPER` : 'WAITING'}</span>
            </span>

            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              {rawSig ? `${rawSig.timeframe} Institutional POI` : 'Scanning Order Flow'}
            </span>
          </div>

          {rawSig && (
            <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
              Score: {rawSig.score.toFixed(1)}/5.0
            </span>
          )}
        </div>
      </div>

      {/* 3. Spacious Target Level Matrix: Exact Entry ("To The Dot"), Stop Loss, and Take Profit */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        {/* Exact Entry */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-sky-500 uppercase font-bold tracking-wider block">
            Exact Entry
          </span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums block mt-1">
            ${exactEntry.toFixed(cfg.digits)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {rawSig ? `${distToDotPips}p to dot` : 'To The Dot'}
          </span>
        </div>

        {/* Stop Loss */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-rose-500 uppercase font-bold tracking-wider block">
            Stop Loss
          </span>
          <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 tabular-nums block mt-1">
            {slPrice === null ? '—' : `$${slPrice.toFixed(cfg.digits)}`}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {rawSig ? `-${riskPts.toFixed(1)}p ($${tradeMetrics.riskDollar})` : '—'}
          </span>
        </div>

        {/* Take Profit */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider block">
            Take Profit
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-1">
            {tpPrice === null ? '—' : `$${tpPrice.toFixed(cfg.digits)}`}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {rawSig ? `+${rewardPts.toFixed(1)}p (+$${tradeMetrics.rewardDollar})` : '—'}
          </span>
        </div>
      </div>

      {/* 4. Ergonomic Volume Controls */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">
            Position Size
          </span>
          <span className="font-black text-xs text-slate-900 dark:text-white">
            1:{tradeMetrics.rrRatio} RR · {tradeMetrics.totalLots} Lots
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1">
            {LOT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLotSize(preset)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  lotSize === preset
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-slate-900 dark:border-white'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-400'
                }`}
              >
                {preset.toFixed(2)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => handleAdjustLot(-0.01)}
              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-black text-xs text-slate-900 dark:text-white tabular-nums w-10 text-center">
              {safeLot.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => handleAdjustLot(0.01)}
              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Feedback Banner */}
      {executedFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center truncate">
          ✓ {executedFeedback}
        </div>
      )}

      {/* 6. High-Contrast 1-Click Execution Button */}
      <button
        onClick={handleExecute}
        disabled={isWideSpread || !rawSig}
        className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
          isWideSpread || !rawSig
            ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600 cursor-not-allowed border border-zinc-300 dark:border-zinc-800'
            : activeDirection === 'SELL'
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-[0.99] border border-rose-500'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-[0.99] border border-emerald-500'
        }`}
      >
        <span className="truncate">
          {!rawSig
            ? 'AWAITING FRESH CONFLUENCE SETUP'
            : isWideSpread
              ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
              : `EXECUTE ${activeDirection} @ $${exactEntry.toFixed(cfg.digits)} (${safeLot.toFixed(2)}L)`}
        </span>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
});
