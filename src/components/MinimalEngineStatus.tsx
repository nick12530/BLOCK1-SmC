/**
 * MinimalEngineStatus.tsx - Minimalist Strategy Status & Risk Controls
 * Compact single-line status bar with pure Black, White, and Grey dark mode palette.
 */

import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { ShieldCheck, ChevronDown, ChevronUp, Sliders, Server } from 'lucide-react';

interface MinimalEngineStatusProps {
  snapshot: TerminalSnapshot;
  onOpenBridge: () => void;
  onOpenSettings: () => void;
}

export const MinimalEngineStatus: React.FC<MinimalEngineStatusProps> = ({
  snapshot,
  onOpenBridge,
  onOpenSettings,
}) => {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="bg-white dark:bg-black border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 font-mono text-xs shadow-xs space-y-3 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Status & Active Gates */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Deterministic Risk Gates Active</span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">·</span>

          <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
            Bias: <strong className="text-zinc-950 dark:text-white">{snapshot.bias.toUpperCase()}</strong> · Max DD Gate: <strong className="text-zinc-950 dark:text-white">3.0%</strong>
          </span>
        </div>

        {/* Right: Quick Actions & Rules Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 transition-colors"
          >
            <span>{showRules ? 'Hide Rules' : 'Strategy Rules'}</span>
            {showRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onOpenBridge}
            className="flex items-center gap-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <Server className="w-3.5 h-3.5" />
            <span>MT5 Bridge</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 text-[11px] font-bold text-white bg-zinc-950 dark:bg-white dark:text-black px-2.5 py-1 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Collapsible Rules Details */}
      {showRules && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
            <span className="font-bold text-zinc-900 dark:text-white block">1. HTF BOS / CHoCH Alignment</span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Strict trend filter. Only buys with bullish structure; only sells with bearish structure.</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
            <span className="font-bold text-zinc-900 dark:text-white block">2. ICT Equilibrium Dealing Range</span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Buys strictly in Discount (&lt; 50%); sells strictly in Premium (&gt; 50%).</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
            <span className="font-bold text-zinc-900 dark:text-white block">3. 1.0x ATR Stop Loss Buffer</span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Buffers stops outside random market noise beyond order blocks.</span>
          </div>
        </div>
      )}
    </div>
  );
};
