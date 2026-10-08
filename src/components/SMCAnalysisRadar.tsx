import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Gauge,
  Activity,
  Zap,
} from 'lucide-react';

interface SMCAnalysisRadarProps {
  snapshot: TerminalSnapshot;
  onTradeSignal: () => void;
}

export const SMCAnalysisRadar: React.FC<SMCAnalysisRadarProps> = ({
  snapshot,
  onTradeSignal,
}) => {
  const sig = snapshot.signal;
  const pattern = sig?.triggerPattern;
  const dr = snapshot.dealing_range;
  const pos = snapshot.price_pos !== null ? Math.min(0.99, Math.max(0.01, snapshot.price_pos)) : 0.5;
  const isInDiscount = snapshot.price_pos !== null && snapshot.price_pos < 0.5;
  const isInPremium = snapshot.price_pos !== null && snapshot.price_pos > 0.5;

  const [lot, setLot] = useState<number>(0.05);
  const [execFeedback, setExecFeedback] = useState<string | null>(null);

  const handleExecuteWithCustomLot = () => {
    if (!sig) return;
    const res = tradingEngine.sendMarket(
      sig.direction,
      lot,
      sig.sl,
      sig.tp,
      'analysis_direct_exec'
    );
    if (res.ok) {
      setExecFeedback(`Order Filled: ${sig.direction} ${lot}L @ ${res.price?.toFixed(2)} (SL: ${sig.sl}, TP: ${sig.tp})`);
    } else {
      setExecFeedback(`Rejected: ${res.error || 'Execution blocked'}`);
    }
    setTimeout(() => setExecFeedback(null), 5000);
  };

  return (
    <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
            Market Analysis & Trade Trigger
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Institutional structure, trigger candle mechanics & direct execution
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span
            className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border ${
              snapshot.bias === 'bearish'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                : snapshot.bias === 'bullish'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            {snapshot.bias === 'bearish' ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            <span>H1 {snapshot.bias.toUpperCase()}</span>
          </span>
        </div>
      </div>

      {/* WHEN SIGNAL IS ACTIVE (e.g. SELL or BUY) */}
      {sig ? (
        <div className="space-y-4">
          {/* Signal Title Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              sig.direction === 'SELL'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900/60'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider text-white ${
                    sig.direction === 'SELL' ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                >
                  ACTIVE {sig.direction} SETUP
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                  Score: {sig.score} / 5.0
                </span>
              </div>
              <div
                className={`text-2xl font-extrabold font-mono tracking-tight mt-1 ${
                  sig.direction === 'SELL' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {sig.direction} XAUUSD @ ${sig.entry.toFixed(2)}
              </div>
            </div>

            {/* Stop Loss & Take Profit targets */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="bg-white dark:bg-[#0c1017] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Stop Loss</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">${sig.sl.toFixed(2)}</span>
              </div>
              <div className="bg-white dark:bg-[#0c1017] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Take Profit (2:1)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">${sig.tp.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* TRIGGER CANDLE PATTERN - "why it gave the signal" */}
          {pattern && (
            <div className="bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    Trigger Candle Pattern: {pattern.name}
                  </span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {pattern.wickRatio}
                </span>
              </div>

              {/* Candle Telemetry: Open, High, Low, Close */}
              <div className="grid grid-cols-4 gap-2 bg-white dark:bg-[#121824] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Open</span>
                  <span className="font-bold text-slate-900 dark:text-white">${pattern.open.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">High</span>
                  <span className="font-bold text-slate-900 dark:text-white">${pattern.high.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Low</span>
                  <span className="font-bold text-slate-900 dark:text-white">${pattern.low.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Close</span>
                  <span
                    className={`font-bold ${
                      pattern.close >= pattern.open ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    ${pattern.close.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Exact narrative explanation of the mechanics */}
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                {pattern.explanation}
              </p>
            </div>
          )}

          {/* Confluence Factors */}
          <div className="space-y-1.5 font-mono text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
              Confluence Factors Validated:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sig.reasons.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PLACE TO EXECUTE TRADE RIGHT IN THE ANALYSIS TAB */}
          <div className="bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">
                Direct Signal Execution
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Risk Target: 1:2 R:R Ratio
              </span>
            </div>

            {/* Quick Lot size buttons */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400">Volume:</span>
              <div className="flex gap-1.5 flex-wrap flex-1">
                {[0.01, 0.05, 0.10, 0.25, 0.50].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLot(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      lot === s
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                        : 'bg-white dark:bg-[#121824] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {s}L
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Execute Button */}
            <button
              onClick={handleExecuteWithCustomLot}
              className={`w-full py-3.5 px-4 rounded-xl font-bold font-mono text-sm tracking-wide transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 text-white ${
                sig.direction === 'SELL'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <span>Execute {sig.direction} ({lot} Lots @ ${sig.entry.toFixed(2)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {execFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-center font-bold">
                {execFeedback}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* BACKGROUND SCANNING STATE (Clean, minimal, tranquil) */
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c1017] space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>SMC Analysis Engine Active in Background</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Score Threshold: ≥ 4.0
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Monitoring H1 market structure, liquidity sweeps of swing extremes, and unmitigated Order Block retests. When an institutional trigger candle forms, the detailed breakdown and 1-click execution box will appear here immediately.
            </p>
          </div>

          {/* Quick Structure & Dealing Range Summary */}
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017]">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Dealing Range Location</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                {isInDiscount ? 'DISCOUNT (< 50% EQ)' : isInPremium ? 'PREMIUM (> 50% EQ)' : 'EQUILIBRIUM'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isInDiscount ? 'Searching for Bullish Demand retests' : 'Searching for Bearish Supply retests'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017]">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Active Targets</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                {snapshot.zones.length} Unmitigated POIs
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Entries allowed during full London / NY sessions
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
