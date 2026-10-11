/**
 * WeekendMarketBanner.tsx - Sleek Monochromatic Market Schedule Indicator
 * Low-profile, integrated status ribbon:
 * - Pure grey, white, and black monochromatic styling (no loud amber banner)
 * - Concise interbank holding quote and reopen countdown
 * - Compact discreet testing toggle
 */

import React, { useState } from 'react';
import { useMarketOpenCountdown } from '../engine/marketHours';
import { Clock, ShieldAlert, Play, Check } from 'lucide-react';
import { tradingEngine } from '../engine/tradingEngine';

interface WeekendMarketBannerProps {
  onOpenMt5Modal?: () => void;
}

export const WeekendMarketBanner: React.FC<WeekendMarketBannerProps> = React.memo(() => {
  const schedule = useMarketOpenCountdown();
  const [isSimulating, setIsSimulating] = useState(() => tradingEngine.simulateWeekendMode);

  if (!schedule || schedule.isOpen) {
    return null;
  }

  const handleToggleSimulation = () => {
    const next = tradingEngine.toggleSimulateWeekend();
    setIsSimulating(next);
  };

  return (
    <div className="w-full bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 dark:border-amber-500/20 rounded-xl px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono text-amber-900 dark:text-amber-200 transition-colors flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
          <span>Interbank Market Paused</span>
        </span>
        <span className="font-semibold text-slate-800 dark:text-zinc-200">
          Gold Interbank Opens In: <strong className="text-amber-700 dark:text-amber-300 font-mono text-xs sm:text-sm tracking-tight">{schedule.liveCountdownText}</strong>
        </span>
        <span className="text-[11px] text-slate-600 dark:text-zinc-400 hidden md:inline">
          ({schedule.reopenTimeFormatted})
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
        <button
          onClick={handleToggleSimulation}
          className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
            isSimulating
              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border-amber-500/30'
          }`}
          title="Allow synthetic tick progression and strategy simulation while interbank markets are closed"
        >
          {isSimulating ? <Check className="w-3 h-3 text-emerald-500" /> : <Play className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
          <span>{isSimulating ? 'Weekend Sim Active' : 'Test Execution (Sim)'}</span>
        </button>
        <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 hidden lg:block">
          Sydney Open Next
        </div>
      </div>
    </div>
  );
});
