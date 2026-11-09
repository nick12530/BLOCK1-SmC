/**
2:  * TerminalUtilitiesBar.tsx - Streamlined Executive Utilities Strip
3:  * De-cluttered: quiet, single-line horizontal strip with clear controls:
4:  * - Emergency Kill Switch toggle with clear state
5:  * - Circuit breaker status indicator
6:  * - Audio Chime toggle
7:  * - Compact sound preview
8:  */

import React, { useState } from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { tradingEngine } from '../engine/tradingEngine';
import {
  Volume2,
  VolumeX,
  AlertOctagon,
  ShieldAlert,
  Play,
} from 'lucide-react';

interface TerminalUtilitiesBarProps {
  onToggleKillSwitchPrompt: () => void;
}

type PreviewSound = 'signal' | 'trade' | 'precision' | 'profit' | 'loss';

export const TerminalUtilitiesBar: React.FC<TerminalUtilitiesBarProps> = React.memo(({
  onToggleKillSwitchPrompt,
}) => {
  const engine = useEngine();
  const { isMuted, toggleMute, playTestSound } = useAudioNotifications();
  const [previewSound, setPreviewSound] = useState<PreviewSound>('precision');

  const isKill = engine.kill_switch;

  return (
    <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl px-3.5 py-2 bg-white dark:bg-[#121917] font-mono text-xs transition-colors flex flex-wrap items-center justify-between gap-2.5">
      {/* Left: Emergency safeguards */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Emergency Kill Switch */}
        <button
          onClick={onToggleKillSwitchPrompt}
          aria-pressed={isKill}
          className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            isKill
              ? 'bg-rose-700 text-white border-rose-700'
              : 'bg-slate-50 hover:bg-rose-50/50 dark:bg-[#0f1513] dark:hover:bg-rose-950/20 border-slate-200 dark:border-[#222d29] text-slate-700 dark:text-slate-300'
          }`}
          title="Emergency kill switch"
        >
          <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${isKill ? 'text-white' : 'text-rose-500'}`} />
          <span>Kill Switch:</span>
          <span className={`text-[10px] font-black uppercase ${isKill ? 'text-white' : 'text-slate-500'}`}>{isKill ? 'ARMED' : 'SAFE'}</span>
        </button>

        {/* Daily-Loss Circuit Breaker */}
        <button
          onClick={() => void tradingEngine.toggleCircuitBreaker()}
          aria-pressed={engine.circuit_breaker_enabled}
          className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            engine.circuit_breaker_enabled
              ? 'bg-slate-50 hover:bg-emerald-50/40 dark:bg-[#0f1513] dark:hover:bg-emerald-950/20 border-slate-200 dark:border-[#222d29] text-slate-700 dark:text-slate-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
          }`}
          title={
            engine.circuit_breaker_enabled
              ? 'Daily-loss Circuit Breaker is active (stops trades at 3% loss).'
              : 'Daily-loss Circuit Breaker is OFF (lockout bypassed).'
          }
        >
          <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${engine.circuit_breaker_enabled ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span>Circuit Breaker:</span>
          <span className={`text-[10px] font-black uppercase px-1 rounded ${
            engine.circuit_breaker_enabled
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}>
            {engine.circuit_breaker_enabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Right: Sound Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={toggleMute}
          aria-pressed={!isMuted}
          className={`py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
            !isMuted
              ? 'bg-slate-100 dark:bg-[#0f1513] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-[#222d29]'
              : 'bg-slate-50 dark:bg-[#0f1513] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-[#222d29]'
          }`}
          title="Toggle audio alerts"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span>{isMuted ? 'Muted' : 'Audio On'}</span>
        </button>

        <div className="flex items-center gap-1 border border-slate-200 dark:border-[#222d29] rounded-lg px-2 py-1 bg-slate-50 dark:bg-[#0f1513]">
          <select
            value={previewSound}
            onChange={(e) => setPreviewSound(e.target.value as PreviewSound)}
            aria-label="Select chime sound preview"
            className="bg-transparent text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
          >
            <option value="precision" className="bg-white dark:bg-zinc-900">Precision</option>
            <option value="signal" className="bg-white dark:bg-zinc-900">Signal</option>
            <option value="trade" className="bg-white dark:bg-zinc-900">Trade</option>
            <option value="profit" className="bg-white dark:bg-zinc-900">Profit</option>
            <option value="loss" className="bg-white dark:bg-zinc-900">Loss</option>
          </select>
          <button
            type="button"
            onClick={() => playTestSound(previewSound)}
            aria-label={`Test ${previewSound} sound`}
            className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
});
