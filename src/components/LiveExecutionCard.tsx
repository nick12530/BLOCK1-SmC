/**
 * LiveExecutionCard.tsx - Unified Multi-Trade Live Execution & Margin Monitor
 * Consolidates running positions, account margin metrics, and ledger links:
 * - Single source of truth for active orders (eliminates duplicate card)
 * - Real-time floating basket P&L, lot exposure, and individual trade controls
 * - Built-in Cash Balance, Live Equity, and Free Margin telemetry
 * - Direct links to Closed Trades History and Daily Journal
 */

import React, { useMemo } from 'react';
import { usePositions, useTicker, useEngine } from '../hooks/useTradingStore';
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
  Crosshair,
  Clock,
  Timer,
  Bot,
  Scissors,
  CheckCircle2,
} from 'lucide-react';

interface LiveExecutionCardProps {
  onOpenClosedTradesModal?: () => void;
  onOpenDailyReportModal?: () => void;
  onFocusChart?: () => void;
}

const formatMT5 = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const LiveExecutionCard: React.FC<LiveExecutionCardProps> = React.memo(({
  onOpenClosedTradesModal,
  onOpenDailyReportModal,
  onFocusChart,
}) => {
  const { positions, selectedTicket, pendingOrders = [] } = usePositions();
  const ticker = useTicker();
  const engine = useEngine();

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
    const marginLevelPct = marginUsed > 0 ? `${((equity / marginUsed) * 100).toFixed(2)}%` : '0.00%';

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
    tradingEngine.modifyPositionStops(ticket, bePrice, pos.tp);
  };

  const handleLockAllBE = () => {
    positions.forEach((pos) => {
      const bePrice = Number(
        (pos.type === 'BUY' ? pos.price_open + 0.3 : pos.price_open - 0.3).toFixed(2)
      );
      tradingEngine.modifyPositionStops(pos.ticket, bePrice, pos.tp);
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
    <div className="bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-xl sm:rounded-2xl p-2.5 sm:p-4.5 flex flex-col justify-between shadow-xs space-y-2.5 sm:space-y-4 font-mono text-xs transition-colors">
      {/* Top Header: Title, Active Orders Counter & Bulk Actions */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
            Live Execution Monitor
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-slate-200 dark:border-zinc-700">
            {totalPositions} {totalPositions === 1 ? 'Trade' : 'Trades'} · {totalVolume}L
          </span>
          {pendingOrders.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
              {pendingOrders.length} Limit {pendingOrders.length === 1 ? 'Order' : 'Orders'}
            </span>
          )}

          {/* Dedicated Auto-Trader Toggle Button */}
          <button
            type="button"
            onClick={() => tradingEngine.toggleAutoTrade()}
            aria-pressed={engine.auto_trade}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              engine.auto_trade
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
            }`}
            title={
              engine.auto_trade
                ? 'Auto-Trader is ACTIVE (Automatically executes verified institutional setups). Click to turn OFF.'
                : 'Auto-Trader is OFF (Manual orders only). Click to turn ON.'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                engine.auto_trade ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
              }`}
            />
            <Bot className="w-3.5 h-3.5" />
            <span>Auto-Trader: {engine.auto_trade ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {totalPositions > 0 && (
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-black px-2.5 py-1.5 rounded-lg tabular-nums border ${
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
                  className="min-h-10 px-3 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer"
                  title="Lock Break-Even for all positions"
                >
                  Lock BE
                </button>
                <button
                  onClick={handleCloseAll}
                  className="min-h-10 px-3 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                  title="Close all positions"
                >
                  Close All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. Pending Limit Orders Strip with Minimalistic Countdown Timer */}
      {pendingOrders.length > 0 && (
        <div className="space-y-2 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>Pending Limit Orders ({pendingOrders.length})</span>
            </div>
            <span className="text-[10px] text-zinc-400 hidden sm:inline">
              Engine holds entry before cancelling if price drifts away
            </span>
          </div>

          <div className="space-y-2">
            {pendingOrders.map((order) => {
              const isBuy = order.direction === 'BUY';
              const progressPct = Math.max(
                0,
                Math.min(100, Math.round((order.remainingSeconds / order.ttlSeconds) * 100))
              );
              const minutes = Math.floor(order.remainingSeconds / 60);
              const seconds = order.remainingSeconds % 60;
              const timeDisplay = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

              return (
                <div
                  key={order.ticket}
                  className="p-3 rounded-xl border border-sky-200/90 dark:border-sky-900/60 bg-sky-50/40 dark:bg-[#091522]/60 space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 border ${
                          isBuy
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{order.type.replace('_', ' ')}</span>
                      </span>

                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {order.symbol} · {order.volume}L @ ${order.entry.toFixed(order.symbol === 'XAUUSD' || order.symbol === 'USDJPY' ? 2 : 4)}
                      </span>

                      <span className="text-slate-400 text-[10px]">#{order.ticket}</span>
                    </div>

                    {/* Minimalist Visual Countdown Timer */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold"
                        title={`Holding entry for ${order.remainingSeconds}s before auto-cancelling if price drifts > ${order.maxDriftPips} pips`}
                      >
                        <Timer className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span className="tabular-nums font-mono">{timeDisplay}</span>
                        <span className="text-[10px] text-amber-500/80">hold</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => tradingEngine.executePendingOrderNow(order.ticket)}
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                        title="Execute immediately at market price"
                      >
                        Fill Now
                      </button>

                      <button
                        type="button"
                        onClick={() => tradingEngine.cancelPendingOrder(order.ticket)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Cancel pending order"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Drift & holding metrics */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 pt-0.5">
                    <span>
                      Current Drift: <strong className="text-slate-800 dark:text-zinc-200 tabular-nums">{order.currentDriftPips} pips</strong> (Auto-cancels if &gt; {order.maxDriftPips} pips)
                    </span>
                    <span>
                      SL: ${order.sl.toFixed(2)} · TP: ${order.tp.toFixed(2)}
                    </span>
                  </div>

                  {/* Minimalist countdown progress bar */}
                  <div className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                className={`p-3.5 sm:p-4 rounded-xl border bg-slate-50/60 dark:bg-zinc-900/60 space-y-3 transition-colors ${
                  selectedTicket === pos.ticket
                    ? 'border-sky-500 dark:border-sky-700'
                    : 'border-slate-200 dark:border-zinc-800/90'
                }`}
              >
                {/* Row 1: Direction, Ticket, Lots & Floating P&L */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      tradingEngine.setSelectedTicket(pos.ticket);
                      onFocusChart?.();
                    }}
                    aria-pressed={selectedTicket === pos.ticket}
                    aria-label={`Show ${pos.type} position ${pos.ticket} and its order block on the chart`}
                    className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                  >
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-black uppercase flex items-center gap-1 border ${
                        isBuy
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-700'
                          : 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {isBuy ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                      <span>{pos.type}</span>
                    </span>

                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {pos.volume} Lots
                    </span>

                    <span className="text-slate-500 text-xs">
                      #{pos.ticket}
                    </span>

                    {pos.partialTaken && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-amber-500" />
                        <span>50% Scaled (1.5R)</span>
                      </span>
                    )}

                    {pos.trailLocked && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        OB Trailed SL
                      </span>
                    )}

                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
                      <Crosshair className="h-4 w-4" />
                      {selectedTicket === pos.ticket ? 'Focused' : 'Chart'}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-black text-sm tabular-nums px-2 py-1 ${
                        pos.profit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)} USD
                    </span>

                    <button
                      type="button"
                      onClick={() => handleScaleOut(pos.ticket)}
                      disabled={pos.partialTaken || pos.volume < 0.02}
                      aria-label={`Scale out 50% of position ${pos.ticket}`}
                      className={`min-h-10 px-2.5 rounded border text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        pos.partialTaken || pos.volume < 0.02
                          ? 'border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-default opacity-50'
                          : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}
                      title={pos.partialTaken ? '50% scale-out already executed' : 'Close 50% volume and lock BE+2pts'}
                    >
                      <Scissors className="w-3 h-3 text-amber-500" />
                      <span>50% Scale</span>
                    </button>

                    <button
                      onClick={() => handleLockBE(pos.ticket)}
                      disabled={pos.beLocked}
                      aria-label={`Move ${pos.type} position ${pos.ticket} stop to break-even`}
                      className={`min-h-10 min-w-10 px-2 rounded border text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center ${
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
                      aria-label={`Close ${pos.type} position ${pos.ticket}`}
                      className="min-h-10 min-w-10 rounded bg-slate-200 hover:bg-rose-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-rose-600 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center"
                      title="Close order"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Price Progression & TP / SL */}
                <div className="grid grid-cols-2 gap-2 text-xs text-center pt-2 border-t border-slate-200/50 dark:border-zinc-800/50 sm:grid-cols-4">
                  <div>
                    <span className="text-zinc-500 block uppercase">Entry</span>
                    <strong className="text-slate-800 dark:text-zinc-200">${pos.price_open.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase">Spot</span>
                    <strong className="text-slate-900 dark:text-white">${curPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase">SL</span>
                    <strong className="text-rose-500">${pos.sl.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase">TP</span>
                    <strong className="text-emerald-500">${pos.tp.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Row 3: Progress Bar */}
                <div className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, progressPct)}%` }}
                  />
                </div>
                {pos.strategyRationale && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                    <span className="font-bold text-sky-700 dark:text-sky-300">Trade rationale: </span>
                    {pos.strategyRationale}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : pendingOrders.length === 0 ? (
        <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-2">
          <Activity className="w-5 h-5 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            Awaiting Next Trade Execution
          </h4>
          <p className="text-[11px] text-zinc-400 font-sans max-w-xs mx-auto">
            Execute orders from the deck or enable Auto-Trade for automated entries.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => tradingEngine.toggleAutoTrade()}
              aria-pressed={engine.auto_trade}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                engine.auto_trade
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  engine.auto_trade ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
                }`}
              />
              <Bot className="w-3.5 h-3.5" />
              <span>Auto-Trader: {engine.auto_trade ? 'ACTIVE (Click to Pause)' : 'TURN ON'}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Account Margin & Journal Navigation Strip (Exact MT5 layout) */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 text-[11px]">
        {/* Margin State (MT5 standard telemetry layout) */}
        <div className="flex items-center gap-2 sm:gap-3 text-zinc-500 dark:text-zinc-400 overflow-x-auto no-scrollbar font-mono text-[10px] sm:text-[11px]">
          <span>
            Balance: <strong className="text-slate-900 dark:text-white font-bold">{formatMT5(ticker.balance)} USD</strong>
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>
            Equity: <strong className="text-slate-900 dark:text-white font-bold">{formatMT5(ticker.equity)}</strong>
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>
            Margin: <strong className="text-slate-900 dark:text-white font-bold">{formatMT5(marginMetrics.marginUsed)}</strong>
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>
            Free Margin: <strong className="text-slate-900 dark:text-white font-bold">{formatMT5(marginMetrics.freeMargin)}</strong>
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>
            Margin Level: <strong className="text-emerald-500 font-bold">{marginMetrics.marginLevelPct}</strong>
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
