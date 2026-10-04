/**
 * FooterView.tsx - Clean Minimalist Terminal Footer
 * Focused purely on system status, interbank connectivity, and server telemetry.
 * All tool triggers are cleanly distributed into the scrollable body.
 */

import React from 'react';
import { useEngine, useTicker } from '../hooks/useTradingStore';
import { ShieldCheck, Activity } from 'lucide-react';

export const FooterView: React.FC = React.memo(() => {
  const engine = useEngine();
  const ticker = useTicker();

  return (
    <footer className="border-t border-slate-200 dark:border-[#1c212c] bg-white dark:bg-[#11141a] px-4 sm:px-6 py-3 font-mono text-xs transition-colors mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-slate-500 dark:text-slate-400">
        {/* Left: Active Session & Interbank Status */}
        <div className="flex items-center gap-2.5 text-[11px] flex-wrap justify-center sm:justify-start">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{engine.session.activeSessionName || 'Institutional Session'}</span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">·</span>

          <span>{engine.session.currentUtcTime} UTC</span>

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>

          <span className="hidden sm:inline">
            Spread: <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{ticker.spread} pts</strong>
          </span>
        </div>

        {/* Right: Security & Terminal Readiness */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>SMC Institutional Execution Engine · Multi-Broker Bridge Ready</span>
        </div>
      </div>
    </footer>
  );
});
