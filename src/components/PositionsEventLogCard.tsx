/**
 * PositionsEventLogCard.tsx - Multi-Position Real-Time Tracker & Account Margin Hub
 * Features:
 * - Real-time market movement visualizer for every active position (distance to TP / SL)
 * - Trailing live points movement (+/- pts from entry)
 * - Complete institutional margin metrics: Free Margin, Used Margin, Margin Level %, Leverage
 * - 1-Click Break-Even (Set BE) and Emergency Close All
 */

import React, { useMemo } from 'react';
import { usePositions, useEvents, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { FileText, History, XCircle, ArrowUpRight, ArrowDownRight, ShieldCheck, Zap } from 'lucide-react';

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
  const logs = eventsState.log.slice(0, 3);

  const totalFloatingPnl = useMemo(() => {
    return positions.reduce((sum, p) => sum + p.profit, 0);
  }, [positions]);

  // Account Margin & Leverage Calculations
  const marginMetrics = useMemo(() => {
    const leverage = 500; // 1:500 standard gold institutional leverage
    const totalVolume = positions.reduce((sum, p) => sum + p.volume, 0);
    // Gold contract size is 100 oz per lot
    const notionalValue = totalVolume * 100 * ticker.bid;
    const marginUsed = notionalValue / leverage;
    const equity = ticker.balance + totalFloatingPnl;
    const freeMargin = Math.max(0, equity - marginUsed);
    const marginLevelPct = marginUsed > 0 ? `${Math.round((equity / marginUsed) * 100)}%` : '∞ (No Margin)';

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

  return (
    <div className="bg-white dark:bg-black border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs space-y-3.5 transition-colors font-mono text-xs">
      <div className="space-y-3">
        {/* Positions Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              ACTIVE POSITIONS ({positions.length})
            </span>

            {positions.length > 1 && (
              <button
                onClick={handleCloseAll}
                className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Emergency close all active trades"
              >
                <XCircle className="w-3 h-3" />
                <span>Close All</span>
              </button>
            )}
          </div>

          {positions.length > 0 && (
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-lg tabular-nums ${
                totalFloatingPnl >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {totalFloatingPnl >= 0 ? '+' : ''}${totalFloatingPnl.toFixed(2)} USD
            </span>
          )}
        </div>

        {/* Multi-Position Scrollable Container with Live Movement Visualizer */}
        {positions.length > 0 ? (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {positions.map((p) => {
              const isProfit = p.profit >= 0;
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
                  className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-black px-2 py-0.5 rounded text-[10px] ${
                          p.type === 'BUY'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {p.type} {p.volume}
                      </span>
                      <span className="text-zinc-400 text-[10px]">#{p.ticket}</span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-black text-xs tabular-nums block ${
                          isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}${p.profit.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-400 tabular-nums">
                        {ptsMovement >= 0 ? '+' : ''}{ptsMovement.toFixed(1)} pts
                      </span>
                    </div>
                  </div>

                  {/* REAL-TIME MARKET MOVEMENT VISUALIZER TO TP */}
                  <div className="space-y-1 bg-white dark:bg-black p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500">Live Progress to Target:</span>
                      <span className="font-bold text-emerald-500">{tpProgressPct}% of TP</span>
                    </div>

                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isProfit ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(5, tpProgressPct)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-zinc-400 pt-0.5">
                      <span>{distanceToSl} pts to SL</span>
                      <span className="font-bold text-zinc-300">Spot ${currentPrice.toFixed(2)}</span>
                      <span className="text-emerald-400">{distanceToTp} pts to TP</span>
                    </div>
                  </div>

                  {/* Levels & Quick Actions */}
                  <div className="flex items-center justify-between pt-0.5 text-[10px]">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <span>Open: <strong className="text-zinc-950 dark:text-white">${p.price_open.toFixed(1)}</strong></span>
                      <span>TP: <strong className="text-emerald-500">${p.tp.toFixed(1)}</strong></span>
                      <span>SL: <strong className="text-rose-500">${p.sl.toFixed(1)}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMoveToBreakEven(p.ticket)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:text-white hover:bg-zinc-900 transition-colors"
                        title="Move Stop Loss to Entry price risk-free"
                      >
                        Set BE
                      </button>
                      <button
                        onClick={() => onClosePosition(p.ticket)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors"
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
          <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-zinc-400 font-sans space-y-1">
            <span className="text-xs font-semibold block text-zinc-500">No Open Positions</span>
            <span className="text-[11px] block">Awaiting verified high-probability signal</span>
          </div>
        )}

        {/* Real-Time Account Balance & Live Equity */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-semibold">
              Cash Balance
            </span>
            <span className="font-bold text-xs text-zinc-950 dark:text-white tabular-nums">
              ${ticker.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-semibold">
              Live Equity
            </span>
            <span
              className={`font-black text-xs tabular-nums ${
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
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            <span>Broker Margin &amp; Risk State</span>
            <span className="text-emerald-500 font-mono">Leverage {marginMetrics.leverage}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-[9px] text-zinc-400 block">Free Margin</span>
              <span className="font-bold text-zinc-950 dark:text-white tabular-nums text-[11px]">
                ${marginMetrics.freeMargin}
              </span>
            </div>

            <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-[9px] text-zinc-400 block">Used Margin</span>
              <span className="font-bold text-zinc-950 dark:text-white tabular-nums text-[11px]">
                ${marginMetrics.marginUsed}
              </span>
            </div>

            <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-[9px] text-zinc-400 block">Margin Level</span>
              <span className="font-bold text-emerald-500 tabular-nums text-[11px]">
                {marginMetrics.marginLevelPct}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reports & Ledger History Links */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
        <button
          onClick={onOpenClosedTradesModal}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          <span>Closed Trades</span>
        </button>

        <button
          onClick={onOpenDailyReportModal}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Daily Audit Log</span>
        </button>
      </div>
    </div>
  );
});
