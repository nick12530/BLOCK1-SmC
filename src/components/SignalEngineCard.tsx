/**
 * SignalEngineCard.tsx - Upgraded, Spacious SMC Signal Engine & Execution Deck
 * Redesigned to eliminate clutter, crowded text, and visual fatigue:
 * - Clean visual hierarchy with generous breathing room
 * - Prominent Direction, Confluence Score & Strategy status
 * - Sleek candidate selector pills (when multiple setups exist)
 * - Spacious 3-column target level matrix (Entry, Stop Loss, Take Profit)
 * - Ergonomic volume controls with quick-pick presets (0.01, 0.02, 0.05, 0.10)
 * - High-contrast 1-Click Execution Button with clear risk/reward context
 */

import React, { useState, useMemo } from 'react';
import { useMarket, useTicker, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  ArrowRight,
  Zap,
  Copy,
  Check,
  Minus,
  Plus,
  Bot,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
} from 'lucide-react';
import { Signal, TradeDirection } from '../types/smc';
import { buildSignalRationale } from '../engine/tradeJournal';
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

  // Execution parameters
  const [lotSize, setLotSize] = useState<number>(0.01);
  const positionCount = 1;
  const [copied, setCopied] = useState(false);
  const [executedFeedback, setExecutedFeedback] = useState<string | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const selectedSignal = market.signals.find(
    (signal) => `${signal.strategy}:${signal.direction}:${signal.timeframe}:${signal.timestamp}` === selectedSignalId
  );
  const rawSig = selectedSignal ?? market.signal;
  const maxSpreadPoints = tradingEngine.getMaxSpreadPoints();
  const isWideSpread = ticker.spread > maxSpreadPoints;

  const activeDirection: TradeDirection = rawSig?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const isBull = activeDirection === 'BUY';

  const currentSpot = activeDirection === 'BUY' ? ticker.ask : ticker.bid;
  const entryPrice = currentSpot;
  const signalEntry = rawSig?.entry ?? null;
  const riskLimitedLotSize = rawSig ? tradingEngine.getRiskBasedVolume(rawSig.sl, lotSize, rawSig.direction) : null;
  const slPrice = rawSig?.sl ?? null;
  const tpPrice = rawSig?.tp ?? null;
  const riskPts = rawSig ? Math.abs(rawSig.entry - rawSig.sl) : 0;
  const rewardPts = rawSig ? Math.abs(rawSig.tp - rawSig.entry) : 0;

  const tradeMetrics = useMemo(() => {
    const config = getInstrumentConfig(ticker.symbol);
    const totalLots = Number(((riskLimitedLotSize ?? lotSize) * positionCount).toFixed(2));
    const spec = market.symbolSpec;
    let riskDollar = 0;
    let rewardDollar = 0;

    if (spec && spec.tickSize > 0 && spec.tickValue > 0) {
      riskDollar = Number((riskPts / spec.tickSize * spec.tickValue * totalLots).toFixed(2));
      rewardDollar = Number((rewardPts / spec.tickSize * spec.tickValue * totalLots).toFixed(2));
    } else {
      if (config.category === 'metals') {
        riskDollar = Number((riskPts * totalLots * config.contractSize).toFixed(2));
        rewardDollar = Number((rewardPts * totalLots * config.contractSize).toFixed(2));
      } else if (ticker.symbol === 'USDJPY') {
        riskDollar = Number(((riskPts * totalLots * config.contractSize) / Math.max(1, currentSpot || 150)).toFixed(2));
        rewardDollar = Number(((rewardPts * totalLots * config.contractSize) / Math.max(1, currentSpot || 150)).toFixed(2));
      } else {
        riskDollar = Number((riskPts * totalLots * config.contractSize).toFixed(2));
        rewardDollar = Number((rewardPts * totalLots * config.contractSize).toFixed(2));
      }
    }

    const rrRatio = riskPts > 0 ? (rewardPts / riskPts).toFixed(1) : '—';

    return {
      totalLots,
      riskDollar,
      rewardDollar,
      rrRatio,
    };
  }, [riskPts, rewardPts, lotSize, positionCount, riskLimitedLotSize, market.symbolSpec, ticker.symbol, currentSpot]);

  const handleAdjustLot = (delta: number) => {
    setLotSize((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(10.0, Math.max(0.01, next));
    });
  };

  const handleCopy = () => {
    if (!rawSig) return;
    const text = `${ticker.symbol} ${activeDirection} (${rawSig.strategy}) | Entry: ${rawSig.entry} | SL: ${rawSig.sl} | TP: ${rawSig.tp} | Vol: ${tradeMetrics.totalLots}L`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExecute = async () => {
    if (isWideSpread || !rawSig) return;
    signalAudioNotifier.unlock();
    signalAudioNotifier.playTradeExecutionAlert(rawSig.direction);

    const safeLot = riskLimitedLotSize ?? lotSize ?? 0.01;
    if (onExecuteSignal) {
      await onExecuteSignal(safeLot, positionCount, rawSig);
    } else {
      const order = {
        direction: rawSig.direction,
        volume: safeLot,
        entry: rawSig.entry,
        sl: rawSig.sl,
        tp: rawSig.tp,
        comment: `user_${rawSig.direction.toLowerCase()}`,
      };
      if (positionCount > 1) {
        const result = tradingEngine.tradeMultiplePositions(positionCount, order);
        setExecutedFeedback(`Opened ${result.countOpened} ${rawSig.direction} orders`);
      } else {
        const result = tradingEngine.tradeSignal(order);
        setExecutedFeedback(result.ok ? `Order sent: ${rawSig.direction} ${safeLot.toFixed(2)} lots` : result.error || 'Order rejected');
      }
      setTimeout(() => setExecutedFeedback(null), 3500);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-4 font-mono text-xs transition-colors min-w-0 overflow-hidden">
      {/* 1. Top Bar: Header, Pair Badge, Auto-Trader Switch & Copy */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider font-sans">
              Signal Engine
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
              <span>{ticker.symbol}</span>
              <span>·</span>
              <span>Spread: {ticker.spread} PTS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-Trader Quick Switch */}
          <button
            type="button"
            onClick={() => tradingEngine.toggleAutoTrade()}
            aria-pressed={engine.auto_trade}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              engine.auto_trade
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
            }`}
            title={engine.auto_trade ? 'Auto-Trader is active. Click to pause.' : 'Auto-Trader is idle. Click to activate.'}
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span>Auto: {engine.auto_trade ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy signal parameters"
            disabled={!rawSig}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Setup Candidate Selector Pills (if multiple signals exist) */}
      {market.signals.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase shrink-0">
            Setups:
          </span>
          {market.signals.slice(0, 3).map((sig, idx) => {
            const sigId = `${sig.strategy}:${sig.direction}:${sig.timeframe}:${sig.timestamp}`;
            const isSelected = rawSig === sig;
            return (
              <button
                key={sigId}
                type="button"
                onClick={() => setSelectedSignalId(sigId)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-slate-900 dark:border-white shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                }`}
              >
                #{idx + 1} {sig.direction} {(sig.strategy || 'SMC Setup').replace('SMC ', '')} ({sig.score.toFixed(1)})
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Hero Status Banner: Direction, Confluence & Rationale */}
      <div className={`rounded-xl p-3.5 border transition-all ${
        rawSig
          ? isBull
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
            : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
          : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800'
      }`}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
              rawSig
                ? isBull
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}>
              {isBull ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{rawSig ? rawSig.direction : 'WAITING'}</span>
            </span>

            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              {rawSig ? `${rawSig.strategy} · ${rawSig.timeframe}` : 'Scanning Live Quotes'}
            </span>
          </div>

          {rawSig && (
            <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
              Score: {rawSig.score.toFixed(1)}/10
            </span>
          )}
        </div>

        <p className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
          {rawSig
            ? rawSig.humanExplanation?.simpleSummary || buildSignalRationale(rawSig)
            : 'Waiting for high-probability structural break and POI confirmation.'}
        </p>
      </div>

      {/* 4. Target Price Levels Matrix (Entry, Stop Loss, Take Profit) */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        {/* Entry */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">
            Entry Spot
          </span>
          <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums block mt-1">
            {signalEntry === null ? '—' : `$${signalEntry.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {rawSig ? rawSig.timeframe : 'Pending'}
          </span>
        </div>

        {/* Stop Loss */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-rose-500 uppercase font-bold tracking-wider block">
            Stop Loss
          </span>
          <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums block mt-1">
            {slPrice === null ? '—' : `$${slPrice.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {rawSig ? `-${riskPts.toFixed(1)}p ($${tradeMetrics.riskDollar})` : 'Pending'}
          </span>
        </div>

        {/* Take Profit */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider block">
            Take Profit
          </span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-1">
            {tpPrice === null ? '—' : `$${tpPrice.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {rawSig ? `+${rewardPts.toFixed(1)}p (+$${tradeMetrics.rewardDollar})` : 'Pending'}
          </span>
        </div>
      </div>

      {/* 5. Volume & Risk-Reward Configuration Row */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-3 min-w-0 flex-wrap">
        <div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">
            Risk &amp; Reward
          </span>
          <span className="font-black text-xs text-slate-900 dark:text-white">
            1:{tradeMetrics.rrRatio} RR · {tradeMetrics.totalLots}L Vol
          </span>
        </div>

        {/* Preset Volume Pills + Stepper */}
        <div className="flex items-center gap-1.5 flex-wrap">
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
              {riskLimitedLotSize === null ? lotSize.toFixed(2) : riskLimitedLotSize.toFixed(2)}
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

      {/* 6. Execution Feedback Banner */}
      {executedFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center truncate">
          ✓ {executedFeedback}
        </div>
      )}

      {/* 7. High-Contrast 1-Click Execution Button */}
      <button
        onClick={handleExecute}
        disabled={isWideSpread || !rawSig || riskLimitedLotSize === null || riskLimitedLotSize <= 0}
        className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer min-w-0 ${
          isWideSpread || !rawSig
            ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600 cursor-not-allowed border border-zinc-300 dark:border-zinc-800'
            : activeDirection === 'SELL'
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-[0.99] border border-rose-500'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-[0.99] border border-emerald-500'
        }`}
      >
        <span className="truncate">
          {!rawSig
            ? 'WAITING FOR CONFIRMED SETUP'
            : isWideSpread
              ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
              : !riskLimitedLotSize
                ? 'RISK SIZING UNAVAILABLE'
                : `${activeDirection} ${riskLimitedLotSize.toFixed(2)} LOTS @ $${entryPrice.toFixed(2)}`}
        </span>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
});
