import React from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { mt5Bridge } from '../engine/mt5Bridge';
import {
  Sun,
  Moon,
  Zap,
  ShieldAlert,
  Sliders,
  Server,
  Database,
  Radio,
} from 'lucide-react';

interface MinimalHeaderProps {
  snapshot: TerminalSnapshot;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenBridge: () => void;
  onOpenScenarios: () => void;
}

export const MinimalHeader: React.FC<MinimalHeaderProps> = ({
  snapshot,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onOpenBridge,
  onOpenScenarios,
}) => {
  const isKill = snapshot.kill_switch;
  const isAuto = snapshot.auto_trade;
  const isProfit = snapshot.equity >= snapshot.balance;
  const bridgeStatus = mt5Bridge.getStatus();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0e131d]/95 backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Clean Brand & Live Price */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-extrabold text-xs">
            AU
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight">
                XAUUSD
              </span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                Spot
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono mt-1">
              <span className="font-bold text-slate-950 dark:text-white tabular-nums">
                ${snapshot.bid.toFixed(2)}
              </span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                ${snapshot.ask.toFixed(2)}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {snapshot.spread} pts
              </span>
            </div>
          </div>
        </div>

        {/* Center: MT5 Port Status & Trading Session */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono">
          {/* MT5 Port Pill */}
          <button
            onClick={onOpenBridge}
            title="Configure MT5 Bridge Connection"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131a27] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                bridgeStatus.connected ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="font-bold">
              MT5: <span className="font-normal text-slate-500 dark:text-slate-400">127.0.0.1:8000</span>
            </span>
          </button>

          {/* Session Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              snapshot.session.tradable
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                : 'bg-slate-50 dark:bg-[#131a27] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                snapshot.session.tradable ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-400'
              }`}
            />
            <span>{snapshot.session.activeSessionName}</span>
          </div>
        </div>

        {/* Right: Balance Snapshot, Auto-Trade, Kill Switch, Settings, Theme */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Compact Balance Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-[#131a27] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-400 text-[10px] uppercase mr-1">Bal</span>
              <strong className="text-slate-900 dark:text-white font-bold">
                ${snapshot.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </strong>
            </div>
            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-slate-400 text-[10px] uppercase mr-1">Eq</span>
              <strong
                className={`font-bold ${
                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ${snapshot.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* Auto-Trade Switch */}
          <button
            onClick={() => tradingEngine.toggleAutoTrade()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isAuto
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isAuto ? 'fill-white text-white' : ''}`} />
            <span>AUTO: {isAuto ? 'ON' : 'OFF'}</span>
          </button>

          {/* Emergency Kill Switch */}
          <button
            onClick={() => tradingEngine.toggleKillSwitch()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isKill
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-900/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isKill ? 'HALTED' : 'KILL'}</span>
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Settings & Replay Buttons */}
          <button
            onClick={onOpenSettings}
            title="Risk & Drawdown Rules"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenScenarios}
            title="Market Regimes & Replay"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
