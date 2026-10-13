import React, { useState, useEffect } from 'react';
import { useTicker, useMarket, usePositions, useScannerAnalyses } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import type { PairAnalysis } from '../engine/multiPairScanner';
import { getInstrumentConfig, SUPPORTED_SYMBOLS, SupportedSymbol } from '../engine/instrumentConfig';
import { mt5Bridge } from '../engine/mt5Bridge';
import { signalAudioNotifier } from '../utils/audioNotification';
import { recordTradeTaken } from '../engine/tradeJournal';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Play,
} from 'lucide-react';

interface LiveSignalsStreamProps {
  onExecuteTrade?: (symbol: SupportedSymbol, direction: 'BUY' | 'SELL', sl: number, tp: number, rationale: string) => void;
}

interface QueuedSignal {
  id: string;
  symbol: SupportedSymbol;
  direction: 'BUY' | 'SELL';
  strategy: string;
  timeframe: string;
  entry: number;
  sl: number;
  tp: number;
  stopPips: number;
  targetPips: number;
  riskUsd: number;
  rewardUsd: number;
  rrRatio: string;
  confluenceScore: number;
  quality: 'PRIME' | 'STRONG' | 'MODERATE';
  timestamp: string;
}

export const LiveSignalsStream: React.FC<LiveSignalsStreamProps> = ({ onExecuteTrade }) => {
  const ticker = useTicker();
  const market = useMarket();
  const { positions } = usePositions();
  const scannerAnalyses = useScannerAnalyses();
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);
  const [signalsQueue, setSignalsQueue] = useState<QueuedSignal[]>([]);

  // Update signals queue from multi-pair analyses and active market signal
  useEffect(() => {
    const list: QueuedSignal[] = [];

    scannerAnalyses.forEach((analysis: PairAnalysis) => {
      const symbol = analysis.symbol;
      const cfg = getInstrumentConfig(symbol);

      if (analysis.bias === 'BUY' || analysis.bias === 'SELL') {
        const dir = analysis.bias;
        const entry = analysis.entryPrice || analysis.price;
        const pipSize = cfg.pipSize;
        const pipVal = cfg.pipValuePerMicroLot;

        const stopPips = cfg.recommendedStopPips || 15;
        const targetPips = cfg.minTakeProfitPips || 30;
        const stopDistance = stopPips * pipSize;
        const targetDistance = targetPips * pipSize;

        const sl = analysis.suggestedSL > 0
          ? analysis.suggestedSL
          : Number((dir === 'BUY' ? entry - stopDistance : entry + stopDistance).toFixed(cfg.digits));
        const tp = analysis.suggestedTP > 0
          ? analysis.suggestedTP
          : Number((dir === 'BUY' ? entry + targetDistance : entry - targetDistance).toFixed(cfg.digits));

        const riskUsd = Number((stopPips * pipVal).toFixed(2));
        const rewardUsd = Number((targetPips * pipVal).toFixed(2));
        const score = analysis.confluenceScore || 70;
        const strategyName = analysis.signal?.strategy || (dir === 'BUY' ? 'Institutional Discount Entry' : 'Institutional Premium Entry');

        list.push({
          id: `${symbol}-${dir}-${strategyName}`,
          symbol,
          direction: dir,
          strategy: strategyName,
          timeframe: analysis.signal?.timeframe || 'M5',
          entry,
          sl,
          tp,
          stopPips,
          targetPips,
          riskUsd,
          rewardUsd,
          rrRatio: (targetPips / stopPips).toFixed(1),
          confluenceScore: score,
          quality: score >= 80 ? 'PRIME' : score >= 70 ? 'STRONG' : 'MODERATE',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Also include active symbol signal if present
    if (market.signal) {
      const sig = market.signal;
      const sym = (ticker.symbol || 'USDJPY') as SupportedSymbol;
      const cfg = getInstrumentConfig(sym);
      const stopDist = Math.abs(sig.entry - sig.sl);
      const targetDist = Math.abs(sig.tp - sig.entry);
      const stopPips = Number((stopDist / cfg.pipSize).toFixed(1));
      const targetPips = Number((targetDist / cfg.pipSize).toFixed(1));
      const riskUsd = Number((stopPips * cfg.pipValuePerMicroLot).toFixed(2));
      const rewardUsd = Number((targetPips * cfg.pipValuePerMicroLot).toFixed(2));
      const score = sig.score <= 10 ? Math.round(sig.score * 10) : sig.score;

      const exists = list.some((item) => item.symbol === sym && item.direction === sig.direction);
      if (!exists) {
        list.unshift({
          id: `active-${sym}-${sig.direction}`,
          symbol: sym,
          direction: sig.direction,
          strategy: sig.strategy || 'SMC Liquidity Setup',
          timeframe: sig.timeframe || 'M1',
          entry: sig.entry,
          sl: sig.sl,
          tp: sig.tp,
          stopPips,
          targetPips,
          riskUsd,
          rewardUsd,
          rrRatio: stopDist > 0 ? (targetDist / stopDist).toFixed(1) : '2.0',
          confluenceScore: score,
          quality: score >= 80 ? 'PRIME' : score >= 70 ? 'STRONG' : 'MODERATE',
          timestamp: new Date().toISOString(),
        });
      }
    }

    setSignalsQueue(list);
  }, [scannerAnalyses, market.signal, ticker.symbol]);

  const handleExecute = async (signal: QueuedSignal) => {
    setExecutingId(signal.id);
    const cfg = getInstrumentConfig(signal.symbol);

    // Switch active symbol to this pair
    if (signal.symbol !== ticker.symbol) {
      tradingEngine.switchSymbol(signal.symbol);
    }

    try {
      if (tradingEngine.mt5Account.connected && mt5Bridge.getStatus().connected) {
        mt5Bridge.setSymbol(signal.symbol);
        const result = await mt5Bridge.sendTrade({
          direction: signal.direction,
          volume: 0.01,
          symbol: signal.symbol,
          sl: signal.sl,
          tp: signal.tp,
          rationale: `${signal.strategy} (${signal.confluenceScore}% score)`,
          clientOrderId: `${signal.strategy}:${signal.timeframe}:${signal.direction}:${Date.now()}:${signal.entry.toFixed(cfg.digits)}`,
          poiKey: tradingEngine.getSignalPoiKey(signal.direction, signal.entry),
          instrumentType: tradingEngine.instrumentType,
          signalTimeframe: signal.timeframe === 'M1' ? 'M1' : 'M5',
          signalTimestamp: new Date().toISOString(),
          magic: cfg.magicNumber,
        });

        tradingEngine.recordMt5Rationale(
          result.ticket,
          result.positionTicket,
          `${signal.strategy} (${signal.confluenceScore}% score)`
        );
        tradingEngine.recordAcceptedEntry(signal.direction);
        tradingEngine.recordExecutedSignal(
          {
            direction: signal.direction,
            entry: signal.entry,
            sl: signal.sl,
            tp: signal.tp,
            score: signal.confluenceScore <= 10 ? signal.confluenceScore : Number((signal.confluenceScore / 10).toFixed(1)),
            strategy: signal.strategy as any,
            timeframe: signal.timeframe as any,
            reasons: [],
            atr: 0.1,
            timestamp: new Date().toISOString(),
          },
          result.ticket,
          0.01,
          signal.symbol,
          `${signal.strategy} (${signal.confluenceScore}% score)`
        );
        recordTradeTaken({
          ticket: result.ticket,
          symbol: signal.symbol,
          type: signal.direction,
          volume: 0.01,
          openPrice: result.price,
          closePrice: result.price,
          openTime: new Date().toISOString(),
          sl: signal.sl,
          tp: signal.tp,
          profit: 0,
          pips: 0,
          reason: 'Manual',
          strategyRationale: `${signal.strategy} (${signal.confluenceScore}% score)`,
          status: 'RUNNING',
        });
        signalAudioNotifier.playTradeExecutionAlert(signal.direction);

        setFeedback({
          id: signal.id,
          msg: `RUNNING: MT5 Order #${result.ticket} · ${signal.direction} 0.01L ${signal.symbol} @ ${result.price}`,
          type: 'success',
        });
        tradingEngine.slog(`MT5 order executed: #${result.ticket} ${signal.direction} 0.01L ${signal.symbol} @ ${result.price}`, 'trade');
      } else {
        const res = tradingEngine.sendMarket(
          signal.direction,
          0.01,
          signal.sl,
          signal.tp,
          `smc:${signal.strategy}`
        );

        if (res.ok) {
          signalAudioNotifier.playTradeExecutionAlert(signal.direction);
          setFeedback({
            id: signal.id,
            msg: `RUNNING: Order #${res.ticket || 'sim'} · ${signal.direction} 0.01L ${signal.symbol} @ ${res.price?.toFixed(cfg.digits)}`,
            type: 'success',
          });
          tradingEngine.slog(`Order placed: ${signal.direction} 0.01L ${signal.symbol} @ ${res.price?.toFixed(cfg.digits)}`, 'trade');
        } else {
          tradingEngine.recordRejectedSignal(
            {
              direction: signal.direction,
              entry: signal.entry,
              sl: signal.sl,
              tp: signal.tp,
              score: signal.confluenceScore <= 10 ? signal.confluenceScore : Number((signal.confluenceScore / 10).toFixed(1)),
              strategy: signal.strategy as any,
              timeframe: signal.timeframe as any,
              reasons: [],
              atr: 0.1,
              timestamp: new Date().toISOString(),
            },
            res.error || 'Execution rejected by risk engine',
            signal.symbol
          );
          setFeedback({
            id: signal.id,
            msg: `BLOCKED: ${res.error || 'Execution rejected by risk engine'}`,
            type: 'error',
          });
        }
      }

      if (onExecuteTrade) {
        onExecuteTrade(signal.symbol, signal.direction, signal.sl, signal.tp, signal.strategy);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Bridge execution error';
      tradingEngine.recordRejectedSignal(
        {
          direction: signal.direction,
          entry: signal.entry,
          sl: signal.sl,
          tp: signal.tp,
          score: signal.confluenceScore <= 10 ? signal.confluenceScore : Number((signal.confluenceScore / 10).toFixed(1)),
          strategy: signal.strategy as any,
          timeframe: signal.timeframe as any,
          reasons: [],
          atr: 0.1,
          timestamp: new Date().toISOString(),
        },
        errorMsg,
        signal.symbol
      );
      setFeedback({
        id: signal.id,
        msg: `FAILED: ${errorMsg}`,
        type: 'error',
      });
    } finally {
      setExecutingId(null);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const filteredSignals = activeFilter === 'ALL'
    ? signalsQueue
    : signalsQueue.filter((s) => s.symbol === activeFilter);

  return (
    <div className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-zinc-800/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs font-mono text-xs flex flex-col gap-3">
      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h3 className="font-bold text-slate-950 dark:text-white uppercase tracking-wider text-xs sm:text-sm">
              Live Signals Execution Queue
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Institutional setups lined up across 4 pairs • 1-Click instant execution (0.01L)
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          {['ALL', ...SUPPORTED_SYMBOLS].map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => setActiveFilter(sym)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                activeFilter === sym
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="font-bold">{feedback.msg}</span>
        </div>
      )}

      {/* Signals Queue List */}
      <div className="space-y-2.5">
        {filteredSignals.length > 0 ? (
          filteredSignals.map((sig) => {
            const isBuy = sig.direction === 'BUY';
            const isExecuting = executingId === sig.id;
            const cfg = getInstrumentConfig(sig.symbol);

            // Check if there is already an open position on this pair
            const hasOpenTradeOnSymbol = positions.some(
              (p) => (p.symbol || ticker.symbol) === sig.symbol
            );

            return (
              <div
                key={sig.id}
                className="bg-slate-50 dark:bg-[#12161f] border border-slate-200 dark:border-zinc-800/80 rounded-xl p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:border-slate-300 dark:hover:border-zinc-700"
              >
                {/* Column 1: Symbol, Direction, Strategy, Score */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {sig.symbol}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black flex items-center gap-1 ${
                      isBuy
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isBuy ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{sig.direction}</span>
                  </span>

                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                    {sig.strategy}
                  </span>

                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                      sig.quality === 'PRIME'
                        ? 'bg-amber-500/20 text-amber-500'
                        : sig.quality === 'STRONG'
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {sig.confluenceScore}% {sig.quality}
                  </span>

                  {hasOpenTradeOnSymbol && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-bold">
                      ACTIVE TRADE IN BASKET
                    </span>
                  )}
                </div>

                {/* Column 2: Price Metrics (Entry, SL, TP, Risk/Reward) */}
                <div className="flex items-center gap-3 text-[11px] flex-wrap font-mono">
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">Entry Spot</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {sig.entry.toFixed(cfg.digits)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase text-rose-500 block">
                      SL ({sig.stopPips}p)
                    </span>
                    <span className="font-bold text-rose-500">
                      {sig.sl.toFixed(cfg.digits)}
                    </span>
                    <span className="text-[9px] text-slate-400 block">-${sig.riskUsd}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase text-emerald-500 block">
                      TP ({sig.targetPips}p)
                    </span>
                    <span className="font-bold text-emerald-500">
                      {sig.tp.toFixed(cfg.digits)}
                    </span>
                    <span className="text-[9px] text-slate-400 block">+${sig.rewardUsd}</span>
                  </div>

                  <div className="hidden sm:block">
                    <span className="text-[9px] uppercase text-slate-400 block">R:R Ratio</span>
                    <span className="font-bold text-sky-400">1:{sig.rrRatio}</span>
                  </div>
                </div>

                {/* Column 3: Execute Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isExecuting}
                    onClick={() => handleExecute(sig)}
                    className={`w-full sm:w-auto px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      isBuy
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-rose-600 hover:bg-rose-500'
                    }`}
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>Execute {sig.direction}</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
            <Sparkles className="w-5 h-5 text-slate-400 mx-auto animate-pulse" />
            <div className="font-bold text-slate-700 dark:text-slate-300">
              Scanning 4 Pairs for Qualified Setups...
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto font-sans">
              USDJPY, XAUUSD, EURUSD, and GBPUSD are being continuously analyzed for liquidity sweeps and order block structure. Signals will appear here as soon as criteria align.
            </p>
          </div>
        )}
      </div>

      {/* Instant 1-Click Execution Strip for all 4 pairs */}
      <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5 flex items-center justify-between">
          <span>Quick Manual Market Order (0.01 Micro Lot)</span>
          <span className="text-slate-500">Auto-Calculated Safe Stops</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SUPPORTED_SYMBOLS.map((sym) => {
            const cfg = getInstrumentConfig(sym);
            const isSelected = sym === ticker.symbol;
            return (
              <div
                key={sym}
                className={`p-2 rounded-xl border flex items-center justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                }`}
              >
                <div className="font-black text-xs text-slate-900 dark:text-white">
                  {sym}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      tradingEngine.switchSymbol(sym);
                      const price = ticker.ask;
                      const sl = Number((price - (cfg.recommendedStopPips * cfg.pipSize)).toFixed(cfg.digits));
                      const tp = Number((price + (cfg.minTakeProfitPips * cfg.pipSize)).toFixed(cfg.digits));
                      if (tradingEngine.mt5Account.connected && mt5Bridge.getStatus().connected) {
                        try {
                          mt5Bridge.setSymbol(sym);
                          const result = await mt5Bridge.sendTrade({
                            direction: 'BUY',
                            volume: 0.01,
                            symbol: sym,
                            sl,
                            tp,
                            rationale: 'Quick 1-Click Manual Market Order',
                            clientOrderId: `manual:BUY:${Date.now()}:${price.toFixed(cfg.digits)}`,
                            poiKey: '',
                            instrumentType: tradingEngine.instrumentType,
                            signalTimeframe: 'M1',
                            signalTimestamp: new Date().toISOString(),
                            magic: cfg.magicNumber,
                          });
                          tradingEngine.recordMt5Rationale(result.ticket, result.positionTicket, 'Quick 1-Click Buy');
                          tradingEngine.recordAcceptedEntry('BUY');
                          recordTradeTaken({
                            ticket: result.ticket,
                            symbol: sym,
                            type: 'BUY',
                            volume: 0.01,
                            openPrice: result.price,
                            closePrice: result.price,
                            openTime: new Date().toISOString(),
                            sl,
                            tp,
                            profit: 0,
                            pips: 0,
                            reason: 'Manual',
                            strategyRationale: 'Quick 1-Click Buy',
                            status: 'RUNNING',
                          });
                          signalAudioNotifier.playTradeExecutionAlert('BUY');
                          setFeedback({
                            id: `quick-${sym}-BUY`,
                            msg: `RUNNING: MT5 Order #${result.ticket} · BUY 0.01L ${sym} @ ${result.price}`,
                            type: 'success',
                          });
                        } catch (e) {
                          setFeedback({
                            id: `quick-${sym}-BUY`,
                            msg: `FAILED: ${e instanceof Error ? e.message : 'Bridge error'}`,
                            type: 'error',
                          });
                        }
                      } else {
                        const res = tradingEngine.sendMarket('BUY', 0.01, sl, tp, 'manual:quick_buy');
                        if (res.ok) {
                          signalAudioNotifier.playTradeExecutionAlert('BUY');
                          setFeedback({
                            id: `quick-${sym}-BUY`,
                            msg: `RUNNING: Order #${res.ticket || 'sim'} · BUY 0.01L ${sym} @ ${res.price?.toFixed(cfg.digits)}`,
                            type: 'success',
                          });
                        }
                      }
                      setTimeout(() => setFeedback(null), 5000);
                    }}
                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      tradingEngine.switchSymbol(sym);
                      const price = ticker.bid;
                      const sl = Number((price + (cfg.recommendedStopPips * cfg.pipSize)).toFixed(cfg.digits));
                      const tp = Number((price - (cfg.minTakeProfitPips * cfg.pipSize)).toFixed(cfg.digits));
                      if (tradingEngine.mt5Account.connected && mt5Bridge.getStatus().connected) {
                        try {
                          mt5Bridge.setSymbol(sym);
                          const result = await mt5Bridge.sendTrade({
                            direction: 'SELL',
                            volume: 0.01,
                            symbol: sym,
                            sl,
                            tp,
                            rationale: 'Quick 1-Click Manual Market Order',
                            clientOrderId: `manual:SELL:${Date.now()}:${price.toFixed(cfg.digits)}`,
                            poiKey: '',
                            instrumentType: tradingEngine.instrumentType,
                            signalTimeframe: 'M1',
                            signalTimestamp: new Date().toISOString(),
                            magic: cfg.magicNumber,
                          });
                          tradingEngine.recordMt5Rationale(result.ticket, result.positionTicket, 'Quick 1-Click Sell');
                          tradingEngine.recordAcceptedEntry('SELL');
                          recordTradeTaken({
                            ticket: result.ticket,
                            symbol: sym,
                            type: 'SELL',
                            volume: 0.01,
                            openPrice: result.price,
                            closePrice: result.price,
                            openTime: new Date().toISOString(),
                            sl,
                            tp,
                            profit: 0,
                            pips: 0,
                            reason: 'Manual',
                            strategyRationale: 'Quick 1-Click Sell',
                            status: 'RUNNING',
                          });
                          signalAudioNotifier.playTradeExecutionAlert('SELL');
                          setFeedback({
                            id: `quick-${sym}-SELL`,
                            msg: `RUNNING: MT5 Order #${result.ticket} · SELL 0.01L ${sym} @ ${result.price}`,
                            type: 'success',
                          });
                        } catch (e) {
                          setFeedback({
                            id: `quick-${sym}-SELL`,
                            msg: `FAILED: ${e instanceof Error ? e.message : 'Bridge error'}`,
                            type: 'error',
                          });
                        }
                      } else {
                        const res = tradingEngine.sendMarket('SELL', 0.01, sl, tp, 'manual:quick_sell');
                        if (res.ok) {
                          signalAudioNotifier.playTradeExecutionAlert('SELL');
                          setFeedback({
                            id: `quick-${sym}-SELL`,
                            msg: `RUNNING: Order #${res.ticket || 'sim'} · SELL 0.01L ${sym} @ ${res.price?.toFixed(cfg.digits)}`,
                            type: 'success',
                          });
                        }
                      }
                      setTimeout(() => setFeedback(null), 5000);
                    }}
                    className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                  >
                    SELL
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
