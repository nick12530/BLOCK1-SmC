import React from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import {
  ShieldAlert,
  Zap,
  Clock,
  Radio,
  Sliders,
  Terminal,
  Database,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface TopNavProps {
  snapshot: TerminalSnapshot;
  onOpenSettings: () => void;
  onOpenBridge: () => void;
  onOpenScenarios: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  snapshot,
  onOpenSettings,
  onOpenBridge,
  onOpenScenarios,
}) => {
  const isKill = snapshot.kill_switch;
  const isAuto = snapshot.auto_trade;
  const isNews = snapshot.news_blackout;
  const isChangeUp = snapshot.change24h >= 0;

  return (
    <header className="border-b border-[#1e2a3d] bg-[#0d131f]/95 backdrop-blur-md px-4 py-2.5 sticky top-0 z-40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Zone: Brand & Institutional Symbol Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight font-mono">
                XAUUSD
              </span>
              <span className="text-[11px] text-[#6b7a90] font-mono">Gold Spot</span>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-xl font-bold text-white tabular-nums tracking-tight">
                {snapshot.bid.toFixed(2)}
              </span>
              <span className="text-xs text-[#6b7a90]">/</span>
              <span className="text-xs text-[#94a3b8] tabular-nums">
                {snapshot.ask.toFixed(2)}
              </span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                  snapshot.spread > 40
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[#1a2436] text-[#6b7a90]'
                }`}
              >
                SPRD {snapshot.spread}
              </span>
            </div>

            {/* 24h Market Stat */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono pl-2 border-l border-[#1e2a3d]">
              <div className="flex items-center gap-1">
                {isChangeUp ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className={isChangeUp ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {isChangeUp ? '+' : ''}${snapshot.change24h.toFixed(2)} ({isChangeUp ? '+' : ''}
                  {snapshot.change24hPct}%)
                </span>
              </div>
              <div className="text-[11px] text-[#6b7a90]">
                24h: {snapshot.low24h.toFixed(1)} – {snapshot.high24h.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Center Zone: Clean Institutional Session Indicator & UTC Time */}
        <div className="hidden md:flex items-center gap-2 font-mono text-xs">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${
              snapshot.session.tradable
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-[#121826] border-[#1e2a3d] text-[#6b7a90]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                snapshot.session.tradable ? 'bg-emerald-400 animate-pulse' : 'bg-[#334155]'
              }`}
            />
            <span>{snapshot.session.activeSessionName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#6b7a90] bg-[#121826] px-2.5 py-1 rounded-md border border-[#1e2a3d]">
            <Clock className="w-3.5 h-3.5 text-[#4f8ef7]" />
            <span>{snapshot.session.currentUtcTime}</span>
          </div>
        </div>

        {/* Right Zone: Account Financials & Primary Action Controls */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Account Strip */}
          <div className="flex items-center gap-3 bg-[#121826] border border-[#1e2a3d] rounded-lg px-3 py-1 font-mono">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6b7a90]">Balance</div>
              <div className="text-xs font-bold text-white tabular-nums">
                ${snapshot.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-6 w-px bg-[#1e2a3d]" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6b7a90]">Equity</div>
              <div
                className={`text-xs font-bold tabular-nums ${
                  snapshot.equity >= snapshot.balance ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                ${snapshot.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="hidden sm:block h-6 w-px bg-[#1e2a3d]" />
            <div className="hidden sm:block">
              <div className="text-[9px] uppercase tracking-wider text-[#6b7a90]">Free Margin</div>
              <div className="text-xs font-semibold text-[#94a3b8] tabular-nums">
                ${snapshot.margin_free.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Quick Tools */}
          <button
            onClick={onOpenScenarios}
            title="Replay historical SMC market scenarios"
            className="p-2 rounded-lg bg-[#121826] border border-[#1e2a3d] text-[#6b7a90] hover:text-white transition-colors"
          >
            <Database className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenBridge}
            title="MetaTrader 5 Python bridge setup & server script"
            className="p-2 rounded-lg bg-[#121826] border border-[#1e2a3d] text-[#6b7a90] hover:text-white transition-colors"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            title="Prop Firm Risk & Drawdown Configuration"
            className="p-2 rounded-lg bg-[#121826] border border-[#1e2a3d] text-[#6b7a90] hover:text-white transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Auto-Trade Switch */}
          <button
            onClick={() => tradingEngine.toggleAutoTrade()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              isAuto
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_14px_rgba(16,185,129,0.2)]'
                : 'bg-[#1a2436] text-[#94a3b8] border border-[#1e2a3d] hover:text-white'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isAuto ? 'fill-emerald-400 text-emerald-400' : ''}`} />
            <span>AUTO: {isAuto ? 'ON' : 'OFF'}</span>
          </button>

          {/* Kill Switch */}
          <button
            onClick={() => tradingEngine.toggleKillSwitch()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              isKill
                ? 'bg-red-600 text-white border border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.4)] animate-pulse'
                : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isKill ? 'KILL ENGAGED' : 'KILL SWITCH'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
