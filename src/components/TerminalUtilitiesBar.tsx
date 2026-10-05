/**
 * TerminalUtilitiesBar.tsx - Streamlined Executive Utilities Bar
 * De-cluttered: single-row horizontal strip with distinct active states:
 * - Left: Core safeguards (Auto Trade, Kill Switch, Audio Chime)
 * - Right: Terminal analysis tools (Scenarios, Risk Rules, MT5 Center)
 * - Eliminates redundant sub-rows and oversized cards
 */

import React from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { tradingEngine } from '../engine/tradingEngine';
import {
  Shield,
  Server,
  Zap,
  Volume2,
  VolumeX,
  PlaySquare,
  AlertOctagon,
  Smartphone,
} from 'lucide-react';

interface TerminalUtilitiesBarProps {
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'scenarios' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa'
  ) => void;
  onToggleKillSwitchPrompt: () => void;
}

export const TerminalUtilitiesBar: React.FC<TerminalUtilitiesBarProps> = React.memo(({
  onOpenModal,
  onToggleKillSwitchPrompt,
}) => {
  const engine = useEngine();
  const { isMuted, toggleMute, hasNewAlert } = useAudioNotifications();

  const isAuto = engine.auto_trade;
  const isKill = engine.kill_switch;

  return (
    <div className="w-full bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-2xl p-3 sm:p-4 shadow-xs font-mono text-xs transition-colors flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      {/* Left: Essential Safeguards & Automation */}
      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto">
        {/* 1. Auto Trade */}
        <button
          onClick={() => tradingEngine.toggleAutoTrade()}
          aria-pressed={isAuto}
          className={`min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 sm:px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isAuto
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Toggle automated trade execution"
        >
          <Zap className={`w-3.5 h-3.5 shrink-0 ${isAuto ? 'text-white fill-current' : 'text-emerald-500'}`} />
          <span className="font-bold text-xs">Auto Trade</span>
          <span className="text-[11px] font-black uppercase opacity-80">{isAuto ? 'ON' : 'OFF'}</span>
        </button>

        {/* 2. Emergency Kill Switch */}
        <button
          onClick={onToggleKillSwitchPrompt}
          aria-pressed={isKill}
          className={`min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 sm:px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isKill
              ? 'bg-rose-700 text-white border-rose-700'
              : 'bg-slate-50 hover:bg-rose-50 dark:bg-zinc-900 dark:hover:bg-rose-950/20 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Emergency circuit breaker"
        >
          <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${isKill ? 'text-white' : 'text-rose-500'}`} />
          <span className="font-bold text-xs">Kill Switch</span>
          <span className="text-[11px] font-black uppercase opacity-80">{isKill ? 'ARMED' : 'SAFE'}</span>
        </button>

        {/* 3. Audio Chime */}
        <button
          onClick={toggleMute}
          aria-pressed={!isMuted}
          className={`col-span-2 min-h-11 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 lg:col-span-1 ${
            !isMuted
              ? 'bg-sky-600 text-white border-sky-600 dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Toggle audio alerts"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-zinc-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
          <span className="font-bold text-xs">{isMuted ? 'Sound off' : 'Sound on'}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${hasNewAlert ? 'bg-amber-400' : isMuted ? 'bg-slate-400' : 'bg-sky-200'}`} />
        </button>
      </div>

      {/* Right: Clean Analysis & System Links */}
      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:justify-end">
        <button
          onClick={() => onOpenModal('scenarios')}
          className="min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold"
        >
          <PlaySquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Scenarios</span>
        </button>

        <button
          onClick={() => onOpenModal('settings')}
          className="min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold"
        >
          <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Risk Rules</span>
        </button>

        <button
          onClick={() => onOpenModal('bridge')}
          className="min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold"
        >
          <Server className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>MT5</span>
        </button>

        <button
          onClick={() => onOpenModal('phone_pwa')}
          className="min-h-11 min-w-11 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center text-xs"
          title="Mobile installation"
          aria-label="Open phone app installation guide"
        >
          <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span className="lg:hidden">Phone app</span>
        </button>
      </div>
    </div>
  );
});
