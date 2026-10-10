/**
 * SignalEngineCard.tsx - Ranked multi-strategy signal and execution deck
 * - Displays ranked SMC, trend-pullback, and volatility-breakout candidates
 * - Live Entry spot price with real-time broker spread display
 * - Broker-spec risk-limited position sizing and single-entry execution
 * - Defined Risk & Reward point matrix with dynamic dollar exposure calculation
 * - High-contrast 1-Click Execution button
 */

import React, { useState, useMemo } from 'react';
import { useMarket, useTicker, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  ArrowRight,
  Shield,
  Zap,
  Layers,
  Copy,
  Check,
  Minus,
  Plus,
  Compass,
  Bot,
} from 'lucide-react';
import { Signal, TradeDirection } from '../types/smc';
import { buildSignalRationale } from '../engine/tradeJournal';
import { getInstrumentConfig } from '../engine/instrumentConfig';

interface SignalEngineCardProps {
  onExecuteSignal?: (customVolume?: number, positionCount?: number, signal?: Signal) => void | Promise<void>;
}

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

    if (onExecuteSignal) {
      if (riskLimitedLotSize === null) return;
      await onExecuteSignal(riskLimitedLotSize, positionCount, rawSig);
    } else {
      const order = {
        direction: rawSig.direction,
        volume: riskLimitedLotSize ?? lotSize,
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
        setExecutedFeedback(result.ok ? `Order sent: ${rawSig.direction} ${lotSize.toFixed(2)} lots` : result.error || 'Order rejected');
      }
      setTimeout(() => setExecutedFeedback(null), 3500);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-xl sm:rounded-2xl p-2.5 sm:p-4.5 flex flex-col justify-between shadow-xs space-y-2.5 sm:space-y-4 font-mono text-xs transition-colors">
      {/* Header: Title, Status Badge, Auto-Trader Toggle & Copy Action */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="w-4 h-4 text-emerald-500" />
          <h2 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
            Multi-Strategy Signal Deck
          </h2>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            rawSig
              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
              : 'bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
          }`}>
            {rawSig
              ? `${rawSig.direction} · ${rawSig.strategy} · ${ticker.spread} PTS`
              : market.brokerMarketData
                ? `SCANNING · ${ticker.spread} PTS`
                : `WAITING FOR VERIFIED MT5 DATA · ${ticker.spread} PTS`}
          </span>

          {/* Dedicated Auto-Trader Toggle Button */}
          <button
            type="button"
            onClick={() => tradingEngine.toggleAutoTrade()}
            aria-pressed={engine.auto_trade}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              engine.auto_trade
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
            }`}
            title={
              engine.auto_trade
                ? 'Auto-Trader is ACTIVE (Automatically executes verified institutional setups). Click to turn OFF.'
                : 'Auto-Trader is OFF (Manual orders only). Click to turn ON.'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                engine.auto_trade ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
              }`}
            />
            <Bot className="w-3.5 h-3.5" />
            <span>Auto-Trader: {engine.auto_trade ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            title="Copy signal parameters"
            disabled={!rawSig}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-0.5 disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Ranked Strategy Signals Grid (Dedicated Row) */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Ranked strategy signals">
        {market.signals.map((signal, index) => {
          const id = `${signal.strategy}:${signal.direction}:${signal.timeframe}:${signal.timestamp}`;
          const isSelected = rawSig === signal;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedSignalId(id)}
              aria-pressed={isSelected}
              className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-500/30'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  #{index + 1} · {signal.strategy}
                </span>
                <span className={`font-bold ${signal.direction === 'BUY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {signal.direction} · {signal.score.toFixed(1)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-zinc-300">
                {signal.timeframe} · Entry {signal.entry} · SL {signal.sl} · TP {signal.tp}
              </div>
            </button>
          );
        })}
        {market.signals.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-3 text-[11px] text-slate-500 dark:border-zinc-700 dark:text-zinc-400 sm:col-span-2 xl:col-span-3">
            Scanning SMC, trend-pullback, and volatility-breakout setups from closed broker candles.
          </div>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/70 dark:bg-sky-950/20"
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
              rawSig ? 'bg-sky-500' : 'bg-slate-400 dark:bg-zinc-600'
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-relaxed text-slate-800 dark:text-zinc-100">
              {rawSig
                ? rawSig.humanExplanation?.simpleSummary || buildSignalRationale(rawSig)
                : 'No broker-confirmed setup currently meets the enabled strategy filters. Execution remains disabled until a valid signal forms.'}
            </p>
            {rawSig?.reasons.length ? (
              <ul className="mt-2 grid gap-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-300 sm:grid-cols-2">
                {rawSig.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`} className="flex gap-2">
                    <span className="text-sky-600 dark:text-sky-400">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {/* Target Price Levels Matrix */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center text-xs">
        {/* Entry Price */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-xs text-zinc-500 block uppercase font-bold">Signal Entry</span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
            {signalEntry === null ? '—' : `$${signalEntry.toFixed(2)}`}
          </span>
          <span className="text-xs text-zinc-500 block mt-0.5">
            {rawSig ? `Confirmed ${rawSig.timeframe}` : 'Waiting for entry'}
          </span>
        </div>

        {/* Stop Loss */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-xs text-rose-500 block uppercase font-bold">Stop Loss (SL)</span>
          <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
            {slPrice === null ? '—' : `$${slPrice.toFixed(2)}`}
          </span>
          <span className="text-xs text-zinc-500 block mt-0.5">
            {rawSig ? `-${riskPts.toFixed(1)} pts (-$${tradeMetrics.riskDollar})` : 'SL pending'}
          </span>
        </div>

        {/* Take Profit */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-xs text-emerald-500 block uppercase font-bold">Take Profit (TP)</span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
            {tpPrice === null ? '—' : `$${tpPrice.toFixed(2)}`}
          </span>
          <span className="text-xs text-zinc-500 block mt-0.5">
            {rawSig ? `+${rewardPts.toFixed(1)} pts (+$${tradeMetrics.rewardDollar})` : 'TP pending'}
          </span>
        </div>
      </div>

      {/* Order Sizing & Position Stacking Matrix */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Risk-limited single entry:</span>
          </span>

          <span className="font-bold text-slate-900 dark:text-white">
            1:{tradeMetrics.rrRatio} RR · Total Exposure: {tradeMetrics.totalLots} Lots
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Volume Lot Adjuster */}
          <div className="flex items-center justify-between px-3 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">Max requested lots:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAdjustLot(-0.01)}
                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums w-12 text-center">
                {riskLimitedLotSize === null ? '—' : riskLimitedLotSize.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => handleAdjustLot(0.01)}
                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Feedback Banner */}
      {executedFeedback && (
        <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
          ✓ {executedFeedback}
        </div>
      )}

      {/* 1-Click Execution Button */}
      <button
        onClick={handleExecute}
        disabled={isWideSpread || !rawSig || riskLimitedLotSize === null || riskLimitedLotSize <= 0}
        className={`w-full py-3.5 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
          isWideSpread || !rawSig
            ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 cursor-not-allowed border border-zinc-300 dark:border-zinc-800'
            : activeDirection === 'SELL'
              ? 'bg-rose-700 hover:bg-rose-600 text-white shadow-xs border border-rose-600/40 active:scale-[0.99]'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs border border-emerald-600/40 active:scale-[0.99]'
        }`}
      >
        <span className="font-medium">
          {!rawSig
            ? 'WAITING FOR CONFIRMED SETUP'
            : isWideSpread
              ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
              : !riskLimitedLotSize
                ? 'BROKER RISK SIZE UNAVAILABLE'
                : `EXECUTE SIGNAL · ${activeDirection} ${riskLimitedLotSize.toFixed(2)} RISK-SIZED LOTS @ $${entryPrice.toFixed(2)}`}
        </span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
});
