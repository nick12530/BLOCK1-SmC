/**
 * CompoundingLadderCard.tsx - Streamlined Institutional Compounding Strip
 * Clean, uncluttered single-row accelerator:
 * - Zero glowing effects, no neon buttons, no pulsing animations
 * - Concise progress from $10 to $25 with safe 0.01 lot calibration
 * - Crisp matte Auto-BE Lock toggle
 */

import React from 'react';
import { useEngine, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { ShieldCheck } from 'lucide-react';

interface CompoundingLadderCardProps {
  onSelectLotSize?: (lot: number) => void;
}

export const CompoundingLadderCard: React.FC<CompoundingLadderCardProps> = React.memo(({ onSelectLotSize }) => {
  const engine = useEngine();
  const ticker = useTicker();

  const stage = engine.compoundingStage || tradingEngine.getCompoundingStage(ticker.balance);
  const isAutoBe = engine.auto_be_enabled;

  return (
    <div className="w-full min-w-0 bg-white dark:bg-[#0d1823] border border-slate-200 dark:border-[#1a3040] shadow-xs dark:shadow-none rounded-xl px-3.5 py-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono transition-colors">
      {/* Left: Current Stage & Progress Bar */}
      <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
        <span className="font-black px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 uppercase tracking-wider text-[11px]">
          Stage {stage.stage}: {stage.name.replace(/Stage \d+:\s*/, '')}
        </span>

        <span className="text-zinc-500 font-semibold text-xs">
          ${stage.minBal} → ${stage.maxBal}
        </span>

        <div className="flex items-center gap-1.5">
          <div className="w-20 sm:w-28 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-600 dark:bg-sky-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, stage.progressPct)}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
            {stage.progressPct}%
          </span>
        </div>
      </div>

      {/* Center: Recommended Volume & Target Per Trade */}
      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap justify-center">
        <span>
          Optimal Vol: <strong className="text-zinc-950 dark:text-white font-bold">{stage.recommendedLot} Lots</strong>
        </span>
        <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">·</span>
        <span>
          Target: <strong className="text-zinc-950 dark:text-white font-bold">{stage.targetPnlPerTrade}</strong>
        </span>
      </div>

      {/* Right: Clean Matte Auto-BE Lock Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => tradingEngine.toggleAutoBe()}
          aria-pressed={isAutoBe}
          title="Toggle Automated Zero-Risk Break-Even Lock at 1:1 RR"
          className={`flex min-h-11 items-center gap-1.5 px-3 rounded-lg text-xs font-bold transition-colors border cursor-pointer ${
            isAutoBe
              ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 border-sky-600 dark:border-sky-500'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Auto-BE: {isAutoBe ? 'ARMED' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
});
