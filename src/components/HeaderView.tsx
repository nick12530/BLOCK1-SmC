/**
 * HeaderView.tsx - MT5 Institutional Account Telemetry Header
 * Replaced Gold Spot Price with real-time MT5 Account Capital metrics:
 * - Balance: Live cash balance
 * - Equity: Floating equity reflecting open trades
 * - Free Margin: Available capital for execution
 * - Margin Level: Safety buffer %
 * - MT5 Connection status & Theme toggle
 */

import React, { useMemo } from 'react';
import { useTicker, useEngine, usePositions } from '../hooks/useTradingStore';
import {
  Sun,
  Moon,
  Server,
  Wallet,
  ShieldCheck,
  Clock,
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
  const { positions } = usePositions();

  const mt5 = engine.mt5Account;

  // Margin telemetry calculation
  const marginMetrics = useMemo(() => {
    const totalVolume = positions.reduce((sum, p) => sum + p.volume, 0);
    const totalFloatingPnl = positions.reduce((sum, p) => sum + p.profit, 0);
    const leverage = 1000;
    const notionalValue = totalVolume * 100 * ticker.bid;
    const marginUsed = notionalValue / leverage;
    const equity = ticker.balance + totalFloatingPnl;
    const freeMargin = Math.max(0, equity - marginUsed);
    const marginLevelPct = marginUsed > 0 ? `${Math.round((equity / marginUsed) * 100)}%` : '∞ Safe';

    return {
      freeMargin: freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      marginLevelPct,
    };
  }, [positions, ticker.bid, ticker.balance]);

  const isProfit = ticker.equity >= ticker.balance;

  return (
    <header className="relative w-full border-b border-slate-200/90 dark:border-[#1a3040] bg-white/95 dark:bg-[#0d1823]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 font-mono text-xs transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: Brand Identity, Dynamic Symbol & Dual Session Times */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white uppercase font-sans">
              {ticker.symbol === 'XAUUSD' ? 'GOLD' : 'FOREX'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 font-bold border border-sky-500/20">
              {ticker.symbol}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />

          {/* Dual Clock: Server Time & Kenya/EAT Time (Section 9) */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
            <Clock className="w-3 h-3 text-sky-500" />
            <span>{ticker.brokerTimeStr || '00:00 Server'}</span>
            <span className="text-zinc-400">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{ticker.kenyaTimeStr || '00:00 EAT'}</span>
          </div>

          <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            mt5?.connected
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-slate-100 text-slate-600 dark:bg-zinc-900 dark:text-zinc-400 border-slate-200 dark:border-zinc-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${mt5?.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>{mt5?.connected ? 'MT5 connected' : 'MT5 not linked'}</span>
          </span>
        </div>

        {/* Center: Linked MT5 Account Telemetry (Balance, Equity, Free Margin, Margin Level) */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar py-0.5">
          {/* 1. Account Balance */}
          <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Balance:</span>
            <strong className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
              ${ticker.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          {/* 2. Floating Equity */}
          <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Equity:</span>
            <strong
              className={`text-xs sm:text-sm font-black tabular-nums ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              ${ticker.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          {/* 3. Free Margin */}
          <div className="hidden sm:flex items-baseline gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Free Margin:</span>
            <strong className="text-xs sm:text-sm font-black text-slate-800 dark:text-zinc-200 tabular-nums">
              ${marginMetrics.freeMargin}
            </strong>
          </div>

          {/* 4. Margin Level */}
          <div className="hidden md:flex items-baseline gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Margin Level:</span>
            <strong className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {marginMetrics.marginLevelPct}
            </strong>
          </div>
        </div>

        {/* Right: MT5 Connection Link & Theme Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenModal('bridge')}
            title="MetaTrader 5 Bridge Link & Server Status"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              mt5?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline font-mono">
              {mt5?.connected ? `MT5 #${mt5.login}` : 'Link MT5'}
            </span>
          </button>

          <button
            onClick={onToggleTheme}
            aria-label="Toggle light or dark theme"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
});
