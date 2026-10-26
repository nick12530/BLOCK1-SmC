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
  Clock,
  Target,
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
  tp1?: number;
  tp2?: number;
  tp3?: number;
  stopPips: number;
  targetPips1?: number;
  targetPips2?: number;
  targetPips3?: number;
  targetPips: number;
  riskUsd: number;
  rewardUsd: number;
  rrRatio: string;
  confluenceScore: number;
  quality: 'PRIME' | 'STRONG' | 'MODERATE';
  timestamp: string;
  expiryTimestamp?: number;
  isSniper?: boolean;
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
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 1-second interval to update live countdown timer and auto-expire passed signals
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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

        const stopPips = analysis.slPips || cfg.recommendedStopPips || 15;
        const targetPips = analysis.targetPips2 || analysis.targetPips || cfg.minTakeProfitPips || 30;
        const targetPips1 = analysis.targetPips1 || Math.round(stopPips * 1.8);
        const targetPips2 = targetPips;
        const targetPips3 = analysis.targetPips3 || Math.round(stopPips * 5.5);

        const stopDistance = stopPips * pipSize;
        const sl = analysis.suggestedSL > 0
          ? analysis.suggestedSL
          : Number((dir === 'BUY' ? entry - stopDistance : entry + stopDistance).toFixed(cfg.digits));
        const tp = analysis.suggestedTP > 0
          ? analysis.suggestedTP
          : Number((dir === 'BUY' ? entry + targetPips * pipSize : entry - targetPips * pipSize).toFixed(cfg.digits));
        const tp1 = analysis.suggestedTP1 || Number((dir === 'BUY' ? entry + targetPips1 * pipSize : entry - targetPips1 * pipSize).toFixed(cfg.digits));
        const tp2 = analysis.suggestedTP2 || tp;
        const tp3 = analysis.suggestedTP3 || Number((dir === 'BUY' ? entry + targetPips3 * pipSize : entry - targetPips3 * pipSize).toFixed(cfg.digits));

        const riskUsd = Number((stopPips * pipVal).toFixed(2));
        const rewardUsd = Number((targetPips * pipVal).toFixed(2));
        const score = analysis.confluenceScore || 70;
        const strategyName = analysis.signal?.strategy || (dir === 'BUY' ? 'Institutional Discount Entry' : 'Institutional Premium Entry');

        const expiryMs = analysis.expiryTimestamp || (Date.now() + (analysis.signal?.timeframe === 'M15' ? 15 * 60_000 : 5 * 60_000));

        list.push({
          id: `${symbol}-${dir}-${strategyName}`,
          symbol,
          direction: dir,
          strategy: strategyName,
          timeframe: analysis.signal?.timeframe || 'M5',
          entry,
          sl,
          tp,
          tp1,
          tp2,
          tp3,
          stopPips,
          targetPips1,
          targetPips2,
          targetPips3,
          targetPips,
          riskUsd,
          rewardUsd,
          rrRatio: (targetPips / stopPips).toFixed(1),
          confluenceScore: score,
          quality: score >= 80 ? 'PRIME' : score >= 70 ? 'STRONG' : 'MODERATE',
          timestamp: new Date().toISOString(),
          expiryTimestamp: expiryMs,
          isSniper: analysis.isSniper || score >= 75,
        });
      }
    });

    // Also include active symbol signal if present
    if (market.signal) {
      const sig = market.signal;
      const sym = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
      const cfg = getInstrumentConfig(sym);
      const stopDist = Math.abs(sig.entry - sig.sl);
      const targetDist = Math.abs(sig.tp - sig.entry);
      const stopPips = sig.slPips || Number((stopDist / cfg.pipSize).toFixed(1));
      const targetPips = sig.targetPips2 || sig.targetPips || Number((targetDist / cfg.pipSize).toFixed(1));
      const targetPips1 = sig.targetPips1 || Math.round(stopPips * 1.8);
      const targetPips2 = targetPips;
      const targetPips3 = sig.targetPips3 || Math.round(stopPips * 5.5);

      const riskUsd = Number((stopPips * cfg.pipValuePerMicroLot).toFixed(2));
      const rewardUsd = Number((targetPips * cfg.pipValuePerMicroLot).toFixed(2));
      const score = sig.score <= 10 ? Math.round(sig.score * 10) : sig.score;
      const expiryMs = sig.expiryTimestamp || (new Date(sig.timestamp).getTime() + (sig.timeframe === 'M15' ? 15 * 60_000 : 5 * 60_000));

      const exists = list.some((item) => item.symbol === sym && item.direction === sig.direction);
      if (!exists) {
        list.unshift({
          id: `active-${sym}-${sig.direction}`,
          symbol: sym,
          direction: sig.direction,
          strategy: sig.strategy || 'SMC POI Retest',
          timeframe: sig.timeframe || 'M5',
          entry: sig.entry,
          sl: sig.sl,
          tp: sig.tp,
          tp1: sig.tp1,
          tp2: sig.tp2,
          tp3: sig.tp3,
          stopPips,
          targetPips1,
          targetPips2,
          targetPips3,
          targetPips,
          riskUsd,
          rewardUsd,
          rrRatio: stopDist > 0 ? (targetDist / stopDist).toFixed(1) : '3.2',
          confluenceScore: score,
          quality: score >= 80 ? 'PRIME' : score >= 70 ? 'STRONG' : 'MODERATE',
          timestamp: new Date().toISOString(),
          expiryTimestamp: expiryMs,
          isSniper: sig.isSniper || score >= 75,
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
        const cleanRationale = `${signal.strategy.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 16)} ${signal.confluenceScore}pct`;
        const result = await mt5Bridge.sendTrade({
          direction: signal.direction,
          volume: 0.01,
          symbol: signal.symbol,
          sl: signal.sl,
          tp: signal.tp,
          rationale: cleanRationale,
          clientOrderId: `${signal.strategy.replace(/[^a-zA-Z0-9]/g, '')}:${signal.direction}:${Date.now()}`,
          poiKey: tradingEngine.getSignalPoiKey(signal.direction, signal.entry),
          instrumentType: tradingEngine.instrumentType,
          signalTimeframe: signal.timeframe === 'M1' ? 'M1' : signal.timeframe === 'M15' ? 'M15' : 'M5',
          signalTimestamp: new Date().toISOString(),
          magic: cfg.magicNumber,
        });

        tradingEngine.recordMt5Rationale(
          result.ticket,
          result.positionTicket,
          cleanRationale
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
          cleanRationale
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
          strategyRationale: cleanRationale,
          status: 'RUNNING',
        });
        signalAudioNotifier.playTradeExecutionAlert(signal.direction);

        setFeedback({
          id: signal.id,
          msg: `RUNNING: MT5 Order #${result.ticket} · ${signal.direction} 0.01L ${signal.symbol} @ ${result.price}`,
          type: 'success',
        });
        tradingEngine.slog(`MT5 order executed: #${result.ticket} ${signal.direction} 0.01L ${signal.symbol} @ ${result.price}`, 'trade');
        if (onExecuteTrade) {
          onExecuteTrade(signal.symbol, signal.direction, signal.sl, signal.tp, signal.strategy);
        }
      } else {
        const res = tradingEngine.sendMarket(
          signal.direction,
          0.01,
          signal.sl,
          signal.tp,
          `sniper:${signal.timeframe}:${signal.confluenceScore}`,
          signal.symbol
        );

        if (res.ok) {
          signalAudioNotifier.playTradeExecutionAlert(signal.direction);
          setFeedback({
            id: signal.id,
            msg: `RUNNING: Order #${res.ticket || 'sim'} · ${signal.direction} 0.01L ${signal.symbol} @ ${res.price?.toFixed(cfg.digits)}`,
            type: 'success',
          });
          tradingEngine.slog(`Order placed: ${signal.direction} 0.01L ${signal.symbol} @ ${res.price?.toFixed(cfg.digits)}`, 'trade');
          if (onExecuteTrade) {
            onExecuteTrade(signal.symbol, signal.direction, signal.sl, signal.tp, signal.strategy);
          }
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
      tradingEngine.slog(`MT5 signal execution failed for ${signal.symbol}: ${errorMsg}`, 'warn');
      setFeedback({
        id: signal.id,
        msg: `MT5 ORDER REJECTED: ${errorMsg}`,
        type: 'error',
      });
    } finally {
      setExecutingId(null);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredSignals = (
    activeFilter === 'ALL'
      ? signalsQueue
      : signalsQueue.filter((s) => s.symbol === activeFilter)
  ).filter((s) => !s.expiryTimestamp || s.expiryTimestamp > currentTime);

  return (
    <div className="w-full bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xs font-mono text-xs flex flex-col gap-4">
      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs sm:text-sm font-sans">
              Live Signals Queue
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-sans">
              Verified institutional setups with multi-target objectives &amp; 1-click execution
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800">
          {['ALL', ...SUPPORTED_SYMBOLS].map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => setActiveFilter(sym)}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                activeFilter === sym
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {sym === 'XAUUSD' ? 'GOLD' : sym.replace('USD', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
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
      <div className="space-y-3">
        {filteredSignals.length > 0 ? (
          filteredSignals.map((sig) => {
            const isBuy = sig.direction === 'BUY';
            const isExecuting = executingId === sig.id;
            const cfg = getInstrumentConfig(sig.symbol);

            const tpVal = sig.tp2 ?? sig.tp;
            const tpPips = sig.targetPips2 ?? sig.targetPips;

            const secondsRemaining = sig.expiryTimestamp
              ? Math.max(0, Math.floor((sig.expiryTimestamp - currentTime) / 1000))
              : 0;

            return (
              <div
                key={sig.id}
                className="bg-slate-50/70 dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 transition-colors hover:border-slate-300 dark:hover:border-zinc-700"
              >
                {/* Row 1: Header - Pair, Direction, Strategy, Confluence & Validity Timer */}
                <div className="flex items-center justify-between gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-black text-slate-900 dark:text-white text-base tracking-tight font-sans">
                      {sig.symbol}
                    </span>

                    <span
                      className={`font-black text-xs uppercase flex items-center gap-1 ${
                        isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isBuy ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span>{sig.direction}</span>
                    </span>

                    <span className="text-slate-300 dark:text-zinc-700">·</span>

                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      {sig.strategy} ({sig.timeframe})
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      {sig.confluenceScore}/100 Confluence
                    </span>

                    {secondsRemaining > 0 && (
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatCountdown(secondsRemaining)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Clean Linear Data Grid (Entry, SL, TP, Action) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase font-medium">
                      Entry Price
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm tabular-nums">
                      ${sig.entry.toFixed(cfg.digits)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rose-500 block uppercase font-medium">
                      Stop Loss
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                        ${sig.sl.toFixed(cfg.digits)}
                      </span>
                      <span className="text-[10px] text-rose-500/80">(-{sig.stopPips}p)</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-500 block uppercase font-medium">
                      Take Profit
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                        ${tpVal.toFixed(cfg.digits)}
                      </span>
                      <span className="text-[10px] text-emerald-500/80">(+{tpPips}p · {sig.rrRatio}R)</span>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      disabled={isExecuting}
                      onClick={() => handleExecute(sig)}
                      className={`w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                        isBuy ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
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
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl space-y-1.5">
            <Sparkles className="w-5 h-5 text-slate-400 mx-auto" />
            <div className="font-bold text-slate-700 dark:text-slate-300">
              Scanning Market for Qualified SMC Setups...
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-md mx-auto font-sans">
              Monitoring USDJPY, XAUUSD, EURUSD, and GBPUSD for order block tapping and liquidity sweeps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
