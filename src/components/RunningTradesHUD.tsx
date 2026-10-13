import React from 'react';
import { usePositions, useTicker, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { getInstrumentConfig } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  X,
  Zap,
  Target,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface RunningTradesHUDProps {
  onOpenTradeStation?: () => void;
}

export const RunningTradesHUD: React.FC<RunningTradesHUDProps> = ({ onOpenTradeStation }) => {
  const { positions } = usePositions();
  const ticker = useTicker();
  const engine = useEngine();

  const totalPositions = positions.length;
  const totalFloatingPnl = Number(positions.reduce((sum, p) => sum + p.profit, 0).toFixed(2));
  const isOverallProfitable = totalFloatingPnl >= 0;

  if (totalPositions === 0) {
    return (
      <div className="w-full bg-slate-50 dark:bg-[#0c0e12] border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300">0 Running Trades</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2 hidden sm:inline">
              Terminal idle • Continuous multi-pair scanner monitoring market structure
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenTradeStation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold font-sans text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Start Trade</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-zinc-800/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs font-mono text-xs">
      {/* Top Banner Header: Aggregate Running P&L */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800/80 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs sm:text-sm">
            Live Running Positions ({totalPositions})
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700/60">
            1:{engine.leverage || 2000} Lev
          </span>
        </div>

        {/* Floating P&L Counter */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase text-slate-400">Total Floating Basket</div>
            <div
              className={`text-base sm:text-lg font-black tracking-tight ${
                isOverallProfitable ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {isOverallProfitable ? '+' : ''}${totalFloatingPnl.toFixed(2)} USD
            </div>
          </div>
          <button
            type="button"
            onClick={() => tradingEngine.closeAll('Manual')}
            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold border border-rose-500/30 transition-colors cursor-pointer text-[11px]"
            title="Immediately close all open market positions"
          >
            Close All
          </button>
        </div>
      </div>

      {/* Individual Running Trade Cards */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        {positions.map((pos) => {
          const isBuy = pos.type === 'BUY';
          const isPosProfit = pos.profit >= 0;
          const posSymbol = pos.symbol || ticker.symbol || 'USDJPY';
          const cfg = getInstrumentConfig(posSymbol);
          const currentPrice = isBuy ? ticker.bid : ticker.ask;

          // Pip calculations
          const pipSize = cfg.pipSize || 0.01;
          const pipsGain = Number(((pos.profit / (pos.volume * 100)) / pipSize).toFixed(1));
          const slDistancePips = pos.sl > 0 ? Math.abs(currentPrice - pos.sl) / pipSize : 0;
          const tpDistancePips = pos.tp > 0 ? Math.abs(pos.tp - currentPrice) / pipSize : 0;

          // Progress bar towards TP / SL
          let progressPct = 50;
          if (pos.tp > 0 && pos.sl > 0) {
            const totalSpan = Math.abs(pos.tp - pos.sl);
            if (totalSpan > 0) {
              const fromSl = isBuy ? currentPrice - pos.sl : pos.sl - currentPrice;
              progressPct = Math.max(5, Math.min(95, (fromSl / totalSpan) * 100));
            }
          }

          return (
            <div
              key={pos.ticket}
              className="bg-slate-50 dark:bg-[#12161f] border border-slate-200 dark:border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all hover:border-slate-300 dark:hover:border-zinc-700"
            >
              {/* Row 1: Symbol, Direction, Volume, Live P&L */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {posSymbol}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                      isBuy
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{pos.type}</span>
                    <span className="ml-0.5 text-[10px] font-mono">{pos.volume}L</span>
                  </span>
                  <span className="text-[10px] text-slate-400">#{pos.ticket}</span>
                </div>

                <div className="text-right">
                  <div
                    className={`font-black text-sm sm:text-base ${
                      isPosProfit ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {isPosProfit ? '+' : ''}${pos.profit.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {pipsGain >= 0 ? '+' : ''}{pipsGain.toFixed(1)} pips
                  </div>
                </div>
              </div>

              {/* Row 2: Price Telemetry (Entry -> Current -> SL/TP) */}
              <div className="grid grid-cols-3 gap-1 bg-white dark:bg-[#0a0d13] p-2 rounded-lg border border-slate-200/80 dark:border-zinc-800/80 text-[11px]">
                <div>
                  <div className="text-[9px] uppercase text-slate-400">Entry Price</div>
                  <div className="font-bold text-slate-900 dark:text-slate-200">
                    {pos.price_open.toFixed(cfg.digits)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-400">Current Spot</div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {currentPrice.toFixed(cfg.digits)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-400">Stop Loss / TP</div>
                  <div className="font-bold text-slate-500 dark:text-slate-400 truncate">
                    {pos.sl > 0 ? pos.sl.toFixed(cfg.digits) : 'None'} / {pos.tp > 0 ? pos.tp.toFixed(cfg.digits) : 'Open'}
                  </div>
                </div>
              </div>

              {/* Visual Trajectory Bar */}
              {pos.tp > 0 && pos.sl > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span className="text-rose-500">SL: {pos.sl.toFixed(cfg.digits)} ({slDistancePips.toFixed(1)}p)</span>
                    <span className="text-emerald-500">TP: {pos.tp.toFixed(cfg.digits)} ({tpDistancePips.toFixed(1)}p)</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isPosProfit ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Row 3: Action Buttons (Breakeven, Partial Scale Out, Close) */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => {
                    const bePrice = Number(
                      (isBuy ? pos.price_open + (cfg.pointSize * 2) : pos.price_open - (cfg.pointSize * 2)).toFixed(cfg.digits)
                    );
                    tradingEngine.modifyPositionStops(pos.ticket, bePrice, pos.tp);
                  }}
                  className="flex-1 py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold transition-colors cursor-pointer text-[10px] flex items-center justify-center gap-1"
                  title="Move Stop Loss to Entry + 2 ticks to lock zero risk"
                >
                  <Shield className="w-3 h-3 text-slate-400" />
                  <span>Lock BE</span>
                </button>

                <button
                  type="button"
                  onClick={() => tradingEngine.scaleOutPosition(pos.ticket, 0.5)}
                  className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold transition-colors cursor-pointer text-[10px]"
                  title="Close 50% of the volume to take partial profit"
                >
                  Scale 50%
                </button>

                <button
                  type="button"
                  onClick={() => tradingEngine.closePosition(pos.ticket, 'Manual')}
                  className="py-1 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                  title="Close this order immediately at market"
                >
                  <X className="w-3 h-3" />
                  <span>Close</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
