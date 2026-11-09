import React from 'react';
import { usePositions, useTicker, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { getInstrumentConfig } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  X,
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
      <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl px-4 py-2.5 bg-white dark:bg-[#121917] flex items-center justify-between gap-3 font-mono text-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-slate-600 dark:text-slate-400 font-medium">0 Open Positions</span>
          <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">· Standing by for confirmed SMC setups</span>
        </div>
        <button
          type="button"
          onClick={onOpenTradeStation}
          className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold"
        >
          View Trade Journal
        </button>
      </div>
    );
  }

  return (
    <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl px-4 py-3 bg-white dark:bg-[#121917] font-mono text-xs transition-colors space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 text-xs">
            Open Positions ({totalPositions})
          </span>
          <span className="text-slate-400 dark:text-slate-500 text-[11px]">
            1:{engine.leverage || 2000} Lev
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Floating P&L:</span>
            <strong
              className={`text-sm tabular-nums font-bold ${
                isOverallProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isOverallProfitable ? '+' : ''}${totalFloatingPnl.toFixed(2)}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => tradingEngine.closeAll('Manual')}
            className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer text-[11px]"
            title="Immediately close all open market positions"
          >
            Close All
          </button>
        </div>
      </div>

      {/* Position Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {positions.map((pos) => {
          const isBuy = pos.type === 'BUY';
          const isPosProfit = pos.profit >= 0;
          const posSymbol = pos.symbol || ticker.symbol || 'USDJPY';
          const cfg = getInstrumentConfig(posSymbol);
          const hasLiveQuote = ticker.symbol === posSymbol;
          const pipsGain = Number(pos.pips.toFixed(1));
          const currentPrice = hasLiveQuote
            ? isBuy ? ticker.bid : ticker.ask
            : pos.price_open + (isBuy ? pipsGain : -pipsGain) * cfg.pipSize;

          return (
            <div
              key={pos.ticket}
              className="p-3 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/60 dark:bg-[#0f1513] flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] ${
                    isBuy
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {isBuy ? 'B' : 'S'}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <span>{posSymbol}</span>
                    <span className="text-[11px] text-slate-400 font-normal">{pos.volume}L</span>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    Open: {pos.price_open.toFixed(cfg.digits)} · Spot: {currentPrice.toFixed(cfg.digits)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div
                    className={`font-bold tabular-nums ${
                      isPosProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isPosProfit ? '+' : ''}${pos.profit.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {pipsGain > 0 ? `+${pipsGain}` : pipsGain} pips
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => tradingEngine.closePosition(pos.ticket, 'Manual')}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Close Position"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
