import React from 'react';
import { Shield, AlertTriangle, Activity, Sliders, TrendingDown, DollarSign } from 'lucide-react';
import { useEngine, usePositions } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { RISK_CONFIG } from '../engine/riskConfig';

interface RiskPanelProps {
  onOpenSettings: () => void;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ onOpenSettings }) => {
  const engine = useEngine();
  const positionsState = usePositions();

  const account = tradingEngine.account;
  const positions = positionsState.positions;
  const maxPositions = Math.max(5, RISK_CONFIG.maxOpenPositions || 5);
  const maxDailyLoss = account.max_daily_loss_pct || 5.0;
  const currentDd = account.daily_drawdown_pct || 0.0;
  const ddRatio = Math.min(100, (currentDd / maxDailyLoss) * 100);

  // Consecutive losses
  const recentClosed = tradingEngine.closedTrades.slice(0, 10);
  let consecutiveLosses = 0;
  for (const t of recentClosed) {
    if (t.profit <= 0) consecutiveLosses++;
    else break;
  }

  const isNearLimit = currentDd >= maxDailyLoss * 0.8;
  const isLossHit = account.daily_loss_hit || currentDd >= maxDailyLoss;

  return (
    <div className="flex flex-col bg-[#10141D] rounded border border-white/[0.06] overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#141923] shrink-0">
        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
          RISK & CAPITAL
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-[10px] font-mono text-[#2979FF] hover:underline cursor-pointer flex items-center gap-1"
        >
          <Sliders className="w-2.5 h-2.5" />
          <span>CONFIG</span>
        </button>
      </div>

      <div className="p-3 space-y-3 font-mono text-xs">
        {/* Daily Drawdown Progress Bar with limit marker */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">DAILY DRAWDOWN</span>
            <span
              className={`font-bold tabular-nums ${
                isLossHit ? 'text-[#FF5252]' : isNearLimit ? 'text-amber-400' : 'text-zinc-200'
              }`}
            >
              {currentDd.toFixed(2)}% <span className="text-zinc-500">/ {maxDailyLoss.toFixed(1)}% limit</span>
            </span>
          </div>

          <div className="relative w-full bg-[#0A0E14] h-2 rounded-full overflow-hidden border border-white/[0.04]">
            {/* Drawdown bar */}
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isLossHit
                  ? 'bg-[#FF5252]'
                  : isNearLimit
                  ? 'bg-amber-400'
                  : 'bg-[#2979FF]'
              }`}
              style={{ width: `${ddRatio}%` }}
            />
          </div>
        </div>

        {/* 4-Stat Grid: Risk Pct, Open Positions, Consecutive Losses, Daily PnL */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {/* Risk % per trade */}
          <div className="bg-[#0A0E14] p-2 rounded border border-white/[0.04]">
            <span className="text-[9px] uppercase text-zinc-500 font-bold block">RISK / TRADE</span>
            <span className="font-bold text-zinc-200 tabular-nums">
              {account.risk_pct.toFixed(1)}% equity
            </span>
          </div>

          {/* Open Positions Count */}
          <div className="bg-[#0A0E14] p-2 rounded border border-white/[0.04]">
            <span className="text-[9px] uppercase text-zinc-500 font-bold block">OPEN TRADES</span>
            <span className="font-bold text-zinc-200 tabular-nums">
              {positions.length} <span className="text-zinc-500">/ {maxPositions} max</span>
            </span>
          </div>

          {/* Consecutive Losses */}
          <div className="bg-[#0A0E14] p-2 rounded border border-white/[0.04]">
            <span className="text-[9px] uppercase text-zinc-500 font-bold block">CONSEC LOSSES</span>
            <span
              className={`font-bold tabular-nums ${
                consecutiveLosses >= 2 ? 'text-[#FF5252]' : 'text-zinc-200'
              }`}
            >
              {consecutiveLosses} <span className="text-zinc-500">/ {RISK_CONFIG.maxConsecutiveLosses}</span>
            </span>
          </div>

          {/* Day P&L */}
          <div className="bg-[#0A0E14] p-2 rounded border border-white/[0.04]">
            <span className="text-[9px] uppercase text-zinc-500 font-bold block">TODAY P&L</span>
            {(() => {
              const dailyPnl = account.equity - (account.daily_start_balance || account.balance);
              const isProfit = dailyPnl >= 0;
              return (
                <span
                  className={`font-bold tabular-nums ${
                    isProfit ? 'text-[#00E676]' : 'text-[#FF5252]'
                  }`}
                >
                  {isProfit ? '+' : ''}${dailyPnl.toFixed(2)}
                </span>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
