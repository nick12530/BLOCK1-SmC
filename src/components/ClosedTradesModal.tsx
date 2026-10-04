/**
 * ClosedTradesModal.tsx - Trade History Ledger with Virtualized Windowing
 * Fits all screen sizes and includes clear top Close and bottom Back to Terminal buttons.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useClosedTrades } from '../hooks/useTradingStore';
import { History, X, ArrowLeft } from 'lucide-react';

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
  const totalNet = Number(closedTrades.reduce((sum, t) => sum + t.profit, 0).toFixed(2));

  // Virtualization windowing calculation
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
      className="fixed inset-0 z-[170] flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-xs font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-2xl bg-white dark:bg-[#0c0d10] border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-colors">
        {/* Header: Title and Top Close Button */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <History className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </span>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Closed Trades History
              </h2>
              <span className="text-[11px] text-zinc-500">
                {totalTrades} Total Closed Orders
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close Window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#12141a]">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Realized</span>
              <strong
                className={`text-sm sm:text-base font-black tabular-nums ${
                  totalNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)} USD
              </strong>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#12141a]">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Win Rate</span>
              <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                {winRate}%
              </strong>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#12141a]">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">W / L Ratio</span>
              <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                {wins}W / {totalTrades - wins}L
              </strong>
            </div>
          </div>

          {/* Table with Scroll */}
          {totalTrades > 0 ? (
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto max-h-[380px]"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[10px] text-zinc-500 uppercase">
                    <th className="py-2.5 px-3">Position</th>
                    <th className="py-2.5 px-2">Prices</th>
                    <th className="py-2.5 px-2">Reason</th>
                    <th className="py-2.5 px-3 text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {visibleRows.map((t, idx) => (
                    <tr
                      key={`${t.ticket}_${t.closeTime}_${startIndex + idx}`}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-800/30"
                    >
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${t.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {t.type}
                        </span>{' '}
                        <span className="text-zinc-500 font-normal">#{t.ticket} ({t.volume}L)</span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-700 dark:text-zinc-300 tabular-nums">
                        ${t.openPrice.toFixed(2)} → ${t.closePrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {t.reason}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black tabular-nums">
                        <span className={t.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 space-y-1">
              <span className="font-bold text-xs uppercase tracking-wider block">No Closed Trade Records</span>
              <span className="text-[11px] block">Trades will be logged here when closed</span>
            </div>
          )}
        </div>

        {/* Footer: Bottom Back to Terminal Button */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-200/80 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-black transition-colors cursor-pointer"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
