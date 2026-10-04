/**
 * WeekendMarketBanner.tsx - Sleek Monochromatic Market Schedule Indicator
 * Low-profile, integrated status ribbon:
 * - Pure grey, white, and black monochromatic styling (no loud amber banner)
 * - Concise interbank holding quote and reopen countdown
 * - Compact discreet testing toggle
 */

import React from 'react';
import { useEngine, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { Clock, Play, Pause } from 'lucide-react';

interface WeekendMarketBannerProps {
  onOpenMt5Modal?: () => void;
}

export const WeekendMarketBanner: React.FC<WeekendMarketBannerProps> = React.memo(() => {
  const engine = useEngine();
  const ticker = useTicker();

  const schedule = engine.marketSchedule;
  const isWeekendSim = engine.simulateWeekendMode;

  // Only render if market is closed or simulation is enabled
  if (!schedule || (schedule.isOpen && !isWeekendSim)) {
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
          Holding @ ${ticker.bid.toFixed(2)} · Re-opens {schedule.timeUntilOpenFormatted} (Sun 22:00 UTC)
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => tradingEngine.toggleSimulateWeekend()}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
            isWeekendSim
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-700'
              : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:text-slate-950 dark:hover:text-white'
          }`}
          title={isWeekendSim ? 'Disable weekend simulation' : 'Test order execution during weekend'}
        >
          {isWeekendSim ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
          <span>{isWeekendSim ? 'Sim Active' : 'Sim Mode'}</span>
        </button>
      </div>
    </div>
  );
});
