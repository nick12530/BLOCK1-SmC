import React from 'react';
import { TerminalSnapshot } from '../types/smc';
import { Wallet, ShieldCheck, DollarSign, PieChart, TrendingUp, TrendingDown } from 'lucide-react';
import { tradingEngine } from '../engine/tradingEngine';

interface MinimalBalancesProps {
  snapshot: TerminalSnapshot;
}

export const MinimalBalances: React.FC<MinimalBalancesProps> = ({ snapshot }) => {
  const isProfit = snapshot.equity >= snapshot.balance;
  const netDiff = snapshot.equity - snapshot.balance;
  const ddPct = tradingEngine.account.daily_drawdown_pct;
  const maxDd = tradingEngine.account.max_daily_loss_pct;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* 1. Account Balance */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 relative overflow-hidden group">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 dark:text-slate-400">
            Account Balance
          </span>
          <div className="w-7 h-7 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center text-slate-400 dark:text-slate-500">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-950 dark:text-white tabular-nums tracking-tight">
          ${snapshot.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
          <span>Starting:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            ${tradingEngine.account.daily_start_balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* 2. Live Equity */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 relative overflow-hidden group">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 dark:text-slate-400">
            Live Equity
          </span>
          <div className="w-7 h-7 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center text-slate-400 dark:text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>
        <div
          className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${
            isProfit
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          ${snapshot.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
          <span>Exposure:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {snapshot.positions.length} Active {snapshot.positions.length === 1 ? 'Trade' : 'Trades'}
          </span>
        </div>
      </div>

      {/* 3. Floating P/L & Drawdown Guard */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 relative overflow-hidden group">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 dark:text-slate-400">
            Floating P/L
          </span>
          <div className="w-7 h-7 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center text-slate-400 dark:text-slate-500">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>
        <div
          className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight flex items-center gap-1.5 ${
            netDiff >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {netDiff >= 0 ? '+' : ''}${netDiff.toFixed(2)}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
          <span>Daily DD: <strong className={ddPct > 1.5 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}>{ddPct}%</strong></span>
          <span className="text-[10px]">Cap: {maxDd}%</span>
        </div>
      </div>

      {/* 4. Margin Free */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 relative overflow-hidden group">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 dark:text-slate-400">
            Available Margin
          </span>
          <div className="w-7 h-7 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center text-slate-400 dark:text-slate-500">
            <PieChart className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-950 dark:text-white tabular-nums tracking-tight">
          ${snapshot.margin_free.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
          <span>Leverage:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">1:100 Bullion</span>
        </div>
      </div>
    </div>
  );
};
