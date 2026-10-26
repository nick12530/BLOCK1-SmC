/**
 * WeekendMarketBanner.tsx - Sleek Monochromatic Market Schedule Indicator
 * Low-profile, integrated status ribbon:
 * - Pure grey, white, and black monochromatic styling (no loud amber banner)
 * - Concise interbank holding quote and reopen countdown
 * - Compact discreet testing toggle
 */

import React from 'react';
import { useMarketOpenCountdown } from '../engine/marketHours';
import { Clock } from 'lucide-react';

export const WeekendMarketBanner: React.FC = React.memo(() => {
  const schedule = useMarketOpenCountdown();

  if (!schedule || schedule.isOpen) {
    return null;
  }

  return (
    <div className="neo-panel w-full border rounded-xl px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono text-slate-700 dark:text-slate-200 transition-colors flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300">
          <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Interbank Market Paused</span>
        </span>
        <span className="font-semibold text-slate-800 dark:text-zinc-200">
          Gold Interbank Opens In: <strong className="text-sky-700 dark:text-sky-300 font-mono text-xs sm:text-sm tracking-tight">{schedule.liveCountdownText}</strong>
        </span>
        <span className="text-[11px] text-slate-600 dark:text-zinc-400 hidden md:inline">
          ({schedule.reopenTimeFormatted})
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300">
          Signals require live broker data
        </span>
        <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-500/10 text-slate-600 dark:text-slate-300 hidden lg:block">
          Sydney Open Next
        </div>
      </div>
    </div>
  );
});
