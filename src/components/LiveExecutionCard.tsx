/**
 * LiveExecutionCard.tsx - Multi-Trade Live Execution Monitor
 * Allows traders to monitor multiple concurrent positions simultaneously:
 * - Supports arbitrary lot sizes & unlimited concurrent positions
 * - Shows total basket exposure, total floating P&L, and individual position meters
 * - Monochromatic grey, white, and black design in dark mode
 * - 1-Click Break-Even and individual or bulk close
 */

import React from 'react';
import { usePositions, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  X,
  XCircle,
  Activity,
  Layers,
} from 'lucide-react';

export const LiveExecutionCard: React.FC = React.memo(() => {
  const { positions } = usePositions();
  const ticker = useTicker();

  const totalPositions = positions.length;
  const totalVolume = Number(positions.reduce((sum, p) => sum + p.volume, 0).toFixed(2));
  const totalFloatingPnl = Number(positions.reduce((sum, p) => sum + p.profit, 0).toFixed(2));

  const handleLockBE = (ticket: number) => {
    const pos = positions.find((p) => p.ticket === ticket);
    if (!pos) return;
    const bePrice = Number(
      (pos.type === 'BUY' ? pos.price_open + 0.3 : pos.price_open - 0.3).toFixed(2)
    );
    pos.sl = bePrice;
    pos.beLocked = true;
    tradingEngine.slog(`Manual Zero-Risk BE Lock: SL moved to $${bePrice.toFixed(2)} (#${pos.ticket})`, 'trade');
    tradingEngine.notify();
  };

  const handleLockAllBE = () => {
    positions.forEach((pos) => {
      const bePrice = Number(
        (pos.type === 'BUY' ? pos.price_open + 0.3 : pos.price_open - 0.3).toFixed(2)
      );
      pos.sl = bePrice;
      pos.beLocked = true;
    });
    tradingEngine.slog(`Locked Break-Even for all ${positions.length} active positions`, 'trade');
    tradingEngine.notify();
  };

  const handleClose = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  };

  const handleCloseAll = () => {
    tradingEngine.closeAll('Manual');
  };

  return (
    <div className="bg-white dark:bg-[#0c0d10] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-4 font-mono text-xs sm:text-sm transition-colors">
      {/* Top Header: Title, Total Exposure, and Bulk Controls */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
            Live Trade Execution Monitor
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-bold border border-zinc-200 dark:border-zinc-700">
            {totalPositions} {totalPositions === 1 ? 'Trade' : 'Trades'} · {totalVolume} Lots
          </span>
        </div>

        {totalPositions > 0 && (
          <div className="flex items-center gap-2">
            {/* Total Floating P&L */}
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-lg tabular-nums border ${
                totalFloatingPnl >= 0
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-rose-600 dark:text-rose-400 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              Total: {totalFloatingPnl >= 0 ? '+' : ''}${totalFloatingPnl.toFixed(2)} USD
            </span>

            {/* Bulk Actions */}
            {totalPositions > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleLockAllBE}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer"
                  title="Lock Break-Even for all open positions"
                >
                  Lock All BE
                </button>
                <button
                  onClick={handleCloseAll}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-200 dark:hover:bg-white dark:text-black transition-colors cursor-pointer"
                  title="Close all open trades"
                >
                  Close All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body: Active Trades List or Standby State */}
      {totalPositions > 0 ? (
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {positions.map((pos) => {
            const isBuy = pos.type === 'BUY';
            const curPrice = isBuy ? ticker.bid : ticker.ask;
            const diffFromEntry = isBuy ? curPrice - pos.price_open : pos.price_open - curPrice;
            const totalTargetDiff = Math.abs(pos.tp - pos.price_open) || 4.0;
            const progressPct = Math.min(100, Math.max(0, Math.round((diffFromEntry / totalTargetDiff) * 100)));

            return (
              <div
                key={pos.ticket}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-slate-50/60 dark:bg-zinc-900/60 space-y-2.5 transition-colors"
              >
                {/* Row 1: Direction, Ticket, Lots & Floating P&L */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-black uppercase flex items-center gap-1 border ${
                        isBuy
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-700'
                          : 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {isBuy ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                      <span>{pos.type}</span>
                    </span>

                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {pos.volume} Lots
                    </span>

                    <span className="text-slate-400 text-[11px]">
                      #{pos.ticket}
                    </span>
                  </div>

                  {/* Profit Display & Actions */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black text-xs sm:text-sm tabular-nums ${
                        pos.profit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)} USD
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        ({pos.pips >= 0 ? '+' : ''}{pos.pips} pips)
                      </span>
                    </span>

                    {/* Quick BE & Close */}
                    <button
                      onClick={() => handleLockBE(pos.ticket)}
                      disabled={pos.beLocked}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1 ${
                        pos.beLocked
                          ? 'border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-default'
                          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                      }`}
                      title={pos.beLocked ? 'Break-even locked' : 'Move SL to entry + 0.3 points'}
                    >
                      <Shield className="w-3 h-3" />
                      <span className="hidden sm:inline">{pos.beLocked ? 'BE Locked' : 'BE'}</span>
                    </button>

                    <button
                      onClick={() => handleClose(pos.ticket)}
                      className="p-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                      title="Close this trade"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Price Metrics Matrix */}
                <div className="grid grid-cols-4 gap-2 text-[11px] font-mono border-t border-slate-200/60 dark:border-zinc-800/60 pt-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Entry</span>
                    <strong className="text-slate-800 dark:text-zinc-200">${pos.price_open.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current</span>
                    <strong className="text-slate-900 dark:text-white">${curPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Stop Loss</span>
                    <strong className="text-slate-700 dark:text-zinc-300">${pos.sl.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Take Profit</span>
                    <strong className="text-slate-700 dark:text-zinc-300">${pos.tp.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Row 3: Progress Bar towards Take Profit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Progress to TP</span>
                    <span className="font-bold text-slate-600 dark:text-zinc-300">{progressPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-700 dark:bg-zinc-300 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, progressPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Standby State */
        <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-2">
          <Activity className="w-6 h-6 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            Awaiting Next Trade Execution
          </h4>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-sans max-w-sm mx-auto">
            Execute custom trades with your desired lot size above, or toggle Auto-Trade to enter confirmed SMC setups.
          </p>
        </div>
      )}
    </div>
  );
});
