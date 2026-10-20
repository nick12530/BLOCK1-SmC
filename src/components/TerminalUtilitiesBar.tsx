/**
 * TerminalUtilitiesBar.tsx - Streamlined Executive Utilities Bar
 * De-cluttered: single-row horizontal strip with distinct active states:
 * - Left: Core safeguards (Auto Trade, Kill Switch, Audio Chime)
 * - Right: Risk Rules and MT5 Center
 * - Eliminates redundant sub-rows and oversized cards
 */

import React, { useEffect, useState } from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { tradingEngine } from '../engine/tradingEngine';
import { mt5Bridge } from '../engine/mt5Bridge';
import {
  Shield,
  Server,
  Zap,
  Volume2,
  VolumeX,
  AlertOctagon,
  Smartphone,
  Bell,
} from 'lucide-react';

interface TerminalUtilitiesBarProps {
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa' | 'webhook'
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
  const isBridgeConnected = Boolean(engine.mt5Account?.connected || mt5Bridge.getStatus().connected);
  const canEnableAutoTrade = isBridgeConnected;

  return (
    <div className="w-full bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-2xl p-3 sm:p-4 shadow-xs font-mono text-xs transition-colors flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      {/* Left: Essential Safeguards & Automation */}
      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto">
        {/* 1. Auto Trade */}
        <button
          onClick={() => tradingEngine.toggleAutoTrade()}
          disabled={!isAuto && !canEnableAutoTrade}
          aria-pressed={isAuto}
          className={`min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 sm:px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isAuto
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title={canEnableAutoTrade ? 'Toggle automated broker order execution' : 'Connect the intended MT5 account before enabling auto-trade'}
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
          } disabled:cursor-not-allowed disabled:opacity-60`}
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
          onClick={() => onOpenModal('settings')}
          className="min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold"
        >
          <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Risk Rules</span>
        </button>

        <button
          onClick={() => onOpenModal('bridge')}
          className={`min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold ${
            engine.mt5Account?.connected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Connect or configure MetaTrader 5 Bridge"
        >
          <Server className={`w-4 h-4 ${engine.mt5Account?.connected ? 'text-emerald-500' : 'text-sky-600 dark:text-sky-400'}`} />
          <span>{engine.mt5Account?.connected ? `MT5 #${engine.mt5Account.login}` : 'MT5 Bridge'}</span>
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

        <button
          onClick={() => onOpenModal('webhook')}
          className="min-h-11 min-w-11 rounded-lg border bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer flex items-center justify-center text-xs"
          title="Instant Telegram Push Alerts & External Webhooks"
          aria-label="Configure Telegram and Webhook Alerts"
        >
          <Bell className="w-4 h-4 text-amber-500" />
          <span className="lg:hidden ml-1 font-bold">Alerts</span>
        </button>
      </div>
    </div>
  );
});
