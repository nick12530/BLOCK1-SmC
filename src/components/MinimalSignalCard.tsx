import React from 'react';
import { TerminalSnapshot } from '../types/smc';
import { Target, CheckCircle2, ArrowRight, Shield, Zap, Sparkles } from 'lucide-react';

interface MinimalSignalCardProps {
  snapshot: TerminalSnapshot;
  onTradeSignal: () => void;
}

export const MinimalSignalCard: React.FC<MinimalSignalCardProps> = ({
  snapshot,
  onTradeSignal,
}) => {
  const sig = snapshot.signal;

  if (!sig) {
    return (
      <div className="luxury-card rounded-2xl p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Target className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0f1118]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  SMC Confluence Engine Active
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold">
                  Background Scanning
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                Analyzing H1 market structure, order block mitigation, and discount/premium dealing ranges. High-conviction setups (Score ≥ 4.0) surface here instantly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Structure</span>
              <strong className="text-slate-900 dark:text-white font-semibold">{snapshot.bias.toUpperCase()}</strong>
            </div>
            <div className="h-6 w-px bg-black/[0.06] dark:bg-white/[0.08]" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Dealing Range</span>
              <strong className="text-slate-900 dark:text-white font-semibold">
                {snapshot.price_pos !== null ? (snapshot.price_pos < 0.5 ? 'DISCOUNT' : 'PREMIUM') : 'EQ'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isBuy = sig.direction === 'BUY';

  return (
    <div
      className={`luxury-card rounded-2xl p-6 sm:p-7 relative overflow-hidden transition-all ${
        isBuy
          ? 'border-emerald-500/40 shadow-[0_4px_30px_rgba(16,185,129,0.1)] bg-gradient-to-r from-emerald-500/[0.04] via-transparent to-transparent'
          : 'border-rose-500/40 shadow-[0_4px_30px_rgba(244,63,94,0.1)] bg-gradient-to-r from-rose-500/[0.04] via-transparent to-transparent'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Direction & Confluence Score */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase ${
                isBuy
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
              }`}
            >
              VALID SMC SIGNAL
            </span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Confluence: {sig.score} / 5.0
            </span>
            <span className="text-[11px] font-mono text-slate-400">· ATR {sig.atr}</span>
          </div>

          <div className="flex items-baseline gap-3">
            <h2
              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {sig.direction} GOLD
            </h2>
            <span className="text-sm font-mono text-slate-500 dark:text-slate-400">
              @ ${sig.entry.toFixed(2)}
            </span>
          </div>

          {/* Confluence Factor Tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-mono pt-1">
            {sig.reasons.slice(0, 3).map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{r}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Center: Target Grid (Entry / SL / TP) */}
        <div className="grid grid-cols-3 gap-4 bg-black/[0.02] dark:bg-white/[0.03] p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08] font-mono text-center">
          <div>
            <div className="text-[10px] tracking-wider text-slate-400 uppercase font-semibold">Entry</div>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
              ${sig.entry.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-wider text-slate-400 uppercase font-semibold">Stop Loss</div>
            <div className="text-base font-bold text-rose-500 tabular-nums mt-0.5">
              ${sig.sl.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-wider text-slate-400 uppercase font-semibold">Target (TP)</div>
            <div className="text-base font-bold text-emerald-500 tabular-nums mt-0.5">
              ${sig.tp.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Right: 1-Click Action Button */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={onTradeSignal}
            className={`w-full sm:w-auto px-7 py-4 rounded-xl font-bold font-mono text-sm tracking-wide transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 text-white ${
              isBuy
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25'
            }`}
          >
            <span>Execute {sig.direction} (0.05L)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
