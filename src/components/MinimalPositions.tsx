import React, { useState } from 'react';
import { TerminalSnapshot, ClosedTrade } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { X, Trash2, Briefcase, History } from 'lucide-react';

interface MinimalPositionsProps {
  snapshot: TerminalSnapshot;
  closedTrades: ClosedTrade[];
}

export const MinimalPositions: React.FC<MinimalPositionsProps> = ({
  snapshot,
  closedTrades,
}) => {
  const [tab, setTab] = useState<'open' | 'history'>('open');

  const handleClose = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  };

  const handleCloseAll = () => {
    if (window.confirm('Close all open positions at market price?')) {
      tradingEngine.closeAll();
    }
  };

  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter((t) => t.profit > 0).length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalNet = closedTrades.reduce((sum, t) => sum + t.profit, 0);

  return (
    <div className="bg-white dark:bg-[#111723] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      {/* Header with Segmented Tabs */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setTab('open')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === 'open'
                  ? 'bg-white dark:bg-[#131620] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Open Positions ({snapshot.positions.length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === 'history'
                  ? 'bg-white dark:bg-[#131620] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Trade Ledger ({closedTrades.length})
            </button>
          </div>
        </div>

        {tab === 'open' && snapshot.positions.length > 0 && (
          <button
            onClick={handleCloseAll}
            className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900/50 hover:bg-rose-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Close All</span>
          </button>
        )}
      </div>

      {/* Body: Open Positions Table */}
      {tab === 'open' ? (
        <div className="overflow-x-auto">
          {snapshot.positions.length > 0 ? (
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Order</th>
                  <th className="py-2.5 px-3">Volume</th>
                  <th className="py-2.5 px-3">Open Price</th>
                  <th className="py-2.5 px-3">Current</th>
                  <th className="py-2.5 px-3">SL / TP</th>
                  <th className="py-2.5 px-3 text-right">Floating P/L</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {snapshot.positions.map((p) => {
                  const isUp = p.profit >= 0;
                  const curPrice = p.type === 'BUY' ? snapshot.bid : snapshot.ask;
                  return (
                    <tr
                      key={p.ticket}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                              p.type === 'BUY'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {p.type}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">#{p.ticket}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{p.time}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        {p.volume.toFixed(2)} lots
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        ${p.price_open.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-slate-950 dark:text-white">
                        ${curPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        <span className="text-rose-600 dark:text-rose-400 font-bold">{p.sl.toFixed(1)}</span> /{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{p.tp.toFixed(1)}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div
                          className={`font-extrabold tabular-nums text-sm ${
                            isUp
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {isUp ? '+' : ''}${p.profit.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          {p.pips >= 0 ? '+' : ''}
                          {p.pips.toFixed(1)} pips
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleClose(p.ticket)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 border border-slate-300 dark:border-slate-700 transition-colors"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400 space-y-1">
              <Briefcase className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-500 mb-1 opacity-70" />
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                No Open Positions
              </div>
              <div className="text-xs">
                Zero gold market exposure. The SMC engine is scanning order flow for high-confluence entries.
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Trade Ledger Table */
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-[#0c1017] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">Executed</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{totalTrades}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">Win Rate</div>
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{winRate}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">Realized PnL</div>
              <div
                className={`text-base font-extrabold mt-0.5 ${
                  totalNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}
              </div>
            </div>
          </div>

          {closedTrades.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest font-bold">
                  <th className="py-2 px-3">Position</th>
                  <th className="py-2 px-3">Open → Close</th>
                  <th className="py-2 px-3">Exit Reason</th>
                  <th className="py-2 px-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {closedTrades.map((t) => (
                  <tr key={t.ticket} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          t.type === 'BUY' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {t.type}
                      </span>{' '}
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">#{t.ticket}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      ${t.openPrice.toFixed(2)} → ${t.closePrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {t.reason}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-extrabold tabular-nums ${
                          t.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-6 text-center text-slate-500 dark:text-slate-400">
              No closed trade history recorded yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
