/**
 * PositionsEventLogCard.tsx - Multi-Position Real-Time Tracker & Account Margin Hub
 * Mobile-Optimized & Small Account ($10) Ready:
 * - Highly legible mobile typography (no tiny unreadable text)
 * - Single-trade chart focus: tap any position to display it cleanly on the chart
 * - Verified Auto-Closing on Take Profit / Stop Loss armed
 * - Real-time Cash Balance & Live Floating Equity telemetry
 * - Institutional margin & leverage calculations
 */

import React, { useMemo } from 'react';
import { usePositions, useEvents, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { FileText, History, XCircle, ShieldCheck, Eye, CheckCircle2 } from 'lucide-react';

interface PositionsEventLogCardProps {
  onClosePosition: (ticket: number) => void;
  onOpenClosedTradesModal: () => void;
  onOpenDailyReportModal: () => void;
}

export const PositionsEventLogCard: React.FC<PositionsEventLogCardProps> = React.memo(({
  onClosePosition,
  onOpenClosedTradesModal,
  onOpenDailyReportModal,
}) => {
  const positionsState = usePositions();
  const eventsState = useEvents();
  const ticker = useTicker();

  const positions = positionsState.positions;
  const selectedTicket = positionsState.selectedTicket ?? (positions.length > 0 ? positions[positions.length - 1].ticket : null);

  const totalFloatingPnl = useMemo(() => {
    return positions.reduce((sum, p) => sum + p.profit, 0);
  }, [positions]);

  // Account Margin & Leverage Calculations (Micro account friendly)
  const marginMetrics = useMemo(() => {
    const leverage = 1000; // 1:1000 standard gold micro account leverage
    const totalVolume = positions.reduce((sum, p) => sum + p.volume, 0);
    // Gold contract size is 100 oz per lot
    const notionalValue = totalVolume * 100 * ticker.bid;
    const marginUsed = notionalValue / leverage;
    const equity = ticker.balance + totalFloatingPnl;
    const freeMargin = Math.max(0, equity - marginUsed);
    const marginLevelPct = marginUsed > 0 ? `${Math.round((equity / marginUsed) * 100)}%` : '∞ Safe';

    return {
      leverage: `1:${leverage}`,
      marginUsed: marginUsed.toFixed(2),
      freeMargin: freeMargin.toFixed(2),
      equity: equity.toFixed(2),
      marginLevelPct,
    };
  }, [positions, ticker.bid, ticker.balance, totalFloatingPnl]);

  const handleMoveToBreakEven = (ticket: number) => {
    const pos = positions.find((p) => p.ticket === ticket);
    if (!pos) return;
    pos.sl = pos.price_open;
    tradingEngine.slog(`SL moved to BE @ $${pos.price_open.toFixed(2)} (#${ticket})`, 'trade');
    (tradingEngine as any).invalidatePositions();
    (tradingEngine as any).emit('positions');
  };

  const handleCloseAll = () => {
    tradingEngine.closeAll('Manual');
  };

  const handleSelectPosition = (ticket: number) => {
    tradingEngine.setSelectedTicket(ticket);
  };

  return (
    <div className="bg-white dark:bg-[#0c0d10] border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-4 transition-colors font-mono text-xs sm:text-sm">
      <div className="space-y-3.5">
        {/* Header: Title, Count, Auto-Close Banner */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              ACTIVE TRADES ({positions.length})
            </span>

            {positions.length > 1 && (
              <button
                onClick={handleCloseAll}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer py-1 px-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Emergency close all active trades"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Close All</span>
              </button>
            )}
          </div>

          {positions.length > 0 ? (
            <span
              className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg tabular-nums shadow-xs ${
                totalFloatingPnl >= 0
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              {totalFloatingPnl >= 0 ? '+' : ''}${totalFloatingPnl.toFixed(2)} USD
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800">
              0 Active
            </span>
          )}
        </div>

        {/* Small Account Capital & Auto-Close Status Banner */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Auto-Close: Armed (SL / TP)</span>
          </div>
          <span className="text-zinc-500 font-medium">
            {ticker.balance <= 50 ? 'Micro $10 Growth Mode' : 'Standard Mode'}
          </span>
        </div>

        {/* Multi-Position Scrollable Container with Live Movement Visualizer */}
        {positions.length > 0 ? (
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {positions.map((p) => {
              const isProfit = p.profit >= 0;
              const isSelected = selectedTicket === p.ticket;
              const currentPrice = p.type === 'BUY' ? ticker.bid : ticker.ask;
              const ptsMovement = p.type === 'BUY' ? currentPrice - p.price_open : p.price_open - currentPrice;
              
              // Progress to TP: 0% at Open, 100% at TP
              const totalDistance = Math.abs(p.tp - p.price_open) || 1;
              const coveredDistance = Math.max(0, ptsMovement);
              const tpProgressPct = Math.min(100, Math.round((coveredDistance / totalDistance) * 100));

              // Distance to TP and SL
              const distanceToTp = Math.abs(p.tp - currentPrice).toFixed(1);
              const distanceToSl = Math.abs(currentPrice - p.sl).toFixed(1);

              return (
                <div
                  key={p.ticket}
                  onClick={() => handleSelectPosition(p.ticket)}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500/70 bg-cyan-500/5 dark:bg-cyan-950/20 shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700'
                  } space-y-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-black px-2.5 py-1 rounded text-xs ${
                          p.type === 'BUY'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {p.type} {p.volume}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold text-xs">
                        #{p.ticket}
                      </span>
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-500 border border-cyan-500/40 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>On Chart</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 hover:text-cyan-400">
                          (Click to view)
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-black text-sm tabular-nums block ${
                          isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}${p.profit.toFixed(2)}
                      </span>
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {ptsMovement >= 0 ? '+' : ''}{ptsMovement.toFixed(1)} pts
                      </span>
                    </div>
                  </div>

                  {/* REAL-TIME MARKET MOVEMENT VISUALIZER TO TP */}
                  <div className="space-y-1 bg-white dark:bg-black p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-medium">Progress to Target:</span>
                      <span className="font-bold text-emerald-500">{tpProgressPct}% to TP</span>
                    </div>

                    <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isProfit ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(5, tpProgressPct)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-zinc-400 pt-0.5">
                      <span>{distanceToSl} pts to SL</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">Spot ${currentPrice.toFixed(2)}</span>
                      <span className="text-emerald-500 font-bold">{distanceToTp} pts to TP</span>
                    </div>
                  </div>

                  {/* Levels & Quick Actions */}
                  <div className="flex items-center justify-between pt-0.5 text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2.5 text-zinc-500">
                      <span>Entry: <strong className="text-zinc-950 dark:text-white font-bold">${p.price_open.toFixed(1)}</strong></span>
                      <span>TP: <strong className="text-emerald-500 font-bold">${p.tp.toFixed(1)}</strong></span>
                      <span>SL: <strong className="text-rose-500 font-bold">${p.sl.toFixed(1)}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveToBreakEven(p.ticket)}
                        className="px-2.5 py-1 rounded text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
                        title="Move Stop Loss to Entry price risk-free"
                      >
                        Set BE
                      </button>
                      <button
                        onClick={() => onClosePosition(p.ticket)}
                        className="px-3 py-1 rounded text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer"
                        title="Close this individual trade"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-zinc-400 font-sans space-y-1.5">
            <span className="text-sm font-semibold block text-zinc-500">No Open Positions</span>
            <span className="text-xs block text-zinc-400">1-click execute verified SMC signal below</span>
          </div>
        )}

        {/* Real-Time Account Balance & Live Equity Telemetry Hub */}
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800">
          <div>
            <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block font-bold">
              Cash Balance
            </span>
            <span className="font-black text-sm sm:text-base text-zinc-950 dark:text-white tabular-nums">
              ${ticker.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block font-bold">
              Live Equity
            </span>
            <span
              className={`font-black text-sm sm:text-base tabular-nums ${
                ticker.equity >= ticker.balance
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              ${ticker.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* INSTITUTIONAL MARGIN & LEVERAGE METRICS HUB */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
            <span>Broker Margin State</span>
            <span className="text-emerald-500 font-mono">Leverage {marginMetrics.leverage}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white dark:bg-black p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-xs text-zinc-400 block font-medium">Free Margin</span>
              <span className="font-bold text-zinc-950 dark:text-white tabular-nums text-xs sm:text-sm">
                ${marginMetrics.freeMargin}
              </span>
            </div>

            <div className="bg-white dark:bg-black p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-xs text-zinc-400 block font-medium">Used Margin</span>
              <span className="font-bold text-zinc-950 dark:text-white tabular-nums text-xs sm:text-sm">
                ${marginMetrics.marginUsed}
              </span>
            </div>

            <div className="bg-white dark:bg-black p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-xs text-zinc-400 block font-medium">Margin Level</span>
              <span className="font-bold text-emerald-500 tabular-nums text-xs sm:text-sm">
                {marginMetrics.marginLevelPct}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reports & Ledger History Links */}
      <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold">
        <button
          onClick={onOpenClosedTradesModal}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer py-1"
        >
          <History className="w-4 h-4 text-emerald-500" />
          <span>Closed Trades</span>
        </button>

        <button
          onClick={onOpenDailyReportModal}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer py-1"
        >
          <FileText className="w-4 h-4 text-emerald-500" />
          <span>Daily Audit Log</span>
        </button>
      </div>
    </div>
  );
});
