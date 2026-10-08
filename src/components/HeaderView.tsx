/**
 * HeaderView.tsx - Institutional Header & Telemetry Top Bar
 * Features:
 * - Fluid max-w-[1920px] width matching main workstation grid
 * - Quick symbol switcher with interactive pill selector
 * - Well-spaced dual session clocks (Broker/Server time & Kenya/EAT time)
 * - Real-time MT5 account telemetry: Balance, Equity, Free Margin, Margin Level
 * - 1-Click connection state badge & modal launcher
 * - Clean theme switcher
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTicker, useEngine, usePositions } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { mt5Bridge } from '../engine/mt5Bridge';
import { SUPPORTED_SYMBOLS, SupportedSymbol } from '../engine/instrumentConfig';
import {
  Sun,
  Moon,
  Server,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';

interface HeaderViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa'
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
  const [bridgeReachable, setBridgeReachable] = useState(mt5Bridge.getStatus().connected);

  useEffect(() => {
    const refreshStatus = () => setBridgeReachable(mt5Bridge.getStatus().connected);
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 1000);
    return () => window.clearInterval(timer);
  }, []);

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
  const floatingPnl = ticker.equity - ticker.balance;

  return (
    <header className="relative w-full border-b border-slate-200/90 dark:border-[#1a3040] bg-white/95 dark:bg-[#0d1823]/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 font-mono text-xs transition-colors shadow-xs z-30">
      <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-3 sm:gap-6 flex-wrap xl:flex-nowrap">
        {/* Left: Brand Identity, Dynamic Symbol Switcher & Dual Clocks */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 flex-wrap">
          {/* Brand Logo */}
          <div className="flex items-center gap-2">
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white uppercase font-sans">
              SMC PRO
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
              TERMINAL
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:border-zinc-800" />

          {/* Quick Symbol Switcher Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-[#0a121a] p-0.5 rounded-lg border border-slate-200 dark:border-[#1a3040]">
            {SUPPORTED_SYMBOLS.map((sym) => {
              const isActive = sym === ticker.symbol;
              return (
                <button
                  key={sym}
                  onClick={() => tradingEngine.switchSymbol(sym)}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Switch active instrument to ${sym}`}
                >
                  {sym === 'XAUUSD' ? 'GOLD' : sym.replace('USD', '')}
                </button>
              );
            })}
          </div>

          <div className="hidden md:block h-4 w-px bg-slate-200 dark:border-zinc-800" />

          {/* Dual Clock: Server Time & Kenya/EAT Time */}
          <div className="flex items-center gap-2 text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#0a121a] border border-slate-200 dark:border-[#1a3040] text-slate-600 dark:text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="tabular-nums font-semibold">{ticker.brokerTimeStr || '00:00 Server'}</span>
            <span className="text-zinc-400">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              {ticker.kenyaTimeStr || '00:00 EAT'}
            </span>
          </div>
        </div>

        {/* Center: Linked MT5 Account Telemetry (Balance, Equity, Floating P&L, Free Margin) */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          {/* 1. Account Balance */}
          <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#0c131a] border border-slate-200 dark:border-[#1a3040]">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Balance:</span>
            <strong className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
              {mt5?.connected
                ? `$${ticker.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Unavailable'}
            </strong>
          </div>

          {/* 2. Floating Equity & Live Floating PnL */}
          <div className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#0c131a] border border-slate-200 dark:border-[#1a3040]">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Equity:</span>
            <strong
              className={`text-xs sm:text-sm font-black tabular-nums ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {mt5?.connected
                ? `$${ticker.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Unavailable'}
            </strong>
            {floatingPnl !== 0 && (
              <span
                className={`text-[10px] font-bold px-1 rounded ${
                  floatingPnl > 0
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
              >
                {floatingPnl > 0 ? `+${floatingPnl.toFixed(2)}` : floatingPnl.toFixed(2)}
              </span>
            )}
          </div>

          {/* 3. Free Margin */}
          <div className="hidden sm:flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#0c131a] border border-slate-200 dark:border-[#1a3040]">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Free Margin:</span>
            <strong className="text-xs sm:text-sm font-black text-slate-800 dark:text-zinc-200 tabular-nums">
              {mt5?.connected ? `$${marginMetrics.freeMargin}` : 'Unavailable'}
            </strong>
          </div>

          {/* 4. Margin Level */}
          <div className="hidden lg:flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#0c131a] border border-slate-200 dark:border-[#1a3040]">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Margin Level:</span>
            <strong className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {marginMetrics.marginLevelPct}
            </strong>
          </div>
        </div>

        {/* Right: MT5 Connection Link, Risk Modal Quick Link & Theme Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Risk Modal Link */}
          <button
            onClick={() => onOpenModal('settings')}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Risk & Drawdown Rules"
          >
            <Shield className="w-4 h-4 text-sky-500" />
          </button>

          {/* MT5 Connection Link */}
          <button
            onClick={() => onOpenModal('bridge')}
            title={mt5?.connected && !bridgeReachable
              ? 'MT5 account is linked, but bridge synchronization is offline; broker orders are paused.'
              : 'MetaTrader 5 Bridge Link & Server Status'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              mt5?.connected && bridgeReachable
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
            }`}
          >
            <Server className={`w-3.5 h-3.5 ${mt5?.connected && bridgeReachable ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className="font-mono text-[11px]">
              {mt5?.connected
                ? bridgeReachable ? `MT5 #${mt5.login}` : `MT5 #${mt5.login} · OFFLINE`
                : 'Connect MT5'}
            </span>
          </button>

          {/* Theme Switcher */}
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
