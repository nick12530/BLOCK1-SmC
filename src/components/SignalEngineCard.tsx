/**
 * SignalEngineCard.tsx - Institutional SMC Signal Deck
 * Premium trader execution deck:
 * - Direction switch: BUY / SELL / AUTO SMC with distinct directional cues
 * - Live Entry spot price with real-time broker spread display
 * - Micro-Lot volume control and 1-click Stacking Selector (1x, 2x, 3x, 5x)
 * - Defined Risk & Reward point matrix with dynamic dollar exposure calculation
 * - High-contrast 1-Click Execution button
 */

import React, { useState, useMemo } from 'react';
import { useMarket, useTicker } from '../hooks/useTradingStore';
import { tradingEngine, MAX_SPREAD_POINTS } from '../engine/tradingEngine';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shield,
  Zap,
  Layers,
  Copy,
  Check,
  Minus,
  Plus,
  Compass,
} from 'lucide-react';
import { TradeDirection } from '../types/smc';

interface SignalEngineCardProps {
  onExecuteSignal?: (customVolume?: number) => void;
}

export const SignalEngineCard: React.FC<SignalEngineCardProps> = React.memo(({ onExecuteSignal }) => {
  const market = useMarket();
  const ticker = useTicker();

  // Execution parameters
  const [directionMode, setDirectionMode] = useState<'AUTO' | 'BUY' | 'SELL'>('AUTO');
  const [lotSize, setLotSize] = useState<number>(0.01);
  const [riskPts, setRiskPts] = useState<number>(4.0);
  const [rewardPts, setRewardPts] = useState<number>(8.0);
  const [positionCount, setPositionCount] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const [executedFeedback, setExecutedFeedback] = useState<string | null>(null);

  const rawSig = market.signal;
  const isWideSpread = ticker.spread > MAX_SPREAD_POINTS;

  // Active direction based on user choice or algorithmic SMC bias
  const activeDirection: TradeDirection = useMemo(() => {
    if (directionMode === 'BUY') return 'BUY';
    if (directionMode === 'SELL') return 'SELL';
    return rawSig?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  }, [directionMode, rawSig, market.bias]);

  const currentSpot = activeDirection === 'BUY' ? ticker.ask : ticker.bid;
  const entryPrice = currentSpot;

  const slPrice = Number(
    (activeDirection === 'BUY' ? entryPrice - riskPts : entryPrice + riskPts).toFixed(2)
  );
  const tpPrice = Number(
    (activeDirection === 'BUY' ? entryPrice + rewardPts : entryPrice - rewardPts).toFixed(2)
  );

  const tradeMetrics = useMemo(() => {
    const totalLots = Number((lotSize * positionCount).toFixed(2));
    const dollarPerPoint = totalLots * 100;
    const riskDollar = Number((riskPts * dollarPerPoint).toFixed(2));
    const rewardDollar = Number((rewardPts * dollarPerPoint).toFixed(2));
    const rrRatio = (rewardPts / Math.max(0.1, riskPts)).toFixed(1);

    return {
      totalLots,
      riskDollar,
      rewardDollar,
      rrRatio,
    };
  }, [riskPts, rewardPts, lotSize, positionCount]);

  const handleAdjustLot = (delta: number) => {
    setLotSize((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(10.0, Math.max(0.01, next));
    });
  };

  const handleCopy = () => {
    const text = `XAUUSD ${activeDirection} | Entry: $${entryPrice.toFixed(2)} | SL: $${slPrice.toFixed(2)} | TP: $${tpPrice.toFixed(2)} | Vol: ${tradeMetrics.totalLots}L`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExecute = () => {
    if (isWideSpread) return;

    if (positionCount > 1) {
      const res = tradingEngine.tradeMultiplePositions(positionCount, {
        direction: activeDirection,
        volume: lotSize,
        entry: entryPrice,
        sl: slPrice,
        tp: tpPrice,
        comment: `stack_${activeDirection.toLowerCase()}`,
      });
      setExecutedFeedback(`Stacked ${res.countOpened}x ${activeDirection} Orders (${tradeMetrics.totalLots}L Total)`);
    } else {
      if (onExecuteSignal) {
        onExecuteSignal(lotSize);
      } else {
        tradingEngine.tradeSignal({
          direction: activeDirection,
          volume: lotSize,
          entry: entryPrice,
          sl: slPrice,
          tp: tpPrice,
          comment: `user_${activeDirection.toLowerCase()}`,
        });
      }
      setExecutedFeedback(`Order Sent: ${activeDirection} ${lotSize.toFixed(2)} @ $${entryPrice.toFixed(2)}`);
    }

    setTimeout(() => setExecutedFeedback(null), 3500);
  };

  return (
    <div className="bg-white dark:bg-[#0c0d10] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-4 font-mono text-xs transition-colors">
      {/* Header: Title, Direction Switcher & Copy */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-500" />
          <h2 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
            SMC Signal Deck
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            Spread: {ticker.spread} pts
          </span>
        </div>

        {/* 3-Way Direction Controller */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => setDirectionMode('BUY')}
            className={`px-3 py-1.5 rounded-lg font-black text-xs transition-colors cursor-pointer flex items-center gap-1 ${
              activeDirection === 'BUY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BUY</span>
          </button>

          <button
            onClick={() => setDirectionMode('SELL')}
            className={`px-3 py-1.5 rounded-lg font-black text-xs transition-colors cursor-pointer flex items-center gap-1 ${
              activeDirection === 'SELL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>SELL</span>
          </button>

          <button
            onClick={() => setDirectionMode('AUTO')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
              directionMode === 'AUTO'
                ? 'bg-zinc-800 text-white dark:bg-zinc-700'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
            title="Follow Smart Money institutional bias"
          >
            AUTO
          </button>

          <button
            onClick={handleCopy}
            title="Copy signal parameters"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-0.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Target Price Levels Matrix */}
      <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
        {/* Entry Price */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">Execution Spot</span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
            ${entryPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 block">Live Market Entry</span>
        </div>

        {/* Stop Loss */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-[10px] text-rose-500 block uppercase font-bold">Stop Loss (SL)</span>
          <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
            ${slPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 block">
            -{riskPts} pts (-${tradeMetrics.riskDollar})
          </span>
        </div>

        {/* Take Profit */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-[10px] text-emerald-500 block uppercase font-bold">Take Profit (TP)</span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
            ${tpPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 block">
            +{rewardPts} pts (+${tradeMetrics.rewardDollar})
          </span>
        </div>
      </div>

      {/* Order Sizing & Position Stacking Matrix */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Position Stacking:</span>
          </span>

          <span className="font-bold text-slate-900 dark:text-white">
            1:{tradeMetrics.rrRatio} RR · Total Exposure: {tradeMetrics.totalLots} Lots
          </span>
        </div>

        {/* Stack Presets & Steppers Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Stack Presets: 1x, 2x, 3x, 5x */}
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: '1x Single', val: 1 },
              { label: '2x Split', val: 2 },
              { label: '3x Stack', val: 3 },
              { label: '5x Heavy', val: 5 },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setPositionCount(item.val)}
                className={`py-1.5 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer text-center ${
                  positionCount === item.val
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white shadow-xs'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Volume Lot Adjuster */}
          <div className="flex items-center justify-between px-3 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">Lot per Order:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAdjustLot(-0.01)}
                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums w-12 text-center">
                {lotSize.toFixed(2)}
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
        disabled={isWideSpread}
        className={`w-full py-3.5 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer ${
          isWideSpread
            ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 cursor-not-allowed border border-zinc-300 dark:border-zinc-800'
            : activeDirection === 'SELL'
            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
        }`}
      >
        <span>
          {isWideSpread
            ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
            : positionCount > 1
            ? `EXECUTE SIGNAL · STACK ${positionCount}X ${activeDirection} ORDERS (${tradeMetrics.totalLots} LOTS TOTAL)`
            : `EXECUTE SIGNAL · ${activeDirection} ${lotSize.toFixed(2)} LOTS @ $${entryPrice.toFixed(2)}`}
        </span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
});
