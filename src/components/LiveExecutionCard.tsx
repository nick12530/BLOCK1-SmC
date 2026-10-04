/**
 * LiveExecutionCard.tsx - Unified Multi-Trade Live Execution & Margin Monitor
 * Consolidates running positions, account margin metrics, and ledger links:
 * - Single source of truth for active orders (eliminates duplicate card)
 * - Real-time floating basket P&L, lot exposure, and individual trade controls
 * - Built-in Cash Balance, Live Equity, and Free Margin telemetry
 * - Direct links to Closed Trades History and Daily Journal
 */

import React, { useMemo } from 'react';
import { usePositions, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  X,
  Layers,
  History,
  FileText,
  Activity,
} from 'lucide-react';

interface LiveExecutionCardProps {
  onOpenClosedTradesModal?: () => void;
  onOpenDailyReportModal?: () => void;
}

export const LiveExecutionCard: React.FC<LiveExecutionCardProps> = React.memo(({
  onOpenClosedTradesModal,
  onOpenDailyReportModal,
}) => {
  const { positions } = usePositions();
  const ticker = useTicker();

  const totalPositions = positions.length;
  const totalVolume = Number(positions.reduce((sum, p) => sum + p.volume, 0).toFixed(2));
  const totalFloatingPnl = Number(positions.reduce((sum, p) => sum + p.profit, 0).toFixed(2));

  // Margin & Leverage metrics
  const marginMetrics = useMemo(() => {
    const leverage = 1000;
    const notionalValue = totalVolume * 100 * ticker.bid;
    const marginUsed = notionalValue / leverage;
    const equity = ticker.balance + totalFloatingPnl;
    const freeMargin = Math.max(0, equity - marginUsed);
    const marginLevelPct = marginUsed > 0 ? `${Math.round((equity / marginUsed) * 100)}%` : 'Safe';

    return {
      marginUsed: marginUsed.toFixed(2),
      freeMargin: freeMargin.toFixed(2),
      marginLevelPct,
    };
  }, [totalVolume, ticker.bid, ticker.balance, totalFloatingPnl]);

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
    <div className="bg-white dark:bg-[#0c0d10] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-4 font-mono text-xs transition-colors">
      {/* Top Header: Title, Active Orders Counter & Bulk Actions */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
            Live Execution Monitor
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-slate-200 dark:border-zinc-700">
            {totalPositions} {totalPositions === 1 ? 'Trade' : 'Trades'} · {totalVolume}L
          </span>
        </div>

        {totalPositions > 0 && (
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-lg tabular-nums border ${
                totalFloatingPnl >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
              }`}
            >
              Net: {totalFloatingPnl >= 0 ? '+' : ''}${totalFloatingPnl.toFixed(2)} USD
            </span>

            {totalPositions > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleLockAllBE}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer"
                  title="Lock Break-Even for all positions"
                >
                  Lock BE
                </button>
                <button
                  onClick={handleCloseAll}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                  title="Close all positions"
                >
                  Close All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body: Active Running Positions or Clean Standby State */}
      {totalPositions > 0 ? (
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {positions.map((pos) => {
            const isBuy = pos.type === 'BUY';
            const curPrice = isBuy ? ticker.bid : ticker.ask;
            const diffFromEntry = isBuy ? curPrice - pos.price_open : pos.price_open - curPrice;
            const totalTargetDiff = Math.abs(pos.tp - pos.price_open) || 4.0;
            const progressPct = Math.min(100, Math.max(0, Math.round((diffFromEntry / totalTargetDiff) * 100)));

            return (
              <div
                key={pos.ticket}
                className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-slate-50/60 dark:bg-zinc-900/60 space-y-2 transition-colors"
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

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black text-xs tabular-nums ${
                        pos.profit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)} USD
                    </span>

                    <button
                      onClick={() => handleLockBE(pos.ticket)}
                      disabled={pos.beLocked}
                      className={`p-1 rounded border text-[10px] font-bold transition-colors cursor-pointer ${
                        pos.beLocked
                          ? 'border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-default'
                          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 text-zinc-700 dark:text-zinc-200'
                      }`}
                      title="Move SL to break-even"
                    >
                      <Shield className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleClose(pos.ticket)}
                      className="p-1 rounded bg-slate-200 hover:bg-rose-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-rose-600 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
                      title="Close order"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Price Progression & TP / SL */}
                <div className="grid grid-cols-4 gap-1.5 text-[10px] text-center pt-1 border-t border-slate-200/50 dark:border-zinc-800/50">
                  <div>
                    <span className="text-zinc-400 block uppercase">Entry</span>
                    <strong className="text-slate-800 dark:text-zinc-200">${pos.price_open.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block uppercase">Spot</span>
                    <strong className="text-slate-900 dark:text-white">${curPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block uppercase">SL</span>
                    <strong className="text-rose-500">${pos.sl.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block uppercase">TP</span>
                    <strong className="text-emerald-500">${pos.tp.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Row 3: Progress Bar */}
                <div className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-700 dark:bg-zinc-300 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, progressPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-1">
          <Activity className="w-5 h-5 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            Awaiting Next Trade Execution
          </h4>
          <p className="text-[11px] text-zinc-400 font-sans max-w-xs mx-auto">
            Execute orders from the deck or enable Auto-Trade for SMC entries.
          </p>
        </div>
      )}

      {/* Account Margin & Journal Navigation Strip */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 text-[11px]">
        {/* Margin State */}
        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <span>
            Bal: <strong className="text-slate-900 dark:text-white">${ticker.balance.toFixed(2)}</strong>
          </span>
          <span>·</span>
          <span>
            Free Margin: <strong className="text-slate-900 dark:text-white">${marginMetrics.freeMargin}</strong>
          </span>
        </div>

        {/* Ledger Links */}
        <div className="flex items-center gap-3">
          {onOpenClosedTradesModal && (
            <button
              onClick={onOpenClosedTradesModal}
              className="flex items-center gap-1 text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-zinc-400" />
              <span>History</span>
            </button>
          )}

          {onOpenDailyReportModal && (
            <button
              onClick={onOpenDailyReportModal}
              className="flex items-center gap-1 text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>Journal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
