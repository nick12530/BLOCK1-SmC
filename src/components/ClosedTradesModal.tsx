/**
 * ClosedTradesModal.tsx - Trade History Ledger with Virtualized Windowing
 * Beyond 200 rows, uses lightweight DOM windowing for 60fps scrolling (Priority 5, Item 17).
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useClosedTrades } from '../hooks/useTradingStore';
import { ClosedTrade } from '../types/smc';
import { History, X } from 'lucide-react';

interface ClosedTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROW_HEIGHT = 40;
const VISIBLE_COUNT = 12;

export const ClosedTradesModal: React.FC<ClosedTradesModalProps> = ({ isOpen, onClose }) => {
  const closedTrades = useClosedTrades();
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const totalTrades = closedTrades.length;
  const wins = closedTrades.filter((t) => t.profit > 0).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const totalNet = closedTrades.reduce((sum, t) => sum + t.profit, 0);

  // Virtualization windowing calculation (Priority 5, Item 17)
  const isVirtualized = totalTrades > 200;
  const totalHeight = totalTrades * ROW_HEIGHT;
  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2) : 0;
  const endIndex = isVirtualized
    ? Math.min(totalTrades, startIndex + VISIBLE_COUNT + 4)
    : totalTrades;

  const visibleRows = useMemo(() => {
    return closedTrades.slice(startIndex, endIndex);
  }, [closedTrades, startIndex, endIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isVirtualized) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="closed-trades-title"
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-400" />
            <div>
              <h2 id="closed-trades-title" className="text-sm font-bold text-white">
                Closed Trades History & Ledger
              </h2>
              <p className="text-[11px] text-slate-400">
                {totalTrades} total executions recorded · {isVirtualized ? 'Virtualized (60fps)' : 'All records'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-[#0c1017] border-b border-slate-800 text-center">
          <div>
            <span className="text-[10px] text-slate-400 uppercase">Trades</span>
            <div className="font-bold text-white text-sm mt-0.5">{totalTrades}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase">Win Rate</span>
            <div className="font-bold text-emerald-400 text-sm mt-0.5">{winRate}%</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase">Realized PnL</span>
            <div className={`font-bold text-sm mt-0.5 ${totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Table Content with windowing */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto max-h-[420px] relative p-4"
        >
          {totalTrades > 0 ? (
            <div style={{ height: isVirtualized ? `${totalHeight}px` : 'auto', position: 'relative' }}>
              <table
                className="w-full text-left border-collapse"
                style={{
                  position: isVirtualized ? 'absolute' : 'static',
                  top: isVirtualized ? `${startIndex * ROW_HEIGHT}px` : undefined,
                  left: 0,
                  right: 0,
                }}
              >
                <thead>
                  <tr className="text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <th className="pb-2">Order</th>
                    <th className="pb-2">Open → Close</th>
                    <th className="pb-2">Reason</th>
                    <th className="pb-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {visibleRows.map((t, idx) => (
                    <tr key={`${t.ticket}_${t.closeTime}_${startIndex + idx}`} style={{ height: `${ROW_HEIGHT}px` }} className="hover:bg-slate-800/20">
                      <td className="py-2">
                        <span className={`font-bold ${t.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.type}
                        </span>{' '}
                        <span className="text-slate-400">#{t.ticket}</span>
                      </td>
                      <td className="py-2 text-slate-300">
                        ${t.openPrice.toFixed(1)} → ${t.closePrice.toFixed(1)}
                      </td>
                      <td className="py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          {t.reason}
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold">
                        <span className={t.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              No closed trade records yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
