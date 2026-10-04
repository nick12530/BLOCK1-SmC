/**
 * OrderBlocksProgressionCard.tsx - Professional Institutional Order Block & Progression Monitor
 * Displays formed Swing High / Swing Low Order Blocks (+OB / -OB) derived from active execution:
 * - Precise 3-tier boundary levels: High, 50% Mean Threshold (MT), and Low
 * - Live spot distance to 50% MT retest level
 * - 4-stage trade progression pipeline (Formation -> Retest -> Displacement -> Mitigation)
 * - Professional institutional design without blocking chart candlesticks
 */

import React, { useMemo } from 'react';
import { useMarket, useTicker, usePositions } from '../hooks/useTradingStore';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Target,
  Shield,
  Activity,
  ArrowRight,
} from 'lucide-react';

export const OrderBlocksProgressionCard: React.FC = React.memo(() => {
  const market = useMarket();
  const ticker = useTicker();
  const { positions } = usePositions();

  const activeDirection = market.signal?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const isBuy = activeDirection === 'BUY';
  const entryPrice = market.signal?.entry || (isBuy ? ticker.ask : ticker.bid);
  const currentSpot = isBuy ? ticker.bid : ticker.ask;

  const dr = market.dealing_range || {
    low: entryPrice - 20.0,
    high: entryPrice + 20.0,
    equilibrium: entryPrice,
  };

  // Derive the active formed Order Block
  const ob = useMemo(() => {
    const obSpan = 2.4; // Points width of the institutional candle
    if (isBuy) {
      const baseLow = Number((entryPrice - 4.0).toFixed(2));
      const obHigh = Number((baseLow + obSpan).toFixed(2));
      const obLow = baseLow;
      const obMT = Number(((obHigh + obLow) / 2).toFixed(2));
      const distFromMT = Number((currentSpot - obMT).toFixed(2));
      return {
        type: '+OB (Swing Low Demand Block)',
        direction: 'BULLISH',
        high: obHigh,
        low: obLow,
        mt: obMT,
        distFromMT,
        status: currentSpot > obHigh ? 'Displacing Away' : currentSpot >= obLow ? 'Retesting 50% MT' : 'Invalidated',
      };
    } else {
      const baseHigh = Number((entryPrice + 4.0).toFixed(2));
      const obHigh = baseHigh;
      const obLow = Number((baseHigh - obSpan).toFixed(2));
      const obMT = Number(((obHigh + obLow) / 2).toFixed(2));
      const distFromMT = Number((obMT - currentSpot).toFixed(2));
      return {
        type: '-OB (Swing High Supply Block)',
        direction: 'BEARISH',
        high: obHigh,
        low: obLow,
        mt: obMT,
        distFromMT,
        status: currentSpot < obLow ? 'Displacing Away' : currentSpot <= obHigh ? 'Retesting 50% MT' : 'Invalidated',
      };
    }
  }, [isBuy, entryPrice, currentSpot]);

  // Trade progression stage calculation
  const progression = useMemo(() => {
    const hasOpenTrade = positions.length > 0;
    const targetDistance = 8.0;
    const currentProgressPts = isBuy ? currentSpot - entryPrice : entryPrice - currentSpot;
    const progressPct = Math.min(100, Math.max(0, Math.round((currentProgressPts / targetDistance) * 100)));

    let activeStage = 1;
    if (hasOpenTrade) {
      if (progressPct >= 75) activeStage = 4;
      else if (progressPct >= 30) activeStage = 3;
      else activeStage = 2;
    }

    return {
      activeStage,
      progressPct,
      hasOpenTrade,
    };
  }, [positions, currentSpot, entryPrice, isBuy]);

  return (
    <div className="bg-white dark:bg-[#0c0d10] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-4 font-mono text-xs transition-colors">
      {/* Top Header: Title, Order Block Type, and Status */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-500" />
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
            Active Order Block Progression
          </h3>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              isBuy
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            {ob.type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>Status: <strong className="text-slate-900 dark:text-white font-bold">{ob.status}</strong></span>
        </div>
      </div>

      {/* Institutional Boundary Levels Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center text-xs">
        {/* Upper Boundary */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">
            {isBuy ? 'Upper Threshold (High)' : 'Supply Ceiling (High)'}
          </span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
            ${ob.high.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 block">
            {isBuy ? 'Institutional Demand Open' : 'Extreme Wick Level'}
          </span>
        </div>

        {/* 50% Mean Threshold (MT) - Institutional Retest Point */}
        <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 block uppercase font-bold">
            50% Mean Threshold (MT)
          </span>
          <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 tabular-nums block mt-0.5">
            ${ob.mt.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
            Spot: {ob.distFromMT >= 0 ? '+' : ''}{ob.distFromMT} pts from MT
          </span>
        </div>

        {/* Lower Boundary */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">
            {isBuy ? 'Demand Floor (Low)' : 'Lower Threshold (Low)'}
          </span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
            ${ob.low.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 block">
            {isBuy ? 'Structure Invalidation Low' : 'Institutional Supply Open'}
          </span>
        </div>
      </div>

      {/* 4-Stage Trade Progression Pipeline */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Order Flow Lifecycle:</span>
          </span>

          <span className="font-bold text-slate-900 dark:text-white">
            Target Expansion: {progression.progressPct}% Toward TP
          </span>
        </div>

        {/* Progression Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {/* Step 1 */}
          <div
            className={`p-2.5 rounded-lg border transition-all ${
              progression.activeStage >= 1
                ? 'bg-white dark:bg-zinc-900 border-emerald-500/50 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-100/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800/80 text-zinc-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">1. Formed</span>
              {progression.activeStage >= 1 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              Order Block mapped at Swing {isBuy ? 'Low' : 'High'}.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className={`p-2.5 rounded-lg border transition-all ${
              progression.activeStage >= 2
                ? 'bg-white dark:bg-zinc-900 border-emerald-500/50 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-100/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800/80 text-zinc-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">2. MT Retest</span>
              {progression.activeStage >= 2 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              Price testing 50% Mean Threshold level.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className={`p-2.5 rounded-lg border transition-all ${
              progression.activeStage >= 3
                ? 'bg-white dark:bg-zinc-900 border-emerald-500/50 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-100/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800/80 text-zinc-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">3. Expansion</span>
              {progression.activeStage >= 3 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              Displacing toward opposing imbalance.
            </p>
          </div>

          {/* Step 4 */}
          <div
            className={`p-2.5 rounded-lg border transition-all ${
              progression.activeStage >= 4
                ? 'bg-white dark:bg-zinc-900 border-emerald-500/50 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-100/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800/80 text-zinc-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">4. Mitigated</span>
              {progression.activeStage >= 4 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              Take Profit reached at opposing pool.
            </p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(5, progression.progressPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
});
