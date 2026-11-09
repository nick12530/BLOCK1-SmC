/**
 * HeaderView.tsx - NIFTY Institutional Minimalist Terminal Header
 * Strict, uncluttered, modest layout:
 * - Brand wordmark on the left with currency selector
 * - Clean inline telemetry (Balance, Equity, Broker Time) without pill badges
 * - Essential action buttons on the right: Auto-Trade, MT5 Bridge, Settings & Theme
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
  History,
  Bot,
  Bell,
  BookOpen,
} from 'lucide-react';

interface HeaderViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'webhook'
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

  const floatingPnl = Number((ticker.equity - ticker.balance).toFixed(2));
  const isProfit = floatingPnl >= 0;

  const cleanBrokerTime = useMemo(() => {
    if (!ticker.brokerTimeStr) return '00:00 UTC';
    return ticker.brokerTimeStr.replace(/^\d{4}[.-]\d{2}[.-]\d{2}\s*/, '');
  }, [ticker.brokerTimeStr]);

  return (
    <header className="sticky top-0 w-full border-b border-slate-200 dark:border-[#222d29] bg-white/95 dark:bg-[#121917]/95 backdrop-blur-md z-30 transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        {/* Left: Wordmark & Currency Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 select-none">
            <span className="font-black text-base tracking-wider text-slate-900 dark:text-white font-sans">
              NIFTY
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              SMC Terminal
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>

          {/* Clean Segmented Instrument Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-[#0f1513] p-0.5 rounded-lg border border-slate-200 dark:border-[#222d29] font-mono text-xs">
            {SUPPORTED_SYMBOLS.map((sym) => {
              const isActive = sym === ticker.symbol;
              const label = sym === 'XAUUSD' ? 'GOLD' : sym.replace('USD', '');
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => tradingEngine.switchSymbol(sym)}
                  className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer text-xs ${
                    isActive
                      ? 'bg-white dark:bg-[#222d29] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Focus ${sym}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Account Telemetry (Clean unboxed text with typographic separators) */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500">Balance:</span>
            <strong className="text-slate-900 dark:text-white tabular-nums font-bold">
              ${formatCurrency(ticker.balance)}
            </strong>
          </div>

          <span className="text-slate-300 dark:text-slate-700">·</span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500">Equity:</span>
            <strong
              className={`tabular-nums font-bold ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              ${formatCurrency(ticker.equity)}
            </strong>
            {floatingPnl !== 0 && (
              <span className={`text-[10px] ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                ({isProfit ? `+${formatCurrency(floatingPnl)}` : formatCurrency(floatingPnl)})
              </span>
            )}
          </div>

          <span className="text-slate-300 dark:text-slate-700">·</span>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="tabular-nums text-slate-500 dark:text-slate-400">{cleanBrokerTime}</span>
          </div>
        </div>

        {/* Right: Operational Controls */}
        <div className="flex items-center gap-2">
          {/* Auto-Trader Toggle */}
          <button
            type="button"
            onClick={() => tradingEngine.toggleAutoTrade()}
            aria-pressed={engine.auto_trade}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all cursor-pointer ${
              engine.auto_trade
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#0f1513] dark:hover:bg-[#1a2320] border-slate-200 dark:border-[#222d29] text-slate-700 dark:text-slate-300'
            }`}
            title={engine.auto_trade ? 'Auto-Trader is active.' : 'Auto-Trader is off.'}
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span>Auto: {engine.auto_trade ? 'ON' : 'OFF'}</span>
          </button>

          {/* MT5 Bridge Link */}
          <button
            type="button"
            onClick={() => onOpenModal('bridge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all cursor-pointer ${
              mt5?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#0f1513] dark:hover:bg-[#1a2320] border-slate-200 dark:border-[#222d29] text-slate-700 dark:text-slate-300'
            }`}
            title="MT5 Bridge Status & Account Link"
          >
            <Server className={`w-3.5 h-3.5 ${mt5?.connected ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{mt5?.connected ? `MT5 #${mt5.login}` : 'MT5 Bridge'}</span>
          </button>

          {/* Utilities Dock */}
          <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#0f1513] p-0.5 rounded-lg border border-slate-200 dark:border-[#222d29]">
            <button
              type="button"
              onClick={() => onOpenModal('webhook')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Telegram Alerts & Webhooks"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('settings')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Risk Rules & Settings"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('closed_trades')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Trade Journal"
            >
              <History className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('help')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="User Guide"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});
