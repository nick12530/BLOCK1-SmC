/**
 * HeaderView.tsx - Institutional Header & Telemetry Top Bar
 * Re-architected for pristine responsive distribution:
 * - Tier 1: Brand, Symbol Pills, Auto-Trader, MT5 & Action Tools cleanly distributed
 * - Tier 2: Dedicated Financial Status Ribbon with Dual Clocks & MT5 Account Telemetry
 * - Zero awkward wrapping or unbalanced whitespace on mobile or desktop
 */

import React, { useMemo } from 'react';
import { useTicker, useEngine, usePositions } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { SUPPORTED_SYMBOLS, SupportedSymbol } from '../engine/instrumentConfig';
import {
  Sun,
  Moon,
  Server,
  Clock,
  Shield,
  Volume2,
  VolumeX,
  BookOpen,
  History,
  Bot,
  Smartphone,
} from 'lucide-react';
import { signalAudioNotifier } from '../utils/audioNotification';
import { MarketOpensTimer } from './MarketOpensTimer';

interface HeaderViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenModal: (
    modal: 'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa'
  ) => void;
  onToggleKillSwitchPrompt?: () => void;
}

const formatMT5 = (val: number | string) => {
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

  // Margin telemetry calculation
  const marginMetrics = useMemo(() => {
    const totalVolume = positions.reduce((sum, p) => sum + p.volume, 0);
    const totalFloatingPnl = positions.reduce((sum, p) => sum + p.profit, 0);
    const leverage = engine.leverage || mt5?.leverage || 2000;
    const notionalValue = totalVolume * 100 * ticker.bid;
    const marginUsed = notionalValue / leverage;
    const equity = ticker.balance + totalFloatingPnl;
    const freeMargin = Math.max(0, equity - marginUsed);
    const marginLevelPct = marginUsed > 0 ? `${((equity / marginUsed) * 100).toFixed(2)}%` : '0.00%';

    return {
      leverage: `1:${leverage}`,
      marginUsed: marginUsed.toFixed(2),
      freeMargin: freeMargin.toFixed(2),
      marginLevelPct,
    };
  }, [positions, ticker.bid, ticker.balance, engine.leverage, mt5?.leverage]);

  const isProfit = ticker.equity >= ticker.balance;
  const floatingPnl = ticker.equity - ticker.balance;

  return (
    <header className="relative w-full border-b border-slate-200 dark:border-zinc-800/80 bg-white/95 dark:bg-[#0d0e13]/95 backdrop-blur-md font-mono text-xs transition-colors shadow-xs z-30 pt-2 sm:pt-1.5 overflow-hidden">
      {/* Tier 1: Primary Navigation Bar */}
      <div className="w-full max-w-[1920px] mx-auto px-2.5 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
        {/* Row 1 on mobile / Left on desktop: Brand Identity & Symbol Switcher */}
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white uppercase font-sans">
              SMC PRO
            </span>
            <span className="text-xs font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
              TERMINAL
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-zinc-800" />

          {/* Quick Symbol Switcher Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 gap-1">
            {SUPPORTED_SYMBOLS.map((sym) => {
              const isActive = sym === ticker.symbol;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => tradingEngine.switchSymbol(sym)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white dark:bg-zinc-200 dark:text-zinc-950 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Switch active instrument to ${sym}`}
                >
                  {sym === 'XAUUSD' ? 'GOLD' : sym.replace('USD', '')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2 on mobile / Right on desktop: Auto-Trader Toggle, MT5 Status & Action Tools Hub */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auto-Trader Toggle Button */}
            <button
              type="button"
              onClick={() => tradingEngine.toggleAutoTrade()}
              aria-pressed={engine.auto_trade}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                engine.auto_trade
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
              }`}
              title={
                engine.auto_trade
                  ? 'Auto-Trader is ACTIVE (Automatically executes verified institutional setups). Click to disable.'
                  : 'Auto-Trader is OFF (Manual orders only). Click to enable Auto-Trader.'
              }
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  engine.auto_trade ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-zinc-600'
                }`}
              />
              <Bot className="w-4.5 h-4.5 shrink-0" />
              <span className="font-mono text-xs whitespace-nowrap">
                <span>Auto: </span>
                <strong>{engine.auto_trade ? 'ON' : 'OFF'}</strong>
              </span>
            </button>

            {/* MT5 Connection Link */}
            <button
              type="button"
              onClick={() => onOpenModal('bridge')}
              title="MetaTrader 5 Bridge Status & Terminal Linking"
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                mt5?.connected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
              }`}
            >
              <Server className={`w-4.5 h-4.5 shrink-0 ${mt5?.connected ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="font-mono text-xs whitespace-nowrap">
                {mt5?.connected ? (
                  <>
                    <span className="hidden sm:inline">MT5 </span>
                    <span>#{mt5.login}</span>
                  </>
                ) : (
                  <span>MT5 Bridge</span>
                )}
              </span>
            </button>

            {/* Real-Time Market Opens Timer */}
            <MarketOpensTimer />
          </div>

          {/* Action Tools Cluster with enlarged icon sizes and touch padding */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shrink-0">
            {/* Mobile PWA & Phone Server Hub */}
            <button
              type="button"
              onClick={() => onOpenModal('phone_pwa')}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors cursor-pointer"
              title="Mobile Standalone Web App & Phone Server Hub (PWA / Termux / iSH)"
            >
              <Smartphone className="w-5 h-5" />
            </button>

            {/* Risk / Safeguards */}
            <button
              type="button"
              onClick={() => onOpenModal('settings')}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Risk & Small Account Safeguards"
            >
              <Shield className="w-5 h-5 text-sky-500" />
            </button>

            {/* User Manual / Help Center */}
            <button
              type="button"
              onClick={() => onOpenModal('help')}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Institutional User Manual & Trading Guide"
            >
              <BookOpen className="w-5 h-5 text-slate-600 dark:text-zinc-400 hover:text-white" />
            </button>

            {/* Trade Ledger History */}
            <button
              type="button"
              onClick={() => onOpenModal('closed_trades')}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Closed Trades History & Ledger"
            >
              <History className="w-5 h-5 text-slate-600 dark:text-zinc-400 hover:text-white" />
            </button>

            {/* Audio Alert Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextMuted = !signalAudioNotifier.getMuted();
                signalAudioNotifier.setMuted(nextMuted);
                tradingEngine.slog(`System Audio Alerts: ${nextMuted ? 'MUTED' : 'ACTIVE'}`, 'info');
              }}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              title={signalAudioNotifier.getMuted() ? 'Audio Muted' : 'Audio Active'}
            >
              {signalAudioNotifier.getMuted() ? (
                <VolumeX className="w-5 h-5 text-zinc-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-500" />
              )}
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle light or dark theme"
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tier 2: Dedicated Financial Status Ribbon - Responsive with NO Mobile Slider */}
      <div className="w-full border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-[#0e0f14]/80 px-2.5 sm:px-6 lg:px-8 py-2 font-mono text-xs">
        {/* Mobile View (<sm): Clean 2-Row Stack with Clear, Bold Typography and 3-Metric Pills (NO Slider) */}
        <div className="flex sm:hidden flex-col gap-2 w-full">
          {/* Row 1: Clocks and Margin Level */}
          <div className="flex items-center justify-between text-slate-700 dark:text-zinc-200 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-500 shrink-0" />
              <span className="tabular-nums font-bold">{ticker.brokerTimeStr || '00:00 Server'}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black tabular-nums">
                {ticker.kenyaTimeStr || '00:00 EAT'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Margin:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-black tabular-nums">
                {marginMetrics.marginLevelPct}
              </strong>
            </div>
          </div>

          {/* Row 2: 3 Balance / Equity / Free Margin Metric Cards */}
          <div className="grid grid-cols-3 gap-1.5 border-t border-slate-200/60 dark:border-zinc-800/60 pt-2 text-center">
            <div className="p-1.5 rounded-lg bg-slate-100/70 dark:bg-zinc-900/70 border border-slate-200/50 dark:border-zinc-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">Balance</div>
              <div className="font-black text-slate-900 dark:text-white tabular-nums text-sm sm:text-base mt-0.5">
                ${formatMT5(ticker.balance)}
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100/70 dark:bg-zinc-900/70 border border-slate-200/50 dark:border-zinc-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">Equity</div>
              <div className={`font-black tabular-nums text-sm sm:text-base mt-0.5 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ${formatMT5(ticker.equity)}
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100/70 dark:bg-zinc-900/70 border border-slate-200/50 dark:border-zinc-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">Free Margin</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm sm:text-base mt-0.5">
                ${formatMT5(marginMetrics.freeMargin)}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop/Tablet View (sm+): Full Linear Ribbon */}
        <div className="hidden sm:flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* Dual Clocks (Server & EAT) */}
          <div className="flex items-center gap-1.5 shrink-0 text-slate-600 dark:text-zinc-300 pr-2 border-r border-slate-200 dark:border-zinc-800">
            <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="tabular-nums font-semibold">{ticker.brokerTimeStr || '00:00 Server'}</span>
            <span className="text-zinc-400">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              {ticker.kenyaTimeStr || '00:00 EAT'}
            </span>
          </div>

          {/* MT5 Telemetry Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Balance */}
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Balance:</span>
              <strong className="font-bold text-slate-900 dark:text-white tabular-nums">
                {formatMT5(ticker.balance)} USD
              </strong>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Equity */}
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Equity:</span>
              <strong
                className={`font-bold tabular-nums ${
                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatMT5(ticker.equity)}
              </strong>
              {floatingPnl !== 0 && (
                <span
                  className={`text-[9px] font-bold ${
                    floatingPnl > 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  ({floatingPnl > 0 ? `+${formatMT5(floatingPnl)}` : formatMT5(floatingPnl)})
                </span>
              )}
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Margin */}
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Margin:</span>
              <strong className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatMT5(marginMetrics.marginUsed)}
              </strong>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Free Margin */}
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Free Margin:</span>
              <strong className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatMT5(marginMetrics.freeMargin)}
              </strong>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Margin Level */}
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Margin Level:</span>
              <strong className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {marginMetrics.marginLevelPct}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});
