/**
 * WeekendMarketBanner.tsx - Sleek Monochromatic Market Schedule Indicator
 * Low-profile, integrated status ribbon:
 * - Pure grey, white, and black monochromatic styling (no loud amber banner)
 * - Concise interbank holding quote and reopen countdown
 * - Compact discreet testing toggle
 */

import React from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { Clock } from 'lucide-react';

interface WeekendMarketBannerProps {
  onOpenMt5Modal?: () => void;
}

export const WeekendMarketBanner: React.FC<WeekendMarketBannerProps> = React.memo(() => {
  const engine = useEngine();
  const schedule = engine.marketSchedule;

  if (!schedule || schedule.isOpen) {
    return null;
  }

  return (
    <div className="w-full bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-zinc-800/80 rounded-lg px-3 py-1.5 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-600 dark:text-zinc-400 transition-colors">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span>Weekend Pause</span>
        </span>
        <span className="text-slate-700 dark:text-zinc-300">
          MT5 quotes may be stale while the market is closed · Re-opens {schedule.timeUntilOpenFormatted} (Sun 22:00 UTC)
        </span>
      </div>
    </div>
  );
});
