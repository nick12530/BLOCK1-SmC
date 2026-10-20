/**
 * HeaderView.tsx - NIFTY Institutional Trading Terminal Header
 * Minimalist, highly operational top bar:
 * - Brand: NIFTY with clean live market status
 * - Segmented instrument selector (XAUUSD, EURUSD, USDJPY, GBPUSD)
 * - Clean telemetry metrics (Balance, Equity, Floating PnL, Margin Level)
 * - Instant operational controls: Auto-Trader toggle, MT5 Bridge, Telegram Alerts, Risk, History, Theme
 */

import React, { useMemo } from 'react';
import { useTicker, useEngine, usePositions } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { SUPPORTED_SYMBOLS } from '../engine/instrumentConfig';
import {
  Sun,
  Moon,
  Server,
  Clock,
  Shield,
  Volume2,
  VolumeX,
  History,
  Bot,
  Bell,
  BookOpen,
} from 'lucide-react';
import { signalAudioNotifier } from '../utils/audioNotification';

interface HeaderViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa' | 'webhook'
  ) => void;
  onToggleKillSwitchPrompt?: () => void;
}

const formatCurrency = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const HeaderView: React.FC<HeaderViewProps> = React.memo(({
  isDark,
  onToggleTheme,
  onOpenModal,
}) => {
  const ticker = useTicker();
  const engine = useEngine();
  const { positions } = usePositions();
  const mt5 = engine.mt5Account;

  // Margin calculation
  const marginMetrics = useMemo(() => {
    const totalVolume = positions.reduce((sum, p) => sum + p.volume, 0);
    const totalFloatingPnl = positions.reduce((sum, p) => sum + p.profit, 0);
    const leverage = engine.leverage || mt5?.leverage || 2000;
    const notionalValue = totalVolume * 100 * ticker.bid;
    const marginUsed = notionalValue / leverage;
    const equity = ticker.balance + totalFloatingPnl;
    const freeMargin = Math.max(0, equity - marginUsed);
    const marginLevelPct = marginUsed > 0 ? `${((equity / marginUsed) * 100).toFixed(1)}%` : '—';

    return {
      marginUsed: marginUsed.toFixed(2),
      freeMargin: freeMargin.toFixed(2),
      marginLevelPct,
    };
  }, [positions, ticker.bid, ticker.balance, engine.leverage, mt5?.leverage]);

  const floatingPnl = Number((ticker.equity - ticker.balance).toFixed(2));
  const isProfit = floatingPnl >= 0;

  const cleanBrokerTime = useMemo(() => {
    if (!ticker.brokerTimeStr) return '00:00 UTC';
    return ticker.brokerTimeStr.replace(/^\d{4}[.-]\d{2}[.-]\d{2}\s*/, '');
  }, [ticker.brokerTimeStr]);

  return (
    <header className="w-full border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-[#090b10]/95 backdrop-blur-md z-30 transition-colors">
      {/* Primary Tier: Brand, Currency Switcher, Auto-Trade, MT5, and Utilities */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Brand & Currency Switcher */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* NIFTY Brand Identity */}
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-sm tracking-widest shadow-sm">
              N
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-base tracking-wider text-slate-900 dark:text-white uppercase font-sans">
                  NIFTY
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono tracking-tight font-medium">
                SMC Terminal
              </span>
            </div>
          </div>

          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:border-zinc-800" />

          {/* Clean Segmented Currency Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 font-mono text-xs">
            {SUPPORTED_SYMBOLS.map((sym) => {
              const isActive = sym === ticker.symbol;
              const label = sym === 'XAUUSD' ? 'GOLD' : sym.replace('USD', '');
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => tradingEngine.switchSymbol(sym)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer text-xs ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Focus ${sym}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center/Right: Account Telemetry (Inline, clean typography, zero pills) */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-600 dark:text-zinc-400 border-x border-slate-200/80 dark:border-zinc-800 px-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Balance:</span>
            <strong className="text-slate-900 dark:text-white tabular-nums font-bold">
              ${formatCurrency(ticker.balance)}
            </strong>
          </div>

          <span className="text-slate-300 dark:text-zinc-700">·</span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Equity:</span>
            <strong
              className={`tabular-nums font-bold ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              ${formatCurrency(ticker.equity)}
            </strong>
            {floatingPnl !== 0 && (
              <span className={`text-[10px] font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                ({isProfit ? `+${formatCurrency(floatingPnl)}` : formatCurrency(floatingPnl)})
              </span>
            )}
          </div>

          <span className="text-slate-300 dark:text-zinc-700">·</span>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="tabular-nums">{cleanBrokerTime}</span>
          </div>
        </div>

        {/* Right: Operational Controls & Utilities */}
        <div className="flex items-center gap-2">
          {/* Auto-Trader Toggle */}
          <button
            type="button"
            onClick={() => tradingEngine.toggleAutoTrade()}
            aria-pressed={engine.auto_trade}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all cursor-pointer ${
              engine.auto_trade
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}
            title={engine.auto_trade ? 'Auto-Trader is active. Click to pause.' : 'Auto-Trader is off. Click to activate.'}
          >
            <Bot className="w-4 h-4 shrink-0" />
            <span>Auto: {engine.auto_trade ? 'ON' : 'OFF'}</span>
          </button>

          {/* MT5 Bridge Link */}
          <button
            type="button"
            onClick={() => onOpenModal('bridge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all cursor-pointer ${
              mt5?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}
            title="MT5 Bridge Status & Account Link"
          >
            <Server className={`w-3.5 h-3.5 ${mt5?.connected ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{mt5?.connected ? `MT5 #${mt5.login}` : 'MT5 Bridge'}</span>
          </button>

          {/* Quick Utility Icon Dock */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800">
            {/* Telegram Alerts */}
            <button
              type="button"
              onClick={() => onOpenModal('webhook')}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-amber-500 transition-colors cursor-pointer"
              title="Telegram Push Alerts & Webhook Config"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Risk Settings */}
            <button
              type="button"
              onClick={() => onOpenModal('settings')}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Prop Firm Risk & Drawdown Settings"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Trade Journal / Closed Trades */}
            <button
              type="button"
              onClick={() => onOpenModal('closed_trades')}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Closed Trades History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Help / Guide */}
            <button
              type="button"
              onClick={() => onOpenModal('help')}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Institutional User Manual"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextMuted = !signalAudioNotifier.getMuted();
                signalAudioNotifier.setMuted(nextMuted);
              }}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title={signalAudioNotifier.getMuted() ? 'Audio Muted' : 'Audio Active'}
            >
              {signalAudioNotifier.getMuted() ? (
                <VolumeX className="w-4 h-4 text-zinc-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              )}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Toggle Light / Dark Mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Telemetry Ribbon (<md only): Clean, non-crowded single row */}
      <div className="flex md:hidden items-center justify-between px-3 py-1.5 border-t border-slate-100 dark:border-zinc-800/80 text-xs font-mono text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-black/40">
        <div className="flex items-center gap-1.5">
          <span>Bal:</span>
          <strong className="text-slate-900 dark:text-white font-bold">${formatCurrency(ticker.balance)}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Eq:</span>
          <strong className={`font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
            ${formatCurrency(ticker.equity)}
          </strong>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Margin:</span>
          <strong className="font-bold text-slate-800 dark:text-zinc-200">{marginMetrics.marginLevelPct}</strong>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-sky-500">
          <Clock className="w-3 h-3" />
          <span>{cleanBrokerTime}</span>
        </div>
      </div>
    </header>
  );
});
