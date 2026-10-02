/**
 * FooterView.tsx - Dedicated Minimalist Institutional Footer Bar
 * Houses secondary actions: Help Centre, Phone App (PWA), MT5 Bridge,
 * Daily Performance Report, Risk Settings, and Sound Alerts.
 * Palette: Pure Black, White, and Grey in dark mode.
 */

import React from 'react';
import { useEngine, useTicker } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import {
  Smartphone,
  HelpCircle,
  FileText,
  Sliders,
  Server,
  Volume2,
  VolumeX,
  Clock,
} from 'lucide-react';

interface FooterViewProps {
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'scenarios' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa'
  ) => void;
}

export const FooterView: React.FC<FooterViewProps> = React.memo(({ onOpenModal }) => {
  const engine = useEngine();
  const ticker = useTicker();
  const { isMuted, toggleMute } = useAudioNotifications();

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-4 sm:px-6 py-3 font-mono text-xs transition-colors mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-zinc-500 dark:text-zinc-400">
        {/* Left: Session Status & Latency */}
        <div className="flex items-center gap-3 text-[11px] flex-wrap justify-center md:justify-start">
          <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{engine.session.activeSessionName || 'Institutional Session'}</span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700">·</span>

          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>{engine.session.currentUtcTime} UTC</span>
          </span>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">·</span>

          <span className="text-zinc-400 hidden sm:inline">
            Spread: <strong className="text-zinc-800 dark:text-zinc-200">{ticker.spread} pts</strong>
          </span>
        </div>

        {/* Right: Consolidated Tool Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center md:justify-end">
          {/* Save as App on Phone (PWA) */}
          <button
            onClick={() => onOpenModal('phone_pwa')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 font-bold transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Save as App</span>
          </button>

          {/* Help Centre */}
          <button
            onClick={() => onOpenModal('help')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 font-bold transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help Centre</span>
          </button>

          {/* Daily Report */}
          <button
            onClick={() => onOpenModal('daily_report')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report</span>
          </button>

          {/* MT5 Bridge */}
          <button
            onClick={() => onOpenModal('bridge')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <Server className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MT5 Bridge</span>
          </button>

          {/* Risk Settings */}
          <button
            onClick={() => onOpenModal('settings')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Audio Chime Mute */}
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-500" />}
          </button>
        </div>
      </div>
    </footer>
  );
});
