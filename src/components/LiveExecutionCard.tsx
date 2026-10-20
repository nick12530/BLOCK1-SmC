/**
 * LiveExecutionCard.tsx - NIFTY Master Active Positions & Execution Ledger
 * Clean, minimalistic operational station:
 * - Direct visibility into active running positions with live floating P&L
 * - 1-Click trade actions: Scale-Out 50%, Lock Break-Even, Close Trade, Close All
 * - Pending Limit orders with holding timers and cancel action
 * - Direct links to Closed Trades History and Daily Journal
 * - Zero duplicated telemetry or crowded nested boxes
 */

import React from 'react';
import { usePositions, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  X,
  History,
  FileText,
  Activity,
  Scissors,
  CheckCircle2,
  Clock,
  Timer,
} from 'lucide-react';
import { getInstrumentConfig, SupportedSymbol } from '../engine/instrumentConfig';

interface LiveExecutionCardProps {
  onOpenClosedTradesModal?: () => void;
  onOpenDailyReportModal?: () => void;
  onFocusChart?: () => void;
}

export const LiveExecutionCard: React.FC<LiveExecutionCardProps> = React.memo(({
  onOpenClosedTradesModal,
  onOpenDailyReportModal,
  onFocusChart,
}) => {
  const { positions, selectedTicket, pendingOrders = [] } = usePositions();
  const ticker = useTicker();

  const totalPositions = positions.length;
  const totalVolume = Number(positions.reduce((sum, p) => sum + p.volume, 0).toFixed(2));
  const totalFloatingPnl = Number(positions.reduce((sum, p) => sum + p.profit, 0).toFixed(2));
  const isOverallProfit = totalFloatingPnl >= 0;

  const handleLockBE = (ticket: number) => {
    const pos = positions.find((p) => p.ticket === ticket);
    if (!pos) return;
    const cfg = getInstrumentConfig((pos.symbol || ticker.symbol) as SupportedSymbol);
    const bePrice = Number(
      (pos.type === 'BUY' ? pos.price_open + cfg.pipSize * 3 : pos.price_open - cfg.pipSize * 3).toFixed(cfg.digits)
    );
    tradingEngine.modifyPositionStops(ticket, bePrice, pos.tp);
    tradingEngine.slog(`Break-Even locked for trade #${ticket} at $${bePrice}`, 'trade');
  };

  const handleLockAllBE = () => {
    positions.forEach((pos) => {
      handleLockBE(pos.ticket);
    });
  };

  const handleScaleOut = (ticket: number) => {
    tradingEngine.scaleOutPosition(ticket, 0.5);
  };

  const handleClose = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  };

  const handleCloseAll = () => {
    tradingEngine.closeAll('Manual');
  };

  return (
    <div className="w-full bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xs font-mono text-xs flex flex-col gap-4 transition-colors">
      {/* Header: Title, Total Position Stats & Bulk Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-500" />
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs sm:text-sm font-sans">
            Active Positions &amp; Orders
          </h3>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
            ({totalPositions} {totalPositions === 1 ? 'Trade' : 'Trades'} · {totalVolume}L)
          </span>
        </div>

        {totalPositions > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase">Floating P&amp;L:</span>
              <strong
                className={`font-black text-sm sm:text-base tabular-nums ${
                  isOverallProfit ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {isOverallProfit ? '+' : ''}${totalFloatingPnl.toFixed(2)} USD
              </strong>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLockAllBE}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold transition-colors cursor-pointer"
                title="Move Stop Loss to Break-Even on all trades"
              >
                Lock All BE
              </button>
              <button
                type="button"
                onClick={handleCloseAll}
                className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors cursor-pointer"
                title="Immediately close all open positions"
              >
                Close All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Limit Orders Section (if any) */}
      {pendingOrders.length > 0 && (
        <div className="space-y-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-bold">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Pending Orders ({pendingOrders.length})</span>
          </div>

          <div className="space-y-2">
            {pendingOrders.map((order) => {
              const isBuy = order.direction === 'BUY';
              const minutes = Math.floor(order.remainingSeconds / 60);
              const seconds = order.remainingSeconds % 60;
              const timeDisplay = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

              return (
                <div
                  key={order.ticket}
                  className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black uppercase text-xs ${
                        isBuy ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {order.direction} LIMIT
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {order.symbol} · {order.volume}L @ ${order.entry.toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-[10px]">#{order.ticket}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                      <Timer className="w-3.5 h-3.5" />
                      <span>{timeDisplay} left</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => tradingEngine.cancelPendingOrder(order.ticket)}
                      className="px-2 py-1 rounded bg-slate-200 dark:bg-zinc-800 hover:text-rose-500 font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Running Positions List */}
      {totalPositions > 0 ? (
        <div className="space-y-2.5">
          {positions.map((pos) => {
            const isBuy = pos.type === 'BUY';
            const isProfit = pos.profit >= 0;
            const sym = (pos.symbol || ticker.symbol) as SupportedSymbol;
            const cfg = getInstrumentConfig(sym);
            const isSelected = selectedTicket === pos.ticket;

            return (
              <div
                key={pos.ticket}
                className={`p-3.5 rounded-lg border transition-colors flex items-center justify-between gap-3 flex-wrap ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/5'
                    : 'border-slate-200 dark:border-zinc-800/90 bg-slate-50/70 dark:bg-[#0f1117] hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Trade Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`font-black text-xs uppercase flex items-center gap-1 shrink-0 ${
                      isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{pos.type}</span>
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 dark:text-white font-sans text-sm">
                        {sym}
                      </span>
                      <span className="text-slate-500 font-mono text-xs">
                        {pos.volume}L @ ${pos.price_open.toFixed(cfg.digits)}
                      </span>
                      <span className="text-[10px] text-slate-400">#{pos.ticket}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>SL: ${pos.sl > 0 ? pos.sl.toFixed(cfg.digits) : 'None'}</span>
                      <span>·</span>
                      <span>TP: ${pos.tp > 0 ? pos.tp.toFixed(cfg.digits) : 'None'}</span>
                      {pos.beLocked && (
                        <>
                          <span>·</span>
                          <span className="text-sky-500 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> BE Secured
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live P&L & Individual Action Buttons */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span
                      className={`text-sm sm:text-base font-black tabular-nums block ${
                        isProfit ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isProfit ? '+' : ''}${pos.profit.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400">Floating USD</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Scale-Out 50% */}
                    <button
                      type="button"
                      onClick={() => handleScaleOut(pos.ticket)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                      title="Close 50% volume to secure partial profit"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Scale 50%</span>
                    </button>

                    {/* Lock BE */}
                    {!pos.beLocked && (
                      <button
                        type="button"
                        onClick={() => handleLockBE(pos.ticket)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                        title="Move Stop Loss to Break-Even"
                      >
                        <Shield className="w-3 h-3 text-sky-500" />
                        <span>BE</span>
                      </button>
                    )}

                    {/* Close Position */}
                    <button
                      type="button"
                      onClick={() => handleClose(pos.ticket)}
                      className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                      title="Immediately close this position"
                    >
                      <X className="w-3 h-3" />
                      <span>Close</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : pendingOrders.length === 0 ? (
        /* Standby State (Clean, non-crowded) */
        <div className="py-6 px-4 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-1.5">
          <Activity className="w-4 h-4 text-slate-400 dark:text-zinc-600 mx-auto" />
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            No Active Positions
          </h4>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-sans max-w-sm mx-auto">
            Terminal is listening for institutional setups. Orders execute automatically via Auto-Trader or with 1-click execution above.
          </p>
        </div>
      ) : null}

      {/* Footer Strip: Quick Links to Trade History & Audit Journal */}
      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
        <span className="font-sans">
          Broker Stop Loss &amp; Take Profit synced automatically
        </span>

        <div className="flex items-center gap-3">
          {onOpenClosedTradesModal && (
            <button
              onClick={onOpenClosedTradesModal}
              className="flex items-center gap-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Closed Trades</span>
            </button>
          )}

          {onOpenDailyReportModal && (
            <button
              onClick={onOpenDailyReportModal}
              className="flex items-center gap-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Daily Report</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
