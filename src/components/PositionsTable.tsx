import React, { useState } from 'react';
import { TerminalSnapshot, ClosedTrade } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { Briefcase, X, History, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface PositionsTableProps {
  snapshot: TerminalSnapshot;
  closedTrades: ClosedTrade[];
}

export const PositionsTable: React.FC<PositionsTableProps> = ({ snapshot, closedTrades }) => {
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');

  const handleClose = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  };

  const handleCloseAll = () => {
    if (window.confirm('Close all active SMC bot positions at market price?')) {
      tradingEngine.closeAll();
    }
  };

  // Performance metrics for closed trades
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter((t) => t.profit > 0).length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalRealizedPnL = closedTrades.reduce((sum, t) => sum + t.profit, 0);

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <div className="flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-[#4f8ef7]" />
          <div className="flex items-center bg-[#0b0f17] p-0.5 rounded-lg border border-[#1e2a3d]">
            <button
              onClick={() => setActiveTab('open')}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                activeTab === 'open'
                  ? 'bg-[#1a2436] text-white shadow-sm'
                  : 'text-[#6b7a90] hover:text-[#94a3b8]'
              }`}
            >
              Open ({snapshot.positions.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                activeTab === 'history'
                  ? 'bg-[#1a2436] text-white shadow-sm'
                  : 'text-[#6b7a90] hover:text-[#94a3b8]'
              }`}
            >
              History ({closedTrades.length})
            </button>
          </div>
        </div>

        {activeTab === 'open' && snapshot.positions.length > 0 && (
          <button
            onClick={handleCloseAll}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors font-semibold"
          >
            <Trash2 className="w-3 h-3" />
            <span>Close All</span>
          </button>
        )}
      </div>

      {activeTab === 'open' ? (
        <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e2a3d] text-[10px] uppercase text-[#6b7a90]">
                <th className="py-1.5 px-2">Type</th>
                <th className="py-1.5 px-2">Vol</th>
                <th className="py-1.5 px-2">Open</th>
                <th className="py-1.5 px-2">SL / TP</th>
                <th className="py-1.5 px-2 text-right">P/L ($)</th>
                <th className="py-1.5 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3d]/50">
              {snapshot.positions.length > 0 ? (
                snapshot.positions.map((p) => {
                  const isUp = p.profit >= 0;
                  return (
                    <tr key={p.ticket} className="hover:bg-[#1a2436]/40 transition-colors">
                      <td className="py-2 px-2">
                        <span
                          className={`font-bold ${
                            p.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {p.type}
                        </span>
                        <div className="text-[10px] text-[#6b7a90]">#{p.ticket}</div>
                      </td>
                      <td className="py-2 px-2 text-white font-medium">{p.volume}</td>
                      <td className="py-2 px-2 text-[#94a3b8]">{p.price_open.toFixed(2)}</td>
                      <td className="py-2 px-2 text-[11px]">
                        <span className="text-red-400/80">{p.sl.toFixed(1)}</span>
                        <span className="text-[#6b7a90] mx-1">/</span>
                        <span className="text-emerald-400/80">{p.tp.toFixed(1)}</span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div
                          className={`font-semibold tabular-nums ${
                            isUp ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isUp ? '+' : ''}${p.profit.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#6b7a90]">
                          {p.pips >= 0 ? '+' : ''}
                          {p.pips.toFixed(1)} pips
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleClose(p.ticket)}
                          title="Close position now at market price"
                          className="px-2 py-0.5 rounded bg-[#1a2436] hover:bg-red-500/20 text-[#6b7a90] hover:text-red-400 border border-[#1e2a3d] hover:border-red-500/30 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6b7a90]">
                    Flat · No open positions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {/* History Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 bg-[#0b0f17] p-2 rounded-lg border border-[#1e2a3d] text-center font-mono text-xs">
            <div>
              <div className="text-[10px] text-[#6b7a90]">Total Trades</div>
              <div className="font-semibold text-white">{totalTrades}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#6b7a90]">Win Rate</div>
              <div className="font-semibold text-emerald-400">{winRate}%</div>
            </div>
            <div>
              <div className="text-[10px] text-[#6b7a90]">Net Realized</div>
              <div
                className={`font-semibold tabular-nums ${
                  totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[170px] overflow-y-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1e2a3d] text-[10px] uppercase text-[#6b7a90]">
                  <th className="py-1 px-2">Type</th>
                  <th className="py-1 px-2">Open / Close</th>
                  <th className="py-1 px-2">Outcome</th>
                  <th className="py-1 px-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3d]/50">
                {closedTrades.length > 0 ? (
                  closedTrades.map((t) => (
                    <tr key={t.ticket} className="hover:bg-[#1a2436]/40 transition-colors">
                      <td className="py-1.5 px-2">
                        <span
                          className={`font-bold ${
                            t.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {t.type}
                        </span>
                        <span className="text-[10px] text-[#6b7a90] ml-1.5">{t.volume}L</span>
                      </td>
                      <td className="py-1.5 px-2 text-[#94a3b8]">
                        {t.openPrice.toFixed(1)} → {t.closePrice.toFixed(1)}
                      </td>
                      <td className="py-1.5 px-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            t.reason === 'TP'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : t.reason === 'SL'
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : 'bg-[#1a2436] text-[#94a3b8]'
                          }`}
                        >
                          {t.reason}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#6b7a90]">
                      No closed trades logged in this session yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
