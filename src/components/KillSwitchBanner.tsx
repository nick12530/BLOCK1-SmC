/**
 * KillSwitchBanner.tsx - Persistent full-width red banner when Kill Switch is armed
 * Rendered OUTSIDE the ErrorBoundary so it remains visible even if UI crashes.
 */

import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useEngine } from '../hooks/useTradingStore';

export const KillSwitchBanner: React.FC = () => {
  const engine = useEngine();
  const [dismissed, setDismissed] = useState(false);

  if (!engine.kill_switch || dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="w-full bg-red-600 text-white font-mono text-xs px-4 py-2.5 flex items-center justify-between shadow-md transition-all z-50 sticky top-0"
    >
      <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
        <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
        <span className="font-bold tracking-tight">
          KILL SWITCH ARMED: Automated execution and manual trades are BLOCKED. All open positions were closed.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        title="Dismiss banner for this session"
        className="p-1 rounded-lg hover:bg-red-700 text-white/80 hover:text-white transition-colors ml-2"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
