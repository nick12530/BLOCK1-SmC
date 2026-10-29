/**
 * SignalEngineCard.tsx - Upgraded, Spacious SMC Signal Engine & Execution Deck
 * Redesigned to eliminate clutter, crowded text, and visual fatigue:
 * - Clean visual hierarchy with generous breathing room
 * - Prominent Direction, Confluence Score & Strategy status
 * - Sleek candidate selector pills (when multiple setups exist)
 * - Spacious 3-column target level matrix (Entry, Stop Loss, Take Profit)
 * - Ergonomic volume controls with quick-pick presets (0.01, 0.02, 0.05, 0.10)
 * - High-contrast execution button with clear risk/reward context
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
  TrendingUp,
  TrendingDown,
  ShieldAlert,
} from 'lucide-react';
import { Signal, TradeDirection } from '../types/smc';
import { buildSignalRationale } from '../engine/tradeJournal';
import { getInstrumentConfig } from '../engine/instrumentConfig';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import { signalAudioNotifier } from '../utils/audioNotification';

interface SignalEngineCardProps {
  onExecuteSignal?: (customVolume?: number, positionCount?: number, signal?: Signal) => void | Promise<void>;
}

const LOT_PRESETS = [0.01, 0.02, 0.05, 0.10];

function formatSignalCountdown(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const SignalEngineCard: React.FC<SignalEngineCardProps> = React.memo(({ onExecuteSignal }) => {
  const market = useMarket();
  const ticker = useTicker();
  const engine = useEngine();

  // Filter to only show READY signals (executable) - BLOCKED signals should be hidden
  const readySignals = useMemo(() => {
    return market.signals.filter((signal) => {
      const analysis = market.scannerAnalyses?.find(
        (candidate) =>
          candidate.symbol === ticker.symbol &&
          candidate.signal?.timestamp === signal.timestamp
      );
      return !analysis || analysis.status === 'READY';
    });
  }, [market.signals, market.scannerAnalyses, ticker.symbol]);

  // Execution parameters
  const [lotSize, setLotSize] = useState<number>(0.01);
  const [sizingMode, setSizingMode] = useState<'lots' | 'risk'>('lots');
  const positionCount = 1;
  const [copied, setCopied] = useState(false);
  const [executedFeedback, setExecutedFeedback] = useState<string | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const selectedSignal = readySignals.find(
    (signal) => `${signal.strategy}:${signal.direction}:${signal.timeframe}:${signal.timestamp}` === selectedSignalId
  );
  const rawSig = selectedSignal ?? (readySignals.length > 0 ? readySignals[0] : null);
  const scannerAnalysis = rawSig
    ? market.scannerAnalyses?.find(
        (analysis) =>
          analysis.symbol === ticker.symbol &&
          analysis.signal?.timestamp === rawSig.timestamp
      )
    : undefined;
  const scannerBlockReason =
    scannerAnalysis && scannerAnalysis.status !== 'READY'
      ? scannerAnalysis.rejectionReason ||
        `Confluence ${scannerAnalysis.confluenceScore}/100 is below the ${getInstrumentConfig(ticker.symbol).minScore}/100 setup threshold.`
      : null;
  const maxSpreadPoints = tradingEngine.getMaxSpreadPoints();
  const isWideSpread = ticker.spread > maxSpreadPoints;

  const activeDirection: TradeDirection = rawSig?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const isBull = activeDirection === 'BUY';
  const instrumentConfig = getInstrumentConfig(ticker.symbol);

  const currentSpot = activeDirection === 'BUY' ? ticker.ask : ticker.bid;
  const entryPrice = currentSpot;
  const signalEntry = rawSig?.entry ?? null;
  const riskLimitedLotSize = rawSig ? tradingEngine.getRiskBasedVolume(rawSig.sl, lotSize, rawSig.direction) : null;
  const sizingInfo = rawSig
    ? tradingEngine.getRiskSizingInfo(rawSig.sl, rawSig.direction, ticker.symbol as SupportedSymbol)
    : null;
  const hasSafeLot = typeof riskLimitedLotSize === 'number' && riskLimitedLotSize > 0;
  const slPrice = rawSig?.sl ?? null;
  const tpPrice = rawSig?.tp ?? null;
  const riskPts = rawSig ? Math.abs(entryPrice - rawSig.sl) : 0;
  const rewardPts = rawSig ? Math.abs(rawSig.tp - entryPrice) : 0;
  const riskPips = riskPts / instrumentConfig.pipSize;
  const rewardPips = rewardPts / instrumentConfig.pipSize;

  const tradeMetrics = useMemo(() => {
    const config = instrumentConfig;
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
  }, [riskPts, rewardPts, lotSize, positionCount, riskLimitedLotSize, market.symbolSpec, ticker.symbol, currentSpot, instrumentConfig]);

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
    if (isWideSpread || !rawSig || riskLimitedLotSize === null || riskLimitedLotSize <= 0) return;
    signalAudioNotifier.unlock();
    signalAudioNotifier.playTradeExecutionAlert(rawSig.direction);

    const safeLot = riskLimitedLotSize;
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
    <div className="neo-panel neo-card border rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5 font-mono text-xs transition-colors min-w-0 overflow-hidden">
      {/* 1. Top Bar: Active pair and signal controls */}
      <div className="flex items-center justify-between pb-1 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="font-black text-base text-slate-900 dark:text-white uppercase tracking-wider font-sans">
              Signal Engine
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
              <span>{ticker.symbol} · {market.signals.length} active setup{market.signals.length === 1 ? '' : 's'}</span>
              <span>·</span>
              <span>Spread: {ticker.spread} PTS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

      {/* 2. Setup Candidate Selector Pills (if multiple READY signals exist) */}
      {readySignals.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase shrink-0">
            Setups:
          </span>
          {readySignals.slice(0, 3).map((sig, idx) => {
            const sigId = `${sig.strategy}:${sig.direction}:${sig.timeframe}:${sig.timestamp}`;
            const isSelected = rawSig === sig;
            return (
              <button
                key={sigId}
                type="button"
                onClick={() => setSelectedSignalId(sigId)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'neo-vivid-blue border-transparent text-white shadow-xs'
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

        <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-zinc-200">
          {rawSig
            ? rawSig.humanExplanation?.simpleSummary || buildSignalRationale(rawSig)
            : 'Scanning live quotes for trend, structure, and entry-zone confirmation.'}
        </p>
        {rawSig && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-white dark:bg-white dark:text-black">
              {rawSig.timeframe} SETUP
            </span>
            <span className="rounded-md bg-sky-500/15 px-2 py-1 text-sky-700 dark:text-sky-300">
              WINDOW {formatSignalCountdown(rawSig.validitySeconds)}
            </span>
            <span className="text-slate-500 dark:text-zinc-400">Signal quality is not a profit guarantee</span>
          </div>
        )}
        {scannerBlockReason && (
          <p
            role="status"
            className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-200"
          >
            Candidate signal · execution held: {scannerBlockReason}
          </p>
        )}
      </div>

      {/* 4. Target Price Levels Matrix (Entry, Stop Loss, Take Profit) */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        {/* Entry */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">
            Entry Spot
          </span>
          <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums block mt-1">
            {signalEntry === null ? '—' : signalEntry.toFixed(instrumentConfig.digits)}
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
            {rawSig ? `-${riskPips.toFixed(1)} pips ($${tradeMetrics.riskDollar})` : 'Pending'}
          </span>
        </div>

        {/* Take Profit */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 min-w-0">
          <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider block">
            Take Profit
          </span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-1">
            {tpPrice === null ? '—' : tpPrice.toFixed(instrumentConfig.digits)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
            {rawSig ? `+${rewardPips.toFixed(1)} pips (+$${tradeMetrics.rewardDollar})` : 'Pending'}
          </span>
        </div>
      </div>

      {rawSig && (riskLimitedLotSize === null || riskLimitedLotSize <= 0) && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold leading-relaxed text-amber-800 dark:text-amber-200"
        >
          {sizingInfo
            ? `No safe lot: broker minimum ${sizingInfo.minimumLot}L risks $${sizingInfo.minimumLotRisk.toFixed(2)} at the live quote, above your ${sizingInfo.riskPercent}% risk budget of $${sizingInfo.riskBudget.toFixed(2)}. This order remains blocked.`
            : 'Waiting for a fresh broker quote and symbol specification. Position sizing is unavailable, so execution remains blocked.'}
        </div>
      )}

      {/* 5. Volume & Risk-Reward Configuration Row with Dynamic % / $ Sizing Mode */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex flex-col gap-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">
              Risk &amp; Reward
            </span>
            <span className="font-black text-xs text-slate-900 dark:text-white">
              1:{tradeMetrics.rrRatio} RR · {riskLimitedLotSize && riskLimitedLotSize > 0 ? `${riskLimitedLotSize.toFixed(2)}L safe ($${tradeMetrics.riskDollar})` : 'Sizing blocked'}
            </span>
          </div>

          {/* Sizing Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-zinc-800/80 p-0.5 rounded-lg text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setSizingMode('lots')}
              className={`px-2 py-0.5 rounded transition-colors ${
                sizingMode === 'lots'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Lot Size
            </button>
            <button
              type="button"
              onClick={() => {
                setSizingMode('risk');
                // Calculate dynamic lot for 1% risk
                const equity = tradingEngine.account.equity || 1000;
                const budget = equity * 0.01;
                const spec = market.symbolSpec;
                const pointVal = (spec && spec.tickSize > 0 && spec.tickValue > 0) ? (spec.tickValue / spec.tickSize) : instrumentConfig.contractSize;
                if (riskPts > 0 && pointVal > 0) {
                  const calculated = Math.max(0.01, Math.min(5.0, Number((budget / (riskPts * pointVal)).toFixed(2))));
                  setLotSize(calculated);
                }
              }}
              className={`px-2 py-0.5 rounded transition-colors ${
                sizingMode === 'risk'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              % Risk
            </button>
          </div>
        </div>

        {/* Preset Volume / Risk Pills + Stepper */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-1 flex-wrap">
            {sizingMode === 'lots' ? (
              LOT_PRESETS.map((preset) => (
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
                  {preset.toFixed(2)}L
                </button>
              ))
            ) : (
              [0.5, 1.0, 1.5, 2.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    const equity = tradingEngine.account.equity || 1000;
                    const budget = equity * (pct / 100);
                    const spec = market.symbolSpec;
                    const pointVal = (spec && spec.tickSize > 0 && spec.tickValue > 0) ? (spec.tickValue / spec.tickSize) : instrumentConfig.contractSize;
                    if (riskPts > 0 && pointVal > 0) {
                      const calculated = Math.max(0.01, Math.min(5.0, Number((budget / (riskPts * pointVal)).toFixed(2))));
                      setLotSize(calculated);
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold border border-sky-500/30 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors cursor-pointer"
                >
                  {pct}% Risk
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => handleAdjustLot(-0.01)}
              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-black text-xs text-slate-900 dark:text-white tabular-nums w-12 text-center">
              {riskLimitedLotSize === null ? lotSize.toFixed(2) : riskLimitedLotSize.toFixed(2)}L
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

      {/* 7. High-Contrast 1-Click Execution Button with Hotkey Trigger */}
      <div className="space-y-1.5">
        <button
          data-hotkey-execute="true"
          onClick={handleExecute}
          disabled={isWideSpread || !rawSig || !sizingInfo || !hasSafeLot || Boolean(scannerBlockReason)}
          className={`w-full py-4 px-4 rounded-xl font-black text-sm sm:text-base tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer min-w-0 ${
            isWideSpread || !rawSig || !sizingInfo || !hasSafeLot || Boolean(scannerBlockReason)
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 cursor-not-allowed border border-amber-300/70 dark:border-amber-800/70'
              : activeDirection === 'SELL'
                ? 'neo-vivid-red text-white shadow-md active:scale-[0.99] border border-rose-400'
                : 'neo-vivid-green text-white shadow-md active:scale-[0.99] border border-emerald-400'
          }`}
        >
          <span className="truncate">
            {!rawSig
              ? 'WAITING FOR CONFIRMED SETUP'
              : isWideSpread
                ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
                : !sizingInfo
                  ? 'WAITING FOR BROKER SIZING DATA'
                : !hasSafeLot
                  ? 'RISK LIMIT: MINIMUM LOT TOO LARGE'
                    : scannerBlockReason
                      ? 'SETUP NOT EXECUTION-READY'
                    : `${activeDirection} ${riskLimitedLotSize.toFixed(2)} LOTS @ ${entryPrice.toFixed(instrumentConfig.digits)}`}
          </span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>

        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-bold px-1">
          <span>⚡ Press [Space] to execute · [Esc] to reset</span>
          <span>Broker Safety Gate Active</span>
        </div>
      </div>
    </div>
  );
});
