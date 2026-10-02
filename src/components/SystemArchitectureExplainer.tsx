/**
 * SystemArchitectureExplainer.tsx - Dynamic Institutional System Architecture & Strategy Matrix
 * Explains exactly how the system functions, auto-updating in real-time as the user
 * adjusts risk settings, auto-RR, daily drawdown limits, or market regimes.
 */

import React, { useState } from 'react';
import { useTicker, useMarket, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  ShieldCheck,
  Cpu,
  Layers,
  BarChart3,
  Sliders,
  ChevronDown,
  ChevronUp,
  Flame,
  Zap,
  Info,
} from 'lucide-react';

export const SystemArchitectureExplainer: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const ticker = useTicker();
  const market = useMarket();
  const engine = useEngine();

  const account = tradingEngine.account;
  const balance = ticker.balance || 10300;
  const riskPct = account.risk_pct || 1.0;
  const autoRr = account.auto_rr || 2.0;
  const maxLossPct = account.max_daily_loss_pct || 3.0;

  // Real-time calculated dynamic risk metrics
  const riskAmount = Number(((balance * riskPct) / 100).toFixed(2));
  const targetReward = Number((riskAmount * autoRr).toFixed(2));
  const maxDailyLossAmount = Number(((account.daily_start_balance * maxLossPct) / 100).toFixed(2));

  const dr = market.dealing_range;
  const mtf = market.mtfAlignment || [];

  return (
    <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs font-mono text-xs transition-colors">
      {/* Header Bar with Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-[#0c1017] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
              <span>Institutional SMC Architecture & Live Strategy Rules</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                Live Reactive Matrix
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Auto-updates dynamically with real-time risk, multi-timeframe flow, and market adjustments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
            {isExpanded ? 'Hide Details' : 'Expand Matrix'}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Dynamic Auto-Updating Body */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Real-time Dynamic Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Live Risk Per Trade</span>
              <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                ${riskAmount} <span className="text-xs font-normal text-slate-400">({riskPct}%)</span>
              </div>
              <span className="text-[10px] text-slate-500">Auto-sized per stop distance</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Return (TP)</span>
              <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                +${targetReward} <span className="text-xs font-normal text-slate-400">(1:{autoRr} RR)</span>
              </div>
              <span className="text-[10px] text-slate-500">Strict mathematical asymmetry</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Max Daily Drawdown Gate</span>
              <div className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                ${maxDailyLossAmount} <span className="text-xs font-normal text-slate-400">({maxLossPct}%)</span>
              </div>
              <span className="text-[10px] text-slate-500">Hard prop firm cutoff protection</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Execution Mode</span>
              <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {engine.auto_trade ? 'Auto-Execution' : 'Manual Signal Review'}
              </div>
              <span className="text-[10px] text-slate-500">Threshold: $\ge 4.0$ confluence</span>
            </div>
          </div>

          {/* 4 Pillars of the System Architecture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pillar 1: Dynamic Multi-Timeframe Alignment */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1017] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <span>1. Multi-Timeframe Structural Alignment (M1 to D1)</span>
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {mtf.length} TFs Evaluated
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                The bot enforces structural confluence before entering. Higher timeframes (H4/H1) establish macro bias, M15 maps the active dealing range, and lower timeframes (M5/M1) pinpoint entry pinbars and CHoCH displacement.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                {mtf.map((item) => (
                  <div key={item.tf} className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">{item.tf}</span>
                    <span
                      className={`text-[9px] font-extrabold uppercase ${
                        item.bias === 'bullish'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.bias === 'bearish'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.bias}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pillar 2: Dealing Range & Equilibrium */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1017] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>2. Dealing Range & Equilibrium Pricing</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold tabular-nums">
                  EQ: ${dr ? dr.equilibrium.toFixed(1) : '—'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Smart Money never buys in Premium or sells in Discount. The engine automatically maps the swing range and only fires BUY signals below the 50% Equilibrium level into Demand OBs / FVGs, and SELL signals in Premium.
              </p>
              {dr && (
                <div className="flex items-center justify-between text-[10px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">Demand Low: ${dr.low.toFixed(1)}</span>
                  <span className="text-blue-500">50% EQ: ${dr.equilibrium.toFixed(1)}</span>
                  <span className="text-rose-600 dark:text-rose-400">Supply High: ${dr.high.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Pillar 3: Position Sizing & Invalidation */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1017] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>3. Dynamic Position Sizing Formula</span>
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                  Live Lot Calculation
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300">
                Lots = (Balance ${balance} × {riskPct}%) ÷ (Stop Distance × $100)
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Lot size dynamically adjusts so that if Stop Loss is hit, you lose exactly {riskPct}% of account balance (${riskAmount}), never more. Stop Loss is always buffered by 0.5 × ATR beyond the order block.
              </p>
            </div>

            {/* Pillar 4: Gold Candlestick Pattern Engine */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1017] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span>4. Institutional Candlestick Confluence</span>
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  {market.candlestickAnalysis?.activePattern.name || 'Pinbar Sweep'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                The engine evaluates wicked pinbars, institutional engulfing bars, morning stars, and tweezer tops with Gold-calibrated wick-to-body ratios ($\ge 55\%$ wick rejection) to confirm institutional absorption before trade execution.
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Displacement score: 5/5</span>
                <span>Session filter: London & NY Open</span>
                <span>Max Spread cutoff: 40 points</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
