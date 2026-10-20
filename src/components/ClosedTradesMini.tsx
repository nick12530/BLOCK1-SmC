import React from 'react';
import { History, ExternalLink } from 'lucide-react';
import { ClosedTrade } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';

interface ClosedTradesMiniProps {
  onOpenJournalModal: () => void;
}

export const ClosedTradesMini: React.FC<ClosedTradesMiniProps> = ({ onOpenJournalModal }) => {
  const closedTrades = tradingEngine.closedTrades.slice(0, 5);

  return (
    <div className="flex flex-col bg-[#10141D] rounded border border-white/[0.06] overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#141923] shrink-0">
        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
          RECENT TRADES
        </span>
        <button
          type="button"
          onClick={onOpenJournalModal}
          className="text-[10px] font-mono text-[#2979FF] hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>FULL JOURNAL</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Trades List */}
      <div className="p-2 space-y-1.5 font-mono text-xs">
        {closedTrades.length === 0 ? (
          <div className="py-6 text-center text-zinc-500 text-[11px]">
            No closed trades today.
          </div>
        ) : (
          closedTrades.map((t) => {
            const isProfit = t.profit >= 0;
            return (
              <div
                key={t.ticket}
                className="bg-[#0A0E14] p-2 rounded border border-white/[0.04] flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                      t.type === 'BUY'
                        ? 'bg-[#2979FF]/15 text-[#2979FF]'
                        : 'bg-[#FF5252]/15 text-[#FF5252]'
                    }`}
                  >
                    {t.type}
                  </span>
                  <span className="font-bold text-zinc-200">{t.symbol}</span>
                  <span className="text-[10px] text-zinc-500">#{t.ticket}</span>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                      t.reason === 'TP'
                        ? 'bg-[#00E676]/15 text-[#00E676]'
                        : t.reason === 'SL'
                        ? 'bg-[#FF5252]/15 text-[#FF5252]'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {t.reason || 'Manual'}
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      isProfit ? 'text-[#00E676]' : 'text-[#FF5252]'
                    }`}
                  >
                    {isProfit ? '+' : ''}${t.profit.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
