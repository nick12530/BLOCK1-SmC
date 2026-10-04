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
  const { isMuted, toggleMute } = useAudioNotifications();

  const isAuto = engine.auto_trade;
  const isKill = engine.kill_switch;

  return (
    <div className="w-full bg-white dark:bg-[#0c0d10] border border-slate-200/90 dark:border-zinc-800 rounded-xl p-2.5 sm:p-3 shadow-xs font-mono text-xs transition-colors flex flex-col sm:flex-row items-center justify-between gap-2.5">
      {/* Left: Essential Safeguards & Automation */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* 1. Auto Trade */}
        <button
          onClick={() => tradingEngine.toggleAutoTrade()}
          className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isAuto
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Toggle automated trade execution"
        >
          <Zap className={`w-3.5 h-3.5 shrink-0 ${isAuto ? 'text-white fill-current' : 'text-emerald-500'}`} />
          <span className="font-bold text-[11px]">Auto Trade</span>
          <span className="text-[9px] font-black uppercase opacity-80">{isAuto ? 'ON' : 'OFF'}</span>
        </button>

        {/* 2. Emergency Kill Switch */}
        <button
          onClick={onToggleKillSwitchPrompt}
          className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isKill
              ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.45)] animate-pulse'
              : 'bg-slate-50 hover:bg-rose-50 dark:bg-zinc-900 dark:hover:bg-rose-950/20 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Emergency circuit breaker"
        >
          <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${isKill ? 'text-white' : 'text-rose-500'}`} />
          <span className="font-bold text-[11px]">Kill Switch</span>
          <span className="text-[9px] font-black uppercase opacity-80">{isKill ? 'ARMED' : 'SAFE'}</span>
        </button>

        {/* 3. Audio Chime */}
        <button
          onClick={toggleMute}
          className={`py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
            !isMuted
              ? 'bg-cyan-600 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Toggle audio alerts"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-white" />
          )}
          <span className="font-bold text-[11px] hidden sm:inline">Audio</span>
        </button>
      </div>

      {/* Right: Clean Analysis & System Links */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
        <button
          onClick={() => onOpenModal('scenarios')}
          className="py-1.5 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
        >
          <PlaySquare className="w-3.5 h-3.5 text-blue-500" />
          <span>Scenarios</span>
        </button>

        <button
          onClick={() => onOpenModal('settings')}
          className="py-1.5 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
        >
          <Shield className="w-3.5 h-3.5 text-purple-500" />
          <span>Risk Rules</span>
        </button>

        <button
          onClick={() => onOpenModal('bridge')}
          className="py-1.5 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
        >
          <Server className="w-3.5 h-3.5 text-emerald-500" />
          <span>MT5</span>
        </button>

        <button
          onClick={() => onOpenModal('phone_pwa')}
          className="py-1.5 px-2 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center text-[11px]"
          title="Mobile installation"
        >
          <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>
    </div>
  );
});
