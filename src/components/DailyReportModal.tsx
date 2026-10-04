/**
 * DailyReportModal.tsx - Executive End-of-Day Trading Performance Report & Journal
 * Upgraded with advanced item selectors:
 * - Trade outcome filter pills (All / Wins / Losses)
 * - Direction filter pills (All / Longs / Shorts)
 * - Search by Ticket # or execution rationale
 * - Clean responsive cards and tables fitting all devices
 * - Clear Back to Terminal and Close buttons
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useClosedTrades, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import {
  FileText,
  X,
  Copy,
  Check,
  Download,
  Calendar,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowLeft,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ isOpen, onClose }) => {
  const closedTrades = useClosedTrades();
  const ticker = useTicker();
  const [copied, setCopied] = useState(false);

  // Advanced item selector filters
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Overall session statistics
  const stats = useMemo(() => {
    const todayTrades = closedTrades;
    const totalCount = todayTrades.length;
    const winningTrades = todayTrades.filter((t) => t.profit > 0);
    const losingTrades = todayTrades.filter((t) => t.profit < 0);
    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const winRate = totalCount > 0 ? ((winCount / totalCount) * 100).toFixed(1) : '0.0';

    const grossProfit = winningTrades.reduce((acc, t) => acc + t.profit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.profit, 0));
    const netPnl = Number((grossProfit - grossLoss).toFixed(2));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 'MAX' : '0.00';

    const totalVolume = todayTrades.reduce((acc, t) => acc + t.volume, 0);
    const totalPips = todayTrades.reduce((acc, t) => acc + t.pips, 0);

    const avgWin = winCount > 0 ? (grossProfit / winCount).toFixed(2) : '0.00';
    const avgLoss = lossCount > 0 ? (grossLoss / lossCount).toFixed(2) : '0.00';

    const longTrades = todayTrades.filter((t) => t.type === 'BUY');
    const shortTrades = todayTrades.filter((t) => t.type === 'SELL');
    const longWins = longTrades.filter((t) => t.profit > 0).length;
    const shortWins = shortTrades.filter((t) => t.profit > 0).length;
    const longWinRate = longTrades.length > 0 ? ((longWins / longTrades.length) * 100).toFixed(0) : '0';
    const shortWinRate = shortTrades.length > 0 ? ((shortWins / shortTrades.length) * 100).toFixed(0) : '0';

    const startBalance = tradingEngine.account.daily_start_balance || 10300;
    const returnPct = ((netPnl / startBalance) * 100).toFixed(2);

    return {
      todayTrades,
      totalCount,
      winCount,
      lossCount,
      winRate,
      grossProfit: grossProfit.toFixed(2),
      grossLoss: grossLoss.toFixed(2),
      netPnl,
      profitFactor,
      totalVolume: totalVolume.toFixed(2),
      totalPips: totalPips.toFixed(1),
      avgWin,
      avgLoss,
      longCount: longTrades.length,
      shortCount: shortTrades.length,
      longWinRate,
      shortWinRate,
      returnPct,
    };
  }, [closedTrades]);

  // Filtered trades based on user selectors
  const filteredTrades = useMemo(() => {
    return closedTrades.filter((t) => {
      // Outcome filter
      if (outcomeFilter === 'WIN' && t.profit <= 0) return false;
      if (outcomeFilter === 'LOSS' && t.profit >= 0) return false;

      // Direction filter
      if (directionFilter === 'BUY' && t.type !== 'BUY') return false;
      if (directionFilter === 'SELL' && t.type !== 'SELL') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicket = t.ticket.toString().includes(q);
        const matchReason = t.reason.toLowerCase().includes(q);
        const matchComment = t.comment ? t.comment.toLowerCase().includes(q) : false;
        if (!matchTicket && !matchReason && !matchComment) return false;
      }

      return true;
    });
  }, [closedTrades, outcomeFilter, directionFilter, searchQuery]);

  const handleCopyReport = () => {
    const reportText = `===========================================
SMC GOLD BOT (XAUUSD) - DAILY PERFORMANCE REPORT
Session Date:    ${new Date().toISOString().slice(0, 10)} (UTC)
-------------------------------------------
Net Realized PnL:   ${stats.netPnl >= 0 ? '+' : ''}$${stats.netPnl} USD (${stats.returnPct}%)
Total Trades:       ${stats.totalCount} (${stats.winCount}W / ${stats.lossCount}L)
Win Rate:           ${stats.winRate}%
Profit Factor:      ${stats.profitFactor}
Total Pips:         ${stats.totalPips} pips
Volume Executed:    ${stats.totalVolume} Lots
Avg Win / Loss:     +$${stats.avgWin} / -$${stats.avgLoss}
Long Win Rate:      ${stats.longWinRate}% (${stats.longCount} trades)
Short Win Rate:     ${stats.shortWinRate}% (${stats.shortCount} trades)
Current Equity:     $${ticker.equity.toFixed(2)}
Daily Drawdown:     ${tradingEngine.account.daily_drawdown_pct}% (Max: 3.0%)
===========================================`;

    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadCSV = () => {
    if (closedTrades.length === 0) return;
    const headers = ['Ticket', 'CloseTime', 'Type', 'Volume', 'OpenPrice', 'ClosePrice', 'Pips', 'Profit', 'Reason'];
    const rows = closedTrades.map((t) => [
      t.ticket,
      t.closeTime,
      t.type,
      t.volume,
      t.openPrice.toFixed(2),
      t.closePrice.toFixed(2),
      t.pips.toFixed(1),
      t.profit.toFixed(2),
      t.reason,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smc_trading_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[170] flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-xs font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div className="w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl bg-white dark:bg-[#0c0d10] border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-colors">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-wider">
                Daily Performance Journal
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{new Date().toISOString().slice(0, 10)} (UTC)</span>
                <span>·</span>
                <span className="text-emerald-500 font-bold">XAUUSD Institutional Ledger</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close Journal Window"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Report Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Executive Net P&L Hero Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#12141a] border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block tracking-wider">
                Net Realized Performance (Today)
              </span>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span
                  className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                    stats.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {stats.netPnl >= 0 ? '+' : ''}${stats.netPnl} USD
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    stats.netPnl >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {stats.netPnl >= 0 ? '+' : ''}{stats.returnPct}% Return
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:text-right border-t sm:border-t-0 border-slate-200 dark:border-zinc-800 pt-2.5 sm:pt-0">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Account Balance</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  ${ticker.balance.toLocaleString()}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-zinc-800" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Daily Drawdown</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {tradingEngine.account.daily_drawdown_pct}% / 3.0% Limit
                </span>
              </div>
            </div>
          </div>

          {/* 6 Key Performance Indicators Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141a] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Win Rate</span>
              <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                {stats.winRate}%
              </div>
              <div className="text-[10px] text-slate-500">
                {stats.winCount}W · {stats.lossCount}L ({stats.totalCount} Total)
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141a] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Profit Factor</span>
              <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                {stats.profitFactor}
              </div>
              <div className="text-[10px] text-slate-500">
                Gross: +${stats.grossProfit} / -${stats.grossLoss}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141a] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Pips</span>
              <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                {stats.totalPips} pips
              </div>
              <div className="text-[10px] text-slate-500">
                Volume: {stats.totalVolume} lots
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141a] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Avg Win / Loss</span>
              <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                +${stats.avgWin} / -${stats.avgLoss}
              </div>
              <div className="text-[10px] text-slate-500">
                Positive edge
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141a] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Long (BUY)</span>
              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {stats.longWinRate}% Win Rate
              </div>
              <div className="text-[10px] text-slate-500">
                {stats.longCount} BUY trades
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141a] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Short (SELL)</span>
              <div className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {stats.shortWinRate}% Win Rate
              </div>
              <div className="text-[10px] text-slate-500">
                {stats.shortCount} SELL trades
              </div>
            </div>
          </div>

          {/* ADVANCED ITEM SELECTORS & FILTERS */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-zinc-400" />
                <span>Trade Item Selectors & Filter</span>
              </span>

              {/* Search by Ticket # or reason */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <Search className="w-3 h-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter ticket / reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-[11px] text-slate-900 dark:text-white w-36 sm:w-44"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Filter Selectors */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/50 dark:border-zinc-800/50">
              {/* Outcome Selectors */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('ALL')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    outcomeFilter === 'ALL'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  All ({stats.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('WIN')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    outcomeFilter === 'WIN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-600 dark:text-emerald-400 hover:underline'
                  }`}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Winners ({stats.winCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('LOSS')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    outcomeFilter === 'LOSS'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-600 dark:text-rose-400 hover:underline'
                  }`}
                >
                  <XCircle className="w-2.5 h-2.5" />
                  <span>Losses ({stats.lossCount})</span>
                </button>
              </div>

              {/* Direction Selectors */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setDirectionFilter('ALL')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    directionFilter === 'ALL'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Both Sides
                </button>
                <button
                  type="button"
                  onClick={() => setDirectionFilter('BUY')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    directionFilter === 'BUY'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  BUY Only
                </button>
                <button
                  type="button"
                  onClick={() => setDirectionFilter('SELL')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    directionFilter === 'SELL'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  SELL Only
                </button>
              </div>
            </div>
          </div>

          {/* Trade Ledger / Cards Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Audited Session Trades ({filteredTrades.length} of {stats.todayTrades.length})
              </h3>

              {stats.todayTrades.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
              )}
            </div>

            {filteredTrades.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[10px] text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-2">Order</th>
                      <th className="py-2.5 px-2">Side</th>
                      <th className="py-2.5 px-2">Lots</th>
                      <th className="py-2.5 px-2">Prices</th>
                      <th className="py-2.5 px-2">Strategy Rationale</th>
                      <th className="py-2.5 px-2">Reason</th>
                      <th className="py-2.5 px-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {filteredTrades.map((t, idx) => (
                      <tr key={`${t.ticket}_${t.closeTime}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 text-slate-500">{t.closeTime}</td>
                        <td className="py-2.5 px-2 font-bold text-slate-700 dark:text-slate-300">#{t.ticket}</td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                              t.type === 'BUY'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">{t.volume}L</td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 tabular-nums">
                          ${t.openPrice.toFixed(2)} → ${t.closePrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-300 block max-w-xs truncate" title={t.strategyRationale || 'SMC Confluence execution'}>
                            {t.strategyRationale || 'SMC Confluence execution'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-[10px]">
                            {t.reason}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black tabular-nums">
                          <span className={t.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-1">
                <span className="font-bold text-xs uppercase tracking-wider block text-zinc-400">
                  No Trades Match Selected Filter
                </span>
                <span className="text-[11px] text-zinc-500 block">
                  Change item selectors or clear search query to inspect other trades
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-200/80 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </button>

          <button
            onClick={handleCopyReport}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black font-bold transition-all shadow-xs active:scale-95 cursor-pointer text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Report Copied!' : 'Copy Daily Report'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
