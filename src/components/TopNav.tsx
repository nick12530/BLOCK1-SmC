import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Radio,
  Sliders,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { useTicker, useMarket, usePositions, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { INSTRUMENTS, SupportedSymbol } from '../engine/instrumentConfig';
import { getGoldMarketSchedule } from '../engine/marketHours';

interface TopNavProps {
  onOpenSettings: () => void;
  onOpenBridge: () => void;
  onOpenWebhook?: () => void;
  onRequestKillSwitchToggle: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenSettings,
  onOpenBridge,
  onOpenWebhook,
  onRequestKillSwitchToggle,
}) => {
  const ticker = useTicker();
  const market = useMarket();
  const positionsState = usePositions();
  const engine = useEngine();

  const isKill = engine.kill_switch;
  const isAuto = engine.auto_trade;
  const isNews = engine.news_blackout;
  const activeSymbol = ticker.symbol as SupportedSymbol;
  const instrumentCfg = INSTRUMENTS[activeSymbol] || INSTRUMENTS.XAUUSD;
  const isWideSpread = ticker.spread > instrumentCfg.maxSpreadPoints;

  const marketSchedule = getGoldMarketSchedule();
  const isMarketOpen = marketSchedule.isOpen;

  const handleSelectSymbol = (sym: SupportedSymbol) => {
    tradingEngine.switchSymbol(sym);
  };

  const handleToggleAuto = () => {
    tradingEngine.toggleAutoTrade();
  };

  return (
    <header className="h-12 border-b border-white/[0.06] bg-[#0A0E14] px-3 flex items-center justify-between gap-2 select-none sticky top-0 z-40">
      {/* LEFT: Logo & Symbol Switcher */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 mr-1">
          <span className="font-mono text-xs font-black tracking-widest text-[#2979FF]">NIFTY</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
            PRO
          </span>
        </div>

        {/* Symbol switcher buttons */}
        <div className="flex items-center gap-0.5 bg-[#10141D] p-0.5 rounded border border-white/[0.06]">
          {(['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY'] as SupportedSymbol[]).map((sym) => {
            const isSelected = activeSymbol === sym;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => handleSelectSymbol(sym)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#2979FF] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER-LEFT: Live Quotes, Spread, & Session */}
      <div className="hidden md:flex items-center gap-3">
        {/* Bid / Ask */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-zinc-500 uppercase text-[10px] font-bold">BID</span>
          <span className="font-bold text-zinc-100 tabular-nums">
            {ticker.bid.toFixed(instrumentCfg.digits)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500 uppercase text-[10px] font-bold">ASK</span>
          <span className="font-bold text-zinc-100 tabular-nums">
            {ticker.ask.toFixed(instrumentCfg.digits)}
          </span>
        </div>

        {/* Spread Badge */}
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
            isWideSpread
              ? 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/30 animate-pulse'
              : 'bg-white/[0.04] text-zinc-400 border-white/[0.06]'
          }`}
          title={`Broker Spread: ${ticker.spread} pts (Max safe: ${instrumentCfg.maxSpreadPoints} pts)`}
        >
          <span>SPRD {ticker.spread}</span>
        </div>

        {/* Pulsing Spread Warning Chip */}
        {isWideSpread && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
            title={`High Spread Warning: ${ticker.spread} exceeds ${instrumentCfg.maxSpreadPoints} pts limit. 1-Click execution paused.`}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>SPREAD SPIKE</span>
          </div>
        )}

        {/* News Blackout Chip */}
        {isNews && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30"
            title="High-Impact News Blackout is active. New trades paused."
          >
            <Flame className="w-3 h-3 shrink-0 text-amber-400" />
            <span>NEWS BLACKOUT</span>
          </div>
        )}

        {/* Active Session */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 border-l border-white/[0.06] pl-3">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              engine.session?.tradable ? 'bg-[#00E676] animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span className="truncate max-w-[130px]">{engine.session?.activeSessionName || 'Market Inactive'}</span>
        </div>
      </div>

      {/* CENTER-RIGHT: Account Equity & Balance */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[10px] uppercase font-bold">EQUITY</span>
          <span className="font-bold text-zinc-100 tabular-nums">
            ${tradingEngine.account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex items-center gap-2 border-l border-white/[0.06] pl-3">
          <span className="text-zinc-500 text-[10px] uppercase font-bold">BAL</span>
          <span className="text-zinc-300 tabular-nums">
            ${tradingEngine.account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex items-center gap-2 border-l border-white/[0.06] pl-3">
          <span className="text-zinc-500 text-[10px] uppercase font-bold">DD</span>
          <span
            className={`font-bold tabular-nums ${
              tradingEngine.account.daily_drawdown_pct >= tradingEngine.account.max_daily_loss_pct * 0.8
                ? 'text-[#FF5252]'
                : 'text-zinc-300'
            }`}
          >
            {tradingEngine.account.daily_drawdown_pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* RIGHT: Status Indicators & Control Toggles */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Status Dots */}
        <div className="hidden sm:flex items-center gap-2 border-r border-white/[0.06] pr-2">
          {/* MT5 Bridge Connection */}
          <button
            type="button"
            onClick={onOpenBridge}
            className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title={
              tradingEngine.mt5Account.connected
                ? `MT5 Connected (${tradingEngine.mt5Account.login})`
                : 'MT5 Standby (click to configure bridge)'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tradingEngine.mt5Account.connected ? 'bg-[#00E676]' : 'bg-zinc-600'
              }`}
            />
            <span>MT5</span>
          </button>

          {/* Market Status */}
          <div
            className="flex items-center gap-1 text-[10px] font-mono text-zinc-400"
            title={isMarketOpen ? 'Interbank market open' : 'Weekend / Market closed'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isMarketOpen ? 'bg-[#00E676]' : 'bg-amber-500'
              }`}
            />
            <span>MKT</span>
          </div>
        </div>

        {/* AUTO Execution Toggle */}
        <button
          type="button"
          onClick={handleToggleAuto}
          className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border ${
            isAuto
              ? 'bg-[#2979FF]/20 text-[#2979FF] border-[#2979FF]/40 shadow-xs'
              : 'bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08]'
          }`}
          title={isAuto ? 'Auto-Trading is ACTIVE' : 'Auto-Trading is PAUSED'}
        >
          <Zap className="w-3 h-3" />
          <span>{isAuto ? 'AUTO ON' : 'AUTO OFF'}</span>
        </button>

        {/* KILL SWITCH (Prominent Red Toggle with Confirm Gate) */}
        <button
          type="button"
          onClick={onRequestKillSwitchToggle}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border ${
            isKill
              ? 'bg-[#FF5252] text-white border-[#FF5252] animate-pulse shadow-xs'
              : 'bg-[#FF5252]/10 text-[#FF5252] border-[#FF5252]/30 hover:bg-[#FF5252]/20'
          }`}
          title={isKill ? 'Kill switch is ARMED. All trading blocked.' : 'Kill switch is DISARMED'}
        >
          <ShieldAlert className="w-3 h-3" />
          <span>{isKill ? 'ARMED' : 'KILL SWITCH'}</span>
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer border border-white/[0.06]"
          title="Risk & Engine Configuration"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
