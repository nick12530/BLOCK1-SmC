/**
 * TerminalUtilitiesBar.tsx - Streamlined Executive Utilities Bar
 * PC-Focused, De-cluttered: single-row horizontal strip with distinct active states:
 * - Left: Core safeguards (Auto Trade, Kill Switch, Audio Sound Previewer)
 * - Right: Risk Rules, MT5 Bridge Center, and Telegram Webhook Alerts
 * - Zero phone/mobile bloat
 */

import React, { useState, useRef, useEffect } from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { tradingEngine } from '../engine/tradingEngine';
import { mt5Bridge } from '../engine/mt5Bridge';
import { signalAudioNotifier, SoundType } from '../utils/audioNotification';
import {
  Shield,
  Server,
  Zap,
  Volume2,
  VolumeX,
  AlertOctagon,
  Bell,
  Music2,
  ChevronDown,
} from 'lucide-react';

interface TerminalUtilitiesBarProps {
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'daily_report' | 'tradingview' | 'help' | 'webhook'
  ) => void;
  onToggleKillSwitchPrompt: () => void;
}

export const TerminalUtilitiesBar: React.FC<TerminalUtilitiesBarProps> = React.memo(({
  onOpenModal,
  onToggleKillSwitchPrompt,
}) => {
  const engine = useEngine();
  const { isMuted, toggleMute, hasNewAlert } = useAudioNotifications();
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const soundMenuRef = useRef<HTMLDivElement>(null);

  const isAuto = engine.auto_trade;
  const isKill = engine.kill_switch;
  const isBridgeConnected = Boolean(engine.mt5Account?.connected || mt5Bridge.getStatus().connected);
  const canEnableAutoTrade = isBridgeConnected;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) {
        setShowSoundMenu(false);
      }
    };
    if (showSoundMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSoundMenu]);

  const soundPreviews: { type: SoundType; label: string; desc: string; icon: string }[] = [
    { type: 'vip_telegram', label: '👑 VIP Telegram 100%', desc: 'Prestigious crystal harmonic arpeggio (1.7k->3.5k Hz)', icon: '💎' },
    { type: 'sniper', label: '🎯 Sniper Imminent', desc: 'Urgent 4-tone radar arpeggio (C6->C7)', icon: '⚡' },
    { type: 'signal', label: '🔔 Watchlist Signal', desc: 'Warm gentle crystal bell (E5->G#5)', icon: '🎵' },
    { type: 'trade', label: '⚡ Order Filled', desc: 'Heavy mechanical latch snap + brass punch', icon: '🔨' },
    { type: 'tp_partial', label: '🥈 1.5R Scale-Out', desc: 'Bright silver double ping (1.1k->1.7k Hz)', icon: '✨' },
    { type: 'profit', label: '🏆 Full Take Profit', desc: 'Triumphant major chord celebration', icon: '🎉' },
    { type: 'loss', label: '🛑 Stop Loss Hit', desc: 'Low-frequency double warning buzzer', icon: '⚠️' },
    { type: 'breakeven', label: '🛡️ Breakeven Moved', desc: 'Crisp high-speed metallic double click', icon: '🔒' },
    { type: 'expired', label: '⏳ Signal Expired', desc: 'Soft falling raindrop shut down tone', icon: '💧' },
    { type: 'countdown_urgent', label: '⏱️ Final 15s Radar Ping', desc: 'Subtle high-tech sonar blip (950 Hz)', icon: '⏳' },
  ];

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
          <div>
            <span className="font-bold text-xs block leading-none">Auto {isAuto ? 'ON' : 'OFF'}</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5 leading-none">
              {isAuto ? 'Autonomous' : canEnableAutoTrade ? 'Click to engage' : 'MT5 required'}
            </span>
          </div>
        </button>

        {/* 2. Kill Switch */}
        <button
          onClick={onToggleKillSwitchPrompt}
          aria-pressed={isKill}
          className={`min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 sm:px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isKill
              ? 'bg-rose-700 text-white border-rose-700'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Emergency circuit breaker: halt all automated execution and close orders"
        >
          <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${isKill ? 'text-white' : 'text-rose-500'}`} />
          <div>
            <span className="font-bold text-xs block leading-none">{isKill ? 'Halted' : 'Normal'}</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5 leading-none">
              {isKill ? 'Kill active' : 'Circuit arm'}
            </span>
          </div>
        </button>

        {/* 3. Audio & Sound Menu */}
        <div className="relative" ref={soundMenuRef}>
          <div className="flex items-center">
            <button
              onClick={toggleMute}
              className={`min-h-11 whitespace-nowrap py-2 px-2.5 rounded-l-lg border-y border-l text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isMuted
                  ? 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500'
                  : 'bg-sky-600 text-white border-sky-600'
              }`}
              title="Toggle sound notifications"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-white" />}
              <span>{isMuted ? 'Muted' : 'Sound On'}</span>
              <span className={`h-2 w-2 rounded-full ${hasNewAlert ? 'bg-amber-400' : isMuted ? 'bg-slate-400' : 'bg-emerald-300'}`} />
            </button>

            <button
              onClick={() => setShowSoundMenu(!showSoundMenu)}
              className={`min-h-11 px-2 rounded-r-lg border text-xs transition-colors cursor-pointer flex items-center justify-center ${
                isMuted
                  ? 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-slate-900'
                  : 'bg-sky-700 text-white border-sky-700 hover:bg-sky-800'
              }`}
              title="Audition different sound cues"
            >
              <Music2 className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* Sound Audition Popover */}
          {showSoundMenu && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e14] p-3 shadow-2xl font-mono text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5 text-sky-500" />
                  <span>Distinct Audio Cues</span>
                </span>
                <span className="text-[10px] text-zinc-400">Click to test</span>
              </div>

              <div className="space-y-1">
                {soundPreviews.map((snd) => (
                  <button
                    key={snd.type}
                    type="button"
                    onClick={() => signalAudioNotifier.playTestChime(snd.type)}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {snd.label}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-sans">
                        {snd.desc}
                      </span>
                    </div>
                    <span className="text-xs group-hover:scale-125 transition-transform">
                      {snd.icon}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Clean Analysis, MT5 Center, and Telegram Alerts */}
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
