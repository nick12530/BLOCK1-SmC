/**
 * HeaderView.tsx - De-Cluttered Minimalist Institutional Navbar
 * Clean, breathing, luxury top bar:
 * - Brand & Asset Identity: "GOLD XAUUSD"
 * - Live Market Schedule Pill (Weekend Closed / Live Interbank)
 * - Large, prominent Gold Spot Price ($4,188.50)
 * - MT5 Account status / Link trigger
 * - Crisp Light/Dark Mode Switcher
 * - All secondary buttons moved to page-level Terminal Utilities Bar
 */

import React from 'react';
import { useTicker, useEngine } from '../hooks/useTradingStore';
import {
  Sun,
  Moon,
  Server,
} from 'lucide-react';

interface HeaderViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'scenarios' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa'
  ) => void;
  onToggleKillSwitchPrompt?: () => void;
}

export const HeaderView: React.FC<HeaderViewProps> = React.memo(({
  isDark,
  onToggleTheme,
  onOpenModal,
}) => {
  const ticker = useTicker();
  const engine = useEngine();

  const schedule = engine.marketSchedule;
  const mt5 = engine.mt5Account;

  return (
    <header className="relative w-full border-b border-slate-200/90 dark:border-[#1c212c] bg-white/90 dark:bg-[#11141a]/90 backdrop-blur-md px-4 sm:px-6 py-3 font-mono text-xs sm:text-sm transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Asset, Spot Price & Live Market Status */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Asset Badge */}
          <div className="flex items-center gap-2">
            <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white uppercase font-sans">
              GOLD
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161b23] text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-[#222938]">
              XAUUSD
            </span>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-[#222938] hidden sm:block" />

          {/* Real-Time Spot Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
              ${ticker.bid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 tabular-nums hidden md:inline">
              ({ticker.spread} pts)
            </span>
          </div>

          {/* Market Status Pill */}
          {schedule && !schedule.isOpen ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Weekend Closed</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Interbank</span>
            </span>
          )}
        </div>

        {/* Right: Clean, Uncrowded Action Cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* MT5 Account Linker Button */}
          <button
            onClick={() => onOpenModal('bridge')}
            title="MetaTrader 5 Bridge Status"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              mt5?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#161b23] dark:hover:bg-[#1f2633] border-slate-200 dark:border-[#222938] text-slate-800 dark:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4 text-emerald-500" />
            {mt5?.connected ? (
              <span className="hidden sm:inline">MT5: #{mt5.login}</span>
            ) : (
              <span>Link MT5</span>
            )}
          </button>

          {/* Account Balance Badge */}
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#161b23] border border-slate-200 dark:border-[#222938] text-xs hidden sm:flex items-center gap-1.5">
            <span className="text-slate-400">Equity:</span>
            <strong className="text-slate-900 dark:text-white tabular-nums">
              ${ticker.equity.toFixed(2)}
            </strong>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle light or dark theme"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#161b23] dark:hover:bg-[#1f2633] border border-slate-200 dark:border-[#222938] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
});
