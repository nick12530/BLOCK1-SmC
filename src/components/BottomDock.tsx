import React, { useState } from 'react';
import { TerminalSnapshot, ClosedTrade } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import {
  Briefcase,
  Layers,
  Calendar,
  History,
  Terminal,
  X,
  Trash2,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface BottomDockProps {
  snapshot: TerminalSnapshot;
  closedTrades: ClosedTrade[];
}

export const BottomDock: React.FC<BottomDockProps> = ({ snapshot, closedTrades }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'zones' | 'calendar' | 'history' | 'logs'>('positions');

  const handleClose = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  };

  const handleCloseAll = () => {
    if (window.confirm('Close all active positions at market price?')) {
      tradingEngine.closeAll();
    }
  };

  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter((t) => t.profit > 0).length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalRealizedPnL = closedTrades.reduce((sum, t) => sum + t.profit, 0);

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Dock Tab Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a3d] bg-[#0d131f]/70 text-xs font-mono">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'positions'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Open Positions</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                snapshot.positions.length > 0
                  ? 'bg-[#4f8ef7]/20 text-[#4f8ef7]'
                  : 'bg-[#1e2a3d] text-[#6b7a90]'
              }`}
            >
              {snapshot.positions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'zones'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Unmitigated POIs (FVG/OB)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e2a3d] text-[#6b7a90]">
              {snapshot.zones.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'calendar'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Economic Calendar</span>
            {snapshot.news_blackout && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'history'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({closedTrades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'logs'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal Logs</span>
          </button>
        </div>

        {/* Right Tab Controls */}
        {activeTab === 'positions' && snapshot.positions.length > 0 && (
          <button
            onClick={handleCloseAll}
            className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors font-semibold"
          >
            <Trash2 className="w-3 h-3" />
            <span>Square All</span>
          </button>
        )}
      </div>

      {/* Dock Content Body */}
      <div className="p-3 overflow-y-auto max-h-[220px] min-h-[160px] text-xs font-mono">
        {/* Tab 1: POSITIONS */}
        {activeTab === 'positions' && (
          <div className="overflow-x-auto">
            {snapshot.positions.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a3d] text-[10px] uppercase text-[#6b7a90]">
                    <th className="py-1 px-3">Ticket</th>
                    <th className="py-1 px-3">Time</th>
                    <th className="py-1 px-3">Type</th>
                    <th className="py-1 px-3">Lots</th>
                    <th className="py-1 px-3">Open Price</th>
                    <th className="py-1 px-3">Current Price</th>
                    <th className="py-1 px-3">Stop Loss</th>
                    <th className="py-1 px-3">Take Profit</th>
                    <th className="py-1 px-3 text-right">Floating P/L</th>
                    <th className="py-1 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a3d]/50">
                  {snapshot.positions.map((p) => {
                    const isUp = p.profit >= 0;
                    const curPrice = p.type === 'BUY' ? snapshot.bid : snapshot.ask;
                    return (
                      <tr key={p.ticket} className="hover:bg-[#1a2436]/40 transition-colors">
                        <td className="py-2 px-3 text-white font-medium">#{p.ticket}</td>
                        <td className="py-2 px-3 text-[#6b7a90]">{p.time}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`font-bold ${
                              p.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {p.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-white font-semibold">{p.volume.toFixed(2)}</td>
                        <td className="py-2 px-3 text-[#94a3b8]">{p.price_open.toFixed(2)}</td>
                        <td className="py-2 px-3 text-white font-semibold">{curPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-red-400/90">{p.sl.toFixed(2)}</td>
                        <td className="py-2 px-3 text-emerald-400/90">{p.tp.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={`font-bold tabular-nums ${
                              isUp ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isUp ? '+' : ''}${p.profit.toFixed(2)} ({p.pips >= 0 ? '+' : ''}
                            {p.pips.toFixed(1)} pips)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleClose(p.ticket)}
                            className="px-2 py-0.5 rounded bg-[#1a2436] hover:bg-red-500/20 text-[#6b7a90] hover:text-red-400 border border-[#1e2a3d] transition-colors"
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
              <div className="py-10 text-center text-[#6b7a90] space-y-1">
                <div className="text-sm font-medium text-[#94a3b8]">No Active Positions</div>
                <div className="text-xs">
                  The automated SMC engine is currently scanning for confluence setups.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: UNMITIGATED POI ZONES */}
        {activeTab === 'zones' && (
          <div className="overflow-x-auto">
            {snapshot.zones.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a3d] text-[10px] uppercase text-[#6b7a90]">
                    <th className="py-1 px-3">Type</th>
                    <th className="py-1 px-3">Side</th>
                    <th className="py-1 px-3">Zone Range</th>
                    <th className="py-1 px-3 text-center">Tests Count</th>
                    <th className="py-1 px-3 text-right">Distance to Market</th>
                    <th className="py-1 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a3d]/50">
                  {snapshot.zones.map((z, idx) => {
                    const isBull = z.bullish;
                    const mid = (z.top + z.bottom) / 2;
                    const distPoints = Math.abs(snapshot.bid - mid);
                    const isInside = snapshot.bid >= z.bottom && snapshot.bid <= z.top;
                    return (
                      <tr key={idx} className="hover:bg-[#1a2436]/40 transition-colors">
                        <td className="py-2 px-3 flex items-center gap-1.5 font-bold text-white">
                          <span
                            className={`w-1.5 h-3 rounded-full ${
                              isBull ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span>{z.kind}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`font-semibold ${
                              isBull ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isBull ? 'DEMAND (Bullish)' : 'SUPPLY (Bearish)'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#94a3b8]">
                          {z.bottom.toFixed(2)} – {z.top.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center text-white">{z.tests}</td>
                        <td className="py-2 px-3 text-right text-[#94a3b8]">
                          {distPoints.toFixed(1)} pts
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isInside ? (
                            <span className="text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                              RETESTING NOW
                            </span>
                          ) : (
                            <span className="text-emerald-400">UNMITIGATED</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-[#6b7a90]">
                All historical order blocks and fair value gaps in this lookback have been mitigated.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: ECONOMIC CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-[#6b7a90] pb-2 border-b border-[#1e2a3d]">
              <span>High-Impact USD Macro Events (Triggers 30-min News Blackout Guard)</span>
              <button
                onClick={() => tradingEngine.toggleNewsBlackout()}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
                  snapshot.news_blackout
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-[#1a2436] text-[#6b7a90] hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>Simulate Event Blackout</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {snapshot.economicEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-[#0b0f17] border border-[#1e2a3d] p-3 rounded-lg flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-[#6b7a90]">
                      <span className="font-bold text-white">{evt.currency}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                          evt.impact === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {evt.impact}
                      </span>
                    </div>
                    <div className="font-semibold text-white text-xs mt-1">{evt.event}</div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#1e2a3d]/60 text-[#6b7a90]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#4f8ef7]" />
                      <span>{evt.time}</span>
                    </div>
                    <div>
                      Fcst: <strong className="text-white">{evt.forecast}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 bg-[#0b0f17] p-2.5 rounded-lg border border-[#1e2a3d] text-center text-xs">
              <div>
                <div className="text-[10px] text-[#6b7a90]">Closed Positions</div>
                <div className="font-bold text-white">{totalTrades}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b7a90]">Win Rate</div>
                <div className="font-bold text-emerald-400">{winRate}%</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b7a90]">Realized Return</div>
                <div
                  className={`font-bold ${
                    totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b7a90]">Daily DD Current</div>
                <div className="font-bold text-[#4f8ef7]">
                  {tradingEngine.account.daily_drawdown_pct.toFixed(2)}% / {tradingEngine.account.max_daily_loss_pct}%
                </div>
              </div>
            </div>

            {closedTrades.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a3d] text-[10px] uppercase text-[#6b7a90]">
                    <th className="py-1 px-3">Ticket</th>
                    <th className="py-1 px-3">Type</th>
                    <th className="py-1 px-3">Lots</th>
                    <th className="py-1 px-3">Open / Close Price</th>
                    <th className="py-1 px-3">Exit Reason</th>
                    <th className="py-1 px-3 text-right">Profit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a3d]/50">
                  {closedTrades.map((t) => (
                    <tr key={t.ticket} className="hover:bg-[#1a2436]/40 transition-colors">
                      <td className="py-1.5 px-3 text-[#6b7a90]">#{t.ticket}</td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`font-bold ${
                            t.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-white">{t.volume}L</td>
                      <td className="py-1.5 px-3 text-[#94a3b8]">
                        {t.openPrice.toFixed(2)} → {t.closePrice.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
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
                      <td className="py-1.5 px-3 text-right">
                        <span
                          className={`font-bold tabular-nums ${
                            t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
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
              <div className="py-6 text-center text-[#6b7a90]">
                No trade history recorded yet in this session.
              </div>
            )}
          </div>
        )}

        {/* Tab 5: LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-1 font-mono text-[11px]">
            {snapshot.log.map((item) => {
              let color = 'text-[#94a3b8]';
              if (item.type === 'trade') color = 'text-emerald-400';
              else if (item.type === 'signal') color = 'text-[#4f8ef7] font-semibold';
              else if (item.type === 'warn') color = 'text-amber-400';
              else if (item.type === 'error') color = 'text-red-400';
              return (
                <div key={item.id} className="flex items-start gap-2 leading-tight">
                  <span className="text-[#6b7a90] shrink-0 font-medium">[{item.t}]</span>
                  <span className={color}>{item.msg}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
