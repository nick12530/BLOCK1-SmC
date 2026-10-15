/**
 * KillSwitchBanner.tsx - Persistent full-width red banner when Kill Switch is armed
 * Rendered OUTSIDE the ErrorBoundary so it remains visible even if UI crashes.
 */

import React, { useState } from 'react';
import { ShieldAlert, X, Unlock } from 'lucide-react';
import { useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';

export const KillSwitchBanner: React.FC = () => {
  const engine = useEngine();
  const [dismissed, setDismissed] = useState(false);

  if (!engine.kill_switch || dismissed) {
    return null;
  }

  const handleDisarm = () => {
    tradingEngine.toggleKillSwitch();
  };

  return (
    <div
      role="alert"
      className="w-full bg-red-600 text-white font-mono text-xs px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shadow-md transition-all z-50 sticky top-0 flex-wrap gap-2"
    >
      <div className="flex items-center gap-2 max-w-5xl">
        <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
        <span className="font-bold tracking-tight">
          KILL SWITCH ARMED: Automated execution and trades are BLOCKED.
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleDisarm}
          className="px-3 py-1 bg-white text-red-700 hover:bg-red-50 font-black rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1 active:scale-95"
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>Disarm Kill Switch</span>
        </button>

        <button
          onClick={() => setDismissed(true)}
          title="Dismiss banner for this session"
          className="p-1 rounded-lg hover:bg-red-700 text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
