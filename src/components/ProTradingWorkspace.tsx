import React, { useState } from 'react';
import { TerminalSnapshot, ClosedTrade } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Shield,
  Layers,
  Gauge,
  Activity,
  Briefcase,
  History,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Crosshair,
  BarChart3,
  Compass,
} from 'lucide-react';
import { MinimalOrderTicket } from './MinimalOrderTicket';

interface ProTradingWorkspaceProps {
  snapshot: TerminalSnapshot;
  closedTrades: ClosedTrade[];
}

export const ProTradingWorkspace: React.FC<ProTradingWorkspaceProps> = ({
  snapshot,
  closedTrades,
}) => {
  const [activeTab, setActiveTab] = useState<'signal' | 'positions' | 'analysis' | 'ticket' | 'history'>('signal');
  const [selectedTf, setSelectedTf] = useState<'M1' | 'M5' | 'M15'>('M5');
  const [lot, setLot] = useState<number>(0.05);
  const [execFeedback, setExecFeedback] = useState<string | null>(null);

  const sig = snapshot.signal;
  const pattern = sig?.triggerPattern;
  const dr = snapshot.dealing_range;
  const isInDiscount = snapshot.price_pos !== null && snapshot.price_pos < 0.5;
  const isInPremium = snapshot.price_pos !== null && snapshot.price_pos > 0.5;

  const anticipatedDir: 'BUY' | 'SELL' = snapshot.bias === 'bearish' ? 'SELL' : 'BUY';
  const entryPrice = sig ? sig.entry : (anticipatedDir === 'SELL' ? snapshot.bid : snapshot.ask);
  const slPrice = sig ? sig.sl : (anticipatedDir === 'SELL' ? Number((snapshot.bid + 4.5).toFixed(2)) : Number((snapshot.ask - 4.5).toFixed(2)));
  const tpPrice = sig ? sig.tp : (anticipatedDir === 'SELL' ? Number((snapshot.bid - 9.0).toFixed(2)) : Number((snapshot.ask + 9.0).toFixed(2)));

  const handleExecute = (direction: 'BUY' | 'SELL', entry: number, sl: number, tp: number) => {
    const res = tradingEngine.sendMarket(
      direction,
      lot,
      sl,
      tp,
      `signal_tab_${selectedTf.toLowerCase()}`
    );
    if (res.ok) {
      setExecFeedback(`Order Executed: ${direction} ${lot}L @ ${res.price?.toFixed(2)} on ${selectedTf} (SL: ${sl}, TP: ${tp})`);
    } else {
      setExecFeedback(`Rejected: ${res.error || 'Execution blocked'}`);
    }
    setTimeout(() => setExecFeedback(null), 5000);
  };

  const handleClosePosition = (ticket: number) => {
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
    <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
      {/* Top Tab Bar - Refined typography & spacing */}
      <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 pb-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c1017]/80 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveTab('signal')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === 'signal'
              ? 'bg-white dark:bg-[#151c2b] text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Signal & Execution</span>
          {sig && (
            <span
              className={`w-2 h-2 rounded-full ${
                sig.direction === 'SELL' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
              }`}
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === 'positions'
              ? 'bg-white dark:bg-[#151c2b] text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 text-blue-500" />
          <span>Open Positions ({snapshot.positions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === 'analysis'
              ? 'bg-white dark:bg-[#151c2b] text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span>Market Analysis & POIs</span>
        </button>

        <button
          onClick={() => setActiveTab('ticket')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === 'ticket'
              ? 'bg-white dark:bg-[#151c2b] text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Manual Ticket</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-white dark:bg-[#151c2b] text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5 text-slate-400" />
          <span>Ledger ({closedTrades.length})</span>
        </button>
      </div>

      {/* Tab 1: TWO POLISHED DEDICATED CARDS */}
      {activeTab === 'signal' && (
        <div className="p-5 sm:p-7 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* CARD 1: THE SIGNAL & TRADE EXECUTION */}
            <div className="lg:col-span-6 flex flex-col justify-between bg-slate-50/80 dark:bg-[#0c1017] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="space-y-4">
                {/* Header: Direction Badge & Timeframe Selector */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-black font-mono tracking-wider uppercase text-white ${
                        (sig ? sig.direction : anticipatedDir) === 'SELL'
                          ? 'bg-rose-600'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {sig ? `${sig.direction} SIGNAL` : `WATCHING ${anticipatedDir} SETUP`}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      {sig ? `Confluence ${sig.score}/5.0` : 'SMC Background Screening'}
                    </span>
                  </div>

                  {/* Timeframe selector: M1 / M5 / M15 */}
                  <div className="flex items-center gap-1 bg-white dark:bg-[#151c2b] p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono">
                    <span className="text-[10px] text-slate-400 uppercase px-1.5 font-bold">TF:</span>
                    {(['M1', 'M5', 'M15'] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setSelectedTf(tf)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all ${
                          selectedTf === tf
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Big Direction & Price Callout */}
                <div>
                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                    {sig ? 'Confirmed Setup' : 'Pending Zone Retest'} · Execute on {selectedTf} Chart
                  </div>
                  <div
                    className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-1 ${
                      (sig ? sig.direction : anticipatedDir) === 'SELL'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {(sig ? sig.direction : anticipatedDir)} GOLD @ ${entryPrice.toFixed(2)}
                  </div>
                </div>

                {/* Target Levels Grid */}
                <div className="grid grid-cols-3 gap-3 font-mono text-center text-xs">
                  <div className="bg-white dark:bg-[#151c2b] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Entry Level</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5 block tabular-nums">
                      ${entryPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#151c2b] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Stop Loss</span>
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 text-sm mt-0.5 block tabular-nums">
                      ${slPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#151c2b] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Take Profit (1:2)</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block tabular-nums">
                      ${tpPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Position Volume Chips */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Position Volume</span>
                    <span className="text-[11px] text-slate-400">1.0 Lot = 100 oz Gold</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0.01, 0.05, 0.10, 0.25, 0.50].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLot(s)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          lot === s
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                            : 'bg-white dark:bg-[#151c2b] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {s}L
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleExecute(sig ? sig.direction : anticipatedDir, entryPrice, slPrice, tpPrice)}
                  className={`w-full py-4 rounded-xl font-bold font-mono text-sm tracking-wide transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 text-white ${
                    (sig ? sig.direction : anticipatedDir) === 'SELL'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  }`}
                >
                  <Crosshair className="w-4 h-4" />
                  <span>
                    EXECUTE {(sig ? sig.direction : anticipatedDir)} ({lot}L on {selectedTf} @ ${entryPrice.toFixed(2)})
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {execFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-center font-bold font-mono text-xs mt-3">
                    {execFeedback}
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: SIGNAL EXPLANATION & TRIGGER CANDLESTICK */}
            <div className="lg:col-span-6 flex flex-col justify-between bg-slate-50/80 dark:bg-[#0c1017] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 font-mono text-xs">
              <div className="space-y-3.5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      Signal Breakdown & Trigger Candlestick
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Execution Chart: {selectedTf}
                  </span>
                </div>

                {/* Entry Point & Execution Timeframe Callout */}
                <div className="grid grid-cols-2 gap-3 bg-white dark:bg-[#151c2b] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Signal Entry Point</span>
                    <strong className="text-slate-900 dark:text-white text-sm font-bold tabular-nums">
                      ${entryPrice.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Where to Execute</span>
                    <strong className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                      {selectedTf} Timeframe
                    </strong>
                  </div>
                </div>

                {/* Candlestick Telemetry & Pattern Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Trigger Candlestick: {pattern ? pattern.name : (anticipatedDir === 'SELL' ? 'Bearish Pinbar / Liquidity Sweep' : 'Bullish Pinbar / Demand Tap')}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {pattern ? pattern.wickRatio : 'Wick Rejection > 60%'}
                    </span>
                  </div>

                  {/* OHLC Telemetry Table */}
                  <div className="grid grid-cols-4 gap-2 bg-white dark:bg-[#151c2b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Open</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        ${pattern ? pattern.open.toFixed(2) : snapshot.bid.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">High</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        ${pattern ? pattern.high.toFixed(2) : (snapshot.bid + 3.2).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Low</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        ${pattern ? pattern.low.toFixed(2) : (snapshot.bid - 1.5).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Close</span>
                      <span
                        className={`font-bold tabular-nums ${
                          anticipatedDir === 'SELL' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        ${pattern ? pattern.close.toFixed(2) : snapshot.bid.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Narrative explanation */}
                  <div className="bg-white dark:bg-[#151c2b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                    {pattern
                      ? pattern.explanation
                      : anticipatedDir === 'SELL'
                      ? `On ${selectedTf}, institutional sellers are targeting sell-side liquidity after a sweep into Premium supply above $${(snapshot.bid + 3.0).toFixed(2)}. Look for the trigger candlestick to reject with a long upper wick before market close.`
                      : `On ${selectedTf}, institutional buyers are defending Discount demand below $${(snapshot.ask - 3.0).toFixed(2)}. Look for the trigger candlestick to reject with a long lower wick and close high.`}
                  </div>
                </div>

                {/* Confluence Validation Checklist */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Confluence Validation Rules:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-[#151c2b] border border-slate-200 dark:border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>H1 {snapshot.bias.toUpperCase()} Structure</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-[#151c2b] border border-slate-200 dark:border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{isInDiscount ? 'Discount Range' : isInPremium ? 'Premium Range' : 'Equilibrium Zone'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                Institutional rule: Execute trades only on {selectedTf} after candlestick close confirms invalidation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: DEDICATED OPEN POSITIONS TAB */}
      {activeTab === 'positions' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm font-mono">
              Live Open Positions ({snapshot.positions.length})
            </h3>
            {snapshot.positions.length > 0 && (
              <button
                onClick={handleCloseAll}
                className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900/50 hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Close All</span>
              </button>
            )}
          </div>

          {snapshot.positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
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
                      <tr key={p.ticket} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                                p.type === 'BUY'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300'
                              }`}
                            >
                              {p.type}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 font-semibold">#{p.ticket}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {p.volume.toFixed(2)} lots
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 tabular-nums">
                          ${p.price_open.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-950 dark:text-white tabular-nums">
                          ${curPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 tabular-nums">
                          <span className="text-rose-600 dark:text-rose-400">{p.sl.toFixed(1)}</span> /{' '}
                          <span className="text-emerald-600 dark:text-emerald-400">{p.tp.toFixed(1)}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div
                            className={`font-extrabold tabular-nums text-sm ${
                              isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isUp ? '+' : ''}${p.profit.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums">
                            {p.pips >= 0 ? '+' : ''}{p.pips.toFixed(1)} pips
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleClosePosition(p.ticket)}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 border border-slate-300 dark:border-slate-700 transition-colors"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-1 font-mono text-xs">
              <Briefcase className="w-6 h-6 mx-auto text-slate-400 mb-1 opacity-70" />
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                No Open Positions
              </div>
              <div>Account is currently flat. Valid signals can be executed in the Signal tab.</div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: MARKET ANALYSIS & POIs */}
      {activeTab === 'analysis' && (
        <div className="p-5 sm:p-6 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dealing Range */}
            <div className="bg-slate-50 dark:bg-[#0c1017] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 font-bold">
                <span>Dealing Range Location</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isInDiscount
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : isInPremium
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isInDiscount ? 'DISCOUNT (< 50% EQ)' : isInPremium ? 'PREMIUM (> 50% EQ)' : 'EQUILIBRIUM'}
                </span>
              </div>
              {dr && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div>Low: ${dr.low.toFixed(1)} · High: ${dr.high.toFixed(1)}</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Equilibrium: ${dr.equilibrium.toFixed(1)}</div>
                </div>
              )}
            </div>

            {/* Structure State */}
            <div className="bg-slate-50 dark:bg-[#0c1017] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 font-bold">
                <span>Confirmed Swings</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase">{snapshot.bias}</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div>Last BOS: {snapshot.bos ? `${snapshot.bos.price.toFixed(2)} (${snapshot.bos.direction})` : 'None in range'}</div>
                <div>Last CHoCH: {snapshot.choch ? `${snapshot.choch.price.toFixed(2)} (${snapshot.choch.direction})` : 'None in range'}</div>
              </div>
            </div>
          </div>

          {/* Active POIs List */}
          <div className="space-y-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Unmitigated Institutional Zones ({snapshot.zones.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {snapshot.zones.slice(0, 6).map((z, idx) => {
                const mid = (z.top + z.bottom) / 2;
                const dist = Math.abs(snapshot.bid - mid).toFixed(1);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017]"
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>{z.kind} {z.bullish ? 'DEMAND' : 'SUPPLY'}</span>
                      <span className="text-[10px] text-slate-500">{dist} pts</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                      ${z.bottom.toFixed(1)} – ${z.top.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: MANUAL ORDER TICKET */}
      {activeTab === 'ticket' && (
        <div className="p-5 sm:p-6 max-w-xl mx-auto">
          <MinimalOrderTicket snapshot={snapshot} />
        </div>
      )}

      {/* Tab 5: TRADE LEDGER / HISTORY */}
      {activeTab === 'history' && (
        <div className="p-5 sm:p-6 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-[#0c1017] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Trades</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">{totalTrades}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-semibold">Win Rate</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{winRate}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-semibold">Net PnL</div>
              <div className={`text-base font-bold ${totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}
              </div>
            </div>
          </div>

          {closedTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
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
                        <span className={`font-bold ${t.type === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type}
                        </span>{' '}
                        <span className="text-slate-400">#{t.ticket}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 tabular-nums">
                        ${t.openPrice.toFixed(2)} → ${t.closePrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {t.reason}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                        <span className={t.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">No closed trades yet.</div>
          )}
        </div>
      )}
    </div>
  );
};
