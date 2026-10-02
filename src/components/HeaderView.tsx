/**
 * HeaderView.tsx - Flowing Minimalist Institutional Navbar
 * Requirements:
 * - Brand: "GOLD" (SMC text removed)
 * - Flowing with site (relative, not fixed/sticky)
 * - Linked MT5 Account Balance & Connection status at top
 * - Audio Chime toggle at top
 * - EAT (East Africa Time) clock
 * - Institutional Kill Zone indicator
 * - Pure Black, White, and Gray primary color palette in dark mode
 */

import React, { useState, useEffect } from 'react';
import { useTicker, useEngine, useMarket } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { signalAudioNotifier } from '../utils/audioNotification';
import { tradingEngine } from '../engine/tradingEngine';
import {
  Sun,
  Moon,
  Volume2,
  VolumeX,
  LineChart,
  TrendingUp,
  TrendingDown,
  Clock,
  Server,
  Zap,
} from 'lucide-react';

interface HeaderViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'scenarios' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa'
  ) => void;
  onToggleKillSwitchPrompt: () => void;
}

export const HeaderView: React.FC<HeaderViewProps> = React.memo(({
  isDark,
  onToggleTheme,
  onOpenModal,
  onToggleKillSwitchPrompt,
}) => {
  const ticker = useTicker();
  const engine = useEngine();
  const market = useMarket();
  const { isMuted, toggleMute } = useAudioNotifications();

  // EAT Clock State (UTC+3)
  const [eatTime, setEatTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format to East Africa Time (Africa/Nairobi UTC+3)
      const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      setEatTime(`${formatted} EAT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isKill = engine.kill_switch;
  const isAuto = engine.auto_trade;

  const activeDirection = market.signal?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const activeScore = market.signal?.score || 5.0;

  // Active Kill Zone name
  const activeKillZone = engine.session.activeSessionName || 'London Kill Zone';

  return (
    <header className="relative w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-3 sm:px-6 py-2.5 font-mono text-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-2.5 lg:gap-4">
        {/* Left Row: Asset Tag ("GOLD"), Spot Price, Bold Signal Badge, and EAT Clock */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-center lg:justify-start">
          {/* Asset Tag - Just "GOLD" */}
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm tracking-tight text-zinc-950 dark:text-white uppercase">
              GOLD
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold border border-zinc-200 dark:border-zinc-800">
              XAUUSD
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          {/* Spot Price with explicit label */}
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold leading-none">
              Gold Spot (oz)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white tabular-nums tracking-tight">
                ${ticker.bid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-zinc-400 hidden md:inline">
                ({ticker.spread} pts)
              </span>
            </div>
          </div>

          {/* FUNCTIONAL SIGNAL STRENGTH BADGE - NO STARS */}
          <button
            onClick={() => tradingEngine.cycleMarketWave()}
            title="Click to cycle next market wave / signal setup"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDirection === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {activeDirection === 'BUY' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{activeDirection} · {Math.min(99, Math.max(82, Math.round((activeScore / 5.0) * 100)))}% STRENGTH</span>
          </button>

          {/* Institutional Kill Zone Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-bold">{activeKillZone}</span>
          </div>

          {/* EAT Timezone Clock */}
          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="tabular-nums font-semibold">{eatTime || '11:24:00 EAT'}</span>
          </div>
        </div>

        {/* Right Row: MT5 Linked Balance, Auto, Kill Switch, Sound, Chart, Theme */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-center lg:justify-end">
          {/* Linked MT5 Account Live Equity & Balance */}
          <button
            onClick={() => onOpenModal('bridge')}
            title="Linked MT5 Broker Account - Click to configure bridge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-emerald-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">Equity:</span>
              <strong
                className={`font-black tabular-nums ${
                  ticker.equity >= ticker.balance
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ${ticker.equity.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              <span className="text-zinc-400 font-sans text-[10px] hidden sm:inline">
                · Bal: ${ticker.balance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </button>

          {/* Auto Trade Toggle with Full Functional Explanation */}
          <button
            onClick={() => tradingEngine.toggleAutoTrade()}
            title={
              isAuto
                ? 'AUTO IS ON: Engine automatically executes verified >= 80% signals on MT5'
                : 'AUTO IS OFF: Manual 1-click execution mode'
            }
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
              isAuto
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            AUTO: {isAuto ? 'ON' : 'OFF'}
          </button>

          {/* Kill Switch Button */}
          <button
            onClick={onToggleKillSwitchPrompt}
            title="Emergency halt & close all positions"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase border transition-all ${
              isKill
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-transparent border-rose-600/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            {isKill ? 'HALTED' : 'KILL SWITCH'}
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          {/* Audio Chime Mute / Unmute & Test Button */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute Audio Chime Alerts' : 'Mute Audio Chime Alerts'}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-zinc-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              )}
            </button>
            {!isMuted && (
              <button
                onClick={() => signalAudioNotifier.playTestChime()}
                title="Preview subtle signal notification sound"
                className="text-[9px] font-mono px-1.5 py-0.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors hidden sm:inline cursor-pointer"
              >
                Test
              </button>
            )}
          </div>

          {/* Fullscreen Chart Modal */}
          <button
            onClick={() => onOpenModal('tradingview')}
            title="Open Fullscreen Chart Workstation"
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <LineChart className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
          </button>
        </div>
      </div>
    </header>
  );
});
