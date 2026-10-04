/**
 * TerminalUtilitiesBar.tsx - Compact 50% Reduced Terminal Utilities Bar
 * Features specific, vibrant button colors when turned ON:
 * - Auto Trade: Vivid Emerald Green when ON
 * - Kill Switch: High-Alert Crimson Rose when ARMED
 * - Audio Chime: Electric Cyan/Blue when SOUND ON
 * - Scenarios, Journal, Risk Rules: Distinct interactive accent borders
 * - Sized 50% smaller to preserve viewport space
 */

import React from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { tradingEngine } from '../engine/tradingEngine';
import {
  Shield,
  FileText,
  Smartphone,
  HelpCircle,
  Server,
  Zap,
  Volume2,
  VolumeX,
  PlaySquare,
  AlertOctagon,
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
    <div className="w-full bg-white dark:bg-[#0c0d10] border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3 sm:p-3.5 shadow-xs font-mono text-xs transition-colors space-y-2.5">
      {/* Top Header: Compact Title & Mode Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-2">
        <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-200">
          Terminal Controls & Tools
        </span>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
            isKill
              ? 'bg-rose-500/15 text-rose-500 border-rose-500/40 animate-pulse'
              : isAuto
              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          {isKill ? 'KILL SWITCH ARMED' : isAuto ? 'AUTO-PILOT ACTIVE' : 'MANUAL CONFIRMATION'}
        </span>
      </div>

      {/* Compact 50% Reduced Horizontal Buttons Grid with Specific Colors When Active */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 1. Auto Trade: Vivid Emerald Green When ON */}
        <button
          onClick={() => tradingEngine.toggleAutoTrade()}
          className={`py-1.5 px-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
            isAuto
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Toggle automated SMC trade execution"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className={`w-3.5 h-3.5 shrink-0 ${isAuto ? 'text-white fill-current' : 'text-emerald-500'}`} />
            <span className="font-bold text-[11px] truncate">Auto Trade</span>
          </div>
          <span
            className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
              isAuto ? 'bg-white/20 text-white' : 'text-zinc-400'
            }`}
          >
            {isAuto ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* 2. Emergency Kill Switch: High-Alert Crimson Rose When ARMED */}
        <button
          onClick={onToggleKillSwitchPrompt}
          className={`py-1.5 px-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
            isKill
              ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.45)] animate-pulse'
              : 'bg-slate-50 hover:bg-rose-50 dark:bg-zinc-900 dark:hover:bg-rose-950/20 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Emergency circuit breaker to halt trading and close open orders"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${isKill ? 'text-white' : 'text-rose-500'}`} />
            <span className="font-bold text-[11px] truncate">Kill Switch</span>
          </div>
          <span
            className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
              isKill ? 'bg-white/20 text-white' : 'text-zinc-400'
            }`}
          >
            {isKill ? 'ARMED' : 'SAFE'}
          </span>
        </button>

        {/* 3. Audio Chime: Electric Cyan/Blue When SOUND ON */}
        <button
          onClick={toggleMute}
          className={`py-1.5 px-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
            !isMuted
              ? 'bg-cyan-600 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Toggle signal audio alerts"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-white shrink-0" />
            )}
            <span className="font-bold text-[11px] truncate">Audio</span>
          </div>
          <span
            className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
              !isMuted ? 'bg-white/20 text-white' : 'text-zinc-400'
            }`}
          >
            {isMuted ? 'MUTE' : 'ON'}
          </span>
        </button>

        {/* 4. Scenarios: Blue Accent */}
        <button
          onClick={() => onOpenModal('scenarios')}
          className="py-1.5 px-2.5 rounded-lg border bg-slate-50 hover:bg-blue-50 dark:bg-zinc-900 dark:hover:bg-blue-950/20 border-slate-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600 text-slate-700 dark:text-zinc-300 transition-all cursor-pointer flex items-center justify-between gap-1.5 group"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <PlaySquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-bold text-[11px] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">Scenarios</span>
          </div>
          <span className="text-[9px] font-bold uppercase text-blue-500 bg-blue-500/10 px-1 py-0.2 rounded">SIM</span>
        </button>

        {/* 5. Daily Journal: Amber Accent */}
        <button
          onClick={() => onOpenModal('daily_report')}
          className="py-1.5 px-2.5 rounded-lg border bg-slate-50 hover:bg-amber-50 dark:bg-zinc-900 dark:hover:bg-amber-950/20 border-slate-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600 text-slate-700 dark:text-zinc-300 transition-all cursor-pointer flex items-center justify-between gap-1.5 group"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-bold text-[11px] truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">Journal</span>
          </div>
          <span className="text-[9px] font-bold uppercase text-amber-500 bg-amber-500/10 px-1 py-0.2 rounded">CSV</span>
        </button>

        {/* 6. Risk Rules: Purple Accent */}
        <button
          onClick={() => onOpenModal('settings')}
          className="py-1.5 px-2.5 rounded-lg border bg-slate-50 hover:bg-purple-50 dark:bg-zinc-900 dark:hover:bg-purple-950/20 border-slate-200 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-600 text-slate-700 dark:text-zinc-300 transition-all cursor-pointer flex items-center justify-between gap-1.5 group"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="font-bold text-[11px] truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">Risk Rules</span>
          </div>
          <span className="text-[9px] font-bold uppercase text-purple-500 bg-purple-500/10 px-1 py-0.2 rounded">SAFE</span>
        </button>
      </div>

      {/* Sub-strip: MT5 Center, Mobile PWA, Guide */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenModal('bridge')}
            className="flex items-center gap-1 text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Server className="w-3 h-3 text-emerald-500" />
            <span>MT5 Bridge Center</span>
          </button>

          <span className="text-zinc-300 dark:text-zinc-700">·</span>

          <button
            onClick={() => onOpenModal('phone_pwa')}
            className="flex items-center gap-1 text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Smartphone className="w-3 h-3 text-blue-500" />
            <span>Mobile App</span>
          </button>
        </div>

        <button
          onClick={() => onOpenModal('help')}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3 h-3" />
          <span>SMC Manual</span>
        </button>
      </div>
    </div>
  );
});
