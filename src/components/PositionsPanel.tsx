import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Layers,
  X,
  Lock,
  Scissors,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { usePositions, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { INSTRUMENTS, SupportedSymbol } from '../engine/instrumentConfig';
import { Position } from '../types/smc';

interface PositionsPanelProps {
  onRequestCloseAll: () => void;
  onFocusPositionChart?: (symbol: SupportedSymbol) => void;
}

export const PositionsPanel: React.FC<PositionsPanelProps> = ({
  onRequestCloseAll,
  onFocusPositionChart,
}) => {
  const positionsState = usePositions();
  const ticker = useTicker();
  const positions = positionsState.positions;

  const totalFloatingPnl = positions.reduce((acc, p) => acc + (p.profit || 0), 0);

  const handleLockBreakEven = (pos: Position) => {
    const sym = (pos.symbol || ticker.symbol || 'XAUUSD') as SupportedSymbol;
    const cfg = INSTRUMENTS[sym] || INSTRUMENTS.XAUUSD;
    // Set SL to entry + 1 pip
    const beSl = pos.type === 'BUY'
      ? pos.price_open + cfg.pipSize
      : pos.price_open - cfg.pipSize;
    tradingEngine.modifyPositionStops(pos.ticket, Number(beSl.toFixed(cfg.digits)), pos.tp);
  };

  const handleScaleOut50 = (ticket: number) => {
    tradingEngine.scaleOutPosition(ticket, 0.5);
  };

  const handleCloseSingle = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  };

  return (
    <div className="flex flex-col bg-[#10141D] rounded border border-white/[0.06] overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#141923] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
            ACTIVE POSITIONS
          </span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30">
            {positions.length}
          </span>
          {positions.length > 0 && (
            <span
              className={`text-[11px] font-mono font-bold tabular-nums ml-2 ${
                totalFloatingPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'
              }`}
            >
              PNL: {totalFloatingPnl >= 0 ? '+' : ''}${totalFloatingPnl.toFixed(2)}
            </span>
          )}
        </div>

        {positions.length > 0 && (
          <button
            type="button"
            onClick={onRequestCloseAll}
            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#FF5252] hover:bg-[#FF5252]/10 border border-[#FF5252]/30 transition-colors cursor-pointer"
          >
            CLOSE ALL
          </button>
        )}
      </div>

      {/* Positions Table */}
      {positions.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center text-center p-4">
          <p className="font-mono text-xs text-zinc-400 font-semibold">
            No active positions open.
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">
            Institutional signals will auto-execute when criteria pass or via 1-Click.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.04] text-zinc-500 text-[10px] uppercase font-bold bg-[#0A0E14]/40">
                <th className="py-1.5 px-2.5">TICKET</th>
                <th className="py-1.5 px-2">SYM</th>
                <th className="py-1.5 px-2">DIR</th>
                <th className="py-1.5 px-2">VOL</th>
                <th className="py-1.5 px-2">ENTRY</th>
                <th className="py-1.5 px-2">CURRENT</th>
                <th className="py-1.5 px-2">SL / TP</th>
                <th className="py-1.5 px-2">PNL ($)</th>
                <th className="py-1.5 px-2 text-center">STATUS</th>
                <th className="py-1.5 px-2.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {positions.map((pos) => {
                const sym = (pos.symbol || ticker.symbol || 'XAUUSD') as SupportedSymbol;
                const cfg = INSTRUMENTS[sym] || INSTRUMENTS.XAUUSD;
                const isBuy = pos.type === 'BUY';
                const curPrice = isBuy ? ticker.bid : ticker.ask;
                const isProfit = (pos.profit || 0) >= 0;

                return (
                  <tr
                    key={pos.ticket}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Ticket */}
                    <td className="py-2 px-2.5 text-zinc-400 tabular-nums">
                      #{pos.brokerTicket || pos.ticket}
                    </td>

                    {/* Symbol */}
                    <td className="py-2 px-2 font-bold text-zinc-200">
                      <button
                        type="button"
                        onClick={() => onFocusPositionChart?.(sym)}
                        className="hover:text-[#2979FF] transition-colors cursor-pointer"
                        title="Click to view chart for this symbol"
                      >
                        {sym}
                      </button>
                    </td>

                    {/* Direction */}
                    <td className="py-2 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isBuy
                            ? 'bg-[#2979FF]/15 text-[#2979FF]'
                            : 'bg-[#FF5252]/15 text-[#FF5252]'
                        }`}
                      >
                        {pos.type}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-2 px-2 text-zinc-300 tabular-nums font-bold">
                      {pos.volume.toFixed(2)}L
                    </td>

                    {/* Entry Price */}
                    <td className="py-2 px-2 text-zinc-300 tabular-nums">
                      {pos.price_open.toFixed(cfg.digits)}
                    </td>

                    {/* Current Price */}
                    <td className="py-2 px-2 text-zinc-200 tabular-nums font-semibold">
                      {curPrice.toFixed(cfg.digits)}
                    </td>

                    {/* SL / TP */}
                    <td className="py-2 px-2 text-zinc-400 tabular-nums text-[10px]">
                      <span className="text-[#FF5252]">{pos.sl > 0 ? pos.sl.toFixed(cfg.digits) : '-'}</span>
                      <span className="text-zinc-600 mx-1">/</span>
                      <span className="text-[#00E676]">{pos.tp > 0 ? pos.tp.toFixed(cfg.digits) : '-'}</span>
                    </td>

                    {/* PnL */}
                    <td className="py-2 px-2 tabular-nums font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          isProfit
                            ? 'bg-[#00E676]/15 text-[#00E676]'
                            : 'bg-[#FF5252]/15 text-[#FF5252]'
                        }`}
                      >
                        {isProfit ? '+' : ''}${(pos.profit || 0).toFixed(2)}
                      </span>
                      {pos.pips !== undefined && (
                        <span className="text-[10px] text-zinc-400 ml-1">
                          ({pos.pips >= 0 ? '+' : ''}{pos.pips}p)
                        </span>
                      )}
                    </td>

                    {/* Badges */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {pos.beLocked && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 font-bold"
                            title="Stop Loss is locked at Break-Even"
                          >
                            BE
                          </span>
                        )}
                        {pos.trailLocked && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30 font-bold"
                            title="ATR Dynamic Trailing Stop active"
                          >
                            TRAIL
                          </span>
                        )}
                        {pos.partialTaken && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold"
                            title="Partial TP (Scale out) executed"
                          >
                            ½ TP
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Lock Break-Even */}
                        <button
                          type="button"
                          onClick={() => handleLockBreakEven(pos)}
                          disabled={pos.beLocked}
                          title="Lock Stop Loss to Break-Even (+1 pip)"
                          className={`p-1 rounded text-[10px] transition-colors cursor-pointer border ${
                            pos.beLocked
                              ? 'bg-zinc-800 text-zinc-600 border-zinc-800 cursor-not-allowed'
                              : 'bg-white/[0.04] text-zinc-300 hover:text-white border-white/[0.06] hover:bg-white/[0.08]'
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                        </button>

                        {/* Scale out 50% */}
                        <button
                          type="button"
                          onClick={() => handleScaleOut50(pos.ticket)}
                          disabled={pos.volume <= 0.01}
                          title="Scale out 50% of position size"
                          className={`p-1 rounded text-[10px] transition-colors cursor-pointer border ${
                            pos.volume <= 0.01
                              ? 'bg-zinc-800 text-zinc-600 border-zinc-800 cursor-not-allowed'
                              : 'bg-white/[0.04] text-zinc-300 hover:text-white border-white/[0.06] hover:bg-white/[0.08]'
                          }`}
                        >
                          <Scissors className="w-3 h-3" />
                        </button>

                        {/* Close Full */}
                        <button
                          type="button"
                          onClick={() => handleCloseSingle(pos.ticket)}
                          title="Close position immediately at market"
                          className="p-1 rounded text-[10px] bg-[#FF5252]/10 hover:bg-[#FF5252]/20 text-[#FF5252] border border-[#FF5252]/30 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
