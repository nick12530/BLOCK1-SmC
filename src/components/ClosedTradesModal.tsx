/**
 * ClosedTradesModal.tsx (AuditJournalModal)
 * Minimalist, high-performance Trade & Signal Audit Journal.
 * In full sync with the system:
 * - Records all trades taken (both live RUNNING positions & CLOSED trade history)
 * - Records all signals logged by the engine (both EXECUTED and REJECTED with full reasons)
 * - Clean, non-glowing minimalistic dark mode without neon outlines.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  useClosedTrades,
  useJournalSignals,
  useJournalTrades,
  usePositions,
  useTicker,
} from '../hooks/useTradingStore';
import {
  clearJournalSignals,
  clearJournalTrades,
  clearAllJournal,
  updateTradeClosedInJournal,
} from '../engine/tradeJournal';
import { tradingEngine } from '../engine/tradingEngine';
import { getInstrumentConfig, SupportedSymbol } from '../engine/instrumentConfig';
import {
  History,
  X,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Download,
  Trash2,
  Filter,
  Search,
  Zap,
} from 'lucide-react';
import type { JournalSignalRecord, JournalTradeRecord } from '../types/smc';

interface ClosedTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'trades' | 'signals';
}

export const ClosedTradesModal: React.FC<ClosedTradesModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'trades',
}) => {
  const [activeTab, setActiveTab] = useState<'trades' | 'signals'>(defaultTab);
  const [tradeFilter, setTradeFilter] = useState<'all' | 'running' | 'closed'>('all');
  const [signalFilter, setSignalFilter] = useState<'all' | 'executed' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const ticker = useTicker();
  const closedTrades = useClosedTrades();
  const storedJournalTrades = useJournalTrades();
  const { positions: livePositions } = usePositions();
  const journalSignals = useJournalSignals();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Combine live positions and recorded trades taken into a single deduplicated list with dynamic real-time PnL
  const allTradesTaken = useMemo<JournalTradeRecord[]>(() => {
    const map = new Map<number, JournalTradeRecord>();

    // 1. Add recorded journal trades
    for (const trade of storedJournalTrades) {
      map.set(trade.ticket, { ...trade });
    }

    // 2. Add closed trades and ensure closed status
    for (const trade of closedTrades) {
      const prev = map.get(trade.ticket);
      map.set(trade.ticket, {
        ...prev,
        ...trade,
        status: 'CLOSED',
      });
    }

    // 3. Overlay currently active live positions (mark as RUNNING)
    for (const pos of livePositions) {
      const prev = map.get(pos.ticket);
      map.set(pos.ticket, {
        ticket: pos.ticket,
        openTime: prev?.openTime || pos.time || new Date().toISOString(),
        closeTime: '',
        symbol: pos.symbol,
        type: pos.type,
        volume: pos.volume,
        openPrice: pos.price_open,
        closePrice: pos.price_open,
        sl: pos.sl,
        tp: pos.tp,
        profit: pos.profit,
        pips: pos.pips,
        reason: prev?.reason || 'Manual',
        strategyRationale: prev?.strategyRationale,
        status: 'RUNNING',
      });
    }

    // Dynamic real-time calculation for all RUNNING trades so PnL never stays at 0
    for (const [ticket, trade] of map.entries()) {
      if (trade.status === 'RUNNING') {
        const matchingPos = livePositions.find((p) => p.ticket === ticket || (p.symbol === trade.symbol && p.type === trade.type));
        if (matchingPos) {
          trade.profit = matchingPos.profit;
          trade.pips = matchingPos.pips;
          trade.closePrice = matchingPos.type === 'BUY' ? ticker.bid : ticker.ask;
        } else {
          const sym = (trade.symbol || ticker.symbol || 'XAUUSD') as SupportedSymbol;
          const pairQuote = tradingEngine.pairData[sym];
          const curBid = sym === ticker.symbol ? ticker.bid : (pairQuote?.bid ?? trade.openPrice);
          const curAsk = sym === ticker.symbol ? ticker.ask : (pairQuote?.ask ?? trade.openPrice);
          const curPrice = trade.type === 'BUY' ? curBid : curAsk;
          const cfg = getInstrumentConfig(sym);
          const pts = trade.type === 'BUY' ? curPrice - trade.openPrice : trade.openPrice - curPrice;
          const pips = Number((pts / cfg.pipSize).toFixed(1));
          let profit = 0;
          if (cfg.category === 'metals') {
            profit = Number((pts * trade.volume * cfg.contractSize).toFixed(2));
          } else if (sym === 'USDJPY') {
            profit = Number(((pts * trade.volume * cfg.contractSize) / Math.max(1, curPrice)).toFixed(2));
          } else {
            profit = Number((pts * trade.volume * cfg.contractSize).toFixed(2));
          }
          trade.profit = profit;
          trade.pips = pips;
          trade.closePrice = curPrice;
        }
      }
    }

    // Sort by ticket descending (newest first)
    return Array.from(map.values()).sort((a, b) => b.ticket - a.ticket);
  }, [storedJournalTrades, closedTrades, livePositions, ticker.bid, ticker.ask, ticker.symbol]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return allTradesTaken.filter((trade) => {
      if (tradeFilter === 'running' && trade.status !== 'RUNNING') return false;
      if (tradeFilter === 'closed' && trade.status === 'RUNNING') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSymbol = (trade.symbol || '').toLowerCase().includes(q);
        const matchesTicket = String(trade.ticket).includes(q);
        const matchesType = trade.type.toLowerCase().includes(q);
        const matchesReason = (trade.reason || '').toLowerCase().includes(q);
        if (!matchesSymbol && !matchesTicket && !matchesType && !matchesReason) return false;
      }
      return true;
    });
  }, [allTradesTaken, tradeFilter, searchQuery]);

  // Filtered signals (reversed so newest first)
  const filteredSignals = useMemo(() => {
    const reversed = [...journalSignals].reverse();
    return reversed.filter((sig) => {
      if (signalFilter === 'executed' && sig.status !== 'EXECUTED') return false;
      if (signalFilter === 'rejected' && sig.status !== 'REJECTED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSymbol = sig.symbol.toLowerCase().includes(q);
        const matchesStrat = (sig.strategy || '').toLowerCase().includes(q);
        const matchesReason = (sig.rejectionReason || '').toLowerCase().includes(q);
        const matchesTicket = sig.ticket ? String(sig.ticket).includes(q) : false;
        if (!matchesSymbol && !matchesStrat && !matchesReason && !matchesTicket) return false;
      }
      return true;
    });
  }, [journalSignals, signalFilter, searchQuery]);

  // Metrics
  const totalTradesCount = allTradesTaken.length;
  const runningCount = allTradesTaken.filter((t) => t.status === 'RUNNING').length;
  const closedCount = allTradesTaken.filter((t) => t.status !== 'RUNNING').length;
  const closedOnly = allTradesTaken.filter((t) => t.status !== 'RUNNING');
  const wins = closedOnly.filter((t) => t.profit > 0).length;
  const winRate = closedCount > 0 ? ((wins / closedCount) * 100).toFixed(1) : '0.0';
  const totalNet = Number(closedOnly.reduce((sum, t) => sum + t.profit, 0).toFixed(2));

  const totalSignalsCount = journalSignals.length;
  const executedSignalsCount = journalSignals.filter((s) => s.status === 'EXECUTED').length;
  const rejectedSignalsCount = journalSignals.filter((s) => s.status === 'REJECTED').length;

  const handleExportCSV = () => {
    let csvContent = '';
    if (activeTab === 'trades') {
      csvContent = 'Ticket,Symbol,Type,Volume,OpenPrice,ClosePrice,Profit,Pips,Status,Reason,OpenTime\n';
      for (const t of allTradesTaken) {
        csvContent += `${t.ticket},${t.symbol || ''},${t.type},${t.volume},${t.openPrice},${t.closePrice},${t.profit},${t.pips},${t.status},${t.reason},${t.openTime}\n`;
      }
    } else {
      csvContent = 'ID,Timestamp,Symbol,Direction,Strategy,Timeframe,Score,Entry,SL,TP,Status,Ticket,RejectionReason\n';
      for (const s of journalSignals) {
        csvContent += `"${s.id}","${s.timestamp}","${s.symbol}","${s.direction}","${s.strategy}","${s.timeframe}",${s.score},${s.entry},${s.sl},${s.tp},"${s.status}","${s.ticket || ''}","${(s.rejectionReason || '').replace(/"/g, '""')}"\n`;
      }
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `smc_${activeTab}_journal_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [confirmClear, setConfirmClear] = useState(false);

  const handleCloseRunningTrade = (ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
    const liveTrade = allTradesTaken.find((t) => t.ticket === ticket);
    if (liveTrade) {
      updateTradeClosedInJournal(
        ticket,
        liveTrade.closePrice || liveTrade.openPrice,
        liveTrade.profit,
        liveTrade.pips,
        'Manual'
      );
    }
  };

  const handleCloseAllRunningTrades = () => {
    tradingEngine.closeAll('Manual');
    for (const t of allTradesTaken) {
      if (t.status === 'RUNNING') {
        updateTradeClosedInJournal(
          t.ticket,
          t.closePrice || t.openPrice,
          t.profit,
          t.pips,
          'Manual'
        );
      }
    }
  };

  const handleClearCurrent = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    if (activeTab === 'trades') {
      tradingEngine.clearDailyTradesAndLogs();
    } else {
      clearJournalSignals();
    }
    setConfirmClear(false);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[170] flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-xs font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[88dvh] rounded-2xl bg-white dark:bg-[#111216] border border-slate-200 dark:border-zinc-800 shadow-xl flex flex-col overflow-hidden transition-colors">
        {/* Header: Title, Tabs and Top Close Button */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#16171d] shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <History className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </span>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                System Audit Journal
              </h2>
              <span className="text-[11px] text-zinc-500">
                Synced with real-time trading engine &amp; signal filters
              </span>
            </div>
          </div>

          {/* Mode Switcher: Trades Taken vs Signals Audit */}
          <div className="flex items-center bg-slate-200/80 dark:bg-zinc-900 p-1 rounded-xl border border-slate-300/80 dark:border-zinc-800 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('trades')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'trades'
                  ? 'bg-white text-slate-900 dark:bg-zinc-800 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Trades Taken ({totalTradesCount})</span>
              {runningCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-black">
                  {runningCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'signals'
                  ? 'bg-white text-slate-900 dark:bg-zinc-800 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-sky-500" />
              <span>Signals Audit ({totalSignalsCount})</span>
            </button>
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
          {activeTab === 'trades' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Taken</span>
                <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                  {totalTradesCount} Orders
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Active Running</span>
                <strong className="text-sm sm:text-base font-black text-sky-600 dark:text-sky-400 tabular-nums">
                  {runningCount} Open
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Win Rate (Closed)</span>
                <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                  {winRate}% ({wins}W / {closedCount - wins}L)
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Realized Net P&amp;L</span>
                <strong
                  className={`text-sm sm:text-base font-black tabular-nums ${
                    totalNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)} USD
                </strong>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Processed</span>
                <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                  {totalSignalsCount} Signals
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                  Executed by System
                </span>
                <strong className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {executedSignalsCount}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">
                  Filtered / Rejected
                </span>
                <strong className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {rejectedSignalsCount}
                </strong>
              </div>
            </div>
          )}

          {/* Sub-Filters and Search Toolbar */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeTab === 'trades' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTradeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      tradeFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-white'
                    }`}
                  >
                    All ({totalTradesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeFilter('running')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      tradeFilter === 'running'
                        ? 'bg-slate-900 text-white dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-white'
                    }`}
                  >
                    Running ({runningCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeFilter('closed')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      tradeFilter === 'closed'
                        ? 'bg-slate-900 text-white dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-white'
                    }`}
                  >
                    Closed ({closedCount})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSignalFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      signalFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-white'
                    }`}
                  >
                    All ({totalSignalsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignalFilter('executed')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      signalFilter === 'executed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-white'
                    }`}
                  >
                    Executed ({executedSignalsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignalFilter('rejected')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      signalFilter === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-white'
                    }`}
                  >
                    Rejected ({rejectedSignalsCount})
                  </button>
                </>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative min-w-[180px] sm:min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol, ticket, reason..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-zinc-500 text-xs outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* TAB 1: TRADES TAKEN TABLE */}
          {activeTab === 'trades' && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto max-h-[420px]">
              {filteredTrades.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#0f1217] border-b border-slate-200 dark:border-zinc-800 text-[10px] text-zinc-500 uppercase z-10">
                    <tr>
                      <th className="py-2.5 px-3">Ticket / Time</th>
                      <th className="py-2.5 px-2">Instrument</th>
                      <th className="py-2.5 px-2">Side &amp; Vol</th>
                      <th className="py-2.5 px-2">Execution Prices</th>
                      <th className="py-2.5 px-2">Status / Reason</th>
                      <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {filteredTrades.map((t) => {
                      const isRunning = t.status === 'RUNNING';
                      return (
                        <tr
                          key={`${t.ticket}_${t.openTime}`}
                          className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-zinc-200 block">
                              #{t.ticket}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              {t.openTime ? new Date(t.openTime).toLocaleTimeString() : 'N/A'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-zinc-300">
                            {t.symbol || 'XAUUSD'}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`font-black ${
                                t.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {t.type}
                            </span>{' '}
                            <span className="text-zinc-500">{t.volume}L</span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-700 dark:text-zinc-300 tabular-nums">
                            {(() => {
                              const symCfg = getInstrumentConfig((t.symbol || 'XAUUSD') as SupportedSymbol);
                              const d = symCfg.digits;
                              return isRunning ? (
                                <span>@ ${t.openPrice.toFixed(d)}</span>
                              ) : (
                                <span>
                                  ${t.openPrice.toFixed(d)} → ${t.closePrice.toFixed(d)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-2">
                            {isRunning ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  RUNNING
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCloseRunningTrade(t.ticket)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition-colors cursor-pointer"
                                  title="Close this trade at market"
                                >
                                  Close
                                </button>
                              </div>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                {t.reason || 'Closed'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black tabular-nums">
                            <span
                              className={
                                t.profit >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-zinc-500 block font-normal">
                              {t.pips >= 0 ? '+' : ''}{t.pips.toFixed(1)} pips
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-500 space-y-1">
                  <span className="font-bold text-xs uppercase tracking-wider block">
                    No matching trade records
                  </span>
                  <span className="text-[11px] block">
                    Executed trades and active positions will automatically log here
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SIGNALS AUDIT TABLE */}
          {activeTab === 'signals' && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto max-h-[420px]">
              {filteredSignals.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#0f1217] border-b border-slate-200 dark:border-zinc-800 text-[10px] text-zinc-500 uppercase z-10">
                    <tr>
                      <th className="py-2.5 px-3">Time / Pair</th>
                      <th className="py-2.5 px-2">Setup</th>
                      <th className="py-2.5 px-2">Levels</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 px-3">Audit Outcome / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {filteredSignals.map((sig) => {
                      const isExecuted = sig.status === 'EXECUTED';
                      return (
                        <tr
                          key={sig.id}
                          className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-zinc-200 block">
                              {sig.symbol}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              {new Date(sig.timestamp).toLocaleTimeString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`font-black ${
                                sig.direction === 'BUY' ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {sig.direction}
                            </span>{' '}
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                              {sig.strategy}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              Score: {sig.score} • {sig.timeframe}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 tabular-nums text-slate-700 dark:text-zinc-300 text-[11px]">
                            <div>E: ${sig.entry.toFixed(2)}</div>
                            <div className="text-zinc-500">
                              SL: ${sig.sl.toFixed(2)} | TP: ${sig.tp.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            {isExecuted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                EXECUTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <XCircle className="w-3 h-3 text-rose-500" />
                                REJECTED
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isExecuted ? (
                              <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                                Filled Order #{sig.ticket || 'sim'} ({sig.volume || 0.01}L)
                              </div>
                            ) : (
                              <div className="text-rose-600 dark:text-rose-400 font-medium">
                                {sig.rejectionReason || 'Filtered by risk guardian'}
                              </div>
                            )}
                            {sig.rationale && (
                              <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                                {sig.rationale}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-500 space-y-1">
                  <span className="font-bold text-xs uppercase tracking-wider block">
                    No matching signal records
                  </span>
                  <span className="text-[11px] block">
                    All processed signals (executed and rejected) will be recorded here
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Bottom Controls and Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-[#16171d] flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-200/80 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Terminal</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-200/80 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Download Journal data as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'trades' && runningCount > 0 && (
              <button
                onClick={handleCloseAllRunningTrades}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                title="Close and reconcile all running positions"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Close All ({runningCount})</span>
              </button>
            )}

            <button
              onClick={handleClearCurrent}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                confirmClear
                  ? 'bg-rose-600 text-white border border-rose-500'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20'
              }`}
              title="Clear journal history for current view"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{confirmClear ? 'Confirm Clear?' : `Clear ${activeTab === 'trades' ? 'Trades' : 'Signals'}`}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AuditJournalModal = ClosedTradesModal;
