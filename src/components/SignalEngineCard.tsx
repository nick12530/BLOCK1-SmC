/**
 * SignalEngineCard.tsx - Refined Minimalist SMC Signal & Execution Engine
 * Redesigned to eliminate clutter, crowded text, and visual fatigue:
 * - Generous breathing room, modest typography
 * - Prominent Direction, Confluence Score & Key Levels
 * - Clean entry, SL, TP figures
 * - Uncrowded lot controls and high-contrast execution button
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

  // Filter to only show READY signals (executable)
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
        `Confluence ${scannerAnalysis.confluenceScore}/100 is below the setup threshold.`
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
    const text = `${ticker.symbol} ${activeDirection} | Entry: ${rawSig.entry} | SL: ${rawSig.sl} | TP: ${rawSig.tp} | Vol: ${tradeMetrics.totalLots}L`;
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
        setExecutedFeedback(`Opened ${result.countOpened} orders`);
      } else {
        const result = tradingEngine.tradeSignal(order);
        setExecutedFeedback(result.ok ? `Order sent: ${safeLot.toFixed(2)} lots` : result.error || 'Order rejected');
      }
      setTimeout(() => setExecutedFeedback(null), 3500);
    }
  };

  return (
    <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl p-4 sm:p-5 bg-white dark:bg-[#121917] flex flex-col justify-between space-y-4 font-mono text-xs transition-colors">
      {/* 1. Header: Pair, Direction, Score */}
      <div className="flex items-center justify-between pb-1 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
            <span>{ticker.symbol} Signal</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">· Spread: {ticker.spread} pts</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rawSig && (
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Score: <strong className="text-slate-900 dark:text-white">{rawSig.score.toFixed(1)}/10</strong>
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy signal parameters"
            disabled={!rawSig}
            className="p-1 rounded text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Direction & Summary */}
      <div className={`rounded-lg p-3 border transition-all ${
        rawSig
          ? isBull
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
          : 'bg-slate-50 dark:bg-[#0f1513] border-slate-200 dark:border-[#222d29]'
      }`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1 ${
              rawSig
                ? isBull
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-[#222d29] dark:text-slate-400'
            }`}>
              {isBull ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{rawSig ? rawSig.direction : 'WAITING'}</span>
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {rawSig ? `${rawSig.strategy} · ${rawSig.timeframe}` : 'Monitoring broker quotes'}
            </span>
          </div>

          {rawSig && rawSig.validitySeconds && rawSig.validitySeconds > 0 && (
            <span className="text-[11px] text-slate-400 tabular-nums">
              Window: {formatSignalCountdown(rawSig.validitySeconds)}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {rawSig
            ? rawSig.humanExplanation?.simpleSummary || buildSignalRationale(rawSig)
            : 'Standing by for structural market break or liquidity sweep confirmation.'}
        </p>

        {scannerBlockReason && (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
            Hold: {scannerBlockReason}
          </p>
        )}
      </div>

      {/* 3. Level Triad: Entry, Stop Loss, Take Profit */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Entry</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums block mt-0.5">
            {signalEntry === null ? '—' : signalEntry.toFixed(instrumentConfig.digits)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{rawSig ? rawSig.timeframe : 'Pending'}</span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-rose-500 uppercase font-semibold block">Stop Loss</span>
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
            {slPrice === null ? '—' : `$${slPrice.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {rawSig ? `-${riskPips.toFixed(1)}p ($${tradeMetrics.riskDollar})` : 'Pending'}
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-emerald-500 uppercase font-semibold block">Take Profit</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
            {tpPrice === null ? '—' : tpPrice.toFixed(instrumentConfig.digits)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {rawSig ? `+${rewardPips.toFixed(1)}p (+$${tradeMetrics.rewardDollar})` : 'Pending'}
          </span>
        </div>
      </div>

      {/* 4. Sizing Controls & R:R Summary */}
      <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/40 dark:bg-[#0f1513] flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Risk &amp; Reward</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            1:{tradeMetrics.rrRatio} RR · {riskLimitedLotSize && riskLimitedLotSize > 0 ? `${riskLimitedLotSize.toFixed(2)}L safe` : 'Sizing hold'}
          </span>
        </div>

        {/* Lot Adjustment */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            {LOT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLotSize(preset)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  lotSize === preset
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-slate-900 dark:border-white'
                    : 'bg-white dark:bg-[#1a2320] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#222d29] hover:border-slate-300'
                }`}
              >
                {preset.toFixed(2)}L
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border border-slate-200 dark:border-[#222d29] rounded px-1.5 py-0.5 bg-white dark:bg-[#121917]">
            <button
              type="button"
              onClick={() => handleAdjustLot(-0.01)}
              className="p-0.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-bold tabular-nums w-10 text-center text-slate-900 dark:text-white text-xs">
              {(riskLimitedLotSize ?? lotSize).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => handleAdjustLot(0.01)}
              className="p-0.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {executedFeedback && (
        <div className="p-2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
          ✓ {executedFeedback}
        </div>
      )}

      {/* 5. Execution Button */}
      <button
        data-hotkey-execute="true"
        onClick={handleExecute}
        disabled={isWideSpread || !rawSig || !sizingInfo || !hasSafeLot || Boolean(scannerBlockReason)}
        className={`w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
          isWideSpread || !rawSig || !sizingInfo || !hasSafeLot || Boolean(scannerBlockReason)
            ? 'bg-slate-100 text-slate-400 dark:bg-[#1a2320] dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-[#222d29]'
            : activeDirection === 'SELL'
            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
        }`}
      >
        <span>
          {!rawSig
            ? 'Waiting for Confirmed Setup'
            : isWideSpread
            ? `Spread Too Wide (${ticker.spread} pts)`
            : !hasSafeLot
            ? 'Risk Limit Exceeded'
            : scannerBlockReason
            ? 'Setup Held by Safety Filter'
            : `Execute ${activeDirection} ${(riskLimitedLotSize ?? lotSize).toFixed(2)}L @ ${entryPrice.toFixed(instrumentConfig.digits)}`}
        </span>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
});
